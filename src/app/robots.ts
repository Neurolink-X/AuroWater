import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aurowater.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/customer/', '/supplier/', '/technician/', '/api/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
