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
 *
 * ## Dua sumber foto
 *
 * `src` yang diawali `images/` adalah berkas di `public/` — bawaan repo, ikut
 * saat build, keberadaannya diperiksa `existsSync`. Selain itu ia object path
 * di bucket `public-assets`, diunggah superadmin lewat `/vendors`.
 *
 * Bucket itu **publik** (`storage_public_assets_read` membuka `select` untuk
 * `anon`), jadi URL-nya tetap, tidak perlu ditandatangani, dan halaman depan
 * tidak perlu memanggil Storage sama sekali saat render. Itu memang tepat di
 * sini: foto pemasaran justru ingin bisa disinggahkan CDN. Berbeda dengan
 * dokumentasi lapangan, yang privat dan selalu lewat signed URL berdurasi
 * pendek.
 *
 * Foto Storage **tidak** bisa diperiksa keberadaannya saat render tanpa
 * memanggil Storage, jadi ia selalu dianggap ada. Kalau berkasnya hilang, yang
 * tampil gambar rusak — bukan placeholder. Itu dapat diterima: yang mengunggah
 * lewat aplikasi baru saja melihat fotonya masuk.
 */
export type SitePhotoProps = {
  /** Path relatif terhadap `public/`, mis. `images/landing/hero.webp`. */
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

/**
 * Foto ini datang dari `public/` atau dari Storage?
 *
 * Dibedakan lewat awalan `images/` dan bukan lewat kolom terpisah: seluruh
 * foto bawaan repo memang tinggal di `public/images/`, dan object path yang
 * ditulis `uploadServicePhoto()` selalu diawali `services/`. Menambah kolom
 * "sumber" berarti dua nilai yang bisa berselisih untuk satu berkas.
 */
function isRepoAsset(src: string): boolean {
  return src.startsWith('images/');
}

/**
 * URL publik sebuah object di `public-assets`.
 *
 * Dirakit dari env, bukan lewat `supabase.storage.getPublicUrl()`: bentuknya
 * tetap dan diketahui, sedangkan memanggil klien Storage di sini menjadikan
 * tiap foto satu pemanggilan tambahan saat render — untuk URL yang bisa
 * disusun tanpa jaringan sama sekali.
 */
function storageUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/public-assets/${path}`;
}

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

export function SitePhoto({ src, alt, width, height, className, priority, sizes }: SitePhotoProps) {
  const remote = isRepoAsset(src) ? null : storageUrl(src);
  // Foto Storage tidak diperiksa keberadaannya (butuh panggilan jaringan per
  // foto); yang jatuh ke placeholder hanya berkas repo yang belum ditaruh, dan
  // foto Storage saat env-nya tidak terpasang sama sekali.
  const missing = isRepoAsset(src) ? !photoExists(src) : remote === null;

  if (missing) {
    // Slot yang menunggu fotonya.
    //
    // Versi sebelumnya kotak abu rata — benar secara nada, tapi dengan sepuluh
    // slot kosong sekaligus halamannya terbaca belum jadi. Sekarang: gradasi
    // hijau sangat tipis, pola titik yang sama dengan latar hero, dan ikon
    // berlatar. Cukup untuk membuat blok ini terasa **disengaja** alih-alih
    // rusak, tanpa menyamar jadi foto sungguhan.
    //
    // Path berkasnya tetap dicetak: slot ini juga petunjuk kerja bagi yang
    // menyiapkan fotonya, dan `public/images/landing/README.md` memuat daftar
    // lengkap beserta rasio & ukurannya.
    return (
      <div
        role="img"
        aria-label={`Foto belum tersedia: ${alt}`}
        className={`from-primary/7 relative flex flex-col items-center justify-center gap-2.5 overflow-hidden bg-gradient-to-br to-neutral-100 p-4 text-center ${className ?? ''}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <div aria-hidden className="bg-grid-fine absolute inset-0" />
        <span className="bg-primary/10 text-primary relative flex size-11 items-center justify-center rounded-lg">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
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
        </span>
        <code className="relative text-[10px] leading-4 break-all text-neutral-500">{src}</code>
      </div>
    );
  }

  return (
    <Image
      src={remote ?? `/${src}`}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}
