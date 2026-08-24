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

  const [branchRows, openOrders, issues, pendingGuestOrders] = await Promise.all([
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
  ]);

  // Outbox notifikasi. RLS-nya menuntut `is_staff()`, jadi vendor mendapat
  // array kosong tanpa penjagaan tambahan di sini — dan panelnya sendiri sudah
  // menangani keadaan kosong, jadi tidak perlu dirender bersyarat.
  const alerts = await getPendingAlerts();

  const summary = summarizeVendorKpi(branchRows);

  return (
    <div className="space-y-6">
      <header className="border-border flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{heading.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{heading.subtitle}</p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {session.profile?.full_name ?? session.email}
          </span>
          <Link href="/orders" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            Kelola Order
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <KpiCards summary={summary} pendingGuestOrders={pendingGuestOrders} />

      {/* Ditaruh tepat di bawah KPI: kartu menjawab *berapa*, panel ini
          menjawab *yang mana* dan membawa langsung ke barisnya. */}
      <AlertPanel alerts={alerts} />

      <DashboardFilters filter={filter} />

      <IssuePanel breakdown={issues} basePath="/dashboard" searchParams={flat} />

      {/* Tabel litmus test: berapa order tertunda, di mana, siapa PIC, apa kendalanya. */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Order Belum Selesai</h2>
          <p className="text-muted-foreground text-sm">
            Diurutkan dari kendala terberat, lalu order paling lama menggantung.
          </p>
        </div>

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
