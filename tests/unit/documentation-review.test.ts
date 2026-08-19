import { describe, expect, it } from 'vitest';
import {
  canValidateDocumentation,
  checkReview,
  isDocumentationComplete,
  missingDocumentationStages,
  nextDocStatus,
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

describe('canValidateDocumentation', () => {
  it('admin dan superadmin memvalidasi', () => {
    expect(canValidateDocumentation('admin')).toBe(true);
    expect(canValidateDocumentation('superadmin')).toBe(true);
  });

  it('vendor tidak — yang mengerjakan bukan yang menilai', () => {
    expect(canValidateDocumentation('vendor')).toBe(false);
    expect(canValidateDocumentation(undefined)).toBe(false);
  });
});

describe('nextDocStatus', () => {
  it('memetakan keputusan langsung ke status akhirnya', () => {
    // Satu tingkat sejak 19 Agustus 2026: tidak ada lagi singgahan
    // `approved_supervisor` di tengah jalan.
    expect(nextDocStatus('approve')).toBe('approved');
    expect(nextDocStatus('reject')).toBe('rejected');
  });
});

describe('checkReview', () => {
  const base = {
    decision: 'approve' as const,
    uploadedBy: UPLOADER,
    reviewerId: REVIEWER,
  };

  it('admin memproses pending langsung menjadi approved', () => {
    const result = checkReview({ ...base, currentStatus: 'pending', role: 'admin' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('approved');
  });

  it('superadmin juga bisa memvalidasi', () => {
    const result = checkReview({ ...base, currentStatus: 'pending', role: 'superadmin' });
    expect(result.ok).toBe(true);
  });

  it('masih menyelesaikan sisa antrian tangga lama', () => {
    // Baris yang sempat lolos tingkat-1 sebelum tangganya dipendekkan akan
    // terjebak selamanya kalau jalur ini ditutup.
    const result = checkReview({
      ...base,
      currentStatus: 'approved_supervisor',
      role: 'admin',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('approved');
  });

  it('menegakkan pemisahan tugas: pengupload tidak boleh memvalidasi sendiri', () => {
    // Tetap berlaku meski tingkatnya tinggal satu — seorang admin yang ikut
    // mengunggah tidak boleh meloloskan buktinya sendiri.
    const result = checkReview({
      ...base,
      currentStatus: 'pending',
      role: 'admin',
      uploadedBy: REVIEWER,
      reviewerId: REVIEWER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('menolak vendor', () => {
    const result = checkReview({ ...base, currentStatus: 'pending', role: 'vendor' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('menolak dokumentasi yang sudah tervalidasi atau sudah ditolak', () => {
    for (const status of ['approved', 'rejected'] as const) {
      const result = checkReview({ ...base, currentStatus: status, role: 'admin' });
      expect(result.ok, status).toBe(false);
      if (!result.ok) expect(result.code).toBe('CONFLICT');
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
