import { z } from 'zod';
import { addCalendarDays, todayWib } from '@/lib/format/date-range';

const uuid = z.string().uuid('Pilihan tidak valid');

/**
 * Sejauh mana ke depan pemesan boleh memilih tanggal pelaksanaan.
 *
 * Angka yang sama ditegakkan di `create_guest_order`. Di luar jendela ini harga
 * dan ketersediaan hewan sudah tidak bisa dipegang dari halaman publik, jadi
 * pemesanannya lewat admin.
 */
export const BOOKING_MAX_DAYS = 7;

/**
 * Jam pelaksanaan yang ditawarkan form.
 *
 * Daftar ini lebih sempit daripada jendela yang dikunci database (06:00–20:00):
 * yang di database batas luarnya, yang di sini slot operasional sehari-hari —
 * supaya jamnya bisa digeser tanpa migration.
 */
export const BOOKING_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
] as const;

/** Batas bawah pemilih tanggal: hari ini menurut WIB. */
export function bookingMinDate(now?: Date): string {
  return todayWib(now);
}

/** Batas atas pemilih tanggal: `BOOKING_MAX_DAYS` hari sejak hari ini. */
export function bookingMaxDate(now?: Date): string {
  return addCalendarDays(todayWib(now), BOOKING_MAX_DAYS);
}

/**
 * Kode wilayah Kemendagri bersarang per dua digit, kecuali kelurahan yang
 * empat: `32` → `32.04` → `32.04.01` → `32.04.01.2001`. Bentuknya diperiksa
 * **per tingkat**, bukan dengan satu pola longgar — pola longgar akan
 * meloloskan kode provinsi yang mendarat di kolom kelurahan.
 *
 * Indeksnya sama dengan `regions.level`: 1 provinsi … 4 kelurahan/desa.
 */
const REGION_CODE_PATTERN: Record<number, RegExp> = {
  1: /^\d{2}$/,
  2: /^\d{2}\.\d{2}$/,
  3: /^\d{2}\.\d{2}\.\d{2}$/,
  4: /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/,
};

