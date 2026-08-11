'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  reportIssueSchema,
  updateIssueSchema,
  updateIssueStatusSchema,
} from '@/features/issues/schema';
import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('issues');

/**
 * Kendala tidak punya kebijakan RLS `delete` (`20260806010600_rls.sql`) — hanya
 * `select` / `insert` / `update`. Itu disengaja: kendala yang pernah dilaporkan
 * adalah catatan operasional, jadi koreksinya lewat penyuntingan atau
 * penyelesaian, bukan penghapusan. Karena itu modul ini sengaja tidak
 * menyediakan action hapus — menambahkannya hanya akan menghasilkan tombol yang
 * pasti ditolak database.
 */

// =============================================================================
// Laporkan kendala (prd.md FR-SL4)
// =============================================================================

export async function createIssueAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_ISSUES')) {
    return forbidden('Role Anda tidak berhak melaporkan kendala.');
  }

  const parsed = reportIssueSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { order_id, title, description, severity } = parsed.data;

  const supabase = await createClient();

  // Dibaca lebih dulu agar order di luar akses menghasilkan "tidak ditemukan"
  // yang jelas, bukan penolakan RLS mentah saat insert.
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('id', order_id)
    .maybeSingle();

  if (!order) return notFound('Order tidak ditemukan atau di luar akses Anda.');

  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      order_id,
      title,
      description: description || null,
      severity,
      reported_by: session.id,
      // `status` dibiarkan pada default `open` — lihat catatan di schema.
    })
    .select('id')
    .maybeSingle();

  if (error) return internalError('Gagal menyimpan kendala', error);
  if (!issue) return forbidden('Pencatatan ditolak untuk order di luar akses Anda.');

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: { id: issue.id } };
}

// =============================================================================
// Koreksi isi kendala
// =============================================================================

/**
 * Ubah judul, deskripsi, atau tingkat keparahan kendala yang sudah tercatat.
 *
 * Sengaja tidak menyentuh `status`: menaikkan keparahan dan menyatakan kendala
 * selesai adalah dua keputusan berbeda, dan hanya yang kedua boleh menulis
 * `resolved_by` / `resolved_at`.
 */
export async function updateIssueAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_ISSUES')) {
    return forbidden('Role Anda tidak berhak mengubah kendala.');
  }

  const parsed = updateIssueSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, title, description, severity } = parsed.data;

  const supabase = await createClient();

  const { data: current } = await supabase
    .from('issues')
    .select('id, order_id')
    .eq('id', id)
    .maybeSingle();

  if (!current) return notFound('Kendala tidak ditemukan atau di luar akses Anda.');

  const { data, error } = await supabase
    .from('issues')
    .update({ title, description: description || null, severity })
    .eq('id', id)
    .select('id');

  if (error) return internalError('Gagal memperbarui kendala', error);
  if ((data ?? []).length === 0) {
    return forbidden('Perubahan ditolak untuk order di luar akses Anda.');
  }

  revalidatePath(`/orders/${current.order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// =============================================================================
// Ubah status penanganan
// =============================================================================

/**
 * Pindahkan kendala antar status penanganan, dua arah — kendala yang ternyata
 * belum beres bisa dibuka kembali.
 *
 * `resolved_at` dan `resolved_by` selalu diturunkan dari status tujuan, tidak
 * pernah dari klien. Constraint `issues_resolved_consistency_check` menuntut
 * `resolved_at` terisi **tepat ketika** statusnya `resolved`; membuka kembali
 * tanpa mengosongkannya akan ditolak database.
 */
export async function updateIssueStatusAction(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_ISSUES')) {
    return forbidden('Role Anda tidak berhak mengubah status kendala.');
  }

  const parsed = updateIssueStatusSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { id, status } = parsed.data;

  const supabase = await createClient();

  const { data: current } = await supabase
    .from('issues')
    .select('id, order_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!current) return notFound('Kendala tidak ditemukan atau di luar akses Anda.');

  // Menulis ulang status yang sama akan menggeser `resolved_at` ke waktu
  // sekarang dan menghapus jejak kapan kendala itu sebenarnya selesai.
  if (current.status === status) {
    return conflict('Kendala sudah berada pada status tersebut.');
  }

  const resolving = status === 'resolved';

  const { data, error } = await supabase
    .from('issues')
    .update({
      status,
      resolved_by: resolving ? session.id : null,
      resolved_at: resolving ? new Date().toISOString() : null,
    })
    .eq('id', id)
    // Status lama ikut jadi syarat: dua operator yang mengubah bersamaan tidak
    // boleh sama-sama dianggap berhasil.
    .eq('status', current.status)
    .select('id');

  if (error) return internalError('Gagal memperbarui status kendala', error);

  if ((data ?? []).length === 0) {
    return conflict(
      'Kendala sudah diubah pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
    );
  }

  revalidatePath(`/orders/${current.order_id}`);
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}
