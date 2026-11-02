'use client';

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { WizardStep } from './step-header';

/**
 * Bar aksi yang menempel di bawah, dipakai checkout aqiqah dan katering.
 *
 * Dulu hanya katering yang menempel; di checkout aqiqah tombol "Lanjut" baru
 * terlihat setelah menggulir 5 layar di 375px. Di ponsel total ikut di sini,
 * di bawah ibu jari, sehingga kepala wizard tidak perlu ikut menempel dan
 * memakan ±125px di atas layar.
 */
export function StepNav({
  steps,
  current,
  total,
  status,
  pending,
  submitDisabled,
  onBack,
  onNext,
  onSubmit,
}: {
  steps: WizardStep[];
  current: number;
  total: number;
  /** Keterangan pendek di samping total, mis. "60 box dari 2 paket". */
  status?: React.ReactNode;
  pending: boolean;
  submitDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const last = current === steps.length;
  return (
    // Satu baris di ponsel (±68px): toast galat muncul 72px dari bawah, jadi
    // bar yang lebih tinggi akan tertutup toast tepat di angka totalnya.
    <div className="border-line sticky bottom-0 z-20 -mx-4 mt-8 flex items-center gap-2 border-t bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
      {current > 1 && (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="btn btn-outline w-11 shrink-0 px-0 sm:w-auto sm:px-5"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {/* Teksnya tetap ada untuk pembaca layar; di ponsel lebarnya dipakai total. */}
          <span className="sr-only sm:not-sr-only">Kembali</span>
        </button>
      )}
      <p aria-live="polite" className="min-w-0 leading-tight sm:hidden">
        <span className="text-ink-muted block truncate text-xs">{status ?? 'Total'}</span>
        <span className="text-ink block text-base font-bold tabular-nums">
          {formatCurrency(total)}
        </span>
      </p>
      {status && (
        <p aria-live="polite" className="text-ink-muted hidden min-w-0 text-sm sm:block">
          {status}
        </p>
      )}
      {/* `key` berbeda itu wajib, bukan hiasan. Tanpanya React memakai ulang
            elemen tombol "Lanjut" sebagai tombol kirim, lengkap dengan fokus
            dan posisinya di bawah kursor: klik kedua atau Enter langsung
            mencatat pesanan. */}
      {!last ? (
        <button
          key="nav-next"
          type="button"
          onClick={onNext}
          className="btn btn-primary ml-auto min-w-0 shrink-0 px-4 sm:px-6"
        >
          {/* Judul pendek di bawah `sm`: di 375px judul penuh terpotong. */}
          <span className="truncate">
            Lanjut ke <span className="sm:hidden">{steps[current].shortTitle}</span>
            <span className="hidden sm:inline">{steps[current].title}</span>
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      ) : (
        /* `type="button"` + onClick, bukan `type="submit"`: pesanan tercatat
             di database, jadi jalurnya tidak boleh bisa dipicu pengiriman
             form implisit dari mana pun. */
        <button
          key="nav-submit"
          type="button"
          onClick={onSubmit}
          disabled={pending || submitDisabled}
          aria-busy={pending}
          className="btn btn-primary btn-lg ml-auto min-w-0 shrink px-4 sm:px-7"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {/* "Kirim Pesanan" saja di ponsel: label penuh tidak muat di samping total. */}
          {pending ? (
            'Mengirim…'
          ) : (
            <>
              <span className="hidden sm:inline">Konfirmasi &amp; </span>Kirim Pesanan
            </>
          )}
        </button>
      )}
    </div>
  );
}
