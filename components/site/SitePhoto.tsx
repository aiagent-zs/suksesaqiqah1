import Image from 'next/image';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Foto landing yang **belum tentu ada berkasnya**.
 *
 * Selama `public/{src}` belum diisi, komponen ini merender kotak abu bertulisan
 * nama berkas yang ditunggu — bukan gambar rusak, dan bukan pula ruang kosong.
 * Keduanya sengaja dihindari: gambar rusak membuat halaman tampak salah, sedang
 * ruang kosong menyembunyikan slot yang justru perlu diingat untuk diisi.
 *
 * Keberadaan berkas diperiksa di **server**, saat render. Ini komponen server
 * (tanpa `'use client'`), jadi `existsSync` aman di sini dan tidak pernah ikut
 * ke peramban. Konsekuensinya: menambahkan foto baru menuntut halaman dirender
 * ulang — di `next dev` itu terjadi sendiri, sedangkan di produksi berkasnya
 * memang sudah ikut saat build.
 *
 * Dipakai `next/image` — berbeda dengan galeri bukti di `/r/{token}` yang
 * sengaja memakai `<img>` polos. Alasannya berkebalikan: foto pemasaran justru
 * **ingin** disinggahkan dan dioptimasi, sementara bukti dokumentasi tidak boleh
 * meninggalkan salinan yang tetap tersaji setelah signed URL-nya kedaluwarsa.
 */
export type SitePhotoProps = {
  /** Path relatif terhadap `public/`, mis. `images/landing/hero.jpg`. */
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** Prioritaskan pemuatan — pakai hanya untuk foto hero yang terlihat di layar awal. */
  priority?: boolean;
  /** Petunjuk ukuran responsif untuk `next/image`. */
  sizes?: string;
};

function photoExists(src: string): boolean {
  // Path dari pemanggil, bukan dari input pengguna — tapi tetap ditolak kalau
  // mencoba keluar dari `public/`, supaya komponen ini tidak bisa dipakai
  // mengintip berkas lain seandainya suatu saat sumbernya jadi dinamis.
  if (src.includes('..')) return false;
  try {
    return existsSync(join(process.cwd(), 'public', src));
  } catch {
    return false;
  }
}

export function SitePhoto({
  src,
  alt,
  width,
  height,
  className,
  priority,
  sizes,
}: SitePhotoProps) {
  if (!photoExists(src)) {
    return (
      <div
        role="img"
        aria-label={`Foto belum tersedia: ${alt}`}
        className={`flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-300 bg-neutral-100 p-4 text-center ${className ?? ''}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7 shrink-0 text-neutral-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <p className="text-[11px] leading-4 font-semibold text-neutral-500">Foto belum diisi</p>
        <code className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] leading-4 break-all text-neutral-500">
          public/{src}
        </code>
      </div>
    );
  }

  return (
    <Image
      src={`/${src}`}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}
