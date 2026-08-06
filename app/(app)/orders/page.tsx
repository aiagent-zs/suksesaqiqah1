import Link from 'next/link';
import { Plus, PackageSearch } from 'lucide-react';
import { requireAuth, isCentral } from '@/server/auth/session';
import { listOrders, getOrderFormOptions } from '@/features/orders/queries';
import { orderFilterSchema } from '@/features/orders/schema';
import { OrderFilters } from '@/features/orders/components/order-filters';
import { OrderCardList, OrderTable } from '@/features/orders/components/order-table';
import { Pagination } from '@/components/data/pagination';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Order — Sukses Aqiqah' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const raw = await searchParams;

  // Nilai array (mis. ?status=a&status=b) diambil yang pertama saja.
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const filter = orderFilterSchema.parse(flat);
  const [result, { branches }] = await Promise.all([listOrders(filter), getOrderFormOptions()]);

  const canCreate =
    session.profile?.role === 'admin_cabang' || session.profile?.role === 'manager_program';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seluruh pesanan aqiqah & qurban dalam cakupan akses Anda.
          </p>
        </div>

        {canCreate && (
          <Link href="/orders/new" className={cn(buttonVariants(), 'h-9')}>
            <Plus className="size-4" />
            Order Baru
          </Link>
        )}
      </header>

      <OrderFilters
        filter={filter}
        branches={branches}
        canPickBranch={isCentral(session.profile)}
      />

      {result.total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <PackageSearch className="size-10 text-muted-foreground" />
          <p className="mt-4 font-medium">Tidak ada order yang cocok</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Coba longgarkan filter, atau buat order baru bila pesanan memang belum tercatat.
          </p>
          {canCreate && (
            <Link href="/orders/new" className={cn(buttonVariants(), 'mt-5 h-9')}>
              <Plus className="size-4" />
              Buat Order
            </Link>
          )}
        </div>
      ) : (
        <>
          <OrderTable rows={result.data} />
          <OrderCardList rows={result.data} />
          <Pagination
            page={result.page}
            pageSize={result.page_size}
            total={result.total}
            basePath="/orders"
            searchParams={flat}
          />
        </>
      )}
    </div>
  );
}
