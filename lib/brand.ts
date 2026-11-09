/**
 * Merek per kanal masuk.
 *
 * Satu aplikasi, dua wajah: pengunjung mini app LinkAja melihat "Aqiqah Aja",
 * selain itu "Sukses Aqiqah". Data, admin, dan pelacakan tetap satu.
 *
 * Kanal LinkAja punya area sendiri di bawah `/aqiqahaja` (landing, paket,
 * checkout, lacak). Kanalnya dibaca dari **path**, bukan cookie: cookie yang
 * menempel 30 hari membuat pengunjung web biasa ikut melihat merek LinkAja
 * kalau perangkatnya pernah membuka mini app, dan sebaliknya. `proxy.ts`
 * meneruskan kanal dari path lewat header `x-channel`; link lama
 * `?ch=linkaja` dialihkan ke `/aqiqahaja`.
 *
 * Nilai kanal ikut tercatat di `orders.channel` (lihat migrasi
 * `20261027010000_order_channel.sql`) untuk laporan per mitra.
 */

export const CHANNELS = ['web', 'linkaja'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_PARAM = 'ch';
/** Header permintaan internal dari `proxy.ts`; nilai dari klien ditimpa di sana. */
export const CHANNEL_HEADER = 'x-channel';

/** Awalan path tiap kanal. `web` di akar. */
export const CHANNEL_BASE: Record<Channel, string> = { web: '', linkaja: '/aqiqahaja' };

/** Kanal dari pathname: `/aqiqahaja` dan turunannya milik LinkAja. */
export function channelFromPath(pathname: string): Channel {
  return pathname === '/aqiqahaja' || pathname.startsWith('/aqiqahaja/') ? 'linkaja' : 'web';
}

/**
 * Tautan internal milik kanal: `/checkout` di LinkAja jadi `/aqiqahaja/checkout`.
 * Pengunjung LinkAja tidak boleh terlempar ke situs web biasa lewat satu
 * tautan yang lupa diberi awalan.
 */
export function channelHref(channel: Channel, href: string): string {
  const base = CHANNEL_BASE[channel];
  if (!base || !href.startsWith('/') || href.startsWith('/r/')) return href;
  // `/`, `/#faq`, `/?x` → `/aqiqahaja`, `/aqiqahaja#faq`: tanpa garis miring akhir
  // yang akan dialihkan Next lebih dulu.
  if (href === '/' || href[1] === '#' || href[1] === '?') return `${base}${href.slice(1)}`;
  return `${base}${href}`;
}

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
  // Logo gambar sengaja sama dengan Sukses Aqiqah (keputusan pemilik): yang
  // membedakan kanal LinkAja hanya namanya.
  linkaja: { name: 'Aqiqah Aja', wordmark: ['Aqiqah', 'Aja'], logo: '/images/logo_new.webp' },
};
