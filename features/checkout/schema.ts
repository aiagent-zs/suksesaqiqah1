import { z } from 'zod';
import { addCalendarDays, todayWib } from '@/lib/format/date-range';

const uuid = z.string().uuid('Pilihan tidak valid');

/**
 * Jeda persiapan minimum, dalam hari, dari hari pemesanan ke tanggal
 * pelaksanaan.
 *
 * `4` berarti hari pengisian form **dan 3 hari sesudahnya** tidak bisa dipilih:
 * mengisi tanggal 10 paling cepat mendapat tanggal 14. Hewan perlu dicari dan
 * disiapkan, dan mitra perlu dijadwalkan — sebelum ini pemesan bisa memilih
 * hari yang sama, dan yang terjadi hanya admin menelepon balik.
 *
 * Angkanya **wajib sama** dengan `app_settings.booking_min_days`.
 */
export const BOOKING_MIN_DAYS = 4;

/**
 * Batas jendela pemesanan, dalam hari.
 *
 * Angkanya **wajib sama** dengan `app_settings.booking_max_days` yang dibaca
 * `create_guest_order`. Pernah berselisih (form 30, RPC 7): pemesan memilih
 * tanggal 20 hari ke depan, lolos seluruh validasi form, lalu ditolak database
 * saat menekan konfirmasi.
 */
export const BOOKING_MAX_DAYS = 30;

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
  '17:00',
] as const;

/**
 * Batas bawah pemilih tanggal: `BOOKING_MIN_DAYS` hari sejak hari ini WIB.
 *
 * **Bukan** "hari ini" — sejak ada jeda persiapan keduanya berbeda. Yang butuh
 * hari ini (batas atas tanggal lahir anak) memakai `todayWib()` langsung.
 */
export function bookingMinDate(now?: Date): string {
  return addCalendarDays(todayWib(now), BOOKING_MIN_DAYS);
}

/** Batas atas pemilih tanggal: `BOOKING_MAX_DAYS` hari sejak hari ini. */
export function bookingMaxDate(now?: Date): string {
  return addCalendarDays(todayWib(now), BOOKING_MAX_DAYS);
}

/**
 * Batas bawah tanggal lahir anak.
 *
 * Bukan usaha menebak umur wajar — aqiqah untuk diri sendiri di usia dewasa itu
 * lazim, jadi tidak ada batas atas umur. Angka ini hanya menyaring salah ketik
 * tahun yang tidak mungkin (`0202`, `1089`), dan sama dengan
 * `orders_child_birth_date_check` di database.
 */
export const CHILD_BIRTH_MIN_DATE = '1900-01-01';

/**
 * Batas atas tanggal lahir: hari ini menurut WIB.
 *
 * Sengaja tidak memakai zona waktu peramban pemesan: yang menilai di ujung sana
 * adalah `create_guest_order` dengan `now() at time zone 'Asia/Jakarta'`, dan
 * peramban di WIT sudah berada di "besok" tujuh jam lebih awal.
 */
export function childBirthMaxDate(now?: Date): string {
  return todayWib(now);
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

    /**
     * Tempat & tanggal lahir anak — keduanya wajib, dan keduanya berhenti di
     * `orders`, bukan di `animals` seperti namanya.
     *
     * Alasannya: satu order boleh berisi dua ekor untuk satu anak yang sama.
     * Data lahir yang menempel pada hewan berarti fakta yang sama disalin per
     * ekor, dan suatu hari dua ekor bisa berselisih tanggal lahir untuk anak
     * yang sama. `aqiqah_for` sudah tinggal di `orders` dengan alasan itu juga.
     *
     * Wajib di sini tanpa syarat, mengikuti `child_name`. RPC mewajibkannya
     * hanya untuk `services.type = 'aqiqah'` — jalur qurban tidak punya anak
     * untuk dicatat, dan form ini memang tidak melayaninya.
     */
    child_birth_place: z
      .string()
      .trim()
      .min(2, 'Tempat lahir anak wajib diisi')
      .max(100, 'Tempat lahir terlalu panjang'),

    child_birth_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Isi tanggal lahir anak'),

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
    if (v.requested_date < todayWib()) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_date'],
        message: 'Tanggal pelaksanaan sudah lewat',
      });
    } else if (v.requested_date < bookingMinDate()) {
      // Dipisah dari "sudah lewat": pemesan yang memilih besok tidak keliru soal
      // kalender, ia hanya belum tahu berapa lama persiapannya.
      ctx.addIssue({
        code: 'custom',
        path: ['requested_date'],
        message: `Pelaksanaan paling cepat ${BOOKING_MIN_DAYS} hari setelah pemesanan. Untuk yang lebih mendesak, hubungi admin.`,
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

    // Batas tanggal lahir, dihitung saat parse dengan alasan yang sama seperti
    // jendela pemesanan di atas: "hari ini" pada proses server yang hidup
    // berhari-hari tidak boleh dibekukan jadi konstanta modul. Perbandingan
    // string aman di sini — `YYYY-MM-DD` berurutan secara leksikografis.
    if (v.child_birth_date > childBirthMaxDate()) {
      ctx.addIssue({
        code: 'custom',
        path: ['child_birth_date'],
        message: 'Tanggal lahir tidak boleh di masa depan',
      });
    } else if (v.child_birth_date < CHILD_BIRTH_MIN_DATE) {
      ctx.addIssue({
        code: 'custom',
        path: ['child_birth_date'],
        message: 'Periksa lagi tahun lahirnya',
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
