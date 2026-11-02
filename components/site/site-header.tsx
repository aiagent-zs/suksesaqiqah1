'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Brand } from '@/lib/brand';
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
  const isLanding = pathname === '/';
  const navHref = (hash: string) => (isLanding ? hash : `/${hash}`);

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

  // Menu mobile: kunci gulir body, tutup dengan Escape, kembalikan fokus ke
  // tombol pembukanya supaya pengguna keyboard tidak kehilangan posisi.
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
   * Kunci `overflow: hidden` baru terlepas setelah React selesai me-render,
   * sementara peramban sudah mencoba menggulir lebih dulu, dan menggulir di
   * `body` yang masih terkunci tidak menghasilkan apa-apa.
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded" onClick={() => setOpen(false)}>
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
            href="/lacak"
            aria-current={pathname === '/lacak' ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 ${
              pathname === '/lacak' ? 'text-primary' : 'text-ink-muted hover:text-ink'
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
          <Link href="/paket" className="btn btn-primary">
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

      {open && (
        <div
          id="mobile-menu"
          className="animate-in fade-in slide-in-from-top-2 border-line max-h-[calc(100dvh-4rem)] overflow-y-auto border-t bg-white pb-[env(safe-area-inset-bottom)] duration-300 ease-out lg:hidden"
        >
          <nav
            aria-label="Menu utama"
            className="mx-auto flex max-w-7xl flex-col px-4 py-3 sm:px-6"
          >
            {primaryNav.map((item) => (
              <a
                key={item.href}
                href={navHref(item.href)}
                onClick={handleMobileNavClick(item.href)}
                className="text-ink hover:bg-surface-muted flex min-h-12 items-center rounded-lg px-2 text-base font-medium"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/lacak"
              onClick={() => setOpen(false)}
              className="text-ink hover:bg-surface-muted flex min-h-12 items-center rounded-lg px-2 text-base font-medium"
            >
              Lacak pesanan
            </Link>
            <div className="border-line mt-3 flex flex-col gap-2 border-t pt-3">
              <Link href="/paket" onClick={() => setOpen(false)} className="btn btn-primary btn-lg">
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
          </nav>
        </div>
      )}
    </header>
  );
}
