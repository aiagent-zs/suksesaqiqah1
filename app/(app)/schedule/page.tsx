import { CalendarOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { scheduleFilterSchema } from '@/features/schedules/schema';
import { getScheduleFilterOptions, listSchedules } from '@/features/schedules/queries';
import { ScheduleFilters } from '@/features/schedules/components/schedule-filters';
import { ScheduleCardList, ScheduleTable } from '@/features/schedules/components/schedule-table';
import { Pagination } from '@/components/data/pagination';

export const metadata = { title: 'Jadwal — Sukses Aqiqah' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAuth();
  const raw = await searchParams;

  // Nilai array (mis. ?status=a&status=b) diambil yang pertama saja.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const filter = scheduleFilterSchema.parse(flat);
  const [result, options] = await Promise.all([listSchedules(filter), getScheduleFilterOptions()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Jadwal</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pelaksanaan per lokasi dan per petugas, diurutkan dari tanggal terdekat.
        </p>
      </header>

      <ScheduleFilters filter={filter} locations={options.locations} vendors={options.vendors} />

      {result.total === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
          <CalendarOff className="text-muted-foreground size-10" />
          <p className="mt-4 font-medium">Tidak ada jadwal yang cocok</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Longgarkan filter, atau tetapkan jadwal dari halaman detail order — tanggal, lokasi, dan
            PIC diatur di sana.
          </p>
        </div>
      ) : (
        <>
          <ScheduleTable rows={result.data} />
          <ScheduleCardList rows={result.data} />
          <Pagination
            page={result.page}
            pageSize={result.page_size}
            total={result.total}
            basePath="/schedule"
            searchParams={flat}
          />
        </>
      )}
    </div>
  );
}
