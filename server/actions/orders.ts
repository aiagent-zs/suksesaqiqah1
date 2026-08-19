'use server';

import { revalidatePath } from 'next/cache';
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
  verifyGuestOrderSchema,
} from '@/features/orders/schema';
import { checkTransition } from '@/features/orders/state-machine';
import { checkAnimalTransition } from '@/features/orders/animal-state-machine';
import { getDefaultBranchId, getOrderDetail } from '@/features/orders/queries';
import type { OrderStatus } from '@/lib/constants/order';

import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('orders');

// =============================================================================
// Create
// =============================================================================

export async function createOrder(
  input: unknown,
): Promise<ActionResult<{ id: string; order_number: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!role || !['superadmin', 'admin'].includes(role)) {
    return {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Hanya admin atau superadmin yang dapat membuat order.',
      },
    };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const payload = parsed.data;

  const supabase = await createClient();

  // Cabang ditentukan di sini, bukan di form: `orders.branch_id` NOT NULL
  // sementara pemilihnya sudah tidak ada.
  const branchId = await getDefaultBranchId();
  if (!branchId) {
    return internalError('Cabang penampung order belum ada', {
      message: 'branches kosong — seed 01_master.sql belum dijalankan',
    });
  }

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
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Ada layanan yang tidak aktif atau tidak ditemukan.',
      },
    };
  }

  const pricedPayload = {
    ...payload,
    branch_id: branchId,
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
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah data order.' },
    };
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
// Verifikasi order tamu (prd.md FR-C2, TASKS.md section 11 butir 1)
// =============================================================================

/**
 * Tandai satu order dari checkout publik sebagai sudah diperiksa admin.
 *
 * Selama penanda ini kosong, trigger `enforce_guest_order_verification` menahan
 * ordernya di status `new` — jadi verifikasi bukan sekadar catatan, melainkan
 * pintu masuk ke alur operasional. Waktu dan pelakunya diturunkan di sini,
 * tidak pernah dikirim klien.
 *
 * Verifikasi sengaja tidak bisa dicabut (ditegakkan trigger yang sama): ia
 * adalah catatan bahwa seseorang benar-benar menghubungi pemesan.
 */
export async function verifyGuestOrder(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'VERIFY_GUEST_ORDER')) {
    return forbidden('Role Anda tidak berhak memverifikasi order tamu.');
  }

  const parsed = verifyGuestOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id } = parsed.data;

  const supabase = await createClient();

  // Dibaca lebih dulu supaya order di luar akses menghasilkan "tidak ditemukan"
  // yang jelas, bukan penolakan RLS mentah saat update.
  const { data: order } = await supabase
    .from('orders')
    .select('id, created_by, guest_verified_at')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  if (order.created_by !== null) {
    return conflict('Order ini dibuat staf, jadi tidak melewati antrian verifikasi order tamu.');
  }

  if (order.guest_verified_at !== null) {
    return conflict('Order ini sudah diverifikasi.');
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ guest_verified_at: new Date().toISOString(), guest_verified_by: session.id })
    .eq('id', order_id)
    // Penguncian optimistik: dua admin yang menekan tombol bersamaan tidak boleh
    // sama-sama berhasil — yang kedua mengenai 0 baris.
    .is('guest_verified_at', null)
    .select('id');

  if (error) return internalError('Gagal memverifikasi order tamu', error);

  if ((data ?? []).length === 0) {
    return conflict(
      'Order sudah diverifikasi pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
    );
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/orders');
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// =============================================================================
// Transisi status — satu-satunya jalan mengubah orders.status (docs/16 section 12)
// =============================================================================

export async function changeOrderStatus(
  input: unknown,
): Promise<ActionResult<{ status: OrderStatus }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'UPDATE_ORDER_STATUS')) {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah status order.' },
    };
  }

  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, to, reason } = parsed.data;

  const detail = await getOrderDetail(order_id);
  if (!detail) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Order tidak ditemukan atau di luar akses Anda.' },
    };
  }

  const check = checkTransition(detail.order.status, to as OrderStatus, role, detail.guard);
  if (!check.ok) {
    return { ok: false, error: { code: check.code, message: check.message } };
  }

  // Order tamu tertahan sampai diverifikasi. Trigger
  // `enforce_guest_order_verification` juga menolaknya di database — cek di sini
  // hanya supaya operator membaca alasannya, bukan kegagalan Postgres mentah.
  if (
    detail.order.created_by === null &&
    detail.order.guest_verified_at === null &&
    to !== 'cancelled'
  ) {
    return conflict(
      'Order dari checkout publik harus diverifikasi lebih dulu di panel "Order dari checkout publik".',
    );
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
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah data hewan.' },
    };
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
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak mengubah data hewan.' },
    };
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
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Role Anda tidak berhak menghapus data hewan.' },
    };
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
