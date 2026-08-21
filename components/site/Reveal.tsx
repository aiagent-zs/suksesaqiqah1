'use client';

import { useEffect, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';

/**
 * Memunculkan isinya saat tergulir ke layar — naik sedikit sambil memudar.
 *
 * **Kenapa IntersectionObserver, bukan animasi yang langsung jalan.** Animasi
 * yang berjalan saat halaman dimuat akan sudah selesai sebelum pengunjung
 * menggulir sampai ke sana; yang ia lihat cuma elemen diam. Observer membuat
 * gerakannya terjadi tepat saat bagian itu masuk pandangan.
 *
 * **Tanpa dependensi tambahan.** Observer sudah ada di semua peramban sasaran;
 * memasang pustaka animasi untuk satu gerakan sepanjang 10px tidak sebanding
 * dengan tambahan ukuran bundel-nya.
 *
 * **Sekali jalan, lalu berhenti diamati.** Elemen yang muncul-hilang berulang
 * saat digulir naik-turun cepat terasa gelisah, terutama di ponsel. Setelah
 * tampil, elemennya dilepas dari observer dan tidak pernah dianimasikan lagi.
 *
 * **Aman ketika JavaScript mati atau lambat.** Nilai awal `data-reveal` dipasang
 * di server sebagai atribut, dan CSS-nya menyembunyikan elemen — jadi kalau
 * skrip tidak pernah jalan, isinya akan tak terlihat. Karena itu `useEffect`
 * di bawah menampilkan seluruh elemen tanpa syarat bila Observer tidak tersedia,
 * dan `<noscript>` di `app/(site)/layout.tsx` mengembalikan `opacity: 1` untuk
 * pengunjung yang mematikan JavaScript sepenuhnya.
 *
 * Preferensi "kurangi gerakan" tidak ditangani di sini melainkan di CSS
 * (`app/globals.css`) — satu aturan `@media` menutup seluruh kasus sekaligus,
 * termasuk elemen yang belum sempat teramati.
 */
export type RevealProps = {
  children: ReactNode;
  /** Tag pembungkus. Default `div`; pakai `li`/`figure` agar HTML tetap sah. */
  as?: ElementType;
  className?: string;
  /**
   * Penundaan sebelum elemen ini muncul, dalam milidetik.
   *
   * Dipakai untuk memberi jeda antar-anggota satu kelompok, sehingga kartu
   * berjajar tampil berurutan alih-alih serentak. Tahan diri: jeda yang panjang
   * membuat pengunjung yang menggulir cepat melewati elemennya sebelum sempat
   * tampil, dan yang tertinggal justru kesan halaman lambat. Di halaman ini
   * jeda terbesar 240ms, dan pemicunya sudah dimajukan lewat `rootMargin`
   * supaya jeda itu terbayar sebelum elemennya terlihat.
   */
  delay?: number;
};

export function Reveal({ children, as, className, delay = 0 }: RevealProps) {
  const Tag = as ?? 'div';
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = () => {
      el.dataset.reveal = 'shown';
    };

    // Peramban tanpa IntersectionObserver: tampilkan saja. Halaman yang isinya
    // tak pernah terlihat jauh lebih buruk daripada halaman tanpa animasi.
    if (typeof IntersectionObserver === 'undefined') {
      show();
      return;
    }

    // Sudah berada di layar saat komponen dipasang (mis. hero, atau pengunjung
    // membuka tautan #anchor langsung ke tengah halaman) — tampilkan tanpa
    // menunggu putaran observer berikutnya.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show();
          observer.unobserve(entry.target);
        }
      },
      {
        // Kotak deteksi diperpanjang ~14% ke bawah layar, jadi elemen mulai
        // bergerak SEBELUM benar-benar terlihat. Dengan gerakan sepanjang 0,85
        // detik, memicu tepat saat elemen masuk pandangan berarti pengunjung
        // menangkapnya di tengah jalan — dan bagian yang paling terasa halus,
        // yaitu perlambatan di akhir, justru terlewat.
        //
        // Nilainya negatif pada versi pertama (`-8%`), yang efeknya kebalikan:
        // pemicunya jadi lebih lambat, bukan lebih awal.
        rootMargin: '0px 0px 14% 0px',
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
