import type { Metadata, Viewport } from 'next';
import { siteConfig } from '@/lib/constants/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  icons: {
    icon: '/icon.svg',
  },

  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    'aqiqah',
    'aqiqah anak',
    'sedekah daging',
    'aqiqah syar’i',
    'jasa aqiqah',
    'Zakat Sukses',
    'Sukses Aqiqah',
  ],
  applicationName: siteConfig.name,
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#0e7c5a',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // `suppressHydrationWarning` hanya untuk `<html>` sendiri — ekstensi peramban
    // (QuillBot, Grammarly, penerjemah) menyuntik atribut seperti
    // `data-qb-installed` ke elemen ini sebelum React sempat hidrasi, dan
    // selisihnya dilaporkan sebagai galat hidrasi yang tidak berasal dari kode
    // mana pun di sini. Aman karena jangkauannya **satu tingkat**: isi halaman
    // tetap diperiksa seperti biasa, jadi ini tidak bisa menutupi selisih
    // sungguhan di dalam aplikasi.
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-white text-neutral-900">{children}</body>
    </html>
  );
}
