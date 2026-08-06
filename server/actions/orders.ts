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

  // Harga satuan tidak dipercaya mentah dari klien: layanan harus aktif.
  const serviceIds = [...new Set(payload.items.map((i) => i.service_id))];
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .in('id', serviceIds)
    .eq('is_active', true)
    .is('deleted_at', null);

  if ((services?.length ?? 0) !== serviceIds.length) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Ada layanan yang tidak aktif atau tidak ditemukan.' },
    };
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_payload: payload as never,
  });

  if (error) {
    return { ok: false, error: { code: 'INTERNAL', message: `Gagal membuat order: ${error.message}` } };
  }

  const result = data as unknown as { id: string; order_number: string };
  revalidatePath('/orders');
  return { ok: true, data: { id: result.id, order_number: result.order_number } };
}

// =============================================================================
// Update data order (bukan status)
// =============================================================================

export async function updateOrder(input: unknown): Promise<ActionResult<null>> {
  await requireAuth();

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, ...changes } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({
      notes: changes.notes || null,
      ...(changes.total_amount !== undefined ? { total_amount: changes.total_amount } : {}),
    })
    .eq('id', order_id);

  if (error) {
    return { ok: false, error: { code: 'FORBIDDEN', message: `Gagal menyimpan perubahan: ${error.message}` } };
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
  const { error } = await supabase
    .from('orders')
    .update({ status: to as OrderStatus, status_reason: reason || null })
    .eq('id', order_id)
    // Optimistic locking sederhana: gagal bila status sudah berubah di sesi lain.
    .eq('status', detail.order.status);

  if (error) {
    return { ok: false, error: { code: 'FORBIDDEN', message: `Gagal mengubah status: ${error.message}` } };
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/orders');
  return { ok: true, data: { status: to as OrderStatus } };
}

// =============================================================================
// Hewan — satu order banyak hewan (docs/05 section 4.8)
// =============================================================================

export async function addAnimal(input: unknown): Promise<ActionResult<null>> {
  await requireAuth();

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

  if (error) {
    return { ok: false, error: { code: 'FORBIDDEN', message: `Gagal menambah hewan: ${error.message}` } };
  }

  revalidatePath(`/orders/${order_id}`);
  return { ok: true, data: null };
}

export async function updateAnimalStatus(input: unknown): Promise<ActionResult<null>> {
  await requireAuth();

  const parsed = updateAnimalStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { animal_id, status } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('animals')
    .update({ status })
    .eq('id', animal_id)
    .select('order_id')
    .maybeSingle();

  if (error) {
    return { ok: false, error: { code: 'FORBIDDEN', message: `Gagal memperbarui hewan: ${error.message}` } };
  }

  if (data?.order_id) revalidatePath(`/orders/${data.order_id}`);
  return { ok: true, data: null };
}

export async function deleteAnimal(input: unknown): Promise<ActionResult<null>> {
  await requireAuth();

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

  const { error } = await supabase.from('animals').delete().eq('id', parsed.data.animal_id);
  if (error) {
    return { ok: false, error: { code: 'FORBIDDEN', message: `Gagal menghapus hewan: ${error.message}` } };
  }

  revalidatePath(`/orders/${animal.order_id}`);
  return { ok: true, data: null };
}
