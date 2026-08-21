import { z } from 'zod';

const uuid = z.string().uuid('ID tidak valid');

/**
 * Tahap bukti — cerminan `fulfilment_stage` + `umum`.
 *
 * Keselarasan ini struktural, bukan kesepakatan tak tertulis: gerbang
 * kelengkapan di `v_order_progress` membandingkan `documentations.stage`
 * dengan `stage_requirements.stage` secara langsung.
 */
export const DOC_STAGES = [
  'persiapan',
  'sembelih',
  'masak',
  'salur',
  'kirim',
  'terkirim',
  'umum',
] as const;

/**
 * Unggah satu dokumentasi (docs/10 section 3).
 *
 * `type` ikut dikirim karena `note` tidak punya berkas sama sekali —
 * constraint `documentations_storage_path_check` menuntut `storage_path`
 * terisi untuk photo/video, dan membiarkannya kosong untuk note.
 */
export const uploadDocumentationSchema = z
  .object({
    order_id: uuid,
    animal_id: uuid.optional().or(z.literal('')),
    stage: z.enum(DOC_STAGES),
    type: z.enum(['photo', 'video', 'note']),
    storage_path: z.string().trim().max(300).optional().or(z.literal('')),
    caption: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.type === 'note' || Boolean(v.storage_path), {
    path: ['storage_path'],
    message: 'Foto dan video wajib menyertakan berkas',
  })
  .refine((v) => v.type !== 'note' || Boolean(v.caption), {
    // Catatan tanpa isi tidak membuktikan apa pun.
    path: ['caption'],
    message: 'Catatan wajib diisi',
  });

/**
 * Keputusan validasi, dipakai kedua tingkat (docs/10 section 4).
 *
 * Tingkat mana yang berlaku ditentukan role pemanggil di server action, bukan
 * oleh klien — supaya vendor tidak bisa meminta status `approved` untuk
 * unggahannya sendiri.
 */
export const reviewDocumentationSchema = z
  .object({
    documentation_id: uuid,
    decision: z.enum(['approve', 'reject']),
    review_note: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.decision !== 'reject' || Boolean(v.review_note), {
    path: ['review_note'],
    // Juga ditegakkan constraint `documentations_reject_reason_check` di DB.
    message: 'Alasan wajib diisi saat menolak dokumentasi',
  });

export const deleteDocumentationSchema = z.object({ documentation_id: uuid });

/** Filter antrian validasi (docs/10 section 6). */
export const validationFilterSchema = z.object({
  // Cabang dicabut sebagai filter — lihat catatan di `orderFilterSchema`.
  stage: z.enum(DOC_STAGES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  page_size: z.coerce.number().int().min(5).max(100).default(20).catch(20),
});

export type UploadDocumentationInput = z.infer<typeof uploadDocumentationSchema>;
export type ValidationFilterInput = z.infer<typeof validationFilterSchema>;
