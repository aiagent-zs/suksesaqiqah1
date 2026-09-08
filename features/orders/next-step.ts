import { ORDER_STATUS_META, type OrderStatus } from '@/lib/constants/order';
import { getTransitionOptions, type OrderGuardContext } from './state-machine';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * Panel di halaman detail order, dikenali lewat id anchornya.
 *
 * Nilainya dipakai dua kali dan **harus sama persis** dengan `id` pada elemen
 * di `app/(app)/orders/[id]/page.tsx`: sekali untuk menggulir ke panelnya, dan
 * sekali untuk memutuskan panel mana yang terbuka pada fase ini.
 */
export type PanelId = 'verifikasi' | 'pembayaran' | 'jadwal' | 'hewan' | 'tahap' | 'laporan';

export const PANEL_LABEL: Record<PanelId, string> = {
  verifikasi: 'Order dari checkout publik',
  pembayaran: 'Pembayaran',
  jadwal: 'Jadwal & Mitra',
  hewan: 'Hewan',
  tahap: 'Tahap Pelaksanaan',
  laporan: 'Laporan Peserta',
};

export type NextStep = {
  /** Kalimat perintah: apa yang harus dikerjakan sekarang. */
  title: string;
  /** Panel tempat pekerjaan itu dilakukan. `null` = tidak ada yang perlu diisi. */
  panel: PanelId | null;
  /**
   * Hal-hal yang masih menghalangi order naik ke status berikutnya, apa adanya
   * dari `guard` state machine — jadi layar dan penolakan server tidak pernah
   * berbeda kalimat.
   */
  blockers: string[];
  /** Status berikutnya dalam rangkaian, bila sudah bisa dinaikkan. */
  readyFor: OrderStatus | null;
  /** Order sudah tidak bergerak lagi (selesai / dibatalkan). */
  done: boolean;
};

/**
 * Panel yang **relevan** pada tiap status.
 *
 * Halaman detail order merender sembilan panel sekaligus, selalu terbuka penuh,
 * apa pun statusnya — jadi di order `new` panel Dokumentasi dan Laporan ikut
 * memenuhi layar padahal keduanya baru berguna berminggu-minggu kemudian.
 * Daftar ini yang menentukan mana yang terbuka; sisanya tetap ada tapi terlipat,
 * karena "belum waktunya" bukan alasan untuk menyembunyikannya sama sekali —
 * admin tetap perlu bisa menengok ke belakang.
 */
const RELEVANT_PANELS: Record<OrderStatus, PanelId[]> = {
  new: ['verifikasi'],
  verified: ['pembayaran'],
  // Dua-duanya syarat naik ke `assigned`, dan keduanya sering terlewat justru
  // karena berada di panel yang berbeda.
  paid: ['jadwal', 'hewan'],
  assigned: ['tahap'],
  in_progress: ['tahap'],
  // Bukti kini hidup di dalam panel tahap, jadi keduanya satu tempat.
  validation: ['tahap'],
  reporting: ['laporan'],
  completed: ['laporan'],
  // Tidak ada satu pekerjaan yang jelas: yang menahan ada di alasan statusnya.
  on_hold: [],
  cancelled: [],
};

/** Pekerjaan pokok tiap fase — kalimat perintah, bukan nama status. */
const STEP_TITLE: Record<OrderStatus, string> = {
  new: 'Periksa isi pesanan, lalu tandai terverifikasi',
  verified: 'Catat pembayaran masuk dan verifikasi buktinya',
  paid: 'Tetapkan mitra pelaksana dan daftarkan hewannya',
  assigned: 'Menunggu mitra mulai mengerjakan tahap lapangan',
  in_progress: 'Validasi laporan tahap yang dikirim mitra',
  validation: 'Validasi laporan tahap beserta buktinya',
  reporting: 'Buat laporan peserta lalu kirimkan tautannya',
  completed: 'Order selesai — tidak ada yang perlu dikerjakan',
  on_hold: 'Order ditahan — lanjutkan bila penyebabnya sudah selesai',
  cancelled: 'Order dibatalkan',
};

export function isPanelRelevant(status: OrderStatus, panel: PanelId): boolean {
  return RELEVANT_PANELS[status].includes(panel);
}

/**
 * Turunkan "apa yang harus dikerjakan sekarang" dari status + konteks guard.
 *
 * **Tidak ada aturan baru di sini.** Penghalangnya dibaca dari `guard` state
 * machine yang sama dengan yang ditegakkan server action, jadi tidak mungkin
 * layar mengatakan sesuatu sudah beres sementara tombolnya menolak — atau
 * sebaliknya. Yang ditambahkan modul ini cuma penerjemahan: dari daftar transisi
 * menjadi satu kalimat pekerjaan dan satu panel tujuan.
 */
export function deriveNextStep(
  status: OrderStatus,
  role: UserRole | undefined,
  ctx: OrderGuardContext,
): NextStep {
  const done = status === 'completed' || status === 'cancelled';
  const panels = RELEVANT_PANELS[status];

  // Transisi maju saja. `on_hold` dan `cancelled` adalah jalan keluar, bukan
  // langkah berikutnya — menawarkannya sebagai "yang siap dikerjakan" membuat
  // membatalkan order tampak seperti kemajuan.
  const forward = getTransitionOptions(status, role, ctx).filter(
    (o) => o.to !== 'on_hold' && o.to !== 'cancelled',
  );

  const ready = forward.find((o) => o.allowed) ?? null;

  return {
    title: STEP_TITLE[status],
    panel: panels[0] ?? null,
    blockers: forward.filter((o) => !o.allowed && o.reason).map((o) => o.reason as string),
    readyFor: ready?.to ?? null,
    done,
  };
}

/** Label status berikutnya, untuk tombol/keterangan. */
export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_META[status].label;
}
