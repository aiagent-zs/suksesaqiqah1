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
export const guestCheckoutSchema = z.object({
  service_id: uuid,
  branch_id: uuid,

  species: z.enum(['kambing', 'domba', 'sapi'], { message: 'Jenis hewan tidak dikenali' }),

  qty: z.coerce
    .number()
    .int('Jumlah harus bilangan bulat')
    .min(1, 'Minimal 1 ekor')
    // Batas yang sama ditegakkan ulang di RPC; di sini hanya supaya penolakannya
    // muncul di form, bukan sebagai galat dari database.
    .max(20, 'Untuk pesanan di atas 20 ekor, hubungi admin'),

  /** Nama yang diaqiqahi / diqurbankan. */
  on_behalf_of: z
    .string()
    .trim()
    .min(2, 'Nama atas nama ibadah wajib diisi')
    .max(150, 'Nama terlalu panjang'),

  name: z.string().trim().min(2, 'Nama pemesan wajib diisi').max(150, 'Nama terlalu panjang'),

  phone: z
    .string()
    .trim()
    .min(8, 'Nomor telepon terlalu pendek')
    .max(20, 'Nomor telepon terlalu panjang')
    .regex(/^[0-9+()\- ]+$/, 'Nomor telepon hanya boleh angka dan tanda + ( ) -'),

  email: z.string().trim().email('Format email tidak valid').max(200).optional().or(z.literal('')),

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
