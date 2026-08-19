import { z } from 'zod';

const uuid = z.string().uuid('ID tidak valid');

/** Tanggal kalender `YYYY-MM-DD` dari `<input type="date">`. */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD');

/**
 * Jam `HH:MM` dari `<input type="time">`.
 *
 * Kolomnya bertipe `time` di Postgres dan dibaca kembali sebagai `HH:MM:SS`,
 * jadi bentuk berdetik ikut diterima — tanpa itu, menyimpan ulang jadwal yang
 * dimuat dari database akan ditolak validasinya sendiri.
 */
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Format jam harus HH:MM')
  .transform((v) => v.slice(0, 5));

/**
 * Simpan jadwal satu order (`prd.md` FR-S1).
 *
 * `schedules.order_id` unik, jadi action-nya bersifat upsert — satu order
 * hanya punya satu jadwal aktif (docs/05 section 4.10).
 *
 * `pic_user_id` boleh kosong supaya jadwal bisa disimpan bertahap saat PIC
 * belum ditentukan; konsekuensinya guard `paid → scheduled` tetap tertutup
 * sampai ketiganya terisi.
 */
export const saveScheduleSchema = z.object({
  order_id: uuid,
  location_id: uuid,
  pic_user_id: uuid.optional().or(z.literal('')),
  scheduled_date: calendarDate,
  scheduled_time: clockTime.optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const updateScheduleStatusSchema = z.object({
  order_id: uuid,
  status: z.enum(['planned', 'ongoing', 'done']),
});

/**
 * Filter halaman Jadwal (`prd.md` FR-S2: lihat jadwal per lokasi & per petugas).
 * Seluruhnya `.catch()` — isinya query string yang bisa disunting siapa saja.
 */
export const scheduleFilterSchema = z.object({
  // Cabang dicabut sebagai filter — lihat catatan di `orderFilterSchema`.
  location_id: uuid.optional().catch(undefined),
  pic_id: uuid.optional().catch(undefined),
  status: z.enum(['planned', 'ongoing', 'done']).optional().catch(undefined),
  date_from: calendarDate.optional().catch(undefined),
  date_to: calendarDate.optional().catch(undefined),
  /** `1` = sembunyikan jadwal milik order yang sudah selesai/batal. */
  active_only: z.literal('1').optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  page_size: z.coerce.number().int().min(5).max(100).default(20).catch(20),
});

export type SaveScheduleInput = z.infer<typeof saveScheduleSchema>;
export type ScheduleFilterInput = z.infer<typeof scheduleFilterSchema>;
