import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/constants/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/r/` ikut dilarang meski halaman publik: tautannya dibagikan langsung
      // ke peserta dan isinya memuat nama serta pelaksanaan ibadah mereka.
      disallow: ['/dashboard', '/orders', '/schedule', '/validation', '/settings', '/api', '/r/'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
