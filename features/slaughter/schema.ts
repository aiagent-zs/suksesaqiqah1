import { z } from 'zod';

const uuid = z.string().uuid('ID tidak valid');

/**
 * Waktu pelaksanaan dari `<input type="datetime-local">` (tanpa zona) atau ISO
 * penuh. Dinormalkan menjadi ISO agar kolom `timestamptz` menerimanya apa adanya.
 */
export const performedAt = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Format waktu tidak dikenali')
  .transform((v) => new Date(v).toISOString());

export const recordSlaughterSchema = z.object({
  animal_id: uuid,
  /** Kosong = sekarang (default kolom `performed_at`). */
  performed_at: performedAt.optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const deleteSlaughterSchema = z.object({ id: uuid });

export type RecordSlaughterInput = z.infer<typeof recordSlaughterSchema>;