function regionCode(level: 1 | 2 | 3 | 4, message: string) {
  return z.string().trim().regex(REGION_CODE_PATTERN[level], message).optional().or(z.literal(''));
}

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

    /**
     * Cabang **tidak** ada di sini, dan itu disengaja.
     *
     * Pemilih wilayah layanan dihapus dari form (19 Agustus 2026);
     * `orders.branch_id` tetap NOT NULL, jadi cabangnya ditentukan
     * `create_guest_order` dari `branches.is_default`. Menerimanya dari form
     * berarti pengunjung anonim bisa menyetir order ke cabang mana pun.
     */

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

    /**
     * Tahap 4 — tanggal & jam pelaksanaan yang diminta pemesan.
     *
     * Bentuknya tanggal kalender, bukan timestamp: yang dipilih pemesan adalah
     * "17 Agustus pukul 09:00" menurut jam Indonesia, dan itulah yang disimpan
     * `orders.requested_date` / `requested_time`. Mengubahnya jadi timestamptz
     * lebih dulu hanya menambah satu kesempatan bergeser tujuh jam.
     */
    requested_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal pelaksanaan'),

    requested_time: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, 'Pilih jam pelaksanaan'),

    /** Tahap 4 — menentukan apakah alamat pengiriman wajib. */
    distribution_mode: z.enum(['salur', 'kirim'], {
      message: 'Pilih cara penyaluran',
    }),

    /**
     * Domba tidak ditawarkan di checkout publik (19 Agustus 2026) — enum
     * `animal_species` di database tetap punya `domba` karena order yang dibuat
     * staf masih boleh memakainya. `create_guest_order` menolaknya juga, jadi
     * mengirimnya lewat jalur lain tetap gagal.
     */
    species: z.enum(['kambing', 'sapi'], { message: 'Jenis hewan tidak dikenali' }),

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

    /**
     * Alamat pengiriman terstruktur — hanya relevan untuk Aqiqah Kirim.
     *
     * Yang dikirim ke server **hanya kodenya**; nama wilayahnya diambil RPC dari
     * tabel `regions`. Nama yang dikirim klien bisa tidak cocok dengan kodenya,
     * dan yang dibaca kurir adalah namanya.
     *
     * `delivery_address` sebagai teks bebas sudah tidak ada di sini: kolom itu
     * kini dirakit RPC dari bagian-bagian ini, supaya tidak ada dua tempat yang
     * menyusun teks yang sama dengan hasil berbeda.
     *
     * Optional di tingkat medan, wajib di `superRefine` saat modenya `kirim` —
     * kalau diwajibkan di sini, Aqiqah Salur ikut tertolak.
     */
    delivery_province_code: regionCode(1, 'Pilih provinsi tujuan'),
    delivery_city_code: regionCode(2, 'Pilih kabupaten/kota tujuan'),
    delivery_district_code: regionCode(3, 'Pilih kecamatan tujuan'),
    delivery_village_code: regionCode(4, 'Pilih kelurahan/desa tujuan'),

    delivery_postal_code: z
      .string()
      .trim()
      .regex(/^[0-9]{5}$/, 'Kode pos harus 5 digit angka')
      .optional()
      .or(z.literal('')),

    /** Nama jalan, nomor rumah, RT/RW, patokan — yang tidak ada di daftar wilayah. */
    delivery_detail: z
      .string()
      .trim()
      .max(500, 'Detail alamat terlalu panjang')
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
    if (v.distribution_mode === 'kirim') {
      const wilayah = [
        ['delivery_province_code', v.delivery_province_code, 'Pilih provinsi tujuan'],
        ['delivery_city_code', v.delivery_city_code, 'Pilih kabupaten/kota tujuan'],
        ['delivery_district_code', v.delivery_district_code, 'Pilih kecamatan tujuan'],
        ['delivery_village_code', v.delivery_village_code, 'Pilih kelurahan/desa tujuan'],
      ] as const;

      for (const [path, value, message] of wilayah) {
        if (!value) ctx.addIssue({ code: 'custom', path: [path], message });
      }

      if (!v.delivery_detail?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['delivery_detail'],
          message: 'Isi nama jalan dan nomor rumah',
        });
      }

      if (!v.delivery_postal_code) {
        ctx.addIssue({
          code: 'custom',
          path: ['delivery_postal_code'],
          message: 'Kode pos wajib diisi',
        });
      }

      // Sejalur atau tidak dibaca dari kodenya sendiri: kode Kemendagri
      // bersarang, jadi kelurahan yang berasal dari provinsi lain ketahuan tanpa
      // menyentuh database. Aturan yang sama ditegakkan ulang di dalam RPC —
      // empat kode yang masing-masing sah masih bisa merakit alamat yang tidak
      // pernah ada di dunia nyata.
      const nested =
        !v.delivery_province_code ||
        !v.delivery_city_code ||
        !v.delivery_district_code ||
        !v.delivery_village_code ||
        (v.delivery_city_code.startsWith(`${v.delivery_province_code}.`) &&
          v.delivery_district_code.startsWith(`${v.delivery_city_code}.`) &&
          v.delivery_village_code.startsWith(`${v.delivery_district_code}.`));

      if (!nested) {
        ctx.addIssue({
          code: 'custom',
          path: ['delivery_village_code'],
          message: 'Wilayah tujuan tidak sejalur — pilih ulang dari provinsi',
        });
      }
    }

    // Memilih paket nasi box tanpa jumlah berarti tidak ada yang bisa dipesan.
    if (v.nasi_box_service_id && !v.nasi_box_qty) {
      ctx.addIssue({
        code: 'custom',
        path: ['nasi_box_qty'],
        message: 'Isi jumlah nasi box, atau pilih "Tidak pakai"',
      });
    }

    // Jendela pemesanan dihitung saat parse, bukan saat modul dimuat: proses
    // server hidup berhari-hari, jadi batas yang dibekukan di konstanta modul
    // akan menolak "besok" begitu tanggal berganti.
    if (v.requested_date < bookingMinDate()) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_date'],
        message: 'Tanggal pelaksanaan sudah lewat',
      });
    } else if (v.requested_date > bookingMaxDate()) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_date'],
        message: `Pemesanan hanya bisa untuk ${BOOKING_MAX_DAYS} hari ke depan. Untuk tanggal yang lebih jauh, hubungi admin.`,
      });
    }

    if (!(BOOKING_TIME_SLOTS as readonly string[]).includes(v.requested_time)) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_time'],
        message: 'Pilih salah satu jam pelaksanaan yang tersedia',
      });
    }
  });

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

/**
 * Jenis hewan yang masuk akal per jenis layanan.
 *
 * Aturan yang sama ditegakkan di dalam RPC; disatukan di sini supaya form tidak
 * pernah menawarkan pilihan yang pasti ditolak server.
 *
 * Aqiqah sekarang hanya kambing — domba dicabut dari checkout publik pada
 * 19 Agustus 2026 atas permintaan operasional.
 */
export const SPECIES_BY_SERVICE_TYPE: Record<string, Array<'kambing' | 'sapi'>> = {
  aqiqah: ['kambing'],
  qurban: ['kambing', 'sapi'],
};
