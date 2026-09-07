'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

/**
 * Tombol kirim yang tahu formnya sedang berjalan.
 *
 * Sebelum ini tidak ada satu pun tanda bahwa tombolnya sudah tertekan: form
 * mengirim, halaman diam, lalu beberapa detik kemudian dashboard muncul.
 * Selama jeda itu tidak ada bedanya antara "sedang diproses" dan "kliknya tidak
 * masuk" — jadi orang menekannya lagi, yang mengirim permintaan login kedua dan
 * justru memperlambat.
 *
 * `useFormStatus` dibaca dari komponen anak, bukan dari formnya sendiri: hook
 * ini mengembalikan status form **terdekat di atasnya**, jadi dipanggil di
 * komponen yang merender `<form>`, nilainya selalu `pending: false`.
 *
 * Tetap Server Component di halamannya — yang jadi klien hanya tombol ini, jadi
 * form dan seluruh isinya tetap bisa dikirim tanpa JavaScript.
 */
export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      id="btn-login-email"
      type="submit"
      disabled={pending}
      // `disabled` sekaligus penjaga: klik kedua selama permintaan pertama
      // berjalan tidak menghasilkan apa-apa selain antrean.
      className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#16A34A] to-[#059669] font-medium text-white shadow-lg shadow-emerald-950/50 transition-all hover:from-[#15803D] hover:to-[#047857] focus-visible:ring-3 focus-visible:ring-emerald-500/50 focus-visible:outline-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-80"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Memverifikasi…
        </>
      ) : (
        'Masuk ke System'
      )}
    </button>
  );
}
