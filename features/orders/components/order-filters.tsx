import { Search } from 'lucide-react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ORDER_STATUS_META,
  ORDER_STATUS_FLOW,
  PAYMENT_STATUS_META,
  type OrderStatus,
} from '@/lib/constants/order';
import { ORDER_SOURCES, ORDER_SOURCE_LABEL, type OrderFilterInput } from '../schema';

type Option = { id: string; name: string; code?: string };

/**
 * FilterBar list order (docs/14 section 5, docs/16 section 1).
 * Sengaja memakai form GET native: filter tetap berfungsi tanpa JavaScript,
 * dan state filter hidup di URL sehingga bisa di-bookmark & di-share.
 */
export function OrderFilters({
  filter,
  branches,
  canPickBranch,
}: {
  filter: OrderFilterInput;
  branches: Option[];
  canPickBranch: boolean;
}) {
  const allStatuses: OrderStatus[] = [...ORDER_STATUS_FLOW, 'on_hold', 'cancelled'];
  const hasActiveFilter = Boolean(
    filter.q ||
      filter.status ||
      filter.payment_status ||
      filter.branch_id ||
      filter.source ||
      filter.date_from ||
      filter.date_to,
  );

  return (
    <form
      method="get"
      action="/orders"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="mb-1.5 block text-sm text-slate-700">
            Cari
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              name="q"
              defaultValue={filter.q ?? ''}
              placeholder="Nomor order atau nama peserta"
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm text-slate-700">
            Status
          </label>
          <Select id="status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">Semua status</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="payment_status" className="mb-1.5 block text-sm text-slate-700">
            Pembayaran
          </label>
          <Select
            id="payment_status"
            name="payment_status"
            defaultValue={filter.payment_status ?? ''}
          >
            <option value="">Semua</option>
            {(Object.keys(PAYMENT_STATUS_META) as Array<keyof typeof PAYMENT_STATUS_META>).map(
              (s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_META[s].label}
                </option>
              ),
            )}
          </Select>
        </div>

        <div>
          <label htmlFor="source" className="mb-1.5 block text-sm text-slate-700">
            Sumber order
          </label>
          <Select id="source" name="source" defaultValue={filter.source ?? ''}>
            <option value="">Semua sumber</option>
            {ORDER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {ORDER_SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        {canPickBranch && (
          <div>
            <label htmlFor="branch_id" className="mb-1.5 block text-sm text-slate-700">
              Cabang
            </label>
            <Select id="branch_id" name="branch_id" defaultValue={filter.branch_id ?? ''}>
              <option value="">Semua cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code ? `${b.code} — ${b.name}` : b.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <label htmlFor="date_from" className="mb-1.5 block text-sm text-slate-700">
            Dari tanggal
          </label>
          <Input id="date_from" name="date_from" type="date" defaultValue={filter.date_from ?? ''} />
        </div>

        <div>
          <label htmlFor="date_to" className="mb-1.5 block text-sm text-slate-700">
            Sampai tanggal
          </label>
          <Input id="date_to" name="date_to" type="date" defaultValue={filter.date_to ?? ''} />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" className="h-8">
            Terapkan
          </Button>
          {hasActiveFilter && (
            <Link href="/orders" className={cn(buttonVariants({ variant: 'outline' }), 'h-8')}>
              Reset
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
