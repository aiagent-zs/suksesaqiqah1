import Link from 'next/link';
import { footerNav, siteConfig } from '@/lib/constants/site';
import { IconInstagram, IconMail, IconWhatsApp } from './icons';
import { Logo } from './logo';

export function SiteFooter() {
  const year = 2026; // Date.now() tidak tersedia di lingkungan build ini.

  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-6 text-neutral-600">
              {siteConfig.tagline}. Layanan Aqiqah dan Sedekah Daging yang syar’i, amanah, dan
              terdokumentasi.
            </p>
          </div>

          {/* Layanan */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Layanan</h3>
            <ul className="mt-4 space-y-3">
              {footerNav.layanan.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-primary text-sm text-neutral-600 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Bantuan */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Bantuan</h3>
            <ul className="mt-4 space-y-3">
              {footerNav.bantuan.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-primary text-sm text-neutral-600 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Kontak</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href={siteConfig.whatsapp.href('Halo Sukses Aqiqah, saya ingin bertanya.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors"
                >
                  <IconWhatsApp className="text-primary h-4 w-4 shrink-0" />
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors"
                >
                  <IconInstagram className="text-primary h-4 w-4 shrink-0" />
                  {siteConfig.instagram.handle}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="hover:text-primary inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors"
                >
                  <IconMail className="text-primary h-4 w-4 shrink-0" />
                  {siteConfig.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row">
          <p className="text-xs text-neutral-500">
            © {year} {siteConfig.name} — Zakat Sukses. Seluruh hak cipta dilindungi.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/syarat-layanan" className="hover:text-primary text-xs text-neutral-500">
              Syarat Layanan
            </Link>
            <Link href="/kebijakan-privasi" className="hover:text-primary text-xs text-neutral-500">
              Kebijakan Privasi
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
