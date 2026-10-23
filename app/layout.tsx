import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { siteConfig } from '@/lib/constants/site';
import './globals.css';

// Empat bobot (400 teks, 500 label, 600/700 judul & tombol): tiap bobot satu berkas.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/images/icon.webp', type: 'image/webp' },
    ],
    shortcut: '/icon.svg',
    apple: '/images/logo_sukses_aqiqah_icon.webp',
  },

  title: {
    default: `${siteConfig.name}: ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
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
    title: `${siteConfig.name}: ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name}: ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#16624f',
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
    <html lang="id" className={`h-full antialiased ${jakarta.variable}`} suppressHydrationWarning>
      <body className="bg-background text-ink flex min-h-full flex-col">{children}</body>
    </html>
  );
}
