'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { RateLimiter, rateLimitKeyFrom } from '@/lib/security/rate-limit';
import type { PaymentStatus } from '@/lib/constants/order';

/**
 * Rem terpisah dari `/lacak` (20 per 10 menit): panel sukses bertanya tiap
 * beberapa detik, jadi memakai rem yang sama akan menghabiskannya dalam tiga
 * menit dan memblokir halaman Lacak milik pemesan yang sama.
 */
const pollLimiter = new RateLimiter({ limit: 240, windowMs: 10 * 60 * 1000 });

/**
 * Status pembayaran satu pesanan, untuk panel sukses checkout.
 *
 * Kuncinya sama dengan halaman Lacak (nomor pesanan + 4 digit akhir HP) dan
 * lewat RPC yang sama, jadi tebakan salah tetap terhitung di rem database
 * `get_order_tracking`. Yang dikembalikan hanya status, bukan isi pesanan.
 */
export async function getPaymentStatus(
  orderNumber: string,
  phoneLast4: string,
): Promise<PaymentStatus | null> {
  if (!/^[0-9]{4}$/.test(phoneLast4)) return null;
  if (!pollLimiter.consume(rateLimitKeyFrom(await headers())).allowed) return null;

  const { data, error } = await createAdminClient().rpc('get_order_tracking', {
    p_order_number: orderNumber,
    p_phone_last4: phoneLast4,
  });
  if (error || !data) return null;
  return (data as { payment_status: PaymentStatus }).payment_status;
}
