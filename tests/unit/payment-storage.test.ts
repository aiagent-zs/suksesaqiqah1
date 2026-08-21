import { describe, expect, it } from 'vitest';
import {
  PROOF_MAX_BYTES,
  buildProofPath,
  checkProofFile,
  isProofPathForOrder,
} from '@/features/payments/storage';

const UUID = '4f3c1a2b-5d6e-4f70-8a91-b2c3d4e5f607';

describe('checkProofFile', () => {
  it('menerima tipe yang diizinkan bucket dan mengembalikan ekstensi kanonik', () => {
    expect(checkProofFile({ type: 'image/jpeg', size: 1000 })).toEqual({ ok: true, ext: 'jpg' });
    expect(checkProofFile({ type: 'image/png', size: 1000 })).toEqual({ ok: true, ext: 'png' });
    expect(checkProofFile({ type: 'application/pdf', size: 1000 })).toEqual({
      ok: true,
      ext: 'pdf',
    });
  });

  it('menolak tipe di luar allowed_mime_types bucket', () => {
    // Bucket akan menolaknya juga; ditolak lebih awal supaya pengguna tidak
    // menunggu unggahan yang pasti gagal.
    expect(checkProofFile({ type: 'image/gif', size: 1000 }).ok).toBe(false);
    expect(checkProofFile({ type: 'application/x-msdownload', size: 1000 }).ok).toBe(false);
    expect(checkProofFile({ type: '', size: 1000 }).ok).toBe(false);
  });

  it('menolak berkas kosong dan yang melewati batas 5 MB', () => {
    expect(checkProofFile({ type: 'image/jpeg', size: 0 }).ok).toBe(false);
    expect(checkProofFile({ type: 'image/jpeg', size: PROOF_MAX_BYTES + 1 }).ok).toBe(false);
    expect(checkProofFile({ type: 'image/jpeg', size: PROOF_MAX_BYTES }).ok).toBe(true);
  });

  it('menentukan ekstensi dari MIME, bukan dari nama berkas', () => {
    // Nama seperti "bukti.pdf.exe" tidak pernah ikut menentukan apa pun karena
    // checkProofFile sama sekali tidak membaca nama berkas.
    expect(checkProofFile({ type: 'application/pdf', size: 10 })).toEqual({ ok: true, ext: 'pdf' });
  });
});

describe('isProofPathForOrder', () => {
  const path = buildProofPath('IA-202608-0001', UUID, 'jpg');

  it('menerima path yang dibangun untuk order yang sama', () => {
    expect(path).toBe(`IA-202608-0001/${UUID}.jpg`);
    expect(isProofPathForOrder(path, 'IA-202608-0001')).toBe(true);
  });

  it('menolak bukti milik order lain', () => {
    // Kebijakan Storage hanya membatasi bucket, bukan folder — pemeriksaan ini
    // satu-satunya yang mencegah bukti order lain ditautkan ke sini.
    expect(isProofPathForOrder(path, 'IA-202608-0002')).toBe(false);
    // Awalan yang mirip tidak boleh lolos: nomor order harus cocok utuh.
    expect(isProofPathForOrder(path, 'IA-202608-000')).toBe(false);
  });

  it('menolak path traversal dan path absolut', () => {
    expect(
      isProofPathForOrder(`IA-202608-0001/../../${UUID}.jpg`, 'IA-202608-0001'),
    ).toBe(false);
    expect(isProofPathForOrder(`/BDG/IA-202608-0001/${UUID}.jpg`, 'IA-202608-0001')).toBe(
      false,
    );
    expect(
      isProofPathForOrder(`IA-202608-0001/${UUID}.jpg/../x.jpg`, 'IA-202608-0001'),
    ).toBe(false);
  });

  it('menolak nama berkas yang bukan uuid atau berekstensi terlarang', () => {
    expect(isProofPathForOrder('IA-202608-0001/bukti.jpg', 'IA-202608-0001')).toBe(
      false,
    );
    expect(isProofPathForOrder(`IA-202608-0001/${UUID}.exe`, 'IA-202608-0001')).toBe(
      false,
    );
    expect(isProofPathForOrder(`IA-202608-0001/${UUID}`, 'IA-202608-0001')).toBe(false);
  });

  it('menolak path yang menyertakan nama bucket', () => {
    // Supabase `.from(bucket).upload(path)` sudah menyematkan buckets; path yang
    // ikut membawa prefiks akan tersimpan di folder ganda.
    expect(
      isProofPathForOrder(`payment-proofs/BDG/IA-202608-0001/${UUID}.jpg`, 'IA-202608-0001'),
    ).toBe(false);
  });
});
