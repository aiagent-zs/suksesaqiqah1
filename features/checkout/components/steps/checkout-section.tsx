'use client';

import { Check, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Satu bagian checkout satu-halaman: nomor, judul, lalu isiannya.
 *
 * Bagian, bukan langkah. Wizard empat langkah dicabut 9 November: pemesan
 * menekan "Lanjut" tiga kali hanya untuk melihat apa yang masih diminta, dan di
 * ponsel tiap pergantian langkah melempar layar ke kepala halaman. Satu
 * halaman memperlihatkan seluruh isiannya sejak awal; nomor bagian menjaga
 * urutan mengisinya tetap terbaca.
 */
export function CheckoutSection({
  id,
  index,
  done,
  title,
  hint,
  children,
}: {
  id: string;
  index: number;
  /** Seluruh isian wajib bagian ini sudah terisi: nomornya berganti centang. */
  done: boolean;
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      // Kartu putih di atas latar halaman yang berwarna: tiap bagian terbaca
      // sebagai satu kelompok, bukan isian yang mengalir tanpa batas.
      // `scroll-mt` menahan judul bagian dari tertutup kepala situs yang menempel.
      className="border-line scroll-mt-24 overflow-hidden rounded-lg border bg-white"
    >
      <div className="border-line bg-primary-light/50 flex items-start gap-3 border-b px-4 py-3 sm:px-5">
        <span
          aria-hidden
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors duration-150',
            done ? 'bg-primary text-white' : 'text-primary border-primary/30 border bg-white',
          )}
        >
          {done ? <Check className="size-4 stroke-[3]" /> : index}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-ink text-lg leading-7 font-bold">
            {title}
          </h2>
          {hint && <p className="text-ink-muted text-sm leading-5">{hint}</p>}
        </div>
      </div>
      <div className="space-y-6 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * Bilah kirim di dasar layar: total dan satu tombol, selalu terlihat.
 *
 * Satu tombol, bukan "Lanjut"/"Kembali": tidak ada lagi langkah untuk dituju.
 * Tombol ini satu-satunya jalan mencatat pesanan, jadi ia `type="button"` dan
 * tidak pernah terpicu pengiriman form implisit (Enter di sembarang medan).
 */
export function SubmitBar({
  total,
  status,
  pending,
  disabled,
  onSubmit,
}: {
  total: number;
  status: React.ReactNode;
  pending: boolean;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="border-line sticky bottom-0 z-20 -mx-4 flex items-center gap-3 border-t bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-lg sm:border sm:px-5">
      <p aria-live="polite" className="min-w-0 leading-tight">
        <span className="text-ink-muted block truncate text-xs sm:text-sm">{status}</span>
        <span className="text-ink block text-lg font-bold tabular-nums">
          {formatCurrency(total)}
        </span>
      </p>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || disabled}
        aria-busy={pending}
        className="btn btn-primary btn-lg ml-auto shrink-0 px-5 sm:px-8"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? 'Mengirim…' : 'Kirim Pesanan'}
      </button>
    </div>
  );
}
