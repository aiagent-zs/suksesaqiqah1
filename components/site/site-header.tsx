'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { primaryNav, siteConfig } from '@/lib/constants/site';
import { IconClose, IconMenu, IconWhatsApp } from './icons';
import { Logo } from './logo';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  /**
   * Seluruh menu utama menunjuk section di landing (`#layanan`, `#paket`, …).
   *
   * Header ini juga dipakai di `/checkout`, dan di sana section itu tidak ada
   * sama sekali — jadi `href="#layanan"` tidak menuju ke mana pun: menunya
   * **mati total**, dan pengunjung yang sudah masuk halaman checkout tidak
   * punya jalan kembali ke bagian mana pun di landing selain lewat logo.
   *
   * Karena itu anchor-nya diberi awalan path saat kita sedang di luar landing,
   * sehingga jadi tautan lintas-halaman (`/#layanan`) yang membuka landing lalu
   * menggulir ke seksinya. Di landing sendiri anchor dibiarkan polos supaya
   * peramban menggulir mulus tanpa memuat ulang halaman.
   */
  const isLanding = pathname === '/';
  const navHref = (hash: string) => (isLanding ? hash : `/${hash}`);

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

  /**
   * Tutup menu, lalu biarkan peramban menggulir ke anchor-nya.
   *
   * Menekan "Paket" di menu mobile memanggil `setOpen(false)` **sekaligus**
   * melepas navigasi `#paket`. Kunci `overflow: hidden` di atas baru terlepas
   * setelah React selesai me-render, sementara peramban sudah mencoba menggulir
   * lebih dulu — dan menggulir di dalam `body` yang masih terkunci tidak
   * menghasilkan apa-apa. Menunya terasa mati padahal tautannya benar.
   *
   * Jadi navigasi bawaannya dicegah, menu ditutup, lalu penggulirannya
   * dikerjakan sendiri pada frame berikutnya — saat kuncinya sudah lepas.
   * `history.pushState` dipakai agar alamatnya tetap membawa hash, sehingga
   * tautannya masih bisa disalin dan dibagikan.
   */
  const handleMobileNavClick = (hash: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Di luar landing tautannya lintas-halaman (`/#paket`) — biarkan Next
    // yang menanganinya seperti biasa.
    if (!isLanding) {
      setOpen(false);
      return;
    }

    const target = document.querySelector(hash);
    if (!target) return; // Section tak ditemukan: jangan cegah apa pun.

    e.preventDefault();
    setOpen(false);
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
      history.pushState(null, '', hash);
    });
  };

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
              href={navHref(item.href)}
              className="hover:text-primary inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-neutral-600 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {/* <Link
            href="/login"
            className="hover:text-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Masuk
          </Link> */}
          {/* Pemesanan mandiri berdampingan dengan WhatsApp, bukan
              menggantikannya — memilih kanal pemesanan adalah keputusan bisnis. */}
          <a
            href={siteConfig.whatsapp.href('Halo Sukses Aqiqah, saya ingin memesan layanan.')}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors"
          >
            <IconWhatsApp className="h-4 w-4" />
            WhatsApp
          </a>
          {/* Satu tombol utama saja. Sebelumnya ada dua tombol berdampingan —
              "Pesan Online" dan "Pesan Sekarang" — yang menyulitkan pengunjung
              menebak bedanya. WhatsApp turun jadi tautan biasa. */}
          <Link
            href="/checkout"
            className="bg-primary hover:bg-primary-dark inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-all hover:shadow active:scale-[0.98]"
          >
            Pesan Online
          </Link>
        </div>

        {/* 44×44px — ambang target sentuh yang nyaman di ponsel
            (`design.md §9`: "target sentuh besar"). */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200 md:hidden"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <IconClose className="h-6 w-6" /> : <IconMenu className="h-6 w-6" />}
        </button>
      </div>

      {/* Menu mobile — memudar & turun sedikit saat dibuka. 320ms: cukup untuk
          terbaca sebagai "panel ini datang dari header" dan selaras dengan
          gerakan lain di halaman, tanpa menahan pengunjung yang sudah tahu mau
          ke mana. Panel yang dibuka atas permintaan pengguna memang wajar lebih
          singkat daripada reveal yang muncul sendiri saat digulir. */}
      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 border-t border-neutral-200 bg-white duration-[320ms] ease-out md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3 sm:px-6">
            {primaryNav.map((item) => (
              <a
                key={item.href}
                href={navHref(item.href)}
                onClick={handleMobileNavClick(item.href)}
                className="hover:text-primary rounded-lg px-2 py-3.5 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
              {/* <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-lg border border-neutral-200 px-4 text-center text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
              >
                Masuk
              </Link> */}
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="bg-primary rounded-lg px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Pesan Online
              </Link>
              <a
                href={siteConfig.whatsapp.href('Halo Sukses Aqiqah, saya ingin memesan layanan.')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-800"
              >
                <IconWhatsApp className="h-4 w-4" />
                Tanya via WhatsApp
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
