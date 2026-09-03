import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
     * Host-nya dibaca dari env supaya lokal, staging, dan produksi tidak perlu
     * daftar terpisah. Kalau env-nya belum ada saat build, daftarnya kosong dan
     * `SitePhoto` jatuh ke placeholder alih-alih merender gambar rusak.
     */
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: 'https' as const,
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: '/storage/v1/object/public/public-assets/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
