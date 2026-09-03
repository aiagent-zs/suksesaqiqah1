import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

/** Kode wilayah Kemendagri: `32`, `32.04`, `32.04.01`, `32.04.01.2001`. */
const regionCode = z
  .string()
  .trim()
  .regex(/^\d{2}(\.\d{2}){0,2}(\.\d{4})?$/, 'Kode wilayah tidak dikenali');

/**
 * Master mitra pelaksana.
 *
 * Alamatnya disimpan sebagai kode + nama, bentuk yang sama dengan
 * `orders.delivery_*` — tapi **alasannya berbeda**, dan itu perlu dicatat:
 * alamat pada order adalah rekaman sejarah yang harus beku selamanya,
 * sedangkan alamat mitra adalah master data yang berlaku kini. Kalau Kemendagri
 * mengganti nama kecamatan, alamat mitra memang seharusnya ikut berubah;
 * alamat order tidak boleh.
 */
export const vendorSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,12}$/, 'Kode 2-12 huruf kapital atau angka'),
  name: z.string().trim().min(2, 'Nama usaha wajib diisi').max(150, 'Nama terlalu panjang'),
  legal_name: z.string().trim().max(200).optional().or(z.literal('')),
  owner_name: z.string().trim().max(150).optional().or(z.literal('')),
  npwp: z.string().trim().max(30).optional().or(z.literal('')),

  phone: z
    .string()
    .trim()
    .min(8, 'Nomor telepon tidak valid')
    .max(20, 'Nomor terlalu panjang')
    .regex(/^[0-9+()\- ]+$/, 'Nomor hanya boleh berisi angka dan tanda + ( ) -'),
  whatsapp: z.string().trim().max(20).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid')
    .optional()
    .or(z.literal('')),

  province_code: regionCode.optional().or(z.literal('')),
  city_code: regionCode.optional().or(z.literal('')),
  district_code: regionCode.optional().or(z.literal('')),
  village_code: regionCode.optional().or(z.literal('')),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Kode pos harus 5 digit')
    .optional()
    .or(z.literal('')),
  address_detail: z.string().trim().max(500).optional().or(z.literal('')),

  agreement_number: z.string().trim().max(100).optional().or(z.literal('')),
  agreement_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  agreement_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  daily_capacity: z.number().int().min(1, 'Kapasitas minimal 1').max(1000).optional(),

  /**
   * Mode yang sanggup dilayani. Wajib minimal satu — mitra yang tidak melayani
   * apa pun tidak bisa ditugaskan ke order mana pun.
   */
  service_modes: z.array(z.enum(['salur', 'kirim'])).min(1, 'Pilih minimal satu cara penyaluran'),

  bank_name: z.string().trim().max(100).optional().or(z.literal('')),
  bank_account_no: z.string().trim().max(50).optional().or(z.literal('')),
  bank_account_name: z.string().trim().max(150).optional().or(z.literal('')),

  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const createVendorSchema = vendorSchema;

/**
 * Sunting mitra — `code` **ikut** disunting.
 *
 * Revisi keputusan: sebelumnya `code` di-`omit` di sini dengan alasan ia
 * melekat sejak pendaftaran. Alasan itu tidak bertahan menghadapi kebutuhan
 * yang nyata — salah ketik saat mendaftarkan mitra hanya bisa dibetulkan lewat
 * dashboard Supabase, dan mitra yang berganti nama usaha terpaksa hidup dengan
 * kode lama selamanya.
 *
 * Yang membuatnya aman bukan pendapat, melainkan bentuk skemanya: `code` tidak
 * pernah disalin ke tabel mana pun. Ia dibaca lewat `join` (`v_open_orders`
 * memakainya sebagai `vendor_code`), dan path Storage sengaja **tidak**
 * memakainya — migration `02` mencatat alasannya dengan kalimat yang tegas:
 * *"kode bisa berubah dan order bisa dipindah ke mitra lain"*. Jadi mengubahnya
 * cukup satu `update`, dan seluruh pembacanya ikut berubah sendiri.
 *
 * Keunikannya tetap dijaga `vendors_code_key`; `updateVendor` menerjemahkan
 * `23505` jadi pesan yang menempel pada medannya.
 */
