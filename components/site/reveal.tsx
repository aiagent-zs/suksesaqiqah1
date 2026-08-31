'use client';

import { useEffect, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';

/**
 * Memunculkan isinya saat tergulir ke layar — dan **memunculkannya lagi** saat
 * tergulir balik.
 *
 * **Kenapa berulang, padahal versi sebelumnya sekali jalan.** Versi lama
 * memanggil `observer.unobserve()` begitu elemen tampil, dengan alasan elemen
 * yang muncul-hilang berulang terasa gelisah. Alasannya benar, tapi obatnya
 * terlalu keras: akibatnya menggulir balik ke atas menampilkan halaman yang
 * sepenuhnya diam, dan bagian yang sudah terlewat tidak pernah hidup lagi.
 *
 * Yang dipakai sekarang menyelesaikan keduanya:
 *
 * 1. **Arah gerakan mengikuti arah gulir.** Menggulir ke bawah, elemen datang
 *    dari bawah; menggulir ke atas, ia datang dari atas. Gerakan yang melawan
 *    arah gulir itulah yang dulu terbaca "kaku" — isinya seolah didorong
 *    berlawanan dengan tangan yang menggulir.
 * 2. **Reset hanya setelah elemen benar-benar lepas dari layar.** Selama masih
 *    terlihat sebagian, statusnya tidak disentuh. Ini yang mencegah kegelisahan
 *    yang dikhawatirkan versi lama: menggoyang layar sedikit di sekitar batas
 *    tidak memicu apa pun.
 *
 * **Tanpa dependensi tambahan.** Observer sudah ada di semua peramban sasaran;
 * memasang pustaka animasi untuk gerakan sependek ini tidak sebanding dengan
 * tambahan ukuran bundel-nya.
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
   * Jenis gerakannya.
   *
   * `rise` (bawaan) — bergeser searah gulir sambil memudar; aman untuk teks.
   * `scale` — bergeser + membesar 1,5%, jadi blok terasa maju ke depan. Untuk
   *   kartu, **bukan** untuk teks: teks yang berubah skala terbaca buram selama
   *   animasi berjalan.
   */
  anim?: 'rise' | 'scale';
  /**
   * Penundaan sebelum elemen ini muncul, dalam milidetik.
   *
   * Dipakai untuk memberi jeda antar-anggota satu kelompok, sehingga kartu
   * berjajar tampil berurutan alih-alih serentak. Tahan diri: jeda yang panjang
   * membuat pengunjung yang menggulir cepat melewati elemennya sebelum sempat
   * tampil, dan yang tertinggal justru kesan halaman lambat.
   */
  delay?: number;
};

/**
 * Arah gulir terakhir, dipakai bersama oleh seluruh `<Reveal>` di halaman.
 *
 * Satu listener untuk semua, bukan satu per komponen: halaman ini memasang
 * lebih dari 40 `Reveal`, dan 40 listener `scroll` yang menghitung hal yang
 * persis sama adalah pemborosan yang terasa di ponsel.
 */
let scrollDir: 'down' | 'up' = 'down';
let lastY = 0;
let listening = false;

function startTracking() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  lastY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      // Ambang 4px menelan getaran kecil dari gulir inersia di ponsel, yang
      // tanpa itu membuat arahnya berbalik-balik saat halaman hampir berhenti.
      if (Math.abs(y - lastY) < 4) return;
      scrollDir = y > lastY ? 'down' : 'up';
      lastY = y;
    },
    { passive: true },
  );
}

export function Reveal({ children, as, className, delay = 0, anim = 'rise' }: RevealProps) {
  const Tag = as ?? 'div';
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    startTracking();

    // Peramban tanpa IntersectionObserver: tampilkan saja. Halaman yang isinya
    // tak pernah terlihat jauh lebih buruk daripada halaman tanpa animasi.
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.reveal = 'shown';
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (el.dataset.reveal === 'shown') continue;
            // Arah gerakan ditetapkan saat elemen mau tampil, bukan sekali di
            // awal: pengunjung bisa berganti arah kapan saja, dan yang harus
            // dicocokkan adalah arah pada saat itu.
            el.dataset.revealFrom = scrollDir;
            el.dataset.reveal = 'shown';
            continue;
          }

          // Lepas dari layar — siapkan untuk tampil lagi nanti. `intersectionRatio`
          // nol memastikan ini hanya terjadi setelah elemen benar-benar keluar,
          // bukan saat tepinya masih menyentuh layar.
          if (entry.intersectionRatio === 0) {
            el.dataset.reveal = '';
          }
        }
      },
      {
        // Kotak deteksi diperpanjang ke bawah supaya elemen mulai bergerak
        // sebelum benar-benar terlihat — bagian yang paling terasa halus,
        // yaitu perlambatan di akhir, jadi tidak terlewat.
        //
        // Ke atas TIDAK diperpanjang: itulah tepi tempat elemen dianggap lepas
        // saat digulir turun, dan memperpanjangnya membuat elemen ter-reset
        // padahal masih terlihat di layar.
        rootMargin: '0px 0px 12% 0px',
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
      // Atribut, bukan kelas: CSS-nya memilih keyframe lewat
      // `[data-reveal-anim='...']`, jadi tidak bisa tertimpa utilitas Tailwind
      // tanpa sengaja. `rise` tidak perlu penanda — ia yang bawaan.
      data-reveal-anim={anim === 'rise' ? undefined : anim}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
