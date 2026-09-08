import Link from 'next/link';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { stageQueueFilterSchema } from '@/features/stages/schema';
import { getStageQueue } from '@/features/stages/queries';
import { StageQueue } from '@/features/stages/components/stage-queue';
import { STAGE_META } from '@/features/stages/sequence';
import type { FulfilmentStage } from '@/features/stages/sequence';
import { Select } from '@/components/ui/select';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Validasi Laporan Tahap — Sukses Aqiqah' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Antrean laporan tahap yang menunggu keputusan admin.
 *
 * Sampai 8 September halaman ini adalah antrean **foto** lintas order, terpisah
 * dari laporan tahap yang dibuktikannya. Admin menyetujui sebuah foto tanpa
 * melihat laporannya, lalu memvalidasi laporannya di halaman order tanpa
 * melihat fotonya — dua keputusan untuk satu pekerjaan, masing-masing tanpa
 * konteks yang utuh.
 *
 * Rutenya sengaja tetap `/validation`: menggantinya menyentuh navigasi,
 * middleware, robots, kartu KPI, dan tautan notifikasi tanpa memberi manfaat
 * apa pun bagi pemakainya.
 */
export default async function ValidationPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireAuth();
  const raw = await searchParams;

  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const filter = stageQueueFilterSchema.parse(flat);
  const canValidate = canDo(session.profile?.role, 'VALIDATE_STAGE_REPORT');

  // Bukan validator: halaman tetap dapat dibuka tapi tanpa data, dan alasannya
  // dijelaskan. Menyembunyikan halamannya begitu saja membuat orang menebak
  // apakah menunya rusak atau memang bukan haknya. RLS tetap pertahanan
  // sesungguhnya.
  if (!canValidate) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Validasi Laporan Tahap</h1>
        </header>
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
          <ShieldOff className="text-muted-foreground size-10" />
          <p className="mt-4 font-medium">Role Anda bukan validator laporan tahap</p>
          <p className="text-muted-foreground mt-1 max-w-md text-sm">
            Laporan pelaksanaan dari mitra divalidasi admin atau superadmin. Mitra melaporkan dan
            mengunggah buktinya, bukan menilainya.
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

  const items = await getStageQueue({ stage: filter.stage });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Validasi Laporan Tahap</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Laporan pelaksanaan dari mitra beserta buktinya, menunggu keputusan Anda.
          </p>
        </div>

        <span className="border-border bg-card inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-sm">
          <ShieldCheck className="text-primary size-4" />
          <span className="font-medium tabular-nums">{items.length}</span> menunggu
        </span>
      </header>

      <form
        method="get"
        action="/validation"
        className="border-border bg-card rounded-lg border p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="stage" className="mb-1.5 block text-sm text-slate-700">
              Tahap
            </label>
            <Select id="stage" name="stage" defaultValue={filter.stage ?? ''}>
              <option value="">Semua tahap</option>
              {(Object.keys(STAGE_META) as FulfilmentStage[]).map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
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

      {items.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
          <ShieldCheck className="text-primary size-10" />
          <p className="mt-4 font-medium">Antrean bersih</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Tidak ada laporan tahap yang menunggu validasi Anda saat ini.
          </p>
        </div>
      ) : (
        <StageQueue items={items} currentUserId={session.id} />
      )}
    </div>
  );
}
