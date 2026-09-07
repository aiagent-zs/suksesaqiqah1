import Link from 'next/link';
import { ArrowRight, PackageSearch } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { dashboardFilterSchema } from '@/features/dashboard/schema';
import { getVendorKpi, getIssueBreakdown, getOpenOrders } from '@/features/dashboard/queries';
import { summarizeVendorKpi } from '@/features/dashboard/summary';
import { countPendingGuestOrders } from '@/features/orders/queries';
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters';
import { KpiCards } from '@/features/dashboard/components/kpi-cards';
import { IssuePanel } from '@/features/dashboard/components/issue-panel';
import { getPendingAlerts } from '@/features/notifications/queries';
import { AlertPanel } from '@/features/notifications/components/alert-panel';
import {
  OpenOrdersCardList,
  OpenOrdersTable,
} from '@/features/dashboard/components/open-orders-table';
import { Pagination } from '@/components/data/pagination';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/server/auth/session';

export const metadata = { title: 'Dashboard — Sukses Aqiqah Command' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Judul & cakupan per role (docs/09 section 3–section 6). */
const DASHBOARD_HEADING: Record<UserRole, { title: string; subtitle: string }> = {
  superadmin: {
    title: 'Executive Dashboard',
    subtitle: 'Seluruh order, pembayaran, dan pelaksanaan.',
  },
  admin: {
    title: 'Dashboard Admin',
    subtitle: 'Order masuk, pembayaran menunggu verifikasi, dan bukti dari vendor.',
  },
  vendor: {
    title: 'Tugas Saya',
    subtitle: 'Order yang ditugaskan kepada Anda.',
  },
};

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const raw = await searchParams;

  // Nilai array (mis. ?status=a&status=b) diambil yang pertama saja.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const filter = dashboardFilterSchema.parse(flat);
  const heading = session.profile?.role
    ? DASHBOARD_HEADING[session.profile.role]
    : { title: 'Dashboard', subtitle: 'Ringkasan operasional dalam cakupan akses Anda.' };

  // Kelimanya berangkat bersamaan. `getPendingAlerts` dulu menunggu keempat
  // yang lain selesai sebelum berangkat — satu perjalanan bolak-balik penuh ke
  // Supabase yang ditumpuk di belakang, padahal ia tidak bergantung pada
  // satu pun hasil mereka.
  const [branchRows, openOrders, issues, pendingGuestOrders, alerts] = await Promise.all([
    getVendorKpi(),
    getOpenOrders(filter),
    getIssueBreakdown(),
    // Sengaja di luar `v_branch_kpi`: view itu tidak punya dimensi asal order,
    // dan menambahkannya berarti mengubah view (migration, satu pintu di Bani).
    // Hanya dihitung untuk yang bisa menindaklanjutinya — bagi vendor
    // angkanya selalu 0 (order tamu belum punya PIC), jadi kartunya cuma bising.
    canDo(session.profile?.role, 'VERIFY_GUEST_ORDER')
      ? countPendingGuestOrders()
      : Promise.resolve(null),
    // Outbox notifikasi. RLS-nya menuntut `is_staff()`, jadi vendor mendapat
    // array kosong tanpa penjagaan tambahan di sini — dan panelnya sendiri sudah
    // menangani keadaan kosong, jadi tidak perlu dirender bersyarat.
    getPendingAlerts(),
  ]);

  const summary = summarizeVendorKpi(branchRows);

  return (
    <div className="space-y-6">
      {/* Nama & peran sudah terbaca di sidebar; mengulanginya di sini hanya
          menambah teks yang bersaing dengan judul. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading.title}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{heading.subtitle}</p>
        </div>

        <Link href="/orders" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
          Kelola Order
          <ArrowRight className="size-4" />
        </Link>
      </header>

      <KpiCards summary={summary} pendingGuestOrders={pendingGuestOrders} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AlertPanel alerts={alerts} />
        </div>
        <IssuePanel breakdown={issues} basePath="/dashboard" searchParams={flat} />
      </div>

      {/* Tabel litmus test: berapa order tertunda, di mana, siapa PIC, apa kendalanya. */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Order Belum Selesai</h2>
          <p className="text-muted-foreground text-sm">
            Diurutkan dari kendala terberat, lalu order paling lama menggantung.
          </p>
        </div>

        {/* Filter menempel di sini, bukan melayang di tengah halaman: yang
            disaringnya cuma tabel di bawah ini. Ditaruh di atas KPI, ia
            terbaca seolah menyaring seluruh angka di halaman — padahal
            `getVendorKpi` dan `getIssueBreakdown` tidak menerimanya. */}
        <DashboardFilters filter={filter} />

        {openOrders.total === 0 ? (
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
            <PackageSearch className="text-muted-foreground size-10" />
            <p className="mt-4 font-medium">Tidak ada order tertunda</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              Semua order dalam cakupan akses Anda sudah selesai atau dibatalkan — atau filter di
              atas terlalu sempit.
            </p>
          </div>
        ) : (
          <>
            <OpenOrdersTable rows={openOrders.data} />
            <OpenOrdersCardList rows={openOrders.data} />
            <Pagination
              page={openOrders.page}
              pageSize={openOrders.page_size}
              total={openOrders.total}
              basePath="/dashboard"
              searchParams={flat}
            />
          </>
        )}
      </section>
    </div>
  );
}
