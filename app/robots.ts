import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/constants/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/orders', '/settings', '/api', '/r/'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
