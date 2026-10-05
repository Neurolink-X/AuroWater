import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

const BASE = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/customer/',
          '/supplier/',
          '/technician/',
          '/auth/',
          '/api/',
          '/dashboard/',
        ],
      },
    ],

    sitemap: `${BASE}/sitemap.xml`,
  };
}
