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
 * Simpan jadwal satu order.
 *
 * `schedules.order_id` unik, jadi action-nya bersifat upsert — satu order
 * hanya punya satu jadwal.
 *
 * `location_id` boleh kosong: tanggal sering ditetapkan lebih dulu, sementara
 * lokasi pemotongan baru pasti setelah mitranya menyanggupi. Penugasan mitra
 * sendiri **tidak** di sini — ia kolom pada order, dan punya action sendiri.
 */
export const saveScheduleSchema = z.object({
  order_id: uuid,
  location_id: uuid.optional().or(z.literal('')),
  scheduled_date: calendarDate,
  scheduled_time: clockTime.optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

/**
 * Tetapkan mitra pelaksana.
 *
 * Dipisah dari penyimpanan jadwal dengan sengaja: inilah yang membuka akses
 * vendor ke order (`can_read_order` membandingkan `orders.vendor_id`), jadi ia
 * pantas jadi aksi tersendiri yang terlihat jelas di layar dan di audit.
 */
export const assignVendorSchema = z.object({
  order_id: uuid,
  vendor_id: uuid,
});

/**
 * Filter halaman Jadwal (`prd.md` FR-S2: lihat jadwal per lokasi & per petugas).
 * Seluruhnya `.catch()` — isinya query string yang bisa disunting siapa saja.
 */
export const scheduleFilterSchema = z.object({
  location_id: uuid.optional().catch(undefined),
  vendor_id: uuid.optional().catch(undefined),
  date_from: calendarDate.optional().catch(undefined),
  date_to: calendarDate.optional().catch(undefined),
  /** `1` = sembunyikan jadwal milik order yang sudah selesai/batal. */
  active_only: z.literal('1').optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  page_size: z.coerce.number().int().min(5).max(100).default(20).catch(20),
});

export type SaveScheduleInput = z.infer<typeof saveScheduleSchema>;
export type AssignVendorInput = z.infer<typeof assignVendorSchema>;
export type ScheduleFilterInput = z.infer<typeof scheduleFilterSchema>;
