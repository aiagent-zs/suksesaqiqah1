import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BranchKpi } from '../summary';

/**
 * "Order Tertunda per Cabang" (docs/09 section 3).
 * Cabang tanpa order disembunyikan — `v_branch_kpi` memakai LEFT JOIN sehingga
 * setiap cabang terdaftar selalu punya baris, termasuk yang belum beroperasi.
 */
export function BranchProgress({ rows }: { rows: BranchKpi[] }) {
  const active = rows.filter((r) => r.totalOrders > 0).sort((a, b) => b.openOrders - a.openOrders);

  const max = Math.max(1, ...active.map((r) => r.openOrders));

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="text-muted-foreground size-4" />
          Order Tertunda per Cabang
        </CardTitle>
      </CardHeader>

      <CardContent>
        {active.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Belum ada order tercatat pada cakupan akses Anda.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((row) => (
              <li key={row.branchId}>
                <Link
                  href={`/orders?branch_id=${row.branchId}`}
                  className="group hover:bg-muted/60 block rounded-lg px-1 py-1 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium group-hover:underline">
                      {row.branchName}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {row.openOrders}
                      <span className="text-muted-foreground ml-1 text-xs font-normal">
                        / {row.totalOrders}
                      </span>
                    </span>
                  </div>

                  <div className="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(row.openOrders / max) * 100}%` }}
                    />
                  </div>

                  {row.openIssues > 0 && (
                    <p className="text-destructive mt-1 text-xs">
                      {row.openIssues} kendala terbuka
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
