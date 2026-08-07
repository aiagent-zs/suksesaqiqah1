import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type DistributionRow = {
  id: string;
  recipientName: string | null;
  recipientArea: string | null;
  packagesCount: number;
  distributedAt: string;
  distributorName: string | null;
  lat: number | null;
  lng: number | null;
};

export type DistributionSummary = {
  rows: DistributionRow[];
  totalPackages: number;
};

/** Catatan distribusi satu order (`prd.md` FR-SL2). */
export async function getOrderDistributions(orderId: string): Promise<DistributionSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('distributions')
    .select(
      'id, recipient_name, recipient_area, packages_count, distributed_at, lat, lng, distributor:profiles ( full_name )',
    )
    .eq('order_id', orderId)
    .order('distributed_at', { ascending: false });

  if (error) return { rows: [], totalPackages: 0 };

  const rows = (data ?? []).map((rowValue) => {
    const r = rowValue as unknown as {
      id: string;
      recipient_name: string | null;
      recipient_area: string | null;
      packages_count: number;
      distributed_at: string;
      lat: number | string | null;
      lng: number | string | null;
      distributor: { full_name: string | null } | null;
    };

    return {
      id: r.id,
      recipientName: r.recipient_name,
      recipientArea: r.recipient_area,
      packagesCount: r.packages_count ?? 0,
      distributedAt: r.distributed_at,
      distributorName: r.distributor?.full_name ?? null,
      lat: r.lat == null ? null : Number(r.lat),
      lng: r.lng == null ? null : Number(r.lng),
    };
  });

  return {
    rows,
    totalPackages: rows.reduce((acc, r) => acc + r.packagesCount, 0),
  };
}
