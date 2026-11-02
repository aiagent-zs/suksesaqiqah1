import { z } from 'zod';
import {
  BOOKING_MAX_DAYS,
  BOOKING_MIN_DAYS,
  BOOKING_TIME_SLOTS,
  bookingMaxDate,
  bookingMinDate,
} from '@/features/checkout/schema';
import { todayWib } from '@/lib/format/date-range';
import { OUT_OF_AREA_MESSAGE, isInServiceArea } from '@/features/checkout/service-area';

/**
 * Jendela pemesanan & slot jam **dipakai ulang dari checkout aqiqah**, tidak
 * disalin: keduanya menjawab pertanyaan operasional yang sama (berapa lama
 * persiapan, jam berapa layanan berjalan), dan dua salinan yang harus dijaga
 * sama selamanya adalah kembaran yang paling gampang menyimpang diam-diam.
 *
 * Kalau kelak katering menuntut jeda berbeda dari aqiqah, itulah saatnya
 * memisahkan — dan saat itu perbedaannya akan disengaja, bukan kebetulan.
 */
export { BOOKING_MIN_DAYS, BOOKING_MAX_DAYS, BOOKING_TIME_SLOTS, bookingMinDate, bookingMaxDate };

const uuid = z.string().uuid('Pilihan tidak valid');

/** Batas jenis paket dalam satu pesanan; cermin `create_catering_order`. */
export const MAX_ITEM_LINES = 10;

/** Batas box per baris; cermin `create_catering_order`. */
export const MAX_QTY_PER_LINE = 5000;

/** Batas box seluruh pesanan; cermin `create_catering_order`. */
export const MAX_TOTAL_BOXES = 10_000;

/**
 * Kode wilayah Kemendagri bersarang per dua digit, kecuali kelurahan yang
 * empat. Diperiksa **per tingkat** — pola longgar akan meloloskan kode provinsi
 * yang mendarat di kolom kelurahan.
 *
 * Disalin dari `features/checkout/schema.ts` karena di sana ia tidak diekspor;
 * bentuknya ditentukan Kemendagri, bukan oleh salah satu form, jadi risiko
 * menyimpangnya nol.
 */
const REGION_CODE_PATTERN: Record<number, RegExp> = {
  1: /^\d{2}$/,
  2: /^\d{2}\.\d{2}$/,
  3: /^\d{2}\.\d{2}\.\d{2}$/,
  4: /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/,
};

function regionCode(level: 1 | 2 | 3 | 4, message: string) {
  return z.string().trim().regex(REGION_CODE_PATTERN[level], message);
}

/** Satu baris pesanan: paket katering + jumlah box. */
export const cateringItemSchema = z.object({
  service_id: uuid,
  qty: z.coerce
    .number()
    .int('Jumlah box harus bilangan bulat')
    .min(1, 'Minimal 1 box')
    .max(MAX_QTY_PER_LINE, `Untuk pesanan di atas ${MAX_QTY_PER_LINE} box, hubungi admin`),
});

export type CateringItemInput = z.infer<typeof cateringItemSchema>;

/**
 * Payload checkout katering.
 *
 * Perhatikan yang **tidak** ada di sini — dan bedakan dua sebabnya:
 *
 * 1. **Harga, total, status, jumlah terbayar.** Sama seperti checkout aqiqah:
 *    ditentukan `create_catering_order` dari tabel `services`. Menerimanya dari
 *    form berarti siapa pun bisa memesan seharga nol rupiah.
 *
 * 2. **`distribution_mode`, data anak, jenis hewan, jumlah ekor.** Katering
 *    tidak punya satu pun dari itu. Modenya selalu `kirim` dan ditetapkan RPC,
 *    bukan dipilih pemesan — katering memang selalu diantar.
 */
