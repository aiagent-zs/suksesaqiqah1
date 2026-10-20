import type { Metadata } from 'next';
import { getLandingCatalogue } from '@/features/landing/catalogue';
import { buildPackageTabs, orderMessage } from '@/features/landing/package-cards';
import { PackageFilter } from '@/components/site/package-filter';
import { siteConfig } from '@/lib/constants/site';
import { IconWhatsApp } from '@/components/site/icons';

export const metadata: Metadata = {
  title: 'Semua Paket & Harga',
  description: 'Daftar lengkap paket aqiqah dan katering Sukses Aqiqah beserta harganya.',
  alternates: { canonical: '/paket' },
};

/**
 * Daftar lengkap paket. Landing hanya memajang tiga kartu per tab; tautan
 * "Lihat semua" di sana membawa ke sini dengan `?jenis=` sebagai tab yang
 * langsung terbuka.
 */
export default async function PackagesPage({ searchParams }: PageProps<'/paket'>) {
  const { jenis } = await searchParams;
  const catalogue = await getLandingCatalogue();
  const tabs = buildPackageTabs(catalogue);
  const empty = tabs.every((t) => t.count === 0);

  return (
    <section className="border-b border-neutral-200 bg-neutral-50/70">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Semua paket & harga
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
          Harga sudah termasuk seluruh prosesnya — tidak ada biaya yang menyusul di belakang.
        </p>

        {empty ? (
          // Katalog kosong = database tak terjangkau (lihat `getLandingCatalogue`).
          // Tetap beri jalan keluar, bukan halaman hampa.
          <div className="mt-10 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            Daftar paket sedang tidak bisa dimuat. Tanyakan paket dan harga langsung ke tim kami.
            <a
              href={siteConfig.whatsapp.href(orderMessage())}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-fit items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <IconWhatsApp className="h-4 w-4" />
              Tanya via WhatsApp
            </a>
          </div>
        ) : (
          <PackageFilter
            tabs={tabs}
            defaultTab={typeof jenis === 'string' ? jenis : 'pilihan'}
          />
        )}
      </div>
    </section>
  );
}
