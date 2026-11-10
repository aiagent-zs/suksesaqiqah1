import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

export const DOC_STAGES = ['persiapan', 'sembelih', 'masak', 'salur', 'kirim', 'terkirim'] as const;

export const uploadDocumentationSchema = z
  .object({
    stage_event_id: uuid,
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

export type UploadDocumentationInput = z.infer<typeof uploadDocumentationSchema>;
