import Link from 'next/link';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { validationFilterSchema } from '@/features/documentation/schema';
import { getValidationQueue } from '@/features/documentation/queries';
import { canValidateDocumentation, REVIEWABLE_DOC_STATUSES } from '@/features/documentation/review';
import { ValidationQueue } from '@/features/documentation/components/validation-queue';
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
  const canValidate = canValidateDocumentation(session.profile?.role);

  // Bukan validator: halaman tetap dapat dibuka tapi tanpa data, dan alasannya
  // dijelaskan. RLS tetap menjadi pertahanan sebenarnya.
  if (!canValidate) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Validasi Dokumentasi</h1>
        </header>
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
          <ShieldOff className="text-muted-foreground size-10" />
          <p className="mt-4 font-medium">Role Anda bukan validator dokumentasi</p>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            Bukti yang dikirim vendor divalidasi oleh admin atau superadmin. Vendor mengunggah,
            bukan menilai.
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

  const result = await getValidationQueue(REVIEWABLE_DOC_STATUSES, filter);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Validasi Dokumentasi</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bukti pelaksanaan yang dikirim vendor, menunggu persetujuan Anda.
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
            {filter.stage && (
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
          <ValidationQueue items={result.data} currentUserId={session.id} />
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
