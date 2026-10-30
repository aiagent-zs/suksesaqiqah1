import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
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
 * Rem kasar per IP di depan. Rem yang sesungguhnya ada di `get_order_tracking`:
 * 10 tebakan salah per nomor per jam, dicatat di database, jadi tetap berlaku
 * meski IP dirotasi atau server di-restart.
 */
const trackingLimiter = new RateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

export async function lookupOrder(
  orderNumber: string,
  phoneLast4: string,
  ip: string | null,
): Promise<TrackingLookup> {
  const gate = trackingLimiter.consume(ip ?? 'unknown');
  if (!gate.allowed) {
    return { kind: 'limited', minutes: Math.max(1, Math.ceil(gate.retryAfterMs / 60_000)) };
  }

  // Service role: RPC ini tertutup untuk anon supaya tidak bisa ditembak
  // langsung tanpa rem di atas.
  const supabase = createAdminClient();
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
