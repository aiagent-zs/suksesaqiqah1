import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { requireAuth } from '@/server/auth/session';
import { canDo } from '@/server/auth/capabilities';
import { listVendors } from '@/features/vendors/queries';
import { listServices } from '@/features/services/queries';
import { VendorManager } from '@/features/vendors/components/vendor-manager';
import { ServiceManager } from '@/features/services/components/service-manager';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Mitra & Katalog — Sukses Aqiqah' };

type Search = Promise<{ tab?: string }>;

const TABS = [
  { key: 'mitra', label: 'Mitra Pelaksana' },
  { key: 'katalog', label: 'Katalog Paket' },
] as const;

/**
 * Master mitra **dan** katalog paket — berhenti di superadmin.
 *
 * ## Kenapa keduanya satu halaman
 *
 * Katalog sempat berdiri sebagai `/services` terpisah, lalu disatukan ke sini.
 * Alasannya bukan kerapian menu: keduanya bagian dari satu pekerjaan yang sama
 * — menyiapkan **apa yang dijual dan siapa yang mengerjakannya**. Modal mitra
 * (`vendor_services`) menunjuk baris katalog, dan margin lahir dari selisih
 * keduanya. Memisahkannya berarti operator berpindah halaman untuk menjawab
 * satu pertanyaan.
 *
 * Keduanya juga berbagi pintu yang sama: superadmin, dengan alasan yang sama
 * pula — harga jual dan harga modal sama-sama menentukan margin.
 *
 * ## Tab lewat URL, bukan state
 *
 * `?tab=` supaya tautan bisa dibagikan dan tombol kembali peramban bekerja
 * sebagaimana mestinya. Pola yang sama dengan filter di `/orders` dan
 * `/schedule` yang juga menyimpan keadaannya di URL.
 */
export default async function VendorsPage({ searchParams }: { searchParams: Search }) {
  const session = await requireAuth();

  if (!canDo(session.profile?.role, 'MANAGE_VENDORS')) {
    return (
      <div className="border-border bg-card rounded-lg border p-10 text-center shadow-sm">
        <ShieldOff className="text-muted-foreground mx-auto size-8" />
        <h1 className="mt-3 text-lg font-semibold">Master mitra dibatasi</h1>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">
          Hanya superadmin yang dapat mendaftarkan mitra, mengatur harga modalnya, dan mengubah
          katalog paket. Admin tetap bisa menugaskan mitra ke order dari halaman detail order.
        </p>
      </div>
    );
  }

  const { tab } = await searchParams;
  // Nilai tak dikenal jatuh ke tab pertama alih-alih 404: `?tab=` datang dari
  // URL yang bisa diketik siapa saja, dan halaman yang hilang untuk salah ketik
  // lebih buruk daripada tab yang tidak sesuai harapan.
  const active = TABS.some((t) => t.key === tab) ? tab : 'mitra';

  const [vendors, services] = await Promise.all([listVendors(), listServices()]);

  return (
    <div className="space-y-4">
      <nav className="border-border flex gap-1 border-b" aria-label="Bagian master data">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={`/vendors?tab=${t.key}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'min-h-11 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {t.label}
              <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                {t.key === 'mitra' ? vendors.length : services.length}
              </span>
            </Link>
          );
        })}
      </nav>

      {active === 'mitra' ? (
        <VendorManager vendors={vendors} />
      ) : (
        <ServiceManager services={services} />
      )}
    </div>
  );
}
