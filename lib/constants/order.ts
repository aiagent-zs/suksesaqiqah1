import type { Database } from '@/types/database';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type AnimalStatus = Database['public']['Enums']['animal_status'];
export type AnimalSpecies = Database['public']['Enums']['animal_species'];
export type IssueSeverity = Database['public']['Enums']['issue_severity'];
export type IssueStatus = Database['public']['Enums']['issue_status'];
export type PaymentVerificationStatus = Database['public']['Enums']['payment_verification_status'];

type StatusMeta = {
  label: string;
  /** Kelas pill sesuai design.md — badge selalu fully rounded. */
  className: string;
};

/**
 * Urutan rangkaian administratif order, bukan alfabetis.
 *
 * Empat status lama (preparation, slaughtering, distribution, documentation)
 * melebur jadi `in_progress` + `validation`. Rincian pekerjaannya kini terbaca
 * dari `order_stage_events` — dan **memang harus begitu**, karena tahapannya
 * bercabang menurut cara penyaluran sementara sebuah status tidak bisa
 * bercabang. Stepper di layar menampilkan status ini di atas, dengan tahap
 * lapangan sebagai sub-stepper di bawahnya.
 */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'new',
  'verified',
  'paid',
  'assigned',
  'in_progress',
  'validation',
  'reporting',
  'completed',
];

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  new: { label: 'Baru', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  verified: { label: 'Terverifikasi', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  paid: { label: 'Terbayar', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  assigned: { label: 'Mitra Ditetapkan', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'Dikerjakan', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  validation: { label: 'Validasi', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  reporting: { label: 'Pelaporan', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  completed: { label: 'Selesai', className: 'bg-emerald-600 text-white border-emerald-600' },
  on_hold: { label: 'Ditahan', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelled: { label: 'Dibatalkan', className: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Label untuk kolom yang hanya terisi lewat checkout publik
 * (`orders.aqiqah_for`, `orders.distribution_mode`).
 *
 * Formulir checkout membangun daftar pilihannya sendiri karena tiap opsi di
 * sana membawa keterangan tambahan; peta ini untuk **menampilkan** nilai yang
 * sudah tersimpan, misalnya di panel order tamu pada halaman detail.
 */
export const AQIQAH_FOR_LABEL: Record<string, string> = {
  laki_laki: 'Anak Laki-laki',
  perempuan: 'Anak Perempuan',
};

export const DISTRIBUTION_MODE_LABEL: Record<string, string> = {
  salur: 'Aqiqah Salur — disalurkan ke penerima manfaat',
  kirim: 'Aqiqah Kirim — diantar ke alamat pemesan',
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, StatusMeta> = {
  unpaid: { label: 'Belum Bayar', className: 'bg-red-50 text-red-700 border-red-200' },
  partial: { label: 'DP / Sebagian', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'Lunas', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

/**
 * Status verifikasi satu baris `payments` — beda dengan `payment_status` di
 * `orders`, yang merupakan turunan dari jumlah pembayaran ber-status `verified`
 * (trigger `sync_order_payment`, migration 05).
 */
export const PAYMENT_VERIFICATION_META: Record<PaymentVerificationStatus, StatusMeta> = {
  pending: {
    label: 'Menunggu Verifikasi',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  verified: {
    label: 'Terverifikasi',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: { label: 'Ditolak', className: 'bg-red-50 text-red-700 border-red-200' },
};

/** Metode pembayaran. Kolomnya `text` bebas di DB; daftar ini yang ditawarkan UI. */
export const PAYMENT_METHODS = ['transfer_bank', 'tunai', 'qris', 'lainnya'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer_bank: 'Transfer Bank',
  tunai: 'Tunai',
  qris: 'QRIS',
  lainnya: 'Lainnya',
};

export const ANIMAL_STATUS_META: Record<AnimalStatus, StatusMeta> = {
  registered: { label: 'Terdaftar', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  prepared: { label: 'Disiapkan', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  slaughtered: { label: 'Dipotong', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  distributed: {
    label: 'Terdistribusi',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

/**
 * Urutan tampilan kendala: paling berat lebih dulu — kebalikan urutan enum
 * Postgres (`low` → `high`), karena panel issue dibaca dari yang paling mendesak.
 */
export const ISSUE_SEVERITY_ORDER: IssueSeverity[] = ['high', 'medium', 'low'];

export const ISSUE_SEVERITY_META: Record<IssueSeverity, StatusMeta> = {
  high: { label: 'Berat', className: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: 'Sedang', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Ringan', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

/** Urutan penanganan kendala, sama dengan urutan enum Postgres. */
export const ISSUE_STATUS_ORDER: IssueStatus[] = ['open', 'in_progress', 'resolved'];

export const ISSUE_STATUS_META: Record<IssueStatus, StatusMeta> = {
  open: { label: 'Terbuka', className: 'bg-red-50 text-red-700 border-red-200' },
  in_progress: { label: 'Ditangani', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  resolved: { label: 'Selesai', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

/**
 * Status yang dihitung sebagai "kendala terbuka".
 *
 * Definisi yang sama dipakai `v_open_orders` dan `v_order_progress`
 * (`status in ('open', 'in_progress')`). Kalau daftar ini menyimpang, hitungan
 * di panel order dan angka di dashboard akan berbeda untuk data yang sama.
 */
export const ISSUE_OPEN_STATUSES: IssueStatus[] = ['open', 'in_progress'];

export type DocStatus = Database['public']['Enums']['doc_status'];
export type DocStage = Database['public']['Enums']['doc_stage'];
export type DocType = Database['public']['Enums']['doc_type'];

/**
 * Status validasi bukti — satu tingkat: vendor unggah, admin memutuskan.
 *
 * `approved_supervisor` dari tangga dua tingkat lama sudah tidak ada di enum:
 * skema dibangun ulang dari nol, jadi tidak ada baris warisan yang perlu
 * dijaga jalurnya.
 */
export const DOC_STATUS_META: Record<DocStatus, StatusMeta> = {
  pending: {
    label: 'Menunggu Validasi',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  approved: {
    label: 'Tervalidasi',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: { label: 'Ditolak', className: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Label tahap bukti. Nilainya cerminan `fulfilment_stage` + `umum`, karena
 * gerbang kelengkapan membandingkan keduanya secara langsung.
 */
export const DOC_STAGE_LABEL: Record<DocStage, string> = {
  persiapan: 'Persiapan',
  sembelih: 'Sembelih',
  masak: 'Masak',
  salur: 'Salur',
  kirim: 'Pengiriman',
  terkirim: 'Terkirim',
  umum: 'Umum',
};

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  photo: 'Foto',
  video: 'Video',
  note: 'Catatan',
};

export const ANIMAL_SPECIES_LABEL: Record<AnimalSpecies, string> = {
  kambing: 'Kambing',
  domba: 'Domba',
  sapi: 'Sapi',
};

/** Order yang dianggap "belum selesai" (docs/08 section 8). */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  ...ORDER_STATUS_FLOW.filter((s) => s !== 'completed'),
  'on_hold',
];