export const cateringCheckoutSchema = z
  .object({
    /**
     * Beberapa paket sekaligus, mis. 50 box Sederhana + 30 box Lengkap.
     *
     * Array, bukan satu `service_id`: acara sungguhan sering memesan dua jenis
     * — nasi kotak biasa untuk umum dan yang lengkap untuk tamu kehormatan.
     */
    items: z
      .array(cateringItemSchema)
      .min(1, 'Pilih minimal satu paket katering')
      .max(
        MAX_ITEM_LINES,
        `Maksimal ${MAX_ITEM_LINES} jenis paket. Untuk lebih beragam, hubungi admin`,
      ),

    requested_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal pengiriman'),

    requested_time: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, 'Pilih jam pengiriman'),

    name: z.string().trim().min(2, 'Nama pemesan wajib diisi').max(150, 'Nama terlalu panjang'),

    phone: z
      .string()
      .trim()
      .min(8, 'Nomor telepon terlalu pendek')
      .max(20, 'Nomor telepon terlalu panjang')
      .regex(/^[0-9+()\- ]+$/, 'Nomor telepon hanya boleh angka dan tanda + ( ) -'),

    email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid').max(200),

    address: z.string().trim().max(500, 'Alamat terlalu panjang').optional().or(z.literal('')),

    /**
     * Alamat pengiriman — **wajib tanpa syarat**, berbeda dari checkout aqiqah
     * yang mewajibkannya hanya saat mode `kirim`. Katering selalu diantar, jadi
     * tidak ada cabang yang perlu ditanyakan lebih dulu.
     *
     * Yang dikirim hanya kodenya; nama wilayahnya dibaca RPC dari `regions` —
     * yang dibaca kurir adalah namanya, dan nama kiriman klien bisa tidak cocok
     * dengan kodenya.
     */
    delivery_province_code: regionCode(1, 'Pilih provinsi tujuan'),
    delivery_city_code: regionCode(2, 'Pilih kabupaten/kota tujuan'),
    delivery_district_code: regionCode(3, 'Pilih kecamatan tujuan'),
    delivery_village_code: regionCode(4, 'Pilih kelurahan/desa tujuan'),

    delivery_postal_code: z
      .string()
      .trim()
      .regex(/^[0-9]{5}$/, 'Kode pos harus 5 digit angka'),

    delivery_detail: z
      .string()
      .trim()
      .min(1, 'Isi nama jalan dan nomor bangunan')
      .max(500, 'Detail alamat terlalu panjang'),

    /** Nama acara/instansi penerima — masjid, kantor, sekolah, panitia. */
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
  .superRefine((v, ctx) => {
    // Wilayah sejalur dibaca dari kodenya sendiri: kode Kemendagri bersarang,
    // jadi kelurahan dari provinsi lain ketahuan tanpa menyentuh database.
    // Ditegakkan ulang di RPC — empat kode yang masing-masing sah masih bisa
    // merakit alamat yang tidak pernah ada.
    const nested =
      v.delivery_city_code.startsWith(`${v.delivery_province_code}.`) &&
      v.delivery_district_code.startsWith(`${v.delivery_city_code}.`) &&
      v.delivery_village_code.startsWith(`${v.delivery_district_code}.`);

    if (!nested) {
      ctx.addIssue({
        code: 'custom',
        path: ['delivery_village_code'],
        message: 'Wilayah tujuan tidak sejalur. Pilih ulang dari provinsi.',
      });
    }

    if (!isInServiceArea(v.delivery_city_code)) {
      ctx.addIssue({ code: 'custom', path: ['delivery_city_code'], message: OUT_OF_AREA_MESSAGE });
    }

    // Paket yang sama dipilih dua kali adalah kekeliruan pengisian, bukan
    // pesanan sungguhan. Ditolak di sini supaya galatnya menempel pada barisnya,
    // bukan datang sebagai galat database setelah seluruh form terisi.
    const seen = new Set<string>();
    v.items.forEach((item, i) => {
      if (seen.has(item.service_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'service_id'],
          message: 'Paket ini sudah dipilih. Gabungkan jumlahnya.',
        });
      }
      seen.add(item.service_id);
    });

    const totalBoxes = v.items.reduce((sum, i) => sum + (i.qty || 0), 0);
    if (totalBoxes > MAX_TOTAL_BOXES) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: `Total di atas ${MAX_TOTAL_BOXES.toLocaleString('id-ID')} box. Hubungi admin untuk penawaran khusus.`,
      });
    }

    // Jendela pemesanan dihitung saat parse, bukan saat modul dimuat: proses
    // server hidup berhari-hari, jadi batas yang dibekukan di konstanta modul
    // akan menolak "besok" begitu tanggal berganti.
    if (v.requested_date < todayWib()) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_date'],
        message: 'Tanggal pengiriman sudah lewat',
      });
    } else if (v.requested_date < bookingMinDate()) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_date'],
        message: `Pengiriman paling cepat ${BOOKING_MIN_DAYS} hari setelah pemesanan. Untuk yang lebih mendesak, hubungi admin.`,
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
        message: 'Pilih salah satu jam pengiriman yang tersedia',
      });
    }
  });

export type CateringCheckoutInput = z.infer<typeof cateringCheckoutSchema>;
