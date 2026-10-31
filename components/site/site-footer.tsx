import Link from 'next/link';
import { getBrand } from '@/lib/brand-server';
import { footerNav, siteConfig } from '@/lib/constants/site';
import { IconArrowRight, IconInstagram, IconMail, IconWhatsApp } from './icons';
import { Logo } from './logo';

export async function SiteFooter() {
  const brand = await getBrand();
  const year = 2026; // Date.now() tidak tersedia di lingkungan build ini.

  return (
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <span className="inline-flex rounded-lg bg-white px-3 py-2">
              <Logo brand={brand} />
            </span>
            <p className="mt-4 text-sm leading-6 text-white/75">
              Layanan aqiqah dan katering dari Zakat Sukses. Setiap tahap dicatat, dan Anda menerima
              laporan pelaksanaannya.
            </p>
            <div className="mt-5 flex gap-3">
              <SocialButton
                href={siteConfig.whatsapp.href(`Halo ${brand.name}, saya ingin bertanya.`)}
                label={`WhatsApp ${siteConfig.whatsapp.display}`}
                icon={<IconWhatsApp className="size-5" />}
              />
              <SocialButton
                href={siteConfig.instagram.url}
                label={`Instagram ${siteConfig.instagram.handle}`}
                icon={<IconInstagram className="size-5" />}
              />
              {siteConfig.email && (
                <SocialButton
                  href={`mailto:${siteConfig.email}`}
                  label={`Email ${siteConfig.email}`}
                  icon={<IconMail className="size-5" />}
                />
              )}
            </div>
          </div>

          {/* Dua kolom berdampingan sejak ponsel: dua daftar pendek yang
              ditumpuk hanya menambah panjang gulir tanpa menambah isi. */}
          <div className="grid grid-cols-2 gap-6 lg:contents">
            <FooterGroup title="Layanan" items={footerNav.layanan} />
            <FooterGroup title="Bantuan" items={footerNav.bantuan} />
          </div>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-white/60">
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
      <h2 className="text-accent text-sm font-semibold">{title}</h2>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex min-h-11 items-center gap-1.5 text-sm text-white/85 hover:text-white"
            >
              {item.label}
              <IconArrowRight className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SocialButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex size-11 items-center justify-center rounded-lg border border-white/20 text-white transition-colors duration-150 hover:bg-white/10 active:scale-95"
    >
      {icon}
    </a>
  );
}
