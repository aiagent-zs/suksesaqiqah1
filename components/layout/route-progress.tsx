'use client';

import { useLinkStatus } from 'next/link';

/**
 * Garis progres di puncak layar selama berpindah halaman.
 *
 * Dipasang **di dalam** `<Link>` — `useLinkStatus` membaca status navigasi dari
 * `Link` terdekat di atasnya, jadi memanggilnya di luar selalu mengembalikan
 * `pending: false`.
 *
 * Kenapa perlu: halaman detail order dan dashboard menunggu lima query Supabase
 * sebelum apa pun tampil. Selama itu peramban masih menampilkan halaman lama,
 * dan dari sisi operator tidak ada bedanya antara "sedang dimuat" dan "kliknya
 * tidak masuk" — yang kedua membuat orang menekan lagi, dan itu justru
 * memperlambat.
 *
 * `loading.tsx` sudah menutup sebagian besar kasus itu di dashboard, tapi rute
 * lain belum punya. Garis ini menjembatani keduanya: ia muncul sejak klik,
 * bahkan sebelum kerangka halaman berikutnya sempat dirender.
 *
 * **Tertunda 120ms lewat `animation-delay`**, jadi navigasi yang cepat — rute
 * yang sudah ter-prefetch, misalnya — tidak menampilkan apa pun. Yang berkedip
 * sekejap lebih mengganggu daripada tidak ada indikator sama sekali.
 */
export function RouteProgress() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      // `aria-hidden`: pembaca layar sudah mengumumkan perpindahan halaman
      // sendiri. Menambah pengumuman kedua membuat keduanya saling menyela.
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <span className="bg-primary animate-route-progress block h-full w-full" />
    </span>
  );
}