export const updateVendorSchema = vendorSchema.extend({ id: uuid });

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

export const setVendorActiveSchema = z.object({
  id: uuid,
  is_active: z.boolean(),
});

export const deleteVendorSchema = z.object({ id: uuid });

/**
 * Modal per paket untuk satu mitra.
 *
 * Ini angka internal: pembeli tetap melihat `services.price`. Margin sebuah
 * order adalah selisih keduanya, dan itulah sebabnya kewenangannya berhenti di
 * superadmin.
 */
export const vendorServiceSchema = z
  .object({
    vendor_id: uuid,
    service_id: uuid,
    vendor_price: z.number().min(0, 'Harga modal tidak boleh negatif'),
    is_offered: z.boolean().default(true),

    // --- Batas penawaran mitra ------------------------------------------------
    //
    // Keempat kolom ini **sudah ada di database sejak 20 Agustus** dan sampai 3
    // September **nol dipakai** di seluruh `features/`, `server/`, dan `app/` —
    // pola yang sama persis dengan `vendor_coverage` sebelum 27 Agustus: kolom
    // lahir duluan, layarnya tidak pernah menyusul.
    //
    // Yang tinggal di sini adalah hal yang **berbeda tiap mitra**. Yang sama
    // untuk semua — nama paket, harga jual, porsi, ragam olahan — tetap di
    // `services`, sebab itulah yang dijanjikan ke pembeli di halaman depan.
    // Kalau tiap mitra bisa mengubahnya, pembeli membaca satu janji lalu
    // menerima yang lain, dan tidak ada yang bisa menentukan mana yang benar.

    /** Pesanan minimum yang mau dilayani mitra ini. */
    min_qty: z.number().int('Harus bilangan bulat').min(1, 'Minimal 1').max(10_000).optional(),

    /**
     * Kapasitas maksimum, mis. "paket ekonomi maks 100 box".
     *
     * Kosong berarti **tanpa batas**, bukan nol — itu sebabnya kolomnya
     * nullable di database dan bukan `default 0`.
     */
    max_qty: z.number().int('Harus bilangan bulat').min(1, 'Minimal 1').max(100_000).optional(),

    /** Jeda persiapan yang diminta mitra, dalam jam. */
    lead_time_hours: z
      .number()
      .int('Harus bilangan bulat')
      .min(0, 'Tidak boleh negatif')
      .max(24 * 30, 'Lebih dari 30 hari — periksa lagi angkanya')
      .optional(),

    notes: z.string().trim().max(500, 'Catatan terlalu panjang').optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    // Cermin `vendor_services_qty_check` di database. Ditegakkan dua kali dengan
    // sengaja: di sini supaya galatnya menempel pada medannya, dan di database
    // supaya jalur lain tidak bisa melewatinya.
    if (v.max_qty !== undefined && v.min_qty !== undefined && v.max_qty < v.min_qty) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_qty'],
        message: 'Kapasitas maksimum tidak boleh di bawah minimum.',
      });
    }
  });

export type VendorServiceInput = z.infer<typeof vendorServiceSchema>;

export const deleteVendorServiceSchema = z.object({ id: uuid });

/**
 * Wilayah layanan mitra (`vendor_coverage`).
 *
 * Dikirim sebagai daftar utuh, bukan satu-per-satu: yang dikehendaki operator
 * adalah "mitra ini melayani wilayah-wilayah **ini**", dan menyimpannya sebagai
 * satu keadaan membuat penghapusan tidak perlu aksi tersendiri.
 *
 * `region_name` ikut dikirim hanya sebagai isyarat; server tetap membacanya
 * ulang dari `regions` berdasarkan kode — nama yang dipercaya dari klien bisa
 * tidak cocok dengan kodenya, dan yang dibaca orang adalah namanya.
 */
export const saveVendorCoverageSchema = z.object({
  vendor_id: uuid,
  region_codes: z
    .array(regionCode)
    .max(200, 'Terlalu banyak wilayah dipilih')
    // Kode ganda akan ditolak primary key `(vendor_id, region_code)`; disaring
    // di sini supaya pengguna tidak melihat galat database untuk sesuatu yang
    // sudah jelas maksudnya.
    .transform((codes) => [...new Set(codes)]),
});
