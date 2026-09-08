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
 * Nama & alamat satu lokasi pelaksanaan — dipakai saat membuat dan menyunting.
 *
 * **Alamat wajib**, tidak seperti kolomnya di database yang nullable. Lokasi
 * tanpa alamat tidak bisa dituju siapa pun: mitra yang berangkat ke sana perlu
 * tahu jalannya, dan alamat itu ikut tercetak di laporan peserta. Nama saja
 * ("Masjid Al-Ikhlas") ada puluhan di satu kota.
 *
 * Kolomnya dibiarkan nullable di database karena tiga baris seed lama memang
 * lahir tanpa alamat; yang dijaga di sini adalah baris baru, bukan yang sudah
 * terlanjur ada.
 */
const locationFields = {
  name: z.string().trim().min(3, 'Nama tempat minimal 3 karakter').max(150, 'Nama terlalu panjang'),
  address: z
    .string()
    .trim()
    .min(10, 'Alamat lengkap wajib diisi — tulis jalan, nomor, kelurahan, dan kota')
    .max(500, 'Alamat terlalu panjang'),
};

/**
 * Daftarkan lokasi pelaksanaan baru.
 *
 * Tabel `locations` sebelumnya **tidak punya satu pun jalan masuk lewat
 * aplikasi** — barisnya hanya lahir dari seed, jadi menambah tempat baru
 * menuntut akses langsung ke database. Padahal lokasi salur berganti tiap
 * order: masjid, panti, atau kampung penerima manfaat yang berbeda-beda.
 *
 * **`vendor_id` sama sekali tidak ada di sini.** Lokasi yang dibuat lewat
 * aplikasi selalu milik bersama (`vendor_id = NULL`) dan bisa dipakai order
 * mana pun. Kepemilikan per mitra tetap ada di database untuk tiga baris seed
 * (RPH milik mitra), tetapi menawarkannya sebagai pilihan saat membuat hanya
 * membebani orang dengan keputusan yang jarang benar-benar dibutuhkan — dan
 * salah pilih di situ membuat lokasinya lenyap dari order mitra lain tanpa
 * alasan yang terbaca.
 */
export const createLocationSchema = z.object(locationFields);

/** Ubah nama/alamat lokasi. Kepemilikan mitra tidak ikut disunting di sini. */
export const updateLocationSchema = z.object({
  id: uuid,
  ...locationFields,
});

/** Hapus lokasi — `deleted_at`, bukan `delete`. Lihat `deleteLocation`. */
export const deleteLocationSchema = z.object({ id: uuid });

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

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
