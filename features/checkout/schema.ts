import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

/**
 * Payload checkout mandiri (`prd.md` FR-C2).
 *
 * Perhatikan yang **tidak** ada di sini: harga, total, status, dan jumlah
 * terbayar. Ketiganya ditentukan `create_guest_order` dari tabel `services`.
 * Menerimanya dari form berarti siapa pun bisa memesan seharga nol rupiah —
 * schema ini sengaja tidak menyediakan tempatnya.
 */
export const guestCheckoutSchema = z
  .object({
    service_id: uuid,
    branch_id: uuid,

    /** Tahap 1 — dasar anjuran jumlah ekor (2 laki-laki, 1 perempuan). */
    aqiqah_for: z.enum(['laki_laki', 'perempuan'], {
      message: 'Pilih aqiqah untuk anak laki-laki atau perempuan',
    }),

    /** Tahap 3 — nasi box hanya tambahan; kosong berarti "Tidak pakai". */
    nasi_box_service_id: uuid.optional().or(z.literal('')),
    nasi_box_qty: z.coerce
      .number()
      .int('Jumlah nasi box harus bilangan bulat')
      .min(0, 'Jumlah nasi box tidak boleh negatif')
      .max(5000, 'Untuk pesanan di atas 5000 box, hubungi admin')
      .optional(),

    /** Tahap 4 — menentukan apakah alamat pengiriman wajib. */
    distribution_mode: z.enum(['salur', 'kirim'], {
      message: 'Pilih cara penyaluran',
    }),

    species: z.enum(['kambing', 'domba', 'sapi'], { message: 'Jenis hewan tidak dikenali' }),

    qty: z.coerce
      .number()
      .int('Jumlah harus bilangan bulat')
      .min(1, 'Minimal 1 ekor')
      // Batas yang sama ditegakkan ulang di RPC; di sini hanya supaya penolakannya
      // muncul di form, bukan sebagai galat dari database.
      .max(20, 'Untuk pesanan di atas 20 ekor, hubungi admin'),

    /**
     * Nama anak dan nasabnya dipisah di form, lalu disatukan jadi `on_behalf_of`
     * sebelum dikirim ke RPC — tabel `animals` menyimpannya sebagai satu teks.
     */
    child_name: z.string().trim().min(2, 'Nama anak wajib diisi').max(100, 'Nama terlalu panjang'),

    bin_binti: z.string().trim().max(100, 'Nama terlalu panjang').optional().or(z.literal('')),

    name: z.string().trim().min(2, 'Nama pemesan wajib diisi').max(150, 'Nama terlalu panjang'),

    phone: z
      .string()
      .trim()
      .min(8, 'Nomor telepon terlalu pendek')
      .max(20, 'Nomor telepon terlalu panjang')
      .regex(/^[0-9+()\- ]+$/, 'Nomor telepon hanya boleh angka dan tanda + ( ) -'),

    // Wajib, mengikuti alur referensi: email dipakai mengirim salinan pesanan dan
    // tautan laporan pelaksanaan.
    email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid').max(200),

    address: z.string().trim().max(500, 'Alamat terlalu panjang').optional().or(z.literal('')),

    /** Ke mana hasil olahan dikirim; bisa berbeda dari alamat pemesan. */
    delivery_address: z
      .string()
      .trim()
      .max(500, 'Alamat pengiriman terlalu panjang')
      .optional()
      .or(z.literal('')),

    /** Instansi penerima risalah aqiqah — panti, masjid, sekolah, dan sejenisnya. */
    recipient_institution: z
      .string()
      .trim()
      .max(200, 'Nama instansi terlalu panjang')
      .optional()
      .or(z.literal('')),

    referral_code: z
      .string()
      .trim()
      .max(40, 'Kode referral terlalu panjang')
      .optional()
      .or(z.literal('')),

    notes: z.string().trim().max(1000, 'Catatan terlalu panjang').optional().or(z.literal('')),
  })
  // Aturan yang melibatkan lebih dari satu medan. Ditegakkan ulang di dalam RPC
  // — di sini hanya supaya penolakannya menempel pada medan yang tepat di form,
  // bukan datang sebagai galat dari database.
  .superRefine((v, ctx) => {
    if (v.distribution_mode === 'kirim' && !v.delivery_address?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['delivery_address'],
        message: 'Alamat pengiriman wajib diisi untuk pilihan Aqiqah Kirim',
      });
    }

    // Memilih paket nasi box tanpa jumlah berarti tidak ada yang bisa dipesan.
    if (v.nasi_box_service_id && !v.nasi_box_qty) {
      ctx.addIssue({
        code: 'custom',
        path: ['nasi_box_qty'],
        message: 'Isi jumlah nasi box, atau pilih "Tidak pakai"',
      });
    }
  });

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

/**
 * Jenis hewan yang masuk akal per jenis layanan.
 *
 * Aturan yang sama ditegakkan di dalam RPC; disatukan di sini supaya form tidak
 * pernah menawarkan pilihan yang pasti ditolak server.
 */
export const SPECIES_BY_SERVICE_TYPE: Record<string, Array<'kambing' | 'domba' | 'sapi'>> = {
  aqiqah: ['kambing', 'domba'],
  qurban: ['kambing', 'domba', 'sapi'],
};
