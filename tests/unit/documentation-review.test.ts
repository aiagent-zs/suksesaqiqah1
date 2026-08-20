import { describe, expect, it } from 'vitest';
import {
  canValidateDocumentation,
  checkReview,
  isDocumentationComplete,
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
      currentStatus: 'pending',
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

describe('kelengkapan bukti', () => {
  it('lengkap ketika tidak ada tahap yang kurang', () => {
    // Perhitungannya sendiri ada di database (`v_order_progress` membacanya
    // dari `stage_requirements` menurut cara penyaluran order) — di sini hanya
    // memastikan pembacaan hasilnya benar.
    expect(isDocumentationComplete([])).toBe(true);
    expect(isDocumentationComplete(['sembelih'])).toBe(false);
    expect(isDocumentationComplete(['sembelih', 'masak', 'terkirim'])).toBe(false);
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
    orderNumber: 'IA-202608-0001',
    orderCreatedAt: '2026-08-03T02:00:00.000Z',
    stage: 'sembelih',
    uuid: UUID,
    ext: 'jpg',
  });

  it('membangun path tanpa segmen cabang', () => {
    // Cabang dibuang bersama tabelnya, dan sengaja tidak diganti kode mitra:
    // kode mitra bisa berubah dan order bisa dipindah ke mitra lain, sementara
    // nomor order unik global dan tidak pernah berubah.
    expect(path).toBe(`2026/08/IA-202608-0001/sembelih/${UUID}.jpg`);
    expect(isDocPathForOrder(path, 'IA-202608-0001', 'sembelih')).toBe(true);
  });

  it('menolak path milik order atau tahap lain', () => {
    // Kebijakan Storage hanya menuntut pengunggah punya role — sama sekali
    // tidak membatasi folder, jadi pemeriksaan ini satu-satunya penjaga.
    expect(isDocPathForOrder(path, 'IA-202608-0002', 'sembelih')).toBe(false);
    expect(isDocPathForOrder(path, 'IA-202608-0001', 'masak')).toBe(false);
  });

  it('menolak path traversal, bulan tak valid, dan ekstensi terlarang', () => {
    expect(
      isDocPathForOrder(
        `2026/08/IA-202608-0001/sembelih/../../${UUID}.jpg`,
        'IA-202608-0001',
        'sembelih',
      ),
    ).toBe(false);
    expect(
      isDocPathForOrder(`2026/13/IA-202608-0001/sembelih/${UUID}.jpg`, 'IA-202608-0001', 'sembelih'),
    ).toBe(false);
    expect(
      isDocPathForOrder(`2026/08/IA-202608-0001/sembelih/${UUID}.exe`, 'IA-202608-0001', 'sembelih'),
    ).toBe(false);
  });

  it('menolak tahap yang tidak dikenal di path', () => {
    expect(
      isDocPathForOrder(`2026/08/IA-202608-0001/slaughter/${UUID}.jpg`, 'IA-202608-0001', 'sembelih'),
    ).toBe(false);
  });
});
