'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { channelFromPath, channelHref, type Brand } from '@/lib/brand';
import { primaryNav, siteConfig } from '@/lib/constants/site';
import { IconClose, IconMenu, IconWhatsApp } from './icons';
import { Logo } from './logo';

export function SiteHeader({ brand }: { brand: Brand }) {
  const waMessage = `Halo ${brand.name}, saya ingin konsultasi soal paket aqiqah.`;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  /**
   * Seluruh menu utama menunjuk section di landing (`#layanan`, `#paket`, …).
   * Di luar landing section itu tidak ada, jadi anchor-nya diberi awalan path
   * (`/#layanan`) supaya tetap membawa ke tempatnya. Di landing dibiarkan polos
   * supaya peramban menggulir tanpa memuat ulang halaman.
   */
  // Kanal dari path, bukan prop: header ini juga dirender `not-found` global.
  const channel = channelFromPath(pathname ?? '/');
  const home = channelHref(channel, '/');
  const lacak = channelHref(channel, '/lacak');
  const paket = channelHref(channel, '/paket');
  const isLanding = pathname === home;
  const navHref = (hash: string) => (isLanding ? hash : channelHref(channel, `/${hash}`));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Penanda menu aktif: section yang sedang menempati bagian atas layar.
  useEffect(() => {
    if (!isLanding) return;
    const sections = primaryNav
      .map((n) => document.querySelector<HTMLElement>(n.href))
      .filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveHash(`#${e.target.id}`);
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [isLanding]);

  // Menu ponsel: kunci gulir halaman di belakangnya, tutup dengan Escape, dan
  // kembalikan fokus ke tombol pembuka supaya pengguna keyboard tidak tersesat.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /**
   * Tutup menu, lalu gulir ke anchor-nya pada frame berikutnya.
   *
   * Kunci `overflow: hidden` baru terlepas setelah React selesai me-render;
   * menggulir `body` yang masih terkunci tidak menghasilkan apa-apa.
   *
   */
  const handleMobileNavClick = (hash: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isLanding) {
      setOpen(false);
      return;
    }
    const target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    setOpen(false);
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      history.pushState(null, '', hash);
    });
  };

  const linkState = (href: string) =>
    isLanding && activeHash === href ? 'text-primary' : 'text-ink-muted hover:text-ink';

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b bg-white transition-shadow duration-150 ${
        scrolled ? 'border-line shadow-sm' : 'border-transparent'
      }`}
    >
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href={home} className="shrink-0 rounded" onClick={() => setOpen(false)}>
          <Logo brand={brand} />
        </Link>

        <nav aria-label="Menu utama" className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <a
              key={item.href}
              href={navHref(item.href)}
              aria-current={isLanding && activeHash === item.href ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ${linkState(item.href)}`}
            >
              {item.label}
            </a>
          ))}
          <Link
            href={lacak}
            aria-current={pathname === lacak ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ${
              pathname === lacak ? 'text-primary' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Lacak pesanan
          </Link>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href={siteConfig.whatsapp.href(waMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            <IconWhatsApp className="size-4" />
            WhatsApp
          </a>
          <Link href={paket} className="btn btn-primary">
            Lihat paket aqiqah
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-ink hover:bg-surface-muted inline-flex size-11 items-center justify-center rounded-lg lg:hidden"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <IconClose className="size-6" /> : <IconMenu className="size-6" />}
        </button>
      </div>

      {/* Menu ponsel melayang tepat di bawah header (`absolute top-full`) dan
          menimpa hero setinggi isinya saja, bukan menyisip ke aliran isi: hero
          tidak terdorong turun, dan halaman di bawah menu tetap terlihat.
          Latarnya putih pekat; ketuk di luar menu untuk menutupnya. */}
      {open && (
        <button
          type="button"
          aria-label="Tutup menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-x-0 top-16 bottom-0 cursor-default lg:hidden"
        />
      )}
      {open && (
        <div
          id="mobile-menu"
          className="animate-in fade-in slide-in-from-top-2 border-line absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-y bg-white shadow-sm duration-150 lg:hidden"
        >
          <nav aria-label="Menu utama" className="container-site flex flex-col py-2">
            {primaryNav.map((item) => (
              <a
                key={item.href}
                href={navHref(item.href)}
                onClick={handleMobileNavClick(item.href)}
                className="text-ink hover:bg-surface-muted -mx-2 flex min-h-12 items-center rounded-lg px-2 text-base font-medium"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={lacak}
              onClick={() => setOpen(false)}
              className="text-ink hover:bg-surface-muted -mx-2 flex min-h-12 items-center rounded-lg px-2 text-base font-medium"
            >
              Lacak pesanan
            </Link>
          </nav>
          <div className="container-site border-line flex flex-col gap-2 border-t pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link href={paket} onClick={() => setOpen(false)} className="btn btn-primary btn-lg">
              Lihat paket aqiqah
            </Link>
            <a
              href={siteConfig.whatsapp.href(waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-lg"
            >
              <IconWhatsApp className="size-4" />
              Konsultasi WhatsApp
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
