import Link from 'next/link';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { getChannel } from '@/lib/brand-server';
import { BRANDS, channelHref } from '@/lib/brand';

export const metadata = { title: 'Halaman tidak ditemukan' };

/**
 * 404 global. Ditaruh di root karena tautan rusak bisa datang dari mana saja
 * (pesan WhatsApp lama, sitemap lama), dan pengunjung yang tersesat butuh
 * header situs untuk kembali, bukan halaman polos bawaan Next.
 */
export default async function NotFound() {
  const channel = await getChannel();
  return (
    <>
      <SiteHeader brand={BRANDS[channel]} />
      <main className="flex-1">
        <section className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
          <p className="text-primary text-sm font-semibold tabular-nums">404</p>
          <h1 className="text-h2 text-ink mt-2 font-bold">Halaman tidak ditemukan</h1>
          <p className="text-ink-muted mt-3 text-base leading-7">
            Alamat yang Anda buka tidak ada atau sudah dipindah.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={channelHref(channel, '/paket')} className="btn btn-primary btn-lg">
              Lihat paket aqiqah
            </Link>
            <Link href={channelHref(channel, '/lacak')} className="btn btn-outline btn-lg">
              Lacak pesanan
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
