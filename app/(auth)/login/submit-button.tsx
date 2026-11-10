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
      className="btn btn-primary mt-2 w-full disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Memverifikasi…
        </>
      ) : (
        'Masuk'
      )}
    </button>
  );
}
