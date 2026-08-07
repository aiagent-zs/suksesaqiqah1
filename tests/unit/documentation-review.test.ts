import { describe, expect, it } from 'vitest';
import {
  checkReview,
  isDocumentationComplete,
  missingDocumentationStages,
  nextDocStatus,
  reviewLevelFor,
} from '@/features/documentation/review';
import {
  buildDocPath,
  checkDocFile,
  isDocPathForOrder,
  DOC_MAX_BYTES,
} from '@/features/documentation/storage';

const UUID = '4f3c1a2b-5d6e-4f70-8a91-b2c3d4e5f607';
const UPLOADER = 'a3000000-0000-4000-8000-000000000006';
const REVIEWER = 'a3000000-0000-4000-8000-000000000004';

describe('reviewLevelFor', () => {
  it('memberi tingkat akhir hanya kepada Admin Pusat', () => {
    expect(reviewLevelFor('admin_pusat', false)).toBe('final');
  });

  it('memberi tingkat-1 kepada Supervisor yang ditunjuk', () => {
    expect(reviewLevelFor('admin_cabang', true)).toBe('supervisor');
    expect(reviewLevelFor('manager_program', true)).toBe('supervisor');
  });

  it('menolak Manager/Admin Cabang yang belum ditunjuk sebagai Supervisor', () => {
    // `is_supervisor` adalah penanda terpisah dari role (docs/07 section 1).
    expect(reviewLevelFor('admin_cabang', false)).toBeNull();
    expect(reviewLevelFor('manager_program', false)).toBeNull();
  });

  it('menolak Direktur dan Petugas Lapangan', () => {
    expect(reviewLevelFor('direktur', true)).toBeNull();
    expect(reviewLevelFor('petugas_lapangan', true)).toBeNull();
    expect(reviewLevelFor(undefined, true)).toBeNull();
  });
});

describe('nextDocStatus', () => {
  it('memetakan tingkat & keputusan ke status berikutnya', () => {
    expect(nextDocStatus('supervisor', 'approve')).toBe('approved_supervisor');
    expect(nextDocStatus('final', 'approve')).toBe('approved');
    expect(nextDocStatus('supervisor', 'reject')).toBe('rejected');
    expect(nextDocStatus('final', 'reject')).toBe('rejected');
  });
});

