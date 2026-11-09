'use client';

import { ShieldCheck } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { siteConfig } from '@/lib/constants/site';
import { IconWhatsApp } from '@/components/site/icons';

export type AsideLine = { label: string; detail: string; amount: number };

/**
 * Ringkasan tagihan yang menempel di kolom kanan, dipakai checkout aqiqah dan
 * katering.
 *
 * Hanya di desktop (`lg`). Di ponsel total sudah ada di bilah aksi bawah
 * (`StepNav`), dan kolom kedua di 375px berarti isian yang menyempit separuh.
 * Isinya baris yang sama dengan langkah Ringkasan, jadi pemesan melihat
 * tagihannya tumbuh sejak langkah pertama, bukan baru di langkah terakhir.
 */
export function OrderAside({
  lines,
  total,
  empty,
  brandName,
}: {
  lines: AsideLine[];
  total: number;
  /** Kalimat saat belum ada yang dipilih. */
  empty: string;
  brandName: string;
}) {
  return (
    <aside aria-label="Tagihan sementara" className="hidden lg:block">
      <div className="sticky top-24 space-y-4">
        <div className="border-line overflow-hidden rounded-lg border bg-white">
          <h2 className="text-ink border-line border-b px-5 py-4 text-base font-bold">
            Tagihan sementara
          </h2>
          {lines.length === 0 ? (
            <p className="text-ink-muted px-5 py-6 text-sm">{empty}</p>
          ) : (
            <dl className="divide-line divide-y px-5">
              {lines.map((l) => (
                <div key={l.label + l.detail} className="py-3">
                  <dt className="text-ink text-sm font-semibold">{l.label}</dt>
                  <dd className="mt-0.5 flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-ink-muted min-w-0">{l.detail}</span>
                    <span className="text-ink shrink-0 font-semibold tabular-nums">
                      {formatCurrency(l.amount)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {/* Total di pita hijau: angka KPI pemesan, satu-satunya tempat emas
              (design.md §0). Emas di atas primary 3,38:1, lolos untuk teks besar. */}
          <div aria-live="polite" className="bg-primary px-5 py-4 text-white">
            <p className="text-sm text-white/85">Total sementara</p>
            <p className="text-accent mt-0.5 text-2xl font-bold tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <p className="text-ink flex items-start gap-2.5 text-sm leading-6">
          <ShieldCheck aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
          Harga dihitung ulang di server saat pesanan dikirim. Nomor pesanan dan cara bayar muncul
          setelah konfirmasi.
        </p>

        <a
          href={siteConfig.whatsapp.href(`Halo ${brandName}, saya butuh bantuan saat memesan.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="border-line bg-surface-muted hover:border-ink-muted flex min-h-11 items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors"
        >
          <IconWhatsApp className="text-primary size-5 shrink-0" />
          <span>
            <span className="text-ink block font-semibold">Butuh bantuan memesan?</span>
            <span className="text-ink-muted">Tanya tim kami lewat WhatsApp</span>
          </span>
        </a>
      </div>
    </aside>
  );
}
