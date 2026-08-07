import type { Database } from '@/types/database';
import type { DocStatus } from './storage';

type UserRole = Database['public']['Enums']['user_role'];

/** Tingkat validasi yang dipegang seorang pengguna (docs/10 section 4). */
export type ReviewLevel = 'supervisor' | 'final';

/**
 * Tingkat validasi berdasarkan role.
 *
 * Sengaja diturunkan dari role, **bukan** dikirim klien: kalau tingkatnya bisa
 * dipilih dari luar, seorang Supervisor dapat meminta status `approved` penuh
 * dan melewati validasi Admin Pusat sama sekali.
 */
export function reviewLevelFor(
  role: UserRole | undefined,
  isSupervisor: boolean,
): ReviewLevel | null {
  if (role === 'admin_pusat') return 'final';
  if (isSupervisor && (role === 'manager_program' || role === 'admin_cabang')) return 'supervisor';
  return null;
}

/** Status yang boleh ditangani tiap tingkat. */
const REVIEWABLE_FROM: Record<ReviewLevel, DocStatus> = {
  supervisor: 'pending',
  final: 'approved_supervisor',
};

export function nextDocStatus(level: ReviewLevel, decision: 'approve' | 'reject'): DocStatus {
  if (decision === 'reject') return 'rejected';
  return level === 'supervisor' ? 'approved_supervisor' : 'approved';
}

export type ReviewCheck =
  | { ok: true; level: ReviewLevel; next: DocStatus }
  | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

/**
 * Validasi satu keputusan review.
 *
 * Menegakkan tiga hal sekaligus (docs/10 section 4):
 * 1. Tingkat sesuai role — Supervisor tidak bisa menyetujui final.
 * 2. Urutan tidak dilompati — pusat hanya menangani yang sudah lolos tingkat-1.
 * 3. **Pemisahan tugas** — pengupload tidak boleh memvalidasi unggahannya sendiri.
 */
export function checkReview(params: {
  currentStatus: DocStatus;
  decision: 'approve' | 'reject';
  role: UserRole | undefined;
  isSupervisor: boolean;
  uploadedBy: string | null;
  reviewerId: string;
}): ReviewCheck {
  const level = reviewLevelFor(params.role, params.isSupervisor);

  if (!level) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message:
        'Role Anda tidak berhak memvalidasi dokumentasi. Validasi tingkat-1 oleh Supervisor, tingkat akhir oleh Admin Pusat.',
    };
  }

  // Pemisahan tugas: tanpa ini, seorang Supervisor yang juga mengunggah bisa
  // meloloskan buktinya sendiri — persis yang dicegah docs/10 section 4.
  if (params.uploadedBy && params.uploadedBy === params.reviewerId) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Anda tidak dapat memvalidasi dokumentasi yang Anda unggah sendiri.',
    };
  }

  const expected = REVIEWABLE_FROM[level];
  if (params.currentStatus !== expected) {
    const reason =
      params.currentStatus === 'approved'
        ? 'Dokumentasi sudah tervalidasi penuh.'
        : params.currentStatus === 'rejected'
          ? 'Dokumentasi sudah ditolak. Petugas perlu mengunggah ulang.'
          : level === 'final'
            ? 'Dokumentasi ini belum lolos validasi tingkat-1 Supervisor.'
            : 'Dokumentasi ini sudah lewat dari antrian validasi tingkat-1.';

    return { ok: false, code: 'CONFLICT', message: reason };
  }

  return { ok: true, level, next: nextDocStatus(level, params.decision) };
}

export type DocStageCounts = {
  approvedSlaughter: number;
  approvedDistribution: number;
};

/**
 * Kelengkapan minimum dokumentasi sebelum order boleh naik ke `reporting`
 * (docs/10 section 5).
 *
 * Dihitung **per order**, bukan per hewan — kebijakan baku agar beban upload di
 * lapangan tetap ringan.
 */
export function missingDocumentationStages(counts: DocStageCounts): string[] {
  const missing: string[] = [];
  if (counts.approvedSlaughter < 1) missing.push('pemotongan');
  if (counts.approvedDistribution < 1) missing.push('distribusi');
  return missing;
}

export function isDocumentationComplete(counts: DocStageCounts): boolean {
  return missingDocumentationStages(counts).length === 0;
}
