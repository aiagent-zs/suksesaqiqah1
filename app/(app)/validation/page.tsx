import Link from 'next/link';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { requireAuth, isCentral, isSupervisor } from '@/server/auth/session';
import { validationFilterSchema } from '@/features/documentation/schema';
import { getValidationQueue } from '@/features/documentation/queries';
import { reviewLevelFor } from '@/features/documentation/review';
import { ValidationQueue } from '@/features/documentation/components/validation-queue';
import { getBranchOptions } from '@/features/dashboard/queries';
import { Pagination } from '@/components/data/pagination';
import { Select } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { DOC_STAGE_LABEL, type DocStage } from '@/lib/constants/order';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Validasi Dokumentasi — Sukses Aqiqah' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ValidationPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const raw = await searchParams;

  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const filter = validationFilterSchema.parse(flat);
  const level = reviewLevelFor(session.profile?.role, isSupervisor(session.profile));

  // Bukan validator: halaman tetap dapat dibuka tapi tanpa data, dan alasannya
  // dijelaskan. RLS tetap menjadi pertahanan sebenarnya.
  if (!level) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Validasi Dokumentasi</h1>
        </header>
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <ShieldOff className="text-muted-foreground size-10" />
          <p className="mt-4 font-medium">Role Anda bukan validator dokumentasi</p>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            Validasi tingkat-1 dipegang Supervisor yang ditunjuk (Manager Program atau Admin Cabang
            dengan penanda Supervisor); validasi akhir dipegang Admin Pusat.
          </p>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-5 h-9')}
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const queueStatus = level === 'supervisor' ? 'pending' : 'approved_supervisor';
  const canPickBranch = isCentral(session.profile);

  const [result, branches] = await Promise.all([
    getValidationQueue(queueStatus, filter),
    canPickBranch ? getBranchOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {level === 'supervisor' ? 'Validasi Tingkat-1' : 'Validasi Akhir'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {level === 'supervisor'
              ? 'Dokumentasi baru dari petugas lapangan, menunggu persetujuan Supervisor.'
              : 'Dokumentasi yang lolos Supervisor, menunggu persetujuan Admin Pusat.'}
          </p>
        </div>

        <span className="border-border bg-card inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-sm">
          <ShieldCheck className="text-primary size-4" />
          <span className="font-medium tabular-nums">{result.total}</span> menunggu
        </span>
      </header>

      <form
        method="get"
        action="/validation"
        className="border-border bg-card rounded-2xl border p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <label htmlFor="stage" className="mb-1.5 block text-sm text-slate-700">
              Tahap
            </label>
            <Select id="stage" name="stage" defaultValue={filter.stage ?? ''}>
              <option value="">Semua tahap</option>
              {(Object.keys(DOC_STAGE_LABEL) as DocStage[]).map((s) => (
                <option key={s} value={s}>
                  {DOC_STAGE_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button type="submit" className="h-8">
              Terapkan
            </Button>
            {(filter.branch_id || filter.stage) && (
              <Link
                href="/validation"
                className={cn(buttonVariants({ variant: 'outline' }), 'h-8')}
              >
                Reset
              </Link>
            )}
          </div>
        </div>
      </form>

      {result.total === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <ShieldCheck className="text-primary size-10" />
          <p className="mt-4 font-medium">Antrian bersih</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Tidak ada dokumentasi yang menunggu validasi Anda saat ini.
          </p>
        </div>
      ) : (
        <>
          <ValidationQueue items={result.data} level={level} currentUserId={session.id} />
          <Pagination
            page={result.page}
            pageSize={result.page_size}
            total={result.total}
            basePath="/validation"
            searchParams={flat}
          />
        </>
      )}
    </div>
  );
}
