import Link from 'next/link';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ISSUE_SEVERITY_META, ISSUE_SEVERITY_ORDER } from '@/lib/constants/order';
import { cn } from '@/lib/utils';
import type { IssueBreakdown } from '../queries';
import { STAGE_META } from '@/features/stages/sequence';

/**
 * Panel kendala terbuka (docs/09 section 3).
 *
 * Angka per tingkat menghitung **order**, bukan issue: satu order dihitung pada
 * tingkat kendala terberatnya (`max_open_severity`) supaya tidak ada order yang
 * muncul dua kali di dua tingkat berbeda.
 */
export function IssuePanel({
  breakdown,
  basePath,
  searchParams,
}: {
  breakdown: IssueBreakdown;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const buildHref = (severity: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'severity' && key !== 'page') params.set(key, value);
    }
    params.set('severity', severity);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="text-muted-foreground size-4" />
          Kendala Terbuka
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {ISSUE_SEVERITY_ORDER.map((severity) => {
            const meta = ISSUE_SEVERITY_META[severity];
            return (
              <Link
                key={severity}
                href={buildHref(severity)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-center transition-opacity hover:opacity-80',
                  meta.className,
                )}
              >
                <p className="text-xl font-bold tabular-nums">{breakdown.counts[severity]}</p>
                <p className="text-xs font-medium">{meta.label}</p>
              </Link>
            );
          })}
        </div>

        {breakdown.total === 0 ? (
          <p className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
            <ShieldCheck className="text-primary size-4" />
            Tidak ada kendala terbuka.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {breakdown.highlights.map((row) => (
              <li key={row.orderId} className="py-2.5 first:pt-0 last:pb-0">
                <Link href={`/orders/${row.orderId}`} className="group block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-primary truncate text-sm font-medium tabular-nums group-hover:underline">
                      {row.orderNumber}
                    </span>
                    {row.maxSeverity && (
                      <Badge className={ISSUE_SEVERITY_META[row.maxSeverity].className}>
                        {ISSUE_SEVERITY_META[row.maxSeverity].label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {row.latestIssueTitle ?? 'Kendala tanpa judul'}
                    {row.vendorName ? ` · ${row.vendorName}` : ''}
                    {row.currentStage ? ` · ${STAGE_META[row.currentStage].label}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
