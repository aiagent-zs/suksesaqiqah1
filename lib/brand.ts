/**
 * Merek per kanal masuk.
 *
 * Satu aplikasi, dua wajah: pengunjung yang masuk dari mini app LinkAja melihat
 * "Aqiqah Aja", selain itu "Sukses Aqiqah". Data, admin, dan pelacakan tetap
 * satu. Kanal dibawa cookie yang disetel `proxy.ts` dari `?ch=linkaja` di link
 * masuk LinkAja, karena URL di dalam webview tidak terlihat dan tidak perlu
 * domain sendiri.
 *
 * Nilai kanal ikut tercatat di `orders.channel` (lihat migrasi
 * `20261027010000_order_channel.sql`) untuk laporan per mitra.
 */

export const CHANNELS = ['web', 'linkaja'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_COOKIE = 'channel';
export const CHANNEL_PARAM = 'ch';

/** Nilai mentah dari cookie atau query → kanal yang dikenal. Selain itu `web`. */
export function parseChannel(raw: string | null | undefined): Channel {
  return (CHANNELS as readonly string[]).includes(raw ?? '') ? (raw as Channel) : 'web';
}

export type Brand = {
  /** Nama lengkap untuk judul tab, footer, metadata. */
  name: string;
  /** Dua potong nama untuk logo teks: potongan pertama hijau, kedua oranye. */
  wordmark: [string, string];
  /** Logo gambar. `null` = belum ada aset resmi, logo tampil sebagai teks saja. */
  logo: string | null;
};

export const BRANDS: Record<Channel, Brand> = {
  web: { name: 'Sukses Aqiqah', wordmark: ['Sukses', 'Aqiqah'], logo: '/images/logo_new.webp' },
  // ponytail: logo & warna Aqiqah Aja belum diterima, sementara teks dengan
  // warna Sukses Aqiqah. Isi `logo` begitu asetnya ada di `public/images/`.
  linkaja: { name: 'Aqiqah Aja', wordmark: ['Aqiqah', 'Aja'], logo: null },
};
