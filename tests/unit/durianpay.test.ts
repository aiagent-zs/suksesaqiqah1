import { describe, expect, it } from 'vitest';
import { normalizeMobile, orderPayload, paymentMatchesOrder } from '@/features/payments/durianpay';

describe('orderPayload', () => {
  const order = {
    order_number: 'IA-202611-0001',
    total_amount: 2_300_000.4,
    name: 'Budi',
    phone: '0812-3456-7890',
    email: 'budi@example.com',
  };

  it('mengirim items yang jumlahnya sama persis dengan amount (wajib untuk LinkAja/BNPL)', () => {
    const p = orderPayload(order);
    expect(p.amount).toBe('2300000');
    expect(p.items).toEqual([{ name: 'Pesanan IA-202611-0001', qty: 1, price: '2300000' }]);
  });

  it('order_ref_id = nomor order, supaya webhook menemukan ordernya kembali', () => {
    expect(orderPayload(order).order_ref_id).toBe('IA-202611-0001');
  });

  it('menyertakan mobile dan email pelanggan', () => {
    expect(orderPayload(order).customer).toEqual({
      given_name: 'Budi',
      mobile: '081234567890',
      email: 'budi@example.com',
    });
  });
});

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

  it('menolak order batal atau terhapus', () => {
    expect(paymentMatchesOrder(2_500_000, { ...order, status: 'cancelled' })).toBe(false);
    expect(paymentMatchesOrder(2_500_000, { ...order, deleted_at: '2026-10-01' })).toBe(false);
  });

  it('membulatkan sama seperti saat link dibuat', () => {
    expect(paymentMatchesOrder(2_500_001, { ...order, total_amount: 2_500_000.6 })).toBe(true);
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
