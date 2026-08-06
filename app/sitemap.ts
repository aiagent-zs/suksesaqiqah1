import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/constants/site';

// Halaman publik yang saat ini di-index (27_PAGE_MENU).
// Tanggal statis: Date.now()/new Date() tidak tersedia di lingkungan build ini.
const lastModified = new Date('2026-08-06');

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/proses',
    '/paket',
    '/galeri',
    '/faq',
    '/syarat-layanan',
    '/kebijakan-privasi',
  ];

  return routes.map((path) => ({
    url: `${siteConfig.url}${path}`,
    lastModified,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
