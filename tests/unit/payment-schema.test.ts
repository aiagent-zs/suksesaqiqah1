import { describe, expect, it } from 'vitest';
import { recordPaymentSchema, verifyPaymentSchema } from '@/features/payments/schema';

const ORDER_ID = '3f1a9c62-5f4b-4c1e-9a2d-8e7b6c5d4a3f';
const PAYMENT_ID = '7c2e4b18-91af-4d63-b0f5-2a6c8d1e3f40';

describe('recordPaymentSchema', () => {
  it('menerima pembayaran yang sah', () => {
    const result = recordPaymentSchema.parse({
      order_id: ORDER_ID,
      amount: '1750000',
      method: 'transfer_bank',
      note: '  ref TRX-991  ',
    });

    expect(result.amount).toBe(1750000);
    expect(result.method).toBe('transfer_bank');
    expect(result.note).toBe('ref TRX-991');
  });

  it('menolak nominal nol dan negatif', () => {
    expect(
      recordPaymentSchema.safeParse({ order_id: ORDER_ID, amount: 0, method: 'tunai' }).success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({ order_id: ORDER_ID, amount: -5, method: 'tunai' }).success,
    ).toBe(false);
  });

  it('menolak nominal dengan lebih dari 2 desimal', () => {
    // Kolomnya numeric(14,2): tanpa penolakan ini Postgres membulatkan diam-diam
    // dan angka tersimpan berbeda dari yang diketik operator.
    expect(
      recordPaymentSchema.safeParse({ order_id: ORDER_ID, amount: '100.005', method: 'tunai' })
        .success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({ order_id: ORDER_ID, amount: '100.25', method: 'tunai' })
        .success,
    ).toBe(true);
  });

  it('menolak metode di luar daftar', () => {
    expect(
      recordPaymentSchema.safeParse({ order_id: ORDER_ID, amount: 1, method: 'bitcoin' }).success,
    ).toBe(false);
  });

  it('menolak order_id yang bukan uuid', () => {
    expect(
      recordPaymentSchema.safeParse({ order_id: 'bukan-uuid', amount: 1, method: 'tunai' }).success,
    ).toBe(false);
  });
});

describe('verifyPaymentSchema', () => {
  it('menerima verifikasi tanpa catatan', () => {
    const result = verifyPaymentSchema.parse({ payment_id: PAYMENT_ID, decision: 'verified' });
    expect(result.decision).toBe('verified');
  });

  it('mewajibkan alasan saat menolak', () => {
    // Penolakan tanpa alasan tidak bisa ditindaklanjuti oleh yang mencatat.
    const rejected = verifyPaymentSchema.safeParse({
      payment_id: PAYMENT_ID,
      decision: 'rejected',
    });
    expect(rejected.success).toBe(false);

    const withReason = verifyPaymentSchema.safeParse({
      payment_id: PAYMENT_ID,
      decision: 'rejected',
      note: 'Nominal tidak sesuai bukti transfer',
    });
    expect(withReason.success).toBe(true);
  });

  it('menolak keputusan di luar verified/rejected', () => {
    // `pending` adalah keadaan awal, bukan keputusan — mengirimnya lewat action
    // ini berarti membatalkan verifikasi tanpa jejak.
    expect(
      verifyPaymentSchema.safeParse({ payment_id: PAYMENT_ID, decision: 'pending' }).success,
    ).toBe(false);
  });
});
