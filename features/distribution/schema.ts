import { z } from 'zod';
import { performedAt } from '@/features/slaughter/schema';

const uuid = z.string().uuid('ID tidak valid');

/** Koordinat opsional titik distribusi (docs/05 section 4.12). */
const latitude = z.coerce
  .number()
  .min(-90, 'Lintang di luar rentang')
  .max(90, 'Lintang di luar rentang');
const longitude = z.coerce
  .number()
  .min(-180, 'Bujur di luar rentang')
  .max(180, 'Bujur di luar rentang');

export const recordDistributionSchema = z.object({
  order_id: uuid,
  recipient_name: z.string().trim().max(200).optional().or(z.literal('')),
  recipient_area: z.string().trim().max(200).optional().or(z.literal('')),
  packages_count: z.coerce
    .number()
    .int('Jumlah paket harus bilangan bulat')
    .min(0, 'Jumlah paket tidak boleh negatif')
    .max(100000, 'Jumlah paket terlalu besar'),
  distributed_at: performedAt.optional().or(z.literal('')),
  lat: latitude.optional(),
  lng: longitude.optional(),
  /**
   * Hewan yang dagingnya tercakup penyaluran ini — statusnya ikut naik menjadi
   * `distributed`. Tanpa ini `pct_distribution` pada dashboard tidak pernah
   * bergerak, karena angkanya dihitung dari `animals.status`, bukan dari
   * banyaknya baris `distributions`.
   */
  animal_ids: z.array(uuid).max(500).optional(),
});

export const deleteDistributionSchema = z.object({ id: uuid });

export type RecordDistributionInput = z.infer<typeof recordDistributionSchema>;
