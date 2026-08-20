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
import { formatCurrency } from '@/lib/format';

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
          value={summary.ordersTotal.toLocaleString('id-ID')}
          hint={`${summary.ordersCompleted.toLocaleString('id-ID')} selesai`}
          icon={ShoppingBag}
          accent="border-l-primary"
          href="/orders"
        />
        <KpiCard
          label="Tagihan Masuk"
          value={formatCurrency(summary.revenueTotal)}
          icon={Wallet}
          accent="border-l-emerald-500"
        />
        <KpiCard
          label="Modal ke Mitra"
          value={formatCurrency(summary.vendorCostTotal)}
          icon={Truck}
          accent="border-l-cyan-500"
        />
        <KpiCard
          label="Margin"
          value={formatCurrency(summary.marginTotal)}
          hint={`${pct(summary.marginPct)} dari tagihan`}
          icon={FileCheck2}
          accent="border-l-teal-500"
        />
        <KpiCard
          label="Mitra Aktif"
          value={summary.activeVendors.toLocaleString('id-ID')}
          hint={
            summary.avgCycleHours === null
              ? 'Belum ada siklus tercatat'
              : `Rata-rata ${Math.round(summary.avgCycleHours)} jam per order`
          }
          icon={FileText}
          accent="border-l-violet-500"
          href="/vendors"
        />
      </div>

      <div
        className={cn(
          'grid grid-cols-2 gap-4',
          pendingGuestOrders === null ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
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
          value={summary.ordersOpen.toLocaleString('id-ID')}
          hint="Belum selesai / belum dibatalkan"
          icon={ShoppingBag}
          accent="border-l-blue-500"
        />
        <KpiCard
          label="Laporan Ditolak"
          value={summary.ordersWithRejection.toLocaleString('id-ID')}
          hint="Order dengan bukti tahap yang pernah ditolak"
          icon={AlertTriangle}
          accent="border-l-red-500"
        />
        <KpiCard
          label="Order Ditahan"
          value={summary.ordersOnHold.toLocaleString('id-ID')}
          hint="Status on hold"
          icon={PauseCircle}
          accent="border-l-orange-500"
          href="/orders?status=on_hold"
        />
      </div>
    </div>
  );
}
