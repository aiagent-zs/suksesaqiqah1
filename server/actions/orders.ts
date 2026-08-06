'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  addAnimalSchema,
  changeStatusSchema,
  createOrderSchema,
  deleteAnimalSchema,
  updateAnimalStatusSchema,
  updateOrderSchema,
} from '@/features/orders/schema';
import { checkTransition } from '@/features/orders/state-machine';
import { checkAnimalTransition } from '@/features/orders/animal-state-machine';
import { getOrderDetail } from '@/features/orders/queries';
import type { OrderStatus } from '@/lib/constants/order';

/** Bentuk respons seragam mengikuti format error docs/16 section 1. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code:
          | 'UNAUTHENTICATED'
          | 'FORBIDDEN'
          | 'NOT_FOUND'
          | 'VALIDATION_ERROR'
          | 'CONFLICT'
          | 'INTERNAL';
        message: string;
        fields?: Record<string, string>;
      };
    };

function validationError(error: z.ZodError): ActionResult<never> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return {
    ok: false,
    error: { code: 'VALIDATION_ERROR', message: 'Data yang dikirim belum valid.', fields },
  };
}

/**
 * Kegagalan tak terduga dari Postgres/PostgREST.
 * Detail teknisnya masuk log server, bukan ke layar operator — pesan mentah
 * Postgres membocorkan nama tabel, kolom, dan kebijakan RLS.
 */
function internalError(context: string, error: { message: string; code?: string }): ActionResult<never> {
  console.error(`[orders] ${context}:`, error.code ?? '-', error.message);
  return {
    ok: false,
    error: { code: 'INTERNAL', message: `${context}. Coba lagi atau hubungi administrator.` },
  };
}

// =============================================================================
// Create
// =============================================================================

export async function createOrder(input: unknown): Promise<ActionResult<{ id: string; order_number: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!role || !['manager_program', 'admin_cabang'].includes(role)) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Hanya Admin Cabang atau Manager Program yang dapat membuat order.' },
    };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const payload = parsed.data;

  // Defense in depth: RLS sudah menolak lintas cabang, tapi pesan errornya
  // tidak informatif bagi operator.
  if (role === 'admin_cabang' && session.profile?.branch_id !== payload.branch_id) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Anda hanya dapat membuat order untuk cabang sendiri.' },
    };
  }

  const supabase = await createClient();

  // Harga satuan tidak dipercaya dari klien. Katalog `services` adalah satu-
  // satunya sumber harga: layanan wajib aktif, dan `unit_price` yang dikirim
  // form ditimpa harga katalog sebelum masuk RPC. Tanpa ini, siapapun yang bisa
  // membuat order dapat menetapkan harga sendiri — dan karena payment gate
  // membandingkan paid_amount terhadap total_amount, harga palsu ikut
  // melumpuhkan gate DP.
  const serviceIds = [...new Set(payload.items.map((i) => i.service_id))];
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id, price')
    .in('id', serviceIds)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (servicesError) return internalError('Gagal memuat data layanan', servicesError);

  const priceByService = new Map((services ?? []).map((s) => [s.id, Number(s.price)]));

  if (priceByService.size !== serviceIds.length) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Ada layanan yang tidak aktif atau tidak ditemukan.' },
    };
  }

  const pricedPayload = {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      unit_price: priceByService.get(item.service_id)!,
    })),
  };

  const { data, error } = await supabase.rpc('create_order', {
    p_payload: pricedPayload as never,
  });

  if (error) return internalError('Gagal membuat order', error);

  const result = data as unknown as { id: string; order_number: string };
  revalidatePath('/orders');
  return { ok: true, data: { id: result.id, order_number: result.order_number } };
}

// =============================================================================
// Update data order (bukan status)
// =============================================================================

export async function updateOrder(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'UPDATE_ORDER')) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah data order.' } };
  }

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, ...changes } = parsed.data;

  if (changes.total_amount !== undefined && !canDo(role, 'UPDATE_ORDER_AMOUNT')) {
    return {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Hanya Manager Program yang dapat mengubah nilai order.',
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .update({
      notes: changes.notes || null,
      ...(changes.total_amount !== undefined ? { total_amount: changes.total_amount } : {}),
    })
    .eq('id', order_id)
    .select('id');

  if (error) return internalError('Gagal menyimpan perubahan order', error);

  // UPDATE yang tidak mengenai baris apapun bukan error di PostgREST — tanpa cek
  // ini, penolakan RLS terlihat sebagai sukses di UI.
  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Order tidak ditemukan atau di luar akses Anda.' },
    };
  }

  revalidatePath(`/orders/${order_id}`);
  return { ok: true, data: null };
}

// =============================================================================
// Transisi status — satu-satunya jalan mengubah orders.status (docs/16 section 12)
// =============================================================================

