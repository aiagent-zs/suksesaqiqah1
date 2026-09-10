import Link from 'next/link';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ISSUE_SEVERITY_META,
  ISSUE_SEVERITY_ORDER,
  ORDER_STATUS_META,
  ORDER_STATUS_FLOW,
  type OrderStatus,
} from '@/lib/constants/order';
import type { DashboardFilterInput } from '../schema';

/**
 * Filter dashboard (docs/09 section 3 & section 7).
 * Form GET native seperti FilterBar order: tetap berfungsi tanpa JavaScript dan
 * state-nya hidup di URL sehingga tampilan bisa di-bookmark & dibagikan.
 */
export function DashboardFilters({ filter }: { filter: DashboardFilterInput }) {
  // `completed`/`cancelled` sengaja tidak ada: v_open_orders hanya berisi order
  // yang belum selesai, jadi memilihnya selalu menghasilkan tabel kosong.
  const openStatuses: OrderStatus[] = [
    ...ORDER_STATUS_FLOW.filter((s) => s !== 'completed'),
    'on_hold',
  ];

  const hasActiveFilter = Boolean(filter.status || filter.severity || filter.issues_only);

  return (
    <form
      method="get"
      action="/dashboard"
      className="border-border bg-card rounded-lg border shadow-sm"
    >
      {/* Terlipat di ponsel, terbuka sejak awal di layar lebar.
          Di layar 360px ketiga medannya menumpuk jadi satu kolom setinggi
          ~200px — lebih tinggi daripada satu kartu order, sehingga daftar yang
          justru dicari orang terdorong ke bawah lipatan. `<details>` bawaan
          peramban: tidak perlu state, dan tetap bisa dibuka tanpa JavaScript.

          `open` menyalakan dirinya sendiri saat ada filter aktif — panel
          tertutup yang diam-diam menyaring data adalah cara termudah membuat
          orang mengira datanya hilang. */}
      <details className="filter-collapsible group" open={hasActiveFilter}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 lg:hidden [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="size-4" />
            Filter
            {hasActiveFilter && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                aktif
              </span>
            )}
          </span>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </summary>

        <div className="grid grid-cols-1 gap-3 px-4 pt-0 pb-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-4">
          <div>
            <label htmlFor="status" className="mb-1.5 block text-sm text-slate-700">
              Tahap
            </label>
            <Select id="status" name="status" defaultValue={filter.status ?? ''}>
              <option value="">Semua tahap</option>
              {openStatuses.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="severity" className="mb-1.5 block text-sm text-slate-700">
              Keparahan kendala
            </label>
            <Select id="severity" name="severity" defaultValue={filter.severity ?? ''}>
              <option value="">Semua tingkat</option>
              {ISSUE_SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_SEVERITY_META[s].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="issues_only"
                value="1"
                defaultChecked={Boolean(filter.issues_only)}
                className="border-border accent-primary size-4 rounded"
              />
              Hanya yang berkendala
            </label>

            <div className="flex items-center gap-2">
              <Button type="submit" className="h-8">
                Terapkan
              </Button>
              {hasActiveFilter && (
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ variant: 'outline' }), 'h-8')}
                >
                  Reset
                </Link>
              )}
            </div>
          </div>
        </div>
      </details>
    </form>
  );
}
