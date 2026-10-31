'use client';

import { useEffect } from 'react';
import { siteConfig } from '@/lib/constants/site';

export default function ReportError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-h2 text-ink font-bold">Laporan gagal dimuat</h1>
      <p className="text-ink-muted mt-3 text-base leading-7">
        Tautan laporan Anda tetap berlaku. Coba buka lagi sebentar lagi, atau minta admin kami
        mengirimkan ulang.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className="btn btn-primary btn-lg">
          Coba lagi
        </button>
        <a
          href={siteConfig.whatsapp.href('Halo admin, halaman laporan aqiqah saya gagal dibuka.')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-lg"
        >
          Hubungi lewat WhatsApp
        </a>
      </div>
    </section>
  );
}
