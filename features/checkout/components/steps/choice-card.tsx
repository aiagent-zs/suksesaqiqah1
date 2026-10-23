'use client';

import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Kartu pilihan tunggal untuk seluruh langkah checkout.
 *
 * Sebelumnya lima salinan kartu dengan gaya sedikit berbeda, dan kartu yang
 * belum dipilih tidak punya tanda apa pun bahwa ia bisa diketuk: tampak
 * seperti kotak teks biasa. Sekarang setiap kartu selalu membawa lingkaran
 * radio. Kosong berarti "bisa dipilih", terisi berarti "ini pilihan Anda".
 * Bentuk yang sama dipakai formulir kertas, jadi tidak perlu dipelajari.
 *
 * Status terpilih juga tidak hanya lewat warna: lingkarannya berubah bentuk
 * dan ada teks "Dipilih" untuk pembaca layar.
 */
export function ChoiceCard({
  checked,
  onSelect,
  icon: Icon,
  title,
  description,
  price,
  badge,
  includes,
  role = 'radio',
  layout = 'row',
  className,
}: {
  checked: boolean;
  onSelect: () => void;
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  price?: React.ReactNode;
  badge?: React.ReactNode;
  /**
   * Isi paket. Ditampilkan utuh, bukan dipotong: inilah yang membedakan satu
   * paket dari yang lain, dan pemesan memilih berdasarkan daftar ini.
   */
  includes?: string[];
  role?: 'radio' | 'button';
  /**
   * `row`: ikon, teks, radio sebaris. Untuk kartu yang lebar.
   * `stacked`: ikon & radio di baris atas, teks selebar kartu di bawahnya.
   * Untuk kisi tiga kolom, supaya teks dan harga tidak terjepit ikon dan radio.
   */
  layout?: 'row' | 'stacked';
  className?: string;
}) {
  const icon = Icon && (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
        checked ? 'bg-primary text-white' : 'bg-surface-muted text-primary',
      )}
    >
      <Icon className="size-5" />
    </span>
  );

  const radio = (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150',
        checked ? 'border-primary' : 'border-ink-muted/50 group-hover:border-primary/60',
      )}
    >
      {checked && <span className="bg-primary size-2.5 rounded-full" />}
    </span>
  );

  const body = (
    <span className="flex min-w-0 flex-1 flex-col">
      {badge && <span className="mb-1 block">{badge}</span>}
      <span className="text-ink block text-base font-semibold">{title}</span>
      {description && (
        <span className="text-ink-muted mt-0.5 block text-sm leading-5">{description}</span>
      )}
      {includes && includes.length > 0 && (
        <span className="border-line mt-3 block space-y-1.5 border-t pt-3">
          <span className="text-ink block text-xs font-semibold">Yang Anda dapat:</span>
          {includes.map((item) => (
            <span key={item} className="text-ink flex items-start gap-2 text-sm leading-5">
              <Check aria-hidden className="text-primary mt-0.5 size-3.5 shrink-0 stroke-[3]" />
              {item}
            </span>
          ))}
        </span>
      )}
      {price && (
        <span className="text-primary mt-auto block pt-3 text-lg font-bold break-words tabular-nums">
          {price}
        </span>
      )}
    </span>
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      role={role}
      {...(role === 'radio' ? { 'aria-checked': checked } : { 'aria-pressed': checked })}
      className={cn(
        'group relative flex w-full rounded-lg border-2 p-4 text-left transition-colors duration-150 active:scale-[0.99]',
        layout === 'row' ? 'items-start gap-3' : 'flex-col gap-3',
        checked
          ? 'border-primary bg-primary-light'
          : 'border-line hover:border-primary/50 hover:bg-surface-muted bg-white',
        className,
      )}
    >
      {layout === 'row' ? (
        <>
          {icon}
          {body}
          {radio}
        </>
      ) : (
        <>
          <span className="flex w-full items-start justify-between gap-3">
            {icon}
            {radio}
          </span>
          {body}
        </>
      )}
      {checked && <span className="sr-only">, dipilih</span>}
    </button>
  );
}
