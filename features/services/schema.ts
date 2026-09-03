import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

/**
 * Katalog paket yang benar-benar ditagih.
 *
 * **Kenapa haknya berhenti di superadmin.** `services.price` adalah harga yang
 * dibaca `create_guest_order` — RPC itu sengaja mengabaikan harga kiriman
 * klien dan membacanya dari tabel ini, dan itulah pertahanan inti checkout.
 * Jadi siapa pun yang bisa menyunting baris di sini menentukan berapa yang
 * ditagih ke pembeli. Sama alasannya dengan `UPDATE_ORDER_AMOUNT` yang juga
 * berhenti di superadmin: harga keputusan pemilik usaha, bukan operasional.
 */
export const serviceSchema = z.object({
  type: z.enum(['aqiqah', 'qurban', 'sedekah_daging', 'nasi_box'], {
    message: 'Jenis paket tidak dikenali',
  }),
  name: z.string().trim().min(2, 'Nama paket wajib diisi').max(150, 'Nama terlalu panjang'),

  /**
   * Cermin `services_slug_format_check` di database — huruf kecil, angka, dan
   * tanda hubung tunggal. Ditegakkan dua kali dengan sengaja: di sini supaya
   * galatnya menempel pada medannya, dan di database supaya tidak bisa
   * dilewati jalur lain.
   */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Slug wajib diisi')
    .max(80, 'Slug terlalu panjang')
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      'Slug hanya boleh huruf kecil, angka, dan tanda hubung (mis. aqiqah-ekonomi)',
    ),

  description: z.string().trim().max(500, 'Deskripsi terlalu panjang').optional().or(z.literal('')),

  /**
   * `numeric(14,2)` di database, jadi batas atasnya bukan pendapat: 12 digit di
   * depan koma. Angka di atas itu ditolak Postgres dengan galat yang tidak
   * terbaca operator, jadi dicegat di sini lebih dulu.
   */
  price: z
    .number({ message: 'Harga wajib diisi' })
    .min(0, 'Harga tidak boleh negatif')
    .max(999_999_999_999, 'Harga terlalu besar'),

  sort_order: z.number().int('Urutan harus bilangan bulat').min(0).max(9999).optional(),

  // --- Konten landing -------------------------------------------------------
  //
  // Dipisah dari `description`, yang dipakai layar internal & panel modal
  // mitra. Keduanya kalimat tentang paket yang sama, tapi ditulis untuk
  // pembaca yang berbeda: yang satu untuk operator, yang satu untuk calon
  // pembeli.

  tagline: z.string().trim().max(200, 'Tagline terlalu panjang').optional().or(z.literal('')),

  /**
   * Butir yang dicentang di kartu landing.
   *
   * Baris kosong disaring, bukan ditolak: sumbernya `<textarea>` satu-baris-
   * satu-butir, dan baris kosong di ujung adalah cara orang mengetik, bukan
   * kekeliruan yang perlu diberi tahu.
   */
  landing_features: z
    .array(z.string().trim().max(200, 'Butir terlalu panjang'))
    .max(12, 'Maksimal 12 butir')
    .optional()
    .transform((v) => (v ?? []).filter((f) => f.length > 0)),

  photo_path: z.string().trim().max(300).optional().or(z.literal('')),
  photo_alt: z
    .string()
    .trim()
    .max(200, 'Teks alternatif terlalu panjang')
    .optional()
    .or(z.literal('')),

  is_popular: z.boolean().optional(),

  // --- Isi paket (`meta`) ---------------------------------------------------
  //
  // Dibaca **enam** tempat — landing, checkout, panel modal mitra, daftar &
  // detail katalog — dan sampai 3 September ditulis **nol**: satu-satunya cara
  // mengubahnya adalah dashboard Supabase. Pola yang sama persis dengan
  // `vendor_coverage` sebelum 27 Agustus.
  //
  // Bentuknya dua macam, mengikuti jenis paketnya. Itu bukan ketidakrapian:
  // "80 porsi, olahan gulai & sate" menjawab pertanyaan berbeda dari daftar
  // lauk satu box, dan memaksa keduanya ke satu bentuk akan membuat salah satu
  // terbaca janggal.

  /** Aqiqah: perkiraan porsi yang dihasilkan. */
  porsi: z
    .number()
    .int('Porsi harus bilangan bulat')
    .min(1, 'Porsi minimal 1')
    .max(10_000, 'Porsi terlalu besar')
    .optional(),

  /** Aqiqah: ragam olahan, mis. "gulai, sate, tongseng". */
  jenis_olahan: z.string().trim().max(200, 'Terlalu panjang').optional().or(z.literal('')),

  /** Aqiqah: peruntukan, mis. "syukuran keluarga". */
  cocok_untuk: z.string().trim().max(150, 'Terlalu panjang').optional().or(z.literal('')),

  /**
   * Nasi box: isi satu box.
   *
   * **Ini yang tampil di halaman depan** — landing membacanya dari
   * `meta->items`, bukan dari `landing_features`. Jadi menyuntingnya di sini
   * langsung mengubah yang dibaca pengunjung.
   */
  items: z
    .array(z.string().trim().max(100, 'Nama lauk terlalu panjang'))
    .max(20, 'Maksimal 20 item')
    .optional()
    .transform((v) => (v ?? []).filter((i) => i.length > 0)),

  /**
   * Dipasarkan di halaman depan.
   *
   * Terpisah dari `is_active` dengan sengaja — keduanya menjawab pertanyaan
   * berbeda: `is_active` menentukan paket masih bisa dipesan, `show_on_landing`
   * menentukan ia dipajang. Paket musiman bisa tetap bisa dipesan lewat tautan
   * langsung tanpa memenuhi halaman depan.
   *
   * Database menolak kombinasi yang mustahil lewat
   * `services_landing_requires_active`: dipasarkan tapi tidak aktif berarti
   * tombol "Pesan" yang membawa ke checkout tanpa paketnya.
   */
  show_on_landing: z.boolean().optional(),
});

export const createServiceSchema = serviceSchema;
export const updateServiceSchema = serviceSchema.extend({ id: uuid });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const setServiceActiveSchema = z.object({
  id: uuid,
  is_active: z.boolean(),
});

/**
 * Simpan `photo_path` sesudah berkasnya terunggah.
 *
 * Path-nya diperiksa bentuknya di server action lewat `isServicePhotoPath()`,
 * bukan di sini: aturannya tinggal bersama aturan bucket lainnya di
 * `features/services/storage.ts`, satu tempat dengan batas ukuran & MIME.
 */
export const setServicePhotoSchema = z.object({
  id: uuid,
  photo_path: z.string().trim().min(1).max(300),
  photo_alt: z.string().trim().max(200).optional().or(z.literal('')),
});

export const clearServicePhotoSchema = z.object({ id: uuid });