export async function changeOrderStatus(input: unknown): Promise<ActionResult<{ status: OrderStatus }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'UPDATE_ORDER_STATUS')) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah status order.' } };
  }

  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, to, reason } = parsed.data;

  const detail = await getOrderDetail(order_id);
  if (!detail) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Order tidak ditemukan atau di luar akses Anda.' } };
  }

  const check = checkTransition(detail.order.status, to as OrderStatus, role, detail.guard);
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .update({ status: to as OrderStatus, status_reason: reason || null })
    .eq('id', order_id)
    // Optimistic locking sederhana: gagal bila status sudah berubah di sesi lain.
    .eq('status', detail.order.status)
    .select('id');

  if (error) return internalError('Gagal mengubah status order', error);

  // Kunci: `.select()` di atas wajib. PostgREST tidak menganggap UPDATE yang
  // mengenai 0 baris sebagai error, jadi tanpa cek ini transisi yang kalah adu
  // cepat — atau ditolak RLS — akan dilaporkan sukses dan UI menampilkan status
  // baru yang tidak pernah tersimpan.
  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message:
          'Status order sudah diubah pihak lain atau di luar akses Anda. Muat ulang halaman untuk melihat status terkini.',
      },
    };
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/orders');
  return { ok: true, data: { status: to as OrderStatus } };
}

// =============================================================================
// Hewan — satu order banyak hewan (docs/05 section 4.8)
// =============================================================================

export async function addAnimal(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_ANIMALS')) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah data hewan.' } };
  }

  const parsed = addAnimalSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, species, tag_code, weight_kg, on_behalf_of } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from('animals').insert({
    order_id,
    species,
    tag_code: tag_code || null,
    weight_kg: weight_kg ?? null,
    on_behalf_of: on_behalf_of || null,
  });

  if (error) return internalError('Gagal menambah hewan', error);

  revalidatePath(`/orders/${order_id}`);
  return { ok: true, data: null };
}

export async function updateAnimalStatus(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_ANIMALS')) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah data hewan.' } };
  }

  const parsed = updateAnimalStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { animal_id, status } = parsed.data;

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from('animals')
    .select('order_id, status')
    .eq('id', animal_id)
    .maybeSingle();

  if (readError) return internalError('Gagal memuat data hewan', readError);

  if (!current) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Data hewan tidak ditemukan atau di luar akses Anda.' },
    };
  }

  const check = checkAnimalTransition(current.status, status, session.profile?.role);
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  const { data, error } = await supabase
    .from('animals')
    .update({ status })
    .eq('id', animal_id)
    // Status lama ikut jadi syarat: tanpa ini, dua petugas yang mencatat
    // bersamaan bisa saling menimpa dan melewati satu tahap.
    .eq('status', current.status)
    .select('order_id')
    .maybeSingle();

  if (error) return internalError('Gagal memperbarui status hewan', error);

  // `maybeSingle()` mengembalikan null bila 0 baris terpengaruh (status sudah
  // berubah di sesi lain, atau RLS menolak) — tanpa error.
  if (!data) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message:
          'Status hewan sudah diubah pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
      },
    };
  }

  revalidatePath(`/orders/${data.order_id}`);
  return { ok: true, data: null };
}

export async function deleteAnimal(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_ANIMALS')) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak menghapus data hewan.' } };
  }

  const parsed = deleteAnimalSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: animal } = await supabase
    .from('animals')
    .select('order_id, status')
    .eq('id', parsed.data.animal_id)
    .maybeSingle();

  if (!animal) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Data hewan tidak ditemukan.' } };
  }

  // Hewan yang sudah dipotong/didistribusikan adalah bukti pelaksanaan — tidak dihapus.
  if (animal.status !== 'registered') {
    return {
      ok: false,
      error: { code: 'CONFLICT', message: 'Hewan yang sudah diproses tidak dapat dihapus.' },
    };
  }

  // Status ikut difilter di DELETE, bukan hanya dicek di atas: tanpa itu ada
  // celah TOCTOU — hewan bisa berubah jadi `slaughtered` di antara SELECT dan
  // DELETE, dan bukti pelaksanaan ikut terhapus.
  const { data: deleted, error } = await supabase
    .from('animals')
    .delete()
    .eq('id', parsed.data.animal_id)
    .eq('status', 'registered')
    .select('id');

  if (error) return internalError('Gagal menghapus hewan', error);

  if ((deleted ?? []).length === 0) {
    return {
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'Hewan sudah diproses atau di luar akses Anda, jadi tidak dapat dihapus.',
      },
    };
  }

  revalidatePath(`/orders/${animal.order_id}`);
  return { ok: true, data: null };
}