describe('checkReview', () => {
  const base = {
    decision: 'approve' as const,
    uploadedBy: UPLOADER,
    reviewerId: REVIEWER,
  };

  it('Supervisor memproses pending menjadi approved_supervisor', () => {
    const result = checkReview({
      ...base,
      currentStatus: 'pending',
      role: 'admin_cabang',
      isSupervisor: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('approved_supervisor');
  });

  it('Admin Pusat memproses approved_supervisor menjadi approved', () => {
    const result = checkReview({
      ...base,
      currentStatus: 'approved_supervisor',
      role: 'admin_pusat',
      isSupervisor: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('approved');
  });

  it('Supervisor tidak dapat melompati validasi akhir', () => {
    // Tanpa ini, dokumentasi bisa mencapai `approved` tanpa pernah dilihat
    // Admin Pusat — dan `approved` yang masuk laporan peserta.
    const result = checkReview({
      ...base,
      currentStatus: 'approved_supervisor',
      role: 'admin_cabang',
      isSupervisor: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFLICT');
  });

  it('Admin Pusat tidak dapat memproses yang belum lolos tingkat-1', () => {
    const result = checkReview({
      ...base,
      currentStatus: 'pending',
      role: 'admin_pusat',
      isSupervisor: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/tingkat-1/i);
  });

  it('menegakkan pemisahan tugas: pengupload tidak boleh memvalidasi sendiri', () => {
    const result = checkReview({
      ...base,
      currentStatus: 'pending',
      role: 'admin_cabang',
      isSupervisor: true,
      uploadedBy: REVIEWER,
      reviewerId: REVIEWER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('menolak role yang bukan validator', () => {
    for (const role of ['petugas_lapangan', 'direktur'] as const) {
      const result = checkReview({
        ...base,
        currentStatus: 'pending',
        role,
        isSupervisor: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    }
  });

  it('menolak dokumentasi yang sudah final atau sudah ditolak', () => {
    for (const status of ['approved', 'rejected'] as const) {
      const result = checkReview({
        ...base,
        currentStatus: status,
        role: 'admin_pusat',
        isSupervisor: false,
      });
      expect(result.ok).toBe(false);
    }
  });
});

describe('kelengkapan minimum (docs/10 section 5)', () => {
  it('menuntut bukti pemotongan DAN distribusi', () => {
    expect(missingDocumentationStages({ approvedSlaughter: 0, approvedDistribution: 0 })).toEqual([
      'pemotongan',
      'distribusi',
    ]);
    expect(missingDocumentationStages({ approvedSlaughter: 5, approvedDistribution: 0 })).toEqual([
      'distribusi',
    ]);
    expect(isDocumentationComplete({ approvedSlaughter: 1, approvedDistribution: 1 })).toBe(true);
  });
});

describe('checkDocFile', () => {
  it('menurunkan tipe dokumentasi dari MIME', () => {
    expect(checkDocFile({ type: 'image/jpeg', size: 1000 })).toMatchObject({
      ok: true,
      type: 'photo',
    });
    expect(checkDocFile({ type: 'video/mp4', size: 1000 })).toMatchObject({
      ok: true,
      type: 'video',
    });
  });

  it('menolak tipe di luar allowed_mime_types bucket', () => {
    expect(checkDocFile({ type: 'application/pdf', size: 1000 }).ok).toBe(false);
    expect(checkDocFile({ type: 'image/gif', size: 1000 }).ok).toBe(false);
  });

  it('menolak berkas melewati 25 MB', () => {
    expect(checkDocFile({ type: 'video/mp4', size: DOC_MAX_BYTES + 1 }).ok).toBe(false);
    expect(checkDocFile({ type: 'video/mp4', size: DOC_MAX_BYTES }).ok).toBe(true);
  });

  it('menandai foto besar tanpa menolaknya', () => {
    const result = checkDocFile({ type: 'image/jpeg', size: 3 * 1024 * 1024 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.oversizePhoto).toBe(true);
  });
});

describe('isDocPathForOrder', () => {
  const path = buildDocPath({
    branchCode: 'BDG',
    orderNumber: 'IA-202608-0001',
    orderCreatedAt: '2026-08-03T02:00:00.000Z',
    stage: 'slaughter',
    uuid: UUID,
    ext: 'jpg',
  });

  it('membangun path sesuai konvensi docs/17 section 3', () => {
    expect(path).toBe(`BDG/2026/08/IA-202608-0001/slaughter/${UUID}.jpg`);
    expect(isDocPathForOrder(path, 'BDG', 'IA-202608-0001', 'slaughter')).toBe(true);
  });

  it('menolak path milik order, cabang, atau tahap lain', () => {
    // Kebijakan Storage hanya menuntut pengunggah punya role — sama sekali
    // tidak membatasi folder, jadi pemeriksaan ini satu-satunya penjaga.
    expect(isDocPathForOrder(path, 'JKT', 'IA-202608-0001', 'slaughter')).toBe(false);
    expect(isDocPathForOrder(path, 'BDG', 'IA-202608-0002', 'slaughter')).toBe(false);
    expect(isDocPathForOrder(path, 'BDG', 'IA-202608-0001', 'distribution')).toBe(false);
  });

  it('menolak path traversal, bulan tak valid, dan ekstensi terlarang', () => {
    expect(
      isDocPathForOrder(
        `BDG/2026/08/IA-202608-0001/slaughter/../../${UUID}.jpg`,
        'BDG',
        'IA-202608-0001',
        'slaughter',
      ),
    ).toBe(false);
    expect(
      isDocPathForOrder(
        `BDG/2026/13/IA-202608-0001/slaughter/${UUID}.jpg`,
        'BDG',
        'IA-202608-0001',
        'slaughter',
      ),
    ).toBe(false);
    expect(
      isDocPathForOrder(
        `BDG/2026/08/IA-202608-0001/slaughter/${UUID}.exe`,
        'BDG',
        'IA-202608-0001',
        'slaughter',
      ),
    ).toBe(false);
  });
});
