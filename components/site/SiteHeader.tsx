'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { primaryNav, siteConfig } from '@/lib/constants/site';
import { IconClose, IconMenu, IconWhatsApp } from './icons';
import { Logo } from './Logo';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Kunci scroll body saat menu mobile terbuka.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    // Latar solid dan garis bawah yang selalu ada. Versi sebelumnya memakai
    // `bg-white/70` tanpa border, sehingga header melebur ke hero yang sama
    // terangnya — batas antara navigasi dan konten jadi tidak terbaca. Yang
    // berubah saat scroll hanya kedalaman bayangannya, bukan ada/tidaknya batas.
    <header
      className={`sticky top-0 z-50 w-full border-b bg-white transition-shadow duration-300 ${
        scrolled ? 'border-neutral-200 shadow-sm' : 'border-neutral-100'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {primaryNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-primary rounded-full px-3.5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {/* <Link
            href="/login"
            className="hover:text-primary rounded-full px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors"
          >
            Masuk
          </Link> */}
          {/* Pemesanan mandiri berdampingan dengan WhatsApp, bukan
              menggantikannya — memilih kanal pemesanan adalah keputusan bisnis. */}
          <Link
            href="/checkout"
            className="hover:border-primary hover:text-primary rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors"
          >
            Pesan Online
          </Link>
          <a
            href={siteConfig.whatsapp.href('Halo Sukses Aqiqah, saya ingin memesan layanan.')}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary hover:bg-primary-dark inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            <IconWhatsApp className="h-4 w-4" />
            Pesan Sekarang
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <IconClose className="h-6 w-6" /> : <IconMenu className="h-6 w-6" />}
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <div className="border-t border-neutral-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6">
            {primaryNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="hover:text-primary rounded-lg px-2 py-3 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
              {/* <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-200 px-4 py-2.5 text-center text-sm font-semibold text-neutral-700"
              >
                Masuk
              </Link> */}
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-300 px-4 py-2.5 text-center text-sm font-semibold text-neutral-700"
              >
                Pesan Online
              </Link>
              <a
                href={siteConfig.whatsapp.href('Halo Sukses Aqiqah, saya ingin memesan layanan.')}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
              >
                <IconWhatsApp className="h-4 w-4" />
                Pesan Sekarang
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
