import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
  vendors,
}: {
  filter: ScheduleFilterInput;
  locations: Option[];
  vendors: Option[];
}) {
  const hasActiveFilter = Boolean(
    filter.location_id ||
    filter.vendor_id ||
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
          <label htmlFor="vendor_id" className="mb-1.5 block text-sm text-slate-700">
            Mitra pelaksana
          </label>
          <Select id="vendor_id" name="vendor_id" defaultValue={filter.vendor_id ?? ''}>
            <option value="">Semua mitra</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
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
