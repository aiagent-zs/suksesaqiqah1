import 'server-only';
import type { UserRole } from './session';

/**
 * Kapabilitas action-level (docs/07 section 4).
 * Setiap kapabilitas memetakan role yang berhak melakukannya.
 */
export const CAPABILITIES = {
  /** Ubah status order (transisi valid) */
  UPDATE_ORDER_STATUS: [
    'manager_program',
    'admin_cabang',
    'petugas_lapangan',
  ] as UserRole[],

  /** Verifikasi pembayaran */
  VERIFY_PAYMENT: ['manager_program', 'admin_cabang'] as UserRole[],

  /** Validasi dokumentasi tingkat-1 (Supervisor) */
  VALIDATE_DOC_LEVEL1: ['manager_program', 'admin_cabang'] as UserRole[],

  /** Validasi dokumentasi tingkat-akhir */
  VALIDATE_DOC_FINAL: ['admin_pusat'] as UserRole[],

  /** Generate & kirim laporan */
  GENERATE_REPORT: [
    'manager_program',
    'admin_pusat',
    'admin_cabang',
  ] as UserRole[],

  /** Kelola master data & user */
  MANAGE_MASTER_DATA: ['manager_program'] as UserRole[],

  /** Lihat seluruh cabang */
  VIEW_ALL_BRANCHES: [
    'direktur',
    'manager_program',
    'admin_pusat',
  ] as UserRole[],

  /** Akses audit trail penuh */
  VIEW_FULL_AUDIT: [
    'direktur',
    'manager_program',
    'admin_pusat',
  ] as UserRole[],
} as const;

export type Capability = keyof typeof CAPABILITIES;

/**
 * Cek apakah sebuah role punya kapabilitas tertentu.
 * Catatan: untuk VALIDATE_DOC_LEVEL1 juga butuh is_supervisor=true — cek itu di server action.
 */
export function canDo(role: UserRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly UserRole[]).includes(role);
}
