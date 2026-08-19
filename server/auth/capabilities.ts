import 'server-only';
import type { UserRole } from './session';

/**
 * Kapabilitas action-level untuk tiga role.
 *
 *   superadmin  akses penuh atas segalanya
 *   admin       penghubung pembeli & vendor: verifikasi order, verifikasi
 *               pembayaran, penugasan vendor, validasi bukti dari vendor
 *   vendor      pelaksana lapangan; hanya order yang ditugaskan padanya
 *
 * Daftar di sini adalah cerminan kebijakan RLS di
 * `20260819040000_three_roles.sql`. Kalau keduanya menyimpang, UI akan
 * menawarkan aksi yang pasti ditolak database — atau lebih buruk,
 * menyembunyikan aksi yang sebenarnya boleh.
 */
const STAFF: UserRole[] = ['superadmin', 'admin'];
const ALL: UserRole[] = ['superadmin', 'admin', 'vendor'];

export const CAPABILITIES = {
  /** Ubah status order (transisi valid) — vendor menggerakkan tahap lapangan. */
  UPDATE_ORDER_STATUS: ALL,

  /** Ubah data order non-status (catatan, nilai order) */
  UPDATE_ORDER: STAFF,

  /**
   * Ubah nilai `total_amount` sebuah order.
   *
   * Dipisah dari UPDATE_ORDER karena total_amount adalah pembanding payment gate
   * (`paid_amount >= total_amount * min_dp_ratio`). Siapa pun yang bisa
   * menurunkannya bisa meloloskan order tanpa uang masuk, jadi haknya berhenti
   * di superadmin — harga adalah keputusan pemilik usaha, bukan operasional.
   */
  UPDATE_ORDER_AMOUNT: ['superadmin'] as UserRole[],

  /**
   * Verifikasi order tamu sebelum masuk alur operasional (`prd.md` FR-C2).
   *
   * Inilah pintu pertama peran admin: order dari checkout publik masuk tanpa
   * `created_by` dan tertahan di status `new` sampai seseorang benar-benar
   * memeriksanya, lalu mencarikan vendor yang siap mengambilnya.
   *
   * Daftarnya sengaja identik dengan `enforce_guest_order_verification` yang
   * kini memakai `is_staff()`.
   */
  VERIFY_GUEST_ORDER: STAFF,

  /** Tambah/ubah/hapus data hewan pada order */
  MANAGE_ANIMALS: ALL,

  /**
   * Catat pelaksanaan lapangan: pemotongan & distribusi (docs/08 section 3).
   * Vendor termasuk — merekalah aktor kedua tahap ini — sejalan dengan
   * `can_write_order` yang memberi mereka akses pada order yang ditugaskan.
   */
  RECORD_FIELD_WORK: ALL,

  /**
   * Hapus catatan pemotongan/distribusi.
   *
   * Dipisah dari pencatatan dan dibatasi superadmin: catatan ini bukti
   * pelaksanaan yang sudah terhitung di KPI dan melepas guard transisi order.
   */
  DELETE_FIELD_RECORD: ['superadmin'] as UserRole[],

  /**
   * Tandai & kelola kendala pada order (`prd.md` FR-SL4, docs/16 section 11).
   *
   * Daftar rolenya sengaja identik dengan `can_write_order` yang dipakai RLS
   * `issues_insert` / `issues_update` — kendala paling sering muncul di
   * lapangan, jadi vendor harus bisa melaporkannya sendiri.
   */
  MANAGE_ISSUES: ALL,

  /**
   * Catat pembayaran masuk & unggah bukti transfer.
   *
   * Vendor sama sekali di luar urusan pembayaran: uang mengalir antara pembeli
   * dan kami, bukan antara pembeli dan vendor. Sama dengan kebijakan Storage
   * `storage_payment_proofs_write` dan RLS `payments_write`.
   */
  RECORD_PAYMENT: STAFF,

  /** Verifikasi pembayaran pembeli — tugas inti admin. */
  VERIFY_PAYMENT: STAFF,

  /**
   * Tetapkan tanggal, lokasi, dan **vendor pelaksana**.
   *
   * Inilah yang membuat vendor bisa melihat sebuah order sama sekali:
   * `can_read_order` memberi vendor akses lewat `schedules.pic_user_id`. Jadi
   * kapabilitas ini sekaligus pintu masuk data — karenanya berhenti di staf.
   */
  MANAGE_SCHEDULE: STAFF,

  /** Unggah dokumentasi lapangan (docs/10 section 3) — pekerjaan vendor. */
  UPLOAD_DOCUMENTATION: ALL,

  /**
   * Validasi bukti yang dikirim vendor.
   *
   * Satu tingkat sejak 19 Agustus 2026: `pending -> approved`. Pemisahan tugas
   * tetap berlaku — pengunggah tidak bisa memvalidasi unggahannya sendiri —
   * dan itu ditegakkan `checkReview` serta trigger, bukan daftar ini.
   */
  VALIDATE_DOCUMENTATION: STAFF,

  /** Generate & kirim laporan */
  GENERATE_REPORT: STAFF,

  /** Kelola master data & user */
  MANAGE_MASTER_DATA: ['superadmin'] as UserRole[],

  /** Akses audit trail penuh */
  VIEW_FULL_AUDIT: STAFF,
} as const;

export type Capability = keyof typeof CAPABILITIES;

export function canDo(role: UserRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly UserRole[]).includes(role);
}
