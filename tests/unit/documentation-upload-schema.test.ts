import { describe, expect, it } from 'vitest';
import { uploadDocumentationSchema, DOC_STAGES } from '@/features/documentation/schema';

/**
 * Bentuk masukan unggah bukti.
 *
 * ## Kenapa berkas ini ada
 *
 * Klien dulu menamai sendiri `stage`, `order_id`, dan `animal_id` lewat dua
 * dropdown di panel Dokumentasi. Tiga medan yang **bisa diturunkan** dari
 * laporan tahap yang dibuktikan — dan medan yang bisa diturunkan tapi tetap
 * dikirim adalah medan yang bisa berbohong: bukti masak dapat diaku sebagai
 * bukti sembelih, dan `missing_doc_stages` ikut tertipu karena ia menghitung
 * per `(order_id, stage, status='approved')`.
 *
 * Yang dijaga di sini: ketiganya **tidak diterima lagi**, dan `stage_event_id`
 * wajib. Bukan sekadar diabaikan server — ditolak sejak schema, supaya tidak
 * ada jalan diam-diam kalau suatu saat insert-nya menyebar `...v`.
 *
 * `umum` ikut diuji karena ia dicabut dari enum: nilai yang tidak punya padanan
 * di `fulfilment_stage` tidak akan pernah lolos trigger
 * `enforce_documentation_stage_match`, jadi menawarkannya berarti menjanjikan
 * sesuatu yang pasti ditolak database.
 */
const STAGE_EVENT = '11111111-1111-4111-8111-111111111111';

const VALID = {
  stage_event_id: STAGE_EVENT,
  type: 'photo' as const,
  storage_path: '2026/09/IA-202609-0001/sembelih/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.jpg',
};

describe('medan yang bisa diturunkan tidak diterima dari klien', () => {
  it('membuang stage, order_id, dan animal_id', () => {
    const parsed = uploadDocumentationSchema.parse({
      ...VALID,
      stage: 'masak',
      order_id: '22222222-2222-4222-8222-222222222222',
      animal_id: '33333333-3333-4333-8333-333333333333',
    });

    // Kalau salah satu lolos, insert yang menyebar hasil parse akan menuliskan
    // nilai kiriman klien alih-alih yang dibaca server dari laporan tahapnya.
    expect(parsed).not.toHaveProperty('stage');
    expect(parsed).not.toHaveProperty('order_id');
    expect(parsed).not.toHaveProperty('animal_id');
  });

  it('menuntut stage_event_id', () => {
    const tanpaTahap = { ...VALID, stage_event_id: undefined };
    expect(uploadDocumentationSchema.safeParse(tanpaTahap).success).toBe(false);
  });

  it('menolak stage_event_id yang bukan uuid', () => {
    expect(
      uploadDocumentationSchema.safeParse({ ...VALID, stage_event_id: 'bukan-uuid' }).success,
    ).toBe(false);
  });
});

describe('aturan berkas tidak berubah', () => {
  it('foto & video wajib menyertakan berkas', () => {
    expect(uploadDocumentationSchema.safeParse({ ...VALID, storage_path: '' }).success).toBe(false);
  });

  it('catatan tanpa isi tidak membuktikan apa pun', () => {
    const note = { stage_event_id: STAGE_EVENT, type: 'note' as const };
    expect(uploadDocumentationSchema.safeParse(note).success).toBe(false);
    expect(
      uploadDocumentationSchema.safeParse({ ...note, caption: 'Hewan diperiksa dokter' }).success,
    ).toBe(true);
  });
});

describe('daftar tahap bukti', () => {
  it('tidak lagi memuat umum', () => {
    expect(DOC_STAGES).not.toContain('umum');
  });

  it('persis enam tahap pelaksanaan', () => {
    // Cerminan `fulfilment_stage`. Kalau keduanya menyimpang, gerbang
    // kelengkapan membandingkan dua daftar yang berbeda.
    expect([...DOC_STAGES]).toEqual([
      'persiapan',
      'sembelih',
      'masak',
      'salur',
      'kirim',
      'terkirim',
    ]);
  });
});
