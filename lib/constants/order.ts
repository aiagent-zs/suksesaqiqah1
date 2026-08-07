import type { Database } from '@/types/database';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type AnimalStatus = Database['public']['Enums']['animal_status'];
export type AnimalSpecies = Database['public']['Enums']['animal_species'];
export type ScheduleStatus = Database['public']['Enums']['schedule_status'];
export type IssueSeverity = Database['public']['Enums']['issue_severity'];
export type PaymentVerificationStatus = Database['public']['Enums']['payment_verification_status'];

type StatusMeta = {
  label: string;
  /** Kelas pill sesuai design.md — badge selalu fully rounded. */
  className: string;
};

/**
 * Urutan sesuai rangkaian workflow (docs/08 section 2), bukan alfabetis.
 * Dipakai untuk stepper progres dan urutan opsi filter.
 */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'new',
  'paid',
  'scheduled',
  'preparation',
  'slaughtering',
  'distribution',
  'documentation',
  'reporting',
  'completed',
];

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  new: { label: 'Baru', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  paid: { label: 'Terbayar', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  scheduled: { label: 'Terjadwal', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  preparation: { label: 'Persiapan', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  slaughtering: {
    label: 'Pemotongan',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  distribution: { label: 'Distribusi', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  documentation: { label: 'Dokumentasi', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  reporting: { label: 'Pelaporan', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  completed: { label: 'Selesai', className: 'bg-emerald-600 text-white border-emerald-600' },
  on_hold: { label: 'Ditahan', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelled: { label: 'Dibatalkan', className: 'bg-red-50 text-red-700 border-red-200' },
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

export const SCHEDULE_STATUS_META: Record<ScheduleStatus, StatusMeta> = {
  planned: { label: 'Direncanakan', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  ongoing: { label: 'Berlangsung', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  done: { label: 'Selesai', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
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
