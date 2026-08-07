import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PaymentMethod, PaymentVerificationStatus } from '@/lib/constants/order';
import { PROOF_BUCKET } from './storage';

/** TTL signed URL bukti transfer — docs/17 section 4 menyarankan 5–15 menit. */
const PROOF_URL_TTL_SECONDS = 600;

export type PaymentRow = {
  id: string;
  amount: number;
  method: PaymentMethod | string | null;
  status: PaymentVerificationStatus;
  note: string | null;
  createdAt: string;
  verifiedAt: string | null;
  verifierName: string | null;
  /** Signed URL berdurasi pendek; null bila tanpa bukti atau gagal ditandatangani. */
  proofUrl: string | null;
};

export type PaymentSummary = {
  payments: PaymentRow[];
  /** Jumlah pembayaran `verified` — cerminan `orders.paid_amount`. */
  verifiedTotal: number;
  /** Jumlah pembayaran yang masih menunggu keputusan. */
  pendingTotal: number;
  pendingCount: number;
};

/**
 * Riwayat pembayaran satu order (`prd.md` FR-P4).
 *
 * Baris ter-scope RLS: petugas lapangan tidak pernah melihat data pembayaran
 * sama sekali (kebijakan `payments_select`), jadi query ini bisa mengembalikan
 * array kosong untuk mereka tanpa dianggap error.
 */
export async function getOrderPayments(orderId: string): Promise<PaymentSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount, method, status, note, proof_path, created_at, verified_at, verifier:profiles ( full_name )',
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    // Penolakan RLS bagi petugas lapangan tampak sebagai error di sini —
    // diperlakukan sebagai "tidak ada data yang boleh dilihat", bukan kegagalan
    // halaman detail order secara keseluruhan.
    return { payments: [], verifiedTotal: 0, pendingTotal: 0, pendingCount: 0 };
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    amount: number | string;
    method: string | null;
    status: PaymentVerificationStatus;
    note: string | null;
    proof_path: string | null;
    created_at: string;
    verified_at: string | null;
    verifier: { full_name: string | null } | null;
  }>;

  // Satu signed URL per bukti. Ditandatangani sekaligus supaya tidak ada
  // roundtrip berurutan saat order punya banyak cicilan.
  const proofPaths = rows.map((r) => r.proof_path).filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();

  if (proofPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrls(proofPaths, PROOF_URL_TTL_SECONDS);

    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) urlByPath.set(item.path, item.signedUrl);
    }
  }

  const payments: PaymentRow[] = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    method: r.method,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    verifiedAt: r.verified_at,
    verifierName: r.verifier?.full_name ?? null,
    proofUrl: r.proof_path ? (urlByPath.get(r.proof_path) ?? null) : null,
  }));

  const sumWhere = (status: PaymentVerificationStatus) =>
    payments.filter((p) => p.status === status).reduce((acc, p) => acc + p.amount, 0);

  return {
    payments,
    verifiedTotal: sumWhere('verified'),
    pendingTotal: sumWhere('pending'),
    pendingCount: payments.filter((p) => p.status === 'pending').length,
  };
}
