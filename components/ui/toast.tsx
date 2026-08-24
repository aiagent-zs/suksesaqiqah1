'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'error' | 'success';

export type ToastState = {
  /** Berubah tiap kali toast dipanggil, termasuk dengan pesan yang sama. */
  id: number;
  tone: ToastTone;
  message: string;
} | null;

/**
 * Pemberitahuan sekilas di pojok bawah (`design.md §8` — "Aksi: toast
 * sukses/gagal").
 *
 * **Bukan pengganti pesan di medannya.** Toast hilang sendiri, jadi ia tidak
 * boleh jadi satu-satunya tempat galat diberitahukan — pemesan yang berkedip
 * pada saat yang salah akan kehilangan seluruh keterangannya. Di checkout ia
 * berpasangan dengan ringkasan yang menetap di atas form; tugas toast hanya
 * memastikan penolakan itu **terasa** meski mata sedang di bagian lain layar.
 *
 * **Kenapa `role="status"`, bukan `role="alert"`.** Ringkasan di atas form
 * sudah memakai `alert` dan langsung dibacakan. Dua wilayah `alert` sekaligus
 * membuat pembaca layar menyela dirinya sendiri, dan yang terdengar tinggal
 * potongan dari keduanya.
 *
 * **Hilang sendiri setelah 5 detik, tapi tidak saat disentuh** — kursor yang
 * berhenti di atasnya berarti orangnya sedang membaca.
 */
export function Toast({ state, onDismiss }: { state: ToastState; onDismiss: () => void }) {
  // `key` dari `id` memberi tiap toast state-nya sendiri, jadi tidak ada yang
  // perlu di-reset saat pesannya berganti. Tanpa itu, toast kedua akan mewarisi
  // `leaving` dari yang pertama dan langsung tampil sedang memudar keluar.
  if (!state) return null;
  return <ToastBody key={state.id} state={state} onDismiss={onDismiss} />;
}

function ToastBody({ state, onDismiss }: { state: NonNullable<ToastState>; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (paused) return;

    // Dua tahap: tandai "sedang pergi" agar animasi keluar sempat berjalan,
    // baru benar-benar dilepas. Melepasnya langsung membuat toast berkedip
    // hilang, yang justru menarik perhatian ke perginya.
    timer.current = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(onDismiss, 200);
    }, 5000);

    return () => window.clearTimeout(timer.current);
  }, [paused, onDismiss]);

  const isError = state.tone === 'error';
  const Icon = isError ? AlertTriangle : Check;

  return (
    <div
      // `fixed` + inset bawah: tetap terlihat sekalipun halaman sedang tergulir
      // jauh, dan tidak ikut mendorong tata letak form.
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6"
    >
      <div
        role="status"
        aria-live="polite"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className={cn(
          'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 shadow-lg',
          leaving ? 'animate-toast-out' : 'animate-toast-in',
          isError
            ? 'border-red-200 bg-red-50 text-red-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900',
        )}
      >
        <Icon
          className={cn('mt-0.5 size-4 shrink-0', isError ? 'text-red-600' : 'text-emerald-600')}
        />
        <p className="min-w-0 flex-1 text-sm font-medium">{state.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className={cn(
            '-my-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
            isError ? 'hover:bg-red-100' : 'hover:bg-emerald-100',
          )}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
