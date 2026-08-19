import type { Database } from '@/types/database';
import type { DocStatus } from './storage';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * Status yang masih menunggu keputusan.
 *
 * `approved_supervisor` ikut, tapi hanya sebagai **jalur warisan**: sejak
 * validasi dipendekkan jadi satu tingkat (19 Agustus 2026) tidak ada lagi yang
 * membuat status itu. Tanpa dimasukkan ke sini, baris yang sempat lolos
 * tingkat-1 sebelum perubahan akan terjebak selamanya. Trigger
 * `enforce_documentation_review_ladder` menerima jalur yang sama persis.
 */
export const REVIEWABLE_DOC_STATUSES: DocStatus[] = ['pending', 'approved_supervisor'];

/**
 * Siapa yang berhak memvalidasi bukti dari vendor.
 *
 * Sengaja diturunkan dari role, **bukan** dikirim klien — dan sengaja bukan
 * vendor: yang mengerjakan tidak boleh sekaligus yang menyatakan pekerjaannya
 * benar.
 */
export function canValidateDocumentation(role: UserRole | undefined): boolean {
  return role === 'superadmin' || role === 'admin';
}

export function nextDocStatus(decision: 'approve' | 'reject'): DocStatus {
  return decision === 'approve' ? 'approved' : 'rejected';
}

export type ReviewCheck =
  { ok: true; next: DocStatus } | { ok: false; code: 'FORBIDDEN' | 'CONFLICT'; message: string };

/**
 * Validasi satu keputusan review.
 *
 * Menegakkan dua hal (docs/10 section 4):
 * 1. Hanya admin/superadmin yang memutuskan — vendor mengunggah, bukan menilai.
 * 2. **Pemisahan tugas** — pengunggah tidak boleh memvalidasi unggahannya
 *    sendiri, sekalipun ia seorang admin.
 */
export function checkReview(params: {
  currentStatus: DocStatus;
  decision: 'approve' | 'reject';
  role: UserRole | undefined;
  uploadedBy: string | null;
  reviewerId: string;
}): ReviewCheck {
  if (!canValidateDocumentation(params.role)) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Role Anda tidak berhak memvalidasi dokumentasi. Validasi dilakukan admin.',
    };
  }

  // Pemisahan tugas: tanpa ini, admin yang juga mengunggah bisa meloloskan
  // buktinya sendiri — persis yang dicegah docs/10 section 4.
  if (params.uploadedBy && params.uploadedBy === params.reviewerId) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Anda tidak dapat memvalidasi dokumentasi yang Anda unggah sendiri.',
    };
  }

  if (!REVIEWABLE_DOC_STATUSES.includes(params.currentStatus)) {
    return {
      ok: false,
      code: 'CONFLICT',
      message:
        params.currentStatus === 'approved'
          ? 'Dokumentasi sudah tervalidasi.'
          : 'Dokumentasi sudah ditolak. Vendor perlu mengunggah ulang.',
    };
  }

  return { ok: true, next: nextDocStatus(params.decision) };
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
