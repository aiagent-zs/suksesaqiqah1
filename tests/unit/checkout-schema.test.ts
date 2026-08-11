import { describe, expect, it } from 'vitest';
import { guestCheckoutSchema, SPECIES_BY_SERVICE_TYPE } from '@/features/checkout/schema';

const SERVICE_ID = 'a2000000-0000-4000-8000-000000000001';
const BRANCH_ID = 'a0000000-0000-4000-8000-000000000001';

const valid = {
  service_id: SERVICE_ID,
  branch_id: BRANCH_ID,
  species: 'kambing',
  qty: 2,
  // Tahap 1 & 4 — keduanya wajib sejak alur enam tahap.
  aqiqah_for: 'laki_laki',
  distribution_mode: 'salur',
  child_name: 'Fatih',
  bin_binti: 'bin Ahmad',
  name: 'Budi Santoso',
  phone: '081234567890',
  email: 'budi@example.com',
};

describe('guestCheckoutSchema', () => {
  it('menerima pesanan minimum yang lengkap', () => {
    const result = guestCheckoutSchema.parse(valid);
    expect(result.qty).toBe(2);
    expect(result.name).toBe('Budi Santoso');
  });

  it('tidak menyediakan tempat bagi harga maupun status', () => {
    // Inti pengamanan checkout tamu: harga dan status ditentukan RPC dari tabel
    // `services`. Kalau schema ini meneruskannya, pemesan bisa menentukan
    // sendiri berapa yang ia bayar.
    const result = guestCheckoutSchema.parse({
      ...valid,
      price: 1,
      unit_price: 1,
      total_amount: 1,
      status: 'completed',
      payment_status: 'paid',
      paid_amount: 999,
    });

    for (const key of [
      'price',
      'unit_price',
      'total_amount',
      'status',
      'payment_status',
      'paid_amount',
    ]) {
      expect(result, key).not.toHaveProperty(key);
    }
  });

  it('mengubah qty berbentuk teks dari input number menjadi angka', () => {
    expect(guestCheckoutSchema.parse({ ...valid, qty: '3' }).qty).toBe(3);
  });

  it('menolak qty di luar batas', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, qty: 0 }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, qty: 21 }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, qty: 1.5 }).success).toBe(false);
  });

  it('menolak jenis hewan di luar enum database', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, species: 'naga' }).success).toBe(false);
  });

  it('mewajibkan nama anak', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, child_name: '' }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, child_name: ' A ' }).success).toBe(false);
  });

  it('mewajibkan pilihan tahap 1 dan tahap 4', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, aqiqah_for: undefined }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, distribution_mode: undefined }).success).toBe(
      false,
    );
    expect(guestCheckoutSchema.safeParse({ ...valid, aqiqah_for: 'lelaki' }).success).toBe(false);
  });

  it('Aqiqah Kirim menuntut alamat pengiriman', () => {
    // Aturan silang-medan: dikirim tanpa alamat berarti tidak bisa diantar.
    expect(guestCheckoutSchema.safeParse({ ...valid, distribution_mode: 'kirim' }).success).toBe(
      false,
    );
    expect(
      guestCheckoutSchema.safeParse({
        ...valid,
        distribution_mode: 'kirim',
        delivery_address: 'Jl. Melati 1',
      }).success,
    ).toBe(true);
  });

  it('memilih nasi box tanpa jumlah ditolak', () => {
    expect(
      guestCheckoutSchema.safeParse({ ...valid, nasi_box_service_id: SERVICE_ID }).success,
    ).toBe(false);
    expect(
      guestCheckoutSchema.safeParse({
        ...valid,
        nasi_box_service_id: SERVICE_ID,
        nasi_box_qty: 25,
      }).success,
    ).toBe(true);
  });

  it('menerima format nomor telepon yang lazim ditulis orang', () => {
    for (const phone of ['081234567890', '+62 812-3456-7890', '(021) 555 1234']) {
      expect(guestCheckoutSchema.safeParse({ ...valid, phone }).success, phone).toBe(true);
    }
  });

  it('menolak telepon yang bukan nomor', () => {
    // Nomor ini satu-satunya cara menghubungi pemesan tamu; kalau ngawur,
    // pesanan masuk tanpa ada yang bisa dikonfirmasi.
    for (const phone of ['hubungi saya', '0812<script>', '']) {
      expect(guestCheckoutSchema.safeParse({ ...valid, phone }).success, phone).toBe(false);
    }
  });

  it('mewajibkan email dan menolak yang salah bentuk', () => {
    // Mengikuti alur referensi: email dipakai mengirim salinan pesanan.
    expect(guestCheckoutSchema.safeParse({ ...valid, email: '' }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, email: 'bukan-email' }).success).toBe(false);
  });

  it('menolak id yang bukan uuid', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, service_id: 'aqiqah-ekonomi' }).success).toBe(
      false,
    );
    expect(guestCheckoutSchema.safeParse({ ...valid, branch_id: 'bandung' }).success).toBe(false);
  });

  it('memangkas spasi pada medan teks', () => {
    const result = guestCheckoutSchema.parse({
      ...valid,
      name: '  Budi Santoso  ',
      referral_code: '  sa-budi  ',
    });
    expect(result.name).toBe('Budi Santoso');
    expect(result.referral_code).toBe('sa-budi');
  });

  it('membatasi panjang medan bebas', () => {
    expect(guestCheckoutSchema.safeParse({ ...valid, name: 'x'.repeat(151) }).success).toBe(false);
    expect(guestCheckoutSchema.safeParse({ ...valid, referral_code: 'x'.repeat(41) }).success).toBe(
      false,
    );
    expect(
      guestCheckoutSchema.safeParse({ ...valid, delivery_address: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('SPECIES_BY_SERVICE_TYPE', () => {
  it('aqiqah tidak menawarkan sapi', () => {
    // Aturan yang sama ditegakkan di dalam RPC; kalau daftar ini menyimpang,
    // form menawarkan pilihan yang pasti ditolak database.
    expect(SPECIES_BY_SERVICE_TYPE.aqiqah).toEqual(['kambing', 'domba']);
    expect(SPECIES_BY_SERVICE_TYPE.aqiqah).not.toContain('sapi');
  });

  it('qurban menawarkan sapi', () => {
    expect(SPECIES_BY_SERVICE_TYPE.qurban).toContain('sapi');
  });

  it('setiap pilihan yang ditawarkan diterima schema', () => {
    for (const [, list] of Object.entries(SPECIES_BY_SERVICE_TYPE)) {
      for (const species of list) {
        expect(guestCheckoutSchema.safeParse({ ...valid, species }).success, species).toBe(true);
      }
    }
  });
});
