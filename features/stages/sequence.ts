import type { Database } from '@/types/database';

export type FulfilmentStage = Database['public']['Enums']['fulfilment_stage'];
export type DistributionMode = Database['public']['Enums']['distribution_mode'];
export type StageEventStatus = Database['public']['Enums']['stage_event_status'];

/**
 * Urutan tahap menurut cara penyaluran.
 *
 * **Kembaran `public.fulfilment_sequence()` di database.** Keduanya sengaja
 * ada: yang di SQL menegakkan urutan lewat trigger dan membangkitkan daftar
 * tahap saat mitra ditugaskan; yang di sini merender stepper tanpa perlu
 * bertanya ke server. Ada tes yang menuntut isinya sama persis — kembaran
 * seperti ini yang paling gampang menyimpang diam-diam.
 *
 * Percabangannya nyata, bukan sekadar label: order `salur` selesai begitu
 * daging disalurkan, sementara `kirim` masih menyisakan pengantaran dan
 * konfirmasi diterima di alamat pemesan.
 */
export const STAGE_SEQUENCE: Record<DistributionMode, FulfilmentStage[]> = {
  salur: ['persiapan', 'sembelih', 'masak', 'salur'],
  kirim: ['persiapan', 'sembelih', 'masak', 'kirim', 'terkirim'],
};

export function stageSequence(mode: DistributionMode | null | undefined): FulfilmentStage[] {
  if (!mode) return [];
  return STAGE_SEQUENCE[mode];
}

type StageMeta = {
  label: string;
  /** Kalimat pendek yang menerangkan apa yang harus dilaporkan vendor. */
  hint: string;
  className: string;
};

export const STAGE_META: Record<FulfilmentStage, StageMeta> = {
  persiapan: {
    label: 'Persiapan',
    hint: 'Hewan disiapkan dan diperiksa sebelum disembelih.',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  sembelih: {
    label: 'Sembelih',
    hint: 'Pemotongan dicatat per ekor, beserta bukti fotonya.',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  masak: {
    label: 'Masak',
    hint: 'Daging diolah sesuai paket yang dipesan.',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  salur: {
    label: 'Salur',
    hint: 'Daging diserahkan ke penerima manfaat, lengkap dengan titik lokasinya.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  kirim: {
    label: 'Pengiriman',
    hint: 'Pesanan diberangkatkan ke alamat pemesan.',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  terkirim: {
    label: 'Terkirim',
    hint: 'Pesanan sampai di alamat, dengan bukti serah terima.',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
  },
};

export const STAGE_EVENT_STATUS_META: Record<StageEventStatus, StageMeta> = {
  pending: {
    label: 'Menunggu',
    hint: 'Belum dilaporkan vendor.',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  reported: {
    label: 'Dilaporkan',
    hint: 'Menunggu validasi admin.',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  validated: {
    label: 'Tervalidasi',
    hint: 'Sudah disetujui admin.',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Ditolak',
    hint: 'Perlu diperbaiki dan dilaporkan ulang.',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

export const DISTRIBUTION_MODE_LABEL: Record<DistributionMode, string> = {
  salur: 'Aqiqah Salur',
  kirim: 'Aqiqah Kirim',
};

/**
 * Tahap yang sedang dikerjakan: yang paling awal belum tervalidasi.
 *
 * Sama persis dengan `v_order_stages.current_stage` di database. Dipakai saat
 * kita sudah memegang daftar tahapnya di memori dan tidak perlu query lagi.
 */
export function currentStage(
  events: Array<{ stage: FulfilmentStage; seq: number; status: StageEventStatus }>,
): FulfilmentStage | null {
  const pending = events.filter((e) => e.status !== 'validated').sort((a, b) => a.seq - b.seq);
  return pending[0]?.stage ?? null;
}

/**
 * Apakah tahap ini boleh dilaporkan sekarang.
 *
 * Cerminan trigger `enforce_stage_order`: tahap ke-N tertutup sampai seluruh
 * tahap sebelumnya **tervalidasi**. Dipakai untuk menonaktifkan tombol di layar
 * — bukan sebagai pengaman, karena pengamannya ada di database.
 */
export function canReportStage(
  events: Array<{ stage: FulfilmentStage; seq: number; status: StageEventStatus }>,
  seq: number,
): boolean {
  return events.filter((e) => e.seq < seq).every((e) => e.status === 'validated');
}
