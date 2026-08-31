import type { Database } from '@/types/database';
import type { DocStatus } from './storage';

type UserRole = Database['public']['Enums']['user_role'];

/**
 * Status yang masih menunggu keputusan.
 *
 * Validasi satu tingkat: vendor unggah (`pending`), admin memutuskan. Tangga
 * dua tingkat lama sudah tidak ada di enum — skema dibangun ulang dari nol,
 * jadi tidak ada baris warisan yang perlu dijaga jalurnya.
 */
export const REVIEWABLE_DOC_STATUSES: DocStatus[] = ['pending'];

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

/**
 * Kelengkapan bukti sebelum order boleh naik ke `reporting`.
 *
 * **Perhitungannya tidak di sini lagi.** `v_order_progress.missing_doc_stages`
 * menurunkannya dari tabel `stage_requirements` menurut cara penyaluran order —
 * satu sumber kebenaran di database. Fungsi di bawah hanya memformat hasilnya
 * untuk layar.
 *
 * Alasannya: tahapan kini bercabang. Aturan yang ditulis di TypeScript harus
 * disalin ke guard transisi juga, dan dengan dua alur salinan itu jadi empat
 * tempat yang harus dijaga sinkron selamanya.
 */
export function formatMissingDocStages(stages: string[], labels: Record<string, string>): string[] {
  return stages.map((s) => labels[s] ?? s);
}

export function isDocumentationComplete(missingStages: string[]): boolean {
  return missingStages.length === 0;
}
