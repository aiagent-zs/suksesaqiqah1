import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/security/rate-limit';
import type { OrderStatus, PaymentStatus } from '@/lib/constants/order';
import type { DistributionMode, FulfilmentStage } from '@/features/stages/sequence';

export type TrackingResult = {
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  requested_date: string | null;
  distribution_mode: DistributionMode | null;
  is_catering: boolean;
  report_token: string | null;
  services: { name: string; qty: number }[];
  stages: { stage: FulfilmentStage; done: boolean; started: boolean; at: string | null }[];
};

export type TrackingLookup =
  | { kind: 'found'; order: TrackingResult }
  | { kind: 'not_found' }
  | { kind: 'limited'; minutes: number }
  | { kind: 'error' };

/**
 * Pasangan 4 digit hanya punya 10.000 kemungkinan. 20 percobaan per 10 menit
 * per IP cukup untuk salah ketik berkali-kali, dan membuat tebakan satu nomor
 * pesanan butuh berhari-hari dari satu jaringan.
 * ponytail: per-instance, seperti limiter checkout; pindah ke store bersama
 * bila tebakan terdistribusi terlihat di log.
 */
const trackingLimiter = new RateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

export async function lookupOrder(
  orderNumber: string,
  phoneLast4: string,
  ip: string | null,
): Promise<TrackingLookup> {
  if (ip) {
    const gate = trackingLimiter.consume(ip);
    if (!gate.allowed) {
      return { kind: 'limited', minutes: Math.max(1, Math.ceil(gate.retryAfterMs / 60_000)) };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_order_tracking', {
    p_order_number: orderNumber,
    p_phone_last4: phoneLast4,
  });

  if (error) {
    console.error('[tracking] get_order_tracking gagal', error);
    return { kind: 'error' };
  }
  if (!data) return { kind: 'not_found' };
  return { kind: 'found', order: data as unknown as TrackingResult };
}
