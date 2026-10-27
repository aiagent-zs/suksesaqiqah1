import Link from 'next/link';
import { getBrand } from '@/lib/brand-server';
import { footerNav, siteConfig } from '@/lib/constants/site';
import { IconInstagram, IconMail, IconWhatsApp } from './icons';
import { Logo } from './logo';

export async function SiteFooter() {
  const brand = await getBrand();
  const year = 2026; // Date.now() tidak tersedia di lingkungan build ini.

  return (
    <footer className="border-line border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
        {/* Tiga kelompok, bukan empat kolom template: merek + kontak di kiri
            karena kontaklah yang paling sering dicari, lalu dua daftar tautan. */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Logo brand={brand} />
            <p className="text-ink-muted mt-4 text-sm leading-6">
              Layanan aqiqah dan katering dari Zakat Sukses. Setiap tahap dicatat, dan Anda menerima
              laporan pelaksanaannya.
            </p>
            <ul className="mt-5 space-y-1">
              <FooterContact
                href={siteConfig.whatsapp.href(`Halo ${brand.name}, saya ingin bertanya.`)}
                external
                icon={<IconWhatsApp className="text-primary size-4 shrink-0" />}
                label={`WhatsApp ${siteConfig.whatsapp.display}`}
              />
              <FooterContact
                href={siteConfig.instagram.url}
                external
                icon={<IconInstagram className="text-primary size-4 shrink-0" />}
                label={siteConfig.instagram.handle}
              />
              <FooterContact
                href={`mailto:${siteConfig.email}`}
                icon={<IconMail className="text-primary size-4 shrink-0" />}
                label={siteConfig.email}
              />
            </ul>
          </div>

          <FooterGroup title="Layanan" items={footerNav.layanan} />
          <FooterGroup title="Bantuan" items={footerNav.bantuan} />
        </div>

        <p className="border-line text-ink-muted mt-10 border-t pt-6 text-xs">
          © {year} {brand.name}, bagian dari Zakat Sukses.
        </p>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  items,
}: {
  title: string;
  items: readonly { label: string; href: string }[];
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-ink text-sm font-semibold">{title}</h2>
      <ul className="mt-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-ink-muted hover:text-primary flex min-h-11 items-center text-sm"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterContact({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="text-ink-muted hover:text-primary inline-flex min-h-11 items-center gap-2 text-sm break-all"
      >
        {icon}
        {label}
      </a>
    </li>
  );
}
