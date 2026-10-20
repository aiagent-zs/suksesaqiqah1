import { describe, expect, it } from 'vitest';
import { normalizeMobile, paymentMatchesOrder } from '@/features/payments/durianpay';

describe('paymentMatchesOrder', () => {
  const order = { total_amount: 2_500_000, payment_status: 'unpaid' };

  it('menerima nominal yang pas dengan total', () => {
    expect(paymentMatchesOrder(2_500_000, order)).toBe(true);
  });

  it('menolak nominal kurang, lebih, atau bukan angka', () => {
    expect(paymentMatchesOrder(1_000, order)).toBe(false);
    expect(paymentMatchesOrder(2_500_001, order)).toBe(false);
    expect(paymentMatchesOrder(NaN, order)).toBe(false);
  });

  it('menolak order yang sudah lunas', () => {
    expect(paymentMatchesOrder(2_500_000, { ...order, payment_status: 'paid' })).toBe(false);
  });
});

describe('normalizeMobile', () => {
  it('menerima 08… dan +62…', () => {
    expect(normalizeMobile('0812-3456 789')).toBe('08123456789');
    expect(normalizeMobile('+62 812 3456 789')).toBe('+628123456789');
  });

  it('membuang yang bukan nomor Indonesia', () => {
    expect(normalizeMobile('812345')).toBeNull();
  });
});
