'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { reportStageSchema, reviewStageSchema } from '@/features/stages/schema';
import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('stages');

/**
 * Kode penolakan dari trigger database yang memang layak dibaca pengguna.
 *
 * Pesannya ditulis di dalam trigger dan sudah berbahasa Indonesia, jadi
 * diteruskan apa adanya. Selain kode ini, pesan mentah Postgres tidak pernah
 * sampai ke layar — isinya membocorkan nama tabel dan kolom.
 */
const EXPECTED_REJECTIONS = new Set(['23514', '42501']);

function passthroughOrInternal(
  error: { code?: string; message: string },
  fallback: string,
): ActionResult<never> {
  if (error.code && EXPECTED_REJECTIONS.has(error.code)) {
    return conflict(error.message);
  }
  return internalError(fallback, error);
}

// =============================================================================
// Laporkan satu tahap
// =============================================================================

/**
 * Vendor melaporkan tahap yang sedang dikerjakannya.
 *
 * Perhatikan bahwa fungsi ini **tidak membuat** baris tahap: barisnya sudah
 * terbit berstatus `pending` saat admin menugaskan mitra (trigger
 * `generate_stage_checklist`). Vendor mengisi yang menunggu, bukan mengarang
 * tahap yang tidak ada dalam rangkaian modenya.
 *
 * Urutannya pun tidak diperiksa di sini: trigger `enforce_stage_order` menolak
 * tahap yang mendahului tahap sebelumnya, sekalipun dipanggil lewat PostgREST
 * langsung. Yang di sini hanya menerjemahkan penolakannya jadi pesan layar.
 */
export async function reportStage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'REPORT_STAGE')) {
    return forbidden('Role Anda tidak berhak melaporkan tahap pelaksanaan.');
  }

  const parsed = reportStageSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from('order_stage_events')
    .select('id, order_id, stage, status')
    .eq('id', v.stage_event_id)
    .maybeSingle();

  if (readError) return internalError('Gagal membaca laporan tahap', readError);
  if (!existing) return notFound('Tahap tidak ditemukan atau di luar akses Anda.');

  if (existing.status === 'validated') {
    return conflict('Tahap ini sudah tervalidasi dan tidak dapat diubah lagi.');
  }

  // Penguncian optimistik: dua orang yang melapor bersamaan tidak bisa
  // sama-sama berhasil. `.eq('status', existing.status)` inilah kuncinya.
  const { data, error } = await supabase
    .from('order_stage_events')
    .update({
      status: 'reported',
      reported_at: new Date().toISOString(),
      reported_by: session.id,
      occurred_at: v.occurred_at,
      notes: v.notes || null,
      packages_count: v.packages_count ?? null,
      recipient_name: v.recipient_name || null,
      recipient_phone: v.recipient_phone || null,
      recipient_area: v.recipient_area || null,
      weight_kg: v.weight_kg ?? null,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      // Laporan ulang setelah ditolak: catatan penolakan lama dibersihkan
      // supaya tidak menempel pada laporan yang sudah diperbaiki.
      review_note: null,
    })
    .eq('id', v.stage_event_id)
    .eq('status', existing.status)
    .select('id, order_id');

  if (error) return passthroughOrInternal(error, 'Gagal menyimpan laporan tahap');

  const row = (data ?? [])[0];
  if (!row) {
    // PostgREST tidak menganggap update yang mengenai 0 baris sebagai error —
    // tanpa cek ini, penolakan RLS terlihat sebagai sukses di layar.
    return conflict('Laporan tidak tersimpan: status sudah berubah atau di luar akses Anda.');
  }

  revalidatePath(`/orders/${row.order_id}`);
  return { ok: true, data: { id: row.id } };
}

// =============================================================================
// Validasi laporan tahap
// =============================================================================

/**
 * Admin memutuskan laporan tahap: divalidasi atau ditolak dengan alasan.
 *
 * Pemisahan tugas — pelapor tidak boleh memvalidasi laporannya sendiri —
 * ditegakkan trigger `enforce_stage_review`, bukan di sini. Trigger yang sama
 * juga mengisi `validated_by` dari sesi, jadi wewenang itu tidak pernah
 * dipercaya dari klien.
 */
export async function reviewStage(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'VALIDATE_STAGE_REPORT')) {
    return forbidden('Validasi laporan tahap dilakukan admin.');
  }

  const parsed = reviewStageSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from('order_stage_events')
    .select('id, order_id, status, reported_by')
    .eq('id', v.stage_event_id)
    .maybeSingle();

  if (readError) return internalError('Gagal membaca laporan tahap', readError);
  if (!existing) return notFound('Tahap tidak ditemukan atau di luar akses Anda.');

  if (existing.status !== 'reported') {
    return conflict('Hanya tahap yang sudah dilaporkan yang bisa divalidasi.');
  }

  // Diperiksa juga di sini supaya pesannya jelas di layar; penegakan
  // sesungguhnya tetap di trigger.
  if (existing.reported_by && existing.reported_by === session.id) {
    return forbidden('Pelapor tidak boleh memvalidasi laporannya sendiri.');
  }

  const { data, error } = await supabase
    .from('order_stage_events')
    .update({
      status: v.decision === 'validate' ? 'validated' : 'rejected',
      review_note: v.review_note || null,
    })
    .eq('id', v.stage_event_id)
    .eq('status', 'reported')
    .select('id, order_id');

  if (error) return passthroughOrInternal(error, 'Gagal menyimpan keputusan validasi');

  const row = (data ?? [])[0];
  if (!row) {
    return conflict('Keputusan tidak tersimpan: status sudah berubah lebih dulu.');
  }

  revalidatePath(`/orders/${row.order_id}`);
  revalidatePath('/validation');
  return { ok: true, data: { id: row.id } };
}

// =============================================================================
// Hapus laporan tahap
// =============================================================================

/**
 * Kembalikan satu tahap ke keadaan menunggu.
 *
 * Bukan menghapus barisnya — baris tahap adalah bagian dari daftar kerja yang
 * terbit otomatis, dan menghapusnya akan membuat rangkaian order berlubang.
 * Yang dilakukan adalah mengosongkan isinya, jadi vendor bisa melapor ulang.
 */
export async function resetStageReport(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (!canDo(role, 'DELETE_STAGE_REPORT')) {
    return forbidden('Hanya superadmin yang dapat mengulang laporan tahap.');
  }

  const parsed = reviewStageSchema.pick({ stage_event_id: true }).safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_stage_events')
    .update({
      status: 'pending',
      reported_at: null,
      reported_by: null,
      occurred_at: null,
      notes: null,
      packages_count: null,
      recipient_name: null,
      recipient_phone: null,
      recipient_area: null,
      weight_kg: null,
      lat: null,
      lng: null,
      validated_at: null,
      validated_by: null,
      review_note: null,
    })
    .eq('id', parsed.data.stage_event_id)
    .select('id, order_id');

  if (error) return passthroughOrInternal(error, 'Gagal mengulang laporan tahap');

  const row = (data ?? [])[0];
  if (!row) return conflict('Tahap tidak ditemukan atau di luar akses Anda.');

  revalidatePath(`/orders/${row.order_id}`);
  return { ok: true, data: { id: row.id } };
}
