import { z } from 'zod';

const uuid = z.string().uuid('Pilihan tidak valid');

/** Toleransi selisih jam klien & server sebelum sebuah waktu dianggap masa depan. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Laporan satu tahap oleh vendor.
 *
 * Bentuknya satu untuk semua tahap, tapi medan yang **berarti** berbeda-beda —
 * dan itu ditegakkan `superRefine` di bawah, bukan dibiarkan pada kebiasaan
 * pengisi. Yang tidak relevan tidak sekadar diabaikan: mengirimnya ditolak,
 * supaya tidak ada data yang tersimpan tapi tidak pernah berarti.
 *
 * Perhatikan yang TIDAK ada di sini: alamat tujuan. Pada tahap `kirim`, alamat
 * dibaca dari `orders.delivery_*` — vendor tidak mengetik ulang alamat pembeli,
 * karena alamat yang diketik ulang bisa berbeda dari yang dipesan.
 */
export const reportStageSchema = z
  .object({
    stage_event_id: uuid,

    occurred_at: z
      .string()
      .trim()
      .min(1, 'Waktu pelaksanaan wajib diisi')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Waktu pelaksanaan tidak dikenali'),

    notes: z.string().trim().max(1000, 'Catatan terlalu panjang').optional().or(z.literal('')),

    /** Tahap salur & kirim: berapa paket yang diserahkan/diantar. */
    packages_count: z
      .number()
      .int('Jumlah paket harus bilangan bulat')
      .min(0, 'Jumlah paket tidak boleh negatif')
      .max(10000, 'Jumlah paket di luar batas wajar')
      .optional(),

    /** Tahap salur: siapa penerimanya. Tahap terkirim: siapa yang menerima. */
    recipient_name: z
      .string()
      .trim()
      .max(150, 'Nama penerima terlalu panjang')
      .optional()
      .or(z.literal('')),
    recipient_phone: z
      .string()
      .trim()
      .max(20, 'Nomor terlalu panjang')
      .optional()
      .or(z.literal('')),
    /** Tahap salur saja — area penerima manfaat. */
    recipient_area: z.string().trim().max(200, 'Area terlalu panjang').optional().or(z.literal('')),

    /** Tahap sembelih: bobot hasil, opsional. */
    weight_kg: z
      .number()
      .min(0, 'Bobot tidak boleh negatif')
      .max(2000, 'Bobot di luar batas wajar')
      .optional(),

    lat: z
      .number()
      .min(-90, 'Lintang di luar rentang')
      .max(90, 'Lintang di luar rentang')
      .optional(),
    lng: z.number().min(-180, 'Bujur di luar rentang').max(180, 'Bujur di luar rentang').optional(),
  })
  .superRefine((v, ctx) => {
    // Waktu pelaksanaan tidak boleh di masa depan. Toleransi selisih jam
    // diberikan karena jam perangkat vendor di lapangan sering meleset.
    if (Date.parse(v.occurred_at) > Date.now() + CLOCK_SKEW_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['occurred_at'],
        message: 'Waktu pelaksanaan tidak boleh di masa depan',
      });
    }

    // Koordinat wajib berpasangan: satu tanpa pasangannya adalah titik yang
    // tidak bisa dipetakan.
    const adaLat = v.lat !== undefined;
    const adaLng = v.lng !== undefined;
    if (adaLat !== adaLng) {
      ctx.addIssue({
        code: 'custom',
        path: [adaLat ? 'lng' : 'lat'],
        message: 'Titik lokasi harus berisi lintang dan bujur sekaligus',
      });
    }
  });

export type ReportStageInput = z.infer<typeof reportStageSchema>;

/**
 * Keputusan admin atas satu laporan tahap.
 *
 * Penolakan wajib beralasan: tanpa itu vendor tidak tahu apa yang harus
 * diperbaiki, dan constraint `stage_events_reject_reason_check` di database
 * memang menolaknya.
 */
export const reviewStageSchema = z
  .object({
    stage_event_id: uuid,
    decision: z.enum(['validate', 'reject']),
    review_note: z.string().trim().max(500, 'Catatan terlalu panjang').optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'reject' && !v.review_note) {
      ctx.addIssue({
        code: 'custom',
        path: ['review_note'],
        message: 'Alasan penolakan wajib diisi',
      });
    }
  });

export type ReviewStageInput = z.infer<typeof reviewStageSchema>;

/** Filter antrian validasi tahap. */
export const stageQueueFilterSchema = z.object({
  stage: z
    .enum(['persiapan', 'sembelih', 'masak', 'salur', 'kirim', 'terkirim'])
    .optional()
    .catch(undefined),
  vendor_id: z.string().uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type StageQueueFilterInput = z.infer<typeof stageQueueFilterSchema>;
