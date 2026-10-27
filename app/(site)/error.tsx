'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { siteConfig } from '@/lib/constants/site';

export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-h2 text-ink font-bold">Halaman ini gagal dimuat</h1>
      <p className="text-ink-muted mt-3 text-base leading-7">
        Kemungkinan koneksi ke server kami sedang terganggu. Isian form yang belum terkirim tetap
        tersimpan di perangkat Anda.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className="btn btn-primary btn-lg">
          Coba lagi
        </button>
        <a
          href={siteConfig.whatsapp.href('Halo admin, halaman web gagal dimuat.')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-lg"
        >
          Hubungi lewat WhatsApp
        </a>
      </div>
      <Link href="/" className="text-primary mt-6 inline-flex min-h-11 items-center font-semibold">
        Kembali ke beranda
      </Link>
    </section>
  );
}
