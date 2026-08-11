import { z } from 'zod';

const uuid = z.string().uuid('ID tidak valid');

const severity = z.enum(['low', 'medium', 'high'], {
  message: 'Tingkat keparahan tidak dikenali',
});

const status = z.enum(['open', 'in_progress', 'resolved'], {
  message: 'Status kendala tidak dikenali',
});

/**
 * Laporan kendala baru pada sebuah order (`prd.md` FR-SL4).
 *
 * `status` sengaja tidak ada di sini: kendala selalu lahir `open` — itulah yang
 * membuatnya terhitung di panel dashboard. Memindahkannya ke `in_progress` atau
 * `resolved` adalah aksi terpisah yang wajib mencatat siapa penyelesainya.
 */
export const reportIssueSchema = z.object({
  order_id: uuid,
  title: z
    .string()
    .trim()
    .min(3, 'Judul kendala minimal 3 karakter')
    .max(200, 'Judul terlalu panjang'),
  description: z
    .string()
    .trim()
    .max(2000, 'Deskripsi terlalu panjang')
    .optional()
    .or(z.literal('')),
  severity,
});

/**
 * Ubah tingkat keparahan / isi kendala yang sudah tercatat.
 *
 * Terpisah dari perubahan status supaya koreksi redaksional tidak ikut
 * menyentuh `resolved_at` / `resolved_by`.
 */
export const updateIssueSchema = z.object({
  id: uuid,
  title: z
    .string()
    .trim()
    .min(3, 'Judul kendala minimal 3 karakter')
    .max(200, 'Judul terlalu panjang'),
  description: z
    .string()
    .trim()
    .max(2000, 'Deskripsi terlalu panjang')
    .optional()
    .or(z.literal('')),
  severity,
});

export const updateIssueStatusSchema = z.object({
  id: uuid,
  status,
});

export type IssueSeverityInput = z.infer<typeof severity>;
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
