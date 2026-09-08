'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pembungkus panel yang terbuka hanya bila fasenya menuntut.
 *
 * Halaman detail order merender sembilan panel sekaligus dan **semuanya terbuka
 * penuh, apa pun status ordernya** — jadi pada order yang baru masuk, panel
 * Dokumentasi dan Laporan ikut memenuhi layar padahal keduanya baru berguna
 * berminggu-minggu kemudian. Admin harus menggulir melewati semuanya untuk
 * menemukan satu form yang benar-benar perlu diisi sekarang.
 *
 * Yang di luar fase **dilipat, bukan disembunyikan**: memeriksa pembayaran saat
 * order sudah di tahap lapangan adalah hal yang wajar, dan panel yang lenyap
 * sama sekali membuat orang mengira datanya hilang. Ringkasan satu baris tetap
 * terbaca dalam keadaan terlipat, jadi menengok ke belakang sering tidak perlu
 * membukanya.
 *
 * Sengaja `<details>` bawaan peramban, bukan state React: ia bisa dibuka
 * sebelum JavaScript termuat, isinya tetap ditemukan Ctrl+F peramban, dan
 * keyboard sudah bekerja tanpa satu baris pun penanganan tombol.
 */
export function PhaseSection({
  id,
  title,
  summary,
  /** Fase sekarang menuntut panel ini — terbuka, dan diberi tanda. */
  active,
  /** Pekerjaan di panel ini sudah beres. Hanya tanda; tidak mengunci apa pun. */
  complete = false,
  children,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  active: boolean;
  complete?: boolean;
  children: ReactNode;
}) {
  // `defaultOpen` dibaca sekali saja. Kalau `open` diikat langsung ke `active`,
  // panel yang sengaja dibuka admin akan menutup sendiri begitu `router.refresh()`
  // berjalan sesudah aksi apa pun — tepat saat ia sedang membacanya.
  const [open, setOpen] = useState(active);

  return (
    <details
      id={id}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={cn(
        'border-border bg-card group scroll-mt-6 rounded-lg border shadow-sm',
        active && 'ring-primary/30 ring-2',
      )}
    >
      <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-3 rounded-lg px-5 py-4 transition-colors [&::-webkit-details-marker]:hidden">
        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            {active && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                Perlu dikerjakan
              </span>
            )}
            {complete && !active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <Check className="size-3" />
                Beres
              </span>
            )}
          </div>

          {/* Ringkasan tetap terbaca saat terlipat — itu yang membuat melipat
              bukan sekadar menyembunyikan. */}
          {summary && <p className="text-muted-foreground mt-0.5 text-sm">{summary}</p>}
        </div>
      </summary>

      <div className="border-border border-t">{children}</div>
    </details>
  );
}
