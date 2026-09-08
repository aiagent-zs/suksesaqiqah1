'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import {
  deleteDocumentationSchema,
  reviewDocumentationSchema,
  uploadDocumentationSchema,
} from '@/features/documentation/schema';
import { isDocPathForOrder, type DocStage } from '@/features/documentation/storage';
import { checkReview } from '@/features/documentation/review';
import {
  conflict,
  forbidden,
  notFound,
  scopedInternalError,
  validationError,
  type ActionResult,
} from './result';

const internalError = scopedInternalError('documentation');

// =============================================================================
// Unggah (docs/10 section 3)
// =============================================================================

/**
 * Simpan satu bukti berstatus `pending`, menempel pada satu laporan tahap.
 *
 * Berkasnya sudah diunggah klien langsung ke Storage; action ini hanya mencatat
 * `storage_path` setelah memverifikasi bahwa path itu benar milik order & tahap
 * yang bersangkutan.
 *
 * **Tahap, order, dan hewan dibaca dari baris tahapnya — bukan dari klien.**
 * Sebelumnya ketiganya dikirim form, sehingga bukti masak bisa diaku sebagai
 * bukti sembelih dan gerbang kelengkapan (`missing_doc_stages`) ikut tertipu.
 * Sekarang klien hanya menyebut laporan tahap mana yang dibuktikannya; sisanya
 * turunan. Trigger `enforce_documentation_stage_match` tetap jadi lapis kedua
 * di database.
 */
