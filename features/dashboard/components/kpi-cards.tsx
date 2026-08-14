import Link from 'next/link';
import {
  AlertTriangle,
  FileCheck2,
  FileText,
  Globe,
  PauseCircle,
  ShoppingBag,
  Truck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { KpiSummary } from '../summary';

/**
 * Kartu KPI dengan aksen border kiri 4px (design.md — "KPI Stats").
 * Bila `href` diisi, seluruh kartu jadi tautan drill-down (docs/09 section 7).
 */
function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  href,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent: string;
  href?: string;
  progress?: number;
}) {
  const body = (
    <Card
      className={cn(
        'h-full gap-3 rounded-2xl border-l-4 py-4 shadow-sm transition-shadow',
        accent,
        href && 'hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <Icon className="text-muted-foreground size-5 shrink-0" />
      </div>

      {typeof progress === 'number' && (
        <div className="px-4">
          <div
            className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
          >
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {hint && <p className="text-muted-foreground px-4 text-xs">{hint}</p>}
    </Card>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

function pct(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/**
 * 5 KPI inti + baris sekunder operasional (docs/09 section 2 & section 3).
 *
 * `pendingGuestOrders` datang terpisah dari `summary`: `v_branch_kpi` tidak
 * punya dimensi asal order, jadi angkanya dihitung query tersendiri di halaman.
 * `null` berarti role ini tidak berhak memverifikasi order tamu — kartunya
 * tidak dirender sama sekali, bukan ditampilkan bernilai nol.
 */
export function KpiCards({
  summary,
  pendingGuestOrders,
}: {
  summary: KpiSummary;
  pendingGuestOrders: number | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Order"
          value={summary.totalOrders.toLocaleString('id-ID')}
          hint={`${summary.completedOrders.toLocaleString('id-ID')} selesai`}
          icon={ShoppingBag}
          accent="border-l-primary"
          href="/orders"
        />
        <KpiCard
          label="Progres Potong"
          value={pct(summary.pctSlaughter)}
          icon={FileCheck2}
          accent="border-l-violet-500"
          progress={summary.pctSlaughter}
        />
        <KpiCard
          label="Progres Distribusi"
          value={pct(summary.pctDistribution)}
          icon={Truck}
          accent="border-l-cyan-500"
          progress={summary.pctDistribution}
        />
        <KpiCard
          label="Progres Dokumentasi"
          value={pct(summary.pctDocumentation)}
          icon={FileText}
          accent="border-l-amber-500"
          progress={summary.pctDocumentation}
        />
        <KpiCard
          label="Progres Laporan"
          value={pct(summary.pctReport)}
          icon={FileCheck2}
          accent="border-l-teal-500"
          progress={summary.pctReport}
        />
      </div>

      <div
        className={cn(
          'grid grid-cols-2 gap-4',
          pendingGuestOrders === null ? 'lg:grid-cols-4' : 'lg:grid-cols-5',
        )}
      >
        {pendingGuestOrders !== null && (
          <KpiCard
            label="Order Tamu Baru"
            value={pendingGuestOrders.toLocaleString('id-ID')}
            hint="Dari checkout publik, belum diverifikasi"
            icon={Globe}
            accent="border-l-amber-500"
            href="/orders?source=guest_pending"
          />
        )}
        <KpiCard
          label="Order Tertunda"
          value={summary.openOrders.toLocaleString('id-ID')}
          hint="Belum selesai / belum dibatalkan"
          icon={ShoppingBag}
          accent="border-l-blue-500"
        />
        <KpiCard
          label="Kendala Terbuka"
          value={summary.openIssues.toLocaleString('id-ID')}
          hint="Issue open / in progress"
          icon={AlertTriangle}
          accent="border-l-red-500"
        />
        <KpiCard
          label="Belum Lunas"
          value={summary.unpaidOrders.toLocaleString('id-ID')}
          hint="Order aktif berstatus belum lunas"
          icon={Wallet}
          accent="border-l-secondary"
          href="/orders?payment_status=unpaid"
        />
        <KpiCard
          label="Order Ditahan"
          value={summary.onHoldOrders.toLocaleString('id-ID')}
          hint="Status on hold"
          icon={PauseCircle}
          accent="border-l-orange-500"
          href="/orders?status=on_hold"
        />
      </div>
    </div>
  );
}
