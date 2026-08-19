import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SCHEDULE_STATUS_META, type ScheduleStatus } from '@/lib/constants/order';
import { SCHEDULE_STATUS_FLOW } from '../status-machine';
import type { ScheduleFilterInput } from '../schema';

type Option = { id: string; name: string; code?: string | null };

/**
 * FilterBar halaman Jadwal (`prd.md` FR-S2).
 * Form GET native seperti FilterBar order: berfungsi tanpa JavaScript dan
 * state-nya hidup di URL sehingga bisa di-bookmark & dibagikan ke petugas.
 */
export function ScheduleFilters({
  filter,
  locations,
  pics,
}: {
  filter: ScheduleFilterInput;
  locations: Option[];
  pics: Option[];
}) {
  const hasActiveFilter = Boolean(
    filter.location_id ||
    filter.pic_id ||
    filter.status ||
    filter.date_from ||
    filter.date_to ||
    filter.active_only,
  );

  return (
    <form
      method="get"
      action="/schedule"
      className="border-border bg-card rounded-2xl border p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="location_id" className="mb-1.5 block text-sm text-slate-700">
            Lokasi
          </label>
          <Select id="location_id" name="location_id" defaultValue={filter.location_id ?? ''}>
            <option value="">Semua lokasi</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="pic_id" className="mb-1.5 block text-sm text-slate-700">
            Petugas (PIC)
          </label>
          <Select id="pic_id" name="pic_id" defaultValue={filter.pic_id ?? ''}>
            <option value="">Semua petugas</option>
            {pics.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm text-slate-700">
            Status jadwal
          </label>
          <Select id="status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">Semua status</option>
            {SCHEDULE_STATUS_FLOW.map((s: ScheduleStatus) => (
              <option key={s} value={s}>
                {SCHEDULE_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="date_from" className="mb-1.5 block text-sm text-slate-700">
            Dari tanggal
          </label>
          <Input
            id="date_from"
            name="date_from"
            type="date"
            defaultValue={filter.date_from ?? ''}
          />
        </div>

        <div>
          <label htmlFor="date_to" className="mb-1.5 block text-sm text-slate-700">
            Sampai tanggal
          </label>
          <Input id="date_to" name="date_to" type="date" defaultValue={filter.date_to ?? ''} />
        </div>

        <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active_only"
              value="1"
              defaultChecked={Boolean(filter.active_only)}
              className="border-border accent-primary size-4 rounded"
            />
            Sembunyikan order selesai/batal
          </label>

          <div className="flex items-center gap-2">
            <Button type="submit" className="h-8">
              Terapkan
            </Button>
            {hasActiveFilter && (
              <Link href="/schedule" className={cn(buttonVariants({ variant: 'outline' }), 'h-8')}>
                Reset
              </Link>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
