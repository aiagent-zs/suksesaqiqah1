import Link from 'next/link';
import { channelHref, type Channel } from '@/lib/brand';

/**
 * Kepala halaman checkout aqiqah & katering: jejak halaman, judul, dan satu
 * kalimat apa yang terjadi sesudah konfirmasi.
 *
 * Jejaknya tautan sungguhan (bukan teks), supaya pemesan yang ingin
 * membandingkan paket lagi tidak perlu menekan Kembali berkali-kali melewati
 * langkah form.
 */
export function CheckoutHero({
  channel,
  title,
  children,
}: {
  channel: Channel;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="py-6 sm:py-8">
      <nav aria-label="Jejak halaman" className="text-ink-muted text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href={channelHref(channel, '/')}
              className="hover:text-ink underline-offset-2 hover:underline"
            >
              Beranda
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={channelHref(channel, '/paket')}
              className="hover:text-ink underline-offset-2 hover:underline"
            >
              Paket
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-ink font-medium">
            {title}
          </li>
        </ol>
      </nav>
      <h1 className="text-h2 text-ink mt-2 font-bold tracking-tight">{title}</h1>
      <p className="text-ink-muted mt-1.5 max-w-2xl text-sm leading-6 sm:text-base">{children}</p>
    </header>
  );
}
