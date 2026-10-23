import type { Metadata } from 'next';
import Link from 'next/link';
import { getLandingCatalogue } from '@/features/landing/catalogue';
import { buildPackageTabs, orderMessage, type PackageSort } from '@/features/landing/package-cards';
import { PackageFilter } from '@/components/site/package-filter';
import { siteConfig } from '@/lib/constants/site';
import { IconWhatsApp } from '@/components/site/icons';

export const metadata: Metadata = {
  title: 'Semua Paket & Harga',
  description: 'Daftar lengkap paket aqiqah dan katering Sukses Aqiqah beserta harganya.',
  alternates: { canonical: '/paket' },
};

const SORTS: { id: PackageSort; label: string }[] = [
  { id: 'rekomendasi', label: 'Rekomendasi' },
  { id: 'termurah', label: 'Harga terendah' },
  { id: 'termahal', label: 'Harga tertinggi' },
];

/**
 * Daftar lengkap paket. Landing hanya memajang tiga kartu per tab; tautan
 * "Lihat semua" di sana membawa ke sini dengan `?jenis=` sebagai tab yang
 * langsung terbuka. Urutan lewat `?urut=` (tautan biasa, bukan state klien),
 * jadi kartunya tetap dirakit di server.
 */
export default async function PackagesPage({ searchParams }: PageProps<'/paket'>) {
  const { jenis, urut } = await searchParams;
  const sort = SORTS.find((s) => s.id === urut)?.id ?? 'rekomendasi';
  const tab = typeof jenis === 'string' ? jenis : 'pilihan';
  const catalogue = await getLandingCatalogue();
  const tabs = buildPackageTabs(catalogue, undefined, sort);
  const empty = tabs.every((t) => t.count === 0);

  return (
    <section className="bg-surface-muted border-line border-b">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-h1 text-ink font-bold tracking-tight">Semua paket & harga</h1>
        <p className="text-ink-muted mt-4 max-w-2xl text-base leading-7">
          Harga sudah termasuk penyembelihan, pemasakan, dokumentasi, dan laporan pelaksanaan. Tidak
          ada biaya yang menyusul.
        </p>

        {empty ? (
          // Katalog kosong = database tak terjangkau (lihat `getLandingCatalogue`).
          <div className="border-line text-ink mt-10 rounded-lg border bg-white p-6 text-base">
            <p className="font-semibold">Daftar paket sedang tidak bisa dimuat.</p>
            <p className="text-ink-muted mt-1 text-sm">
              Muat ulang halaman ini sebentar lagi, atau tanyakan paket dan harga langsung ke tim
              kami.
            </p>
            <a
              href={siteConfig.whatsapp.href(orderMessage())}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline mt-4"
            >
              <IconWhatsApp className="size-4" />
              Tanya lewat WhatsApp
            </a>
          </div>
        ) : (
          <>
            <nav
              aria-label="Urutkan paket"
              className="mt-8 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm"
            >
              <span className="text-ink-muted mr-2">Urutkan:</span>
              {SORTS.map((s) => (
                <Link
                  key={s.id}
                  href={`/paket?jenis=${tab}&urut=${s.id}`}
                  scroll={false}
                  aria-current={s.id === sort ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-md px-3 font-medium ${
                    s.id === sort
                      ? 'text-primary underline decoration-2 underline-offset-4'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
            <PackageFilter key={sort} tabs={tabs} defaultTab={tab} />
          </>
        )}
      </div>
    </section>
  );
}