export async function uploadDocumentation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'UPLOAD_DOCUMENTATION')) {
    return forbidden('Role Anda tidak berhak mengunggah dokumentasi.');
  }

  const parsed = uploadDocumentationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { stage_event_id, type, storage_path, caption } = parsed.data;

  const supabase = await createClient();

  // RLS `order_stage_events_select` memakai `can_read_order`, jadi baris di
  // luar akses pemanggil tidak terbaca sama sekali — itulah penjaga aksesnya.
  const { data: eventRow } = await supabase
    .from('order_stage_events')
    .select('id, stage, animal_id, order:orders!inner ( id, order_number )')
    .eq('id', stage_event_id)
    .maybeSingle();

  if (!eventRow) return notFound('Tahap tidak ditemukan atau di luar akses Anda.');

  const event = eventRow as unknown as {
    id: string;
    stage: DocStage;
    animal_id: string | null;
    order: { id: string; order_number: string };
  };

  // Kebijakan `storage_documentation_insert` hanya menuntut pengunggah punya
  // role — sama sekali tidak membatasi folder. Tanpa cek ini, berkas milik
  // order lain bisa ditautkan ke bukti ini. Dibandingkan terhadap tahap
  // **hasil baca**, jadi path yang dibangun di folder tahap yang keliru
  // tertolak di sini, bukan menunggu trigger database.
  if (storage_path && !isDocPathForOrder(storage_path, event.order.order_number, event.stage)) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Path berkas tidak sesuai dengan order dan tahap ini.',
        fields: { storage_path: 'Berkas tidak dikenali.' },
      },
    };
  }

  const { data, error } = await supabase
    .from('documentations')
    .insert({
      order_id: event.order.id,
      stage_event_id: event.id,
      // Baris `sembelih` terbit satu per ekor, jadi hewannya sudah tertaut di
      // laporan tahapnya — tidak perlu ditanyakan lagi, dan tidak bisa keliru.
      animal_id: event.animal_id,
      stage: event.stage,
      type,
      storage_path: storage_path ?? '',
      caption: caption || null,
      uploaded_by: session.id,
      status: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (error) return internalError('Gagal menyimpan dokumentasi', error);
  if (!data) return forbidden('Unggahan ditolak untuk order di luar akses Anda.');

  revalidatePath(`/orders/${event.order.id}`);
  revalidatePath('/validation');
  revalidatePath('/dashboard');
  return { ok: true, data: { id: data.id } };
}

// =============================================================================
// Validasi 2 tingkat (docs/10 section 4)
// =============================================================================

/**
 * Setujui atau tolak satu dokumentasi.
 *
 * Wewenangnya diturunkan dari role pemanggil — admin & superadmin menangani
 * `approved_supervisor` menjadi `approved`. Klien tidak pernah menentukan
 * status tujuan.
 */
export async function reviewDocumentation(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();

  const parsed = reviewDocumentationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { documentation_id, decision, review_note } = parsed.data;

  const supabase = await createClient();
  const { data: doc, error: readError } = await supabase
    .from('documentations')
    .select('id, order_id, status, uploaded_by')
    .eq('id', documentation_id)
    .maybeSingle();

  if (readError) return internalError('Gagal memuat dokumentasi', readError);
  if (!doc) return notFound('Dokumentasi tidak ditemukan atau di luar akses Anda.');

  const check = checkReview({
    currentStatus: doc.status,
    decision,
    role: session.profile?.role,
    uploadedBy: doc.uploaded_by,
    reviewerId: session.id,
  });

  if (!check.ok) return { ok: false, error: { code: check.code, message: check.message } };

  const { data, error } = await supabase
    .from('documentations')
    .update({
      status: check.next,
      reviewed_by: session.id,
      reviewed_at: new Date().toISOString(),
      // Constraint `documentations_reject_reason_check` menuntut alasan terisi
      // saat status `rejected`; schema Zod sudah mewajibkannya lebih dulu.
      review_note: review_note || null,
    })
    .eq('id', documentation_id)
    // Status lama ikut jadi syarat: dua validator yang menekan bersamaan tidak
    // boleh sama-sama dianggap berhasil.
    .eq('status', doc.status)
    .select('order_id');

  if (error) return internalError('Gagal menyimpan hasil validasi', error);

  if ((data ?? []).length === 0) {
    return conflict(
      'Dokumentasi sudah diproses pihak lain. Muat ulang halaman untuk melihat kondisi terkini.',
    );
  }

  revalidatePath(`/orders/${doc.order_id}`);
  revalidatePath('/validation');
  revalidatePath('/dashboard');
  return { ok: true, data: null };
}

// =============================================================================
// Hapus (koreksi)
// =============================================================================

/**
 * Hapus satu dokumentasi.
 *
 * Kebijakan RLS `documentations_delete` membatasinya ke Manager Program &
 * admin. Yang sudah `approved` ditolak di sini: dokumentasi itu bukti
 * yang melepas gate menuju `reporting` dan ikut tampil di laporan peserta.
 */
export async function deleteDocumentation(input: unknown): Promise<ActionResult<null>> {
  const session = await requireAuth();
  const role = session.profile?.role;

  if (role !== 'superadmin' && role !== 'admin') {
    return forbidden('Hanya admin atau superadmin yang dapat menghapus dokumentasi.');
  }

  const parsed = deleteDocumentationSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documentations')
    .select('id, order_id, status')
    .eq('id', parsed.data.documentation_id)
    .maybeSingle();

  if (!doc) return notFound('Dokumentasi tidak ditemukan.');

  if (doc.status === 'approved') {
    return conflict(
      'Dokumentasi yang sudah tervalidasi penuh tidak dapat dihapus — bukti ini dipakai laporan peserta.',
    );
  }

  // Status ikut difilter di DELETE untuk menutup celah TOCTOU: tanpa itu,
  // dokumentasi bisa berubah menjadi `approved` di antara SELECT dan DELETE.
  const { data: deleted, error } = await supabase
    .from('documentations')
    .delete()
    .eq('id', parsed.data.documentation_id)
    .neq('status', 'approved')
    .select('id');

  if (error) return internalError('Gagal menghapus dokumentasi', error);
  if ((deleted ?? []).length === 0) {
    return conflict('Dokumentasi sudah tervalidasi atau dihapus pihak lain.');
  }

  // Berkas di Storage sengaja dibiarkan — berkas yatim sudah punya jadwal
  // pembersihan tersendiri (docs/17 section 5).
  revalidatePath(`/orders/${doc.order_id}`);
  revalidatePath('/validation');
  return { ok: true, data: null };
}
