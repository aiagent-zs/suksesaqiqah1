import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Webhook Durianpay: kiriman ulang untuk pembayaran yang sudah tercatat harus
 * idempoten (tanpa log "periksa refund"), dan penolakan kelebihan bayar dari
 * database (23514) dijawab 200 — mengulangnya tidak akan mengubah apa pun.
 */
let recorded: { id: string } | null = null;
let insertError: { code: string; message: string } | null = null;
let inserted = false;

vi.mock('@/features/payments/durianpay', async (orig) => ({
  ...(await orig<typeof import('@/features/payments/durianpay')>()),
  fetchCompletedPayment: async () => ({
    payId: 'pay_1',
    orderNumber: 'IA-202610-0001',
    amount: 1_000_000,
    method: 'VA',
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: () => chain,
        maybeSingle: async () =>
          table === 'orders'
            ? {
                // Sudah lunas: persis keadaan saat webhook dikirim ulang.
                data: {
                  id: 'o1',
                  status: 'verified',
                  total_amount: 1_000_000,
                  payment_status: recorded ? 'paid' : 'unpaid',
                  deleted_at: null,
                },
                error: null,
              }
            : { data: recorded, error: null },
        insert: async () => {
          inserted = true;
          return { error: insertError };
        },
        then: (r: (v: unknown) => void) => r({ error: null }),
      };
      return chain;
    },
  }),
}));

const { POST } = await import('@/app/api/payments/durianpay/route');
const call = () =>
  POST(
    new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ event: 'payment.completed', data: { id: 'pay_1' } }),
    }),
  );

beforeEach(() => {
  recorded = null;
  insertError = null;
  inserted = false;
});

describe('webhook Durianpay', () => {
  it('kiriman ulang pembayaran yang sudah tercatat: 200 tanpa insert dan tanpa log refund', async () => {
    recorded = { id: 'p1' };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    expect(res.status).toBe(200);
    expect(inserted).toBe(false);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('kelebihan bayar ditolak database: 200 dan dicatat untuk diperiksa', async () => {
    insertError = { code: '23514', message: 'melebihi nilai order' };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call();
    expect(res.status).toBe(200);
    expect(err.mock.calls[0]?.[0]).toMatch(/kelebihan bayar/);
    err.mockRestore();
  });
});
