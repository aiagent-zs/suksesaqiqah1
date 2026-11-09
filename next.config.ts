import type { NextConfig } from 'next';
import { readdirSync } from 'node:fs';

/**
 * Daftar foto di `public/images`, dibaca **saat build** (di sini masih Node).
 *
 * `SitePhoto` memakainya untuk memutuskan foto atau placeholder. Dulu ia
 * memanggil `existsSync` saat render; daftar sekali saat build lebih murah dan
 * tidak bergantung pada letak `public/` di server produksi.
 */
const repoImages = readdirSync('public/images', { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  // `parentPath` memakai `\` di Windows; SitePhoto selalu memakai `/`.
  .map((e) => `${e.parentPath.split('\\').join('/').replace(/^public\//, '')}/${e.name}`);

const isDev = process.env.NODE_ENV !== 'production';
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : '';

/**
 * CSP statis, bukan nonce per permintaan: nonce harus dirakit di proxy.ts dan
 * mematikan prerender statis bagi halaman yang kelak kembali statis. Ongkosnya
 * `'unsafe-inline'` di `script-src` (skrip inline Next & JSON-LD).
 * ponytail: CSP statis melemahkan perlindungan XSS di script-src; pindah ke
 * nonce di proxy.ts bila ada konten HTML dari pengguna yang dirender.
 *
 * Supabase dipanggil langsung dari peramban (unggah bukti, signed URL foto),
 * jadi `*.supabase.co` wajib ada di `connect-src` & `img-src`; origin dari env
 * menambahkan Supabase lokal saat dev.
 *
 * `frame-ancestors 'self'`: tidak ada mitra yang menyematkan halaman ini lewat
 * iframe. Kalau mini app LinkAja ternyata memakai iframe, tambahkan origin-nya
 * di sini — gejalanya halaman putih di dalam aplikasi LinkAja.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co ${supabaseOrigin}`,
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${supabaseOrigin}${isDev ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  // Tanpa includeSubDomains: subdomain lain (panel VPS dsb.) belum tentu HTTPS.
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
];

const nextConfig: NextConfig = {
  env: { REPO_IMAGES: JSON.stringify(repoImages) },
  // `x-powered-by: Next.js` hanya memberi tahu penyerang versi apa yang dicari.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  /**
   * Image Docker hanya membawa `.next/standalone` (server + node_modules yang
   * benar-benar dipakai), bukan seluruh node_modules. Lihat `Dockerfile`.
   */
  output: 'standalone',
  /**
   * React PDF membawa dependensi non-JS (fontkit, parser biner) yang rusak bila
   * ikut dibundel Next. Dibiarkan sebagai paket eksternal supaya di-resolve
   * langsung dari node_modules saat runtime server.
   */
  serverExternalPackages: ['@react-pdf/renderer'],

  images: {
    /**
     * Format yang dikirim ke peramban, sesuai urutan pilihan.
     *
     * `next/image` sudah mengubah gambar ke WebP secara bawaan — apa pun format
     * berkas aslinya. Yang ditambahkan di sini AVIF: pada foto seperti milik
     * halaman ini ia biasanya 20-30% lebih kecil lagi daripada WebP pada mutu
     * setara. Peramban yang tidak mendukungnya jatuh ke WebP dengan sendirinya
     * lewat negosiasi `Accept`, jadi tidak ada yang perlu ditangani di kode.
     *
     * Ongkosnya: penyandian AVIF lebih lambat, dan itu dibayar **sekali** per
     * ukuran saat permintaan pertama — hasilnya lalu disinggahkan.
     */
    formats: ['image/avif', 'image/webp'],

    /**
     * Foto katalog yang diunggah lewat aplikasi tinggal di bucket
     * `public-assets` milik project Supabase, bukan di `public/`. `next/image`
     * menolak host luar yang tidak didaftarkan — itu penjagaan yang benar
     * (tanpanya siapa pun bisa memakai pengoptimal gambar ini sebagai proxy
     * terbuka), jadi yang diizinkan dipersempit sampai ke prefix bucketnya.
     *
     * Host produksi ditulis sebagai pola `*.supabase.co`, bukan dibaca dari env:
     * daftar ini dibekukan saat build, dan build yang berjalan tanpa
     * `NEXT_PUBLIC_SUPABASE_URL` dulu menghasilkan daftar kosong — seluruh foto
     * katalog lalu ditolak `400 "url" parameter is not allowed` di produksi.
     * Entri dari env tetap ada untuk Supabase lokal (`http://127.0.0.1`).
     */
    remotePatterns: [
      {
        protocol: 'https' as const,
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/public-assets/**',
      },
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL
        ? [
            {
              protocol: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).protocol.replace(':', '') as
                | 'http'
                | 'https',
              hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
              pathname: '/storage/v1/object/public/public-assets/**',
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
