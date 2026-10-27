import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';
import { canIndexDeployment } from '@/lib/seo-policy';

const BASE_URL = getSiteUrl().replace(/\/+$/, '');

const serviceDetailPages = [
  '/services/water_can',
  '/services/water_tanker',
  '/services/ro_service',
  '/services/plumbing',
  '/services/borewell',
  '/services/motor_pump',
  '/services/tank_cleaning',
] as const;

const publicPages = [
  '/water-delivery',
  '/water-delivery/kanpur',
  '/water-delivery/lucknow',
  '/water-delivery/gorakhpur',
  '/services',
  '/service-areas',
  '/pricing',
  '/how-it-works',
  '/technicians',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/security',
  '/careers',
] as const;

const SITE_UPDATED = new Date('2026-10-09T00:00:00+05:30');
const CONTENT_UPDATED = new Date('2026-10-06T00:00:00+05:30');

function page(
  path: string,
  options: {
    lastModified?: Date;
    changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority?: number;
  } = {},
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE_URL}${path}`,
    lastModified: options.lastModified ?? CONTENT_UPDATED,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  // A preview/staging sitemap must not advertise URLs to search engines.
  if (!canIndexDeployment({
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    allowIndexing: process.env.ALLOW_INDEXING,
  })) return [];

  const publicEntries = [
    page('', { lastModified: SITE_UPDATED, changeFrequency: 'weekly', priority: 1 }),
    ...publicPages.map((path) => page(path, {
      lastModified:
        path === '/services' ||
        path === '/service-areas' ||
        path === '/pricing' ||
        path.startsWith('/water-delivery')
          ? SITE_UPDATED
          : CONTENT_UPDATED,
      changeFrequency: path === '/contact' ? 'monthly' : 'weekly',
      priority:
        path === '/services' || path === '/service-areas'
          ? 0.9
          : path === '/water-delivery'
            ? 0.9
            : path.startsWith('/water-delivery/')
              ? 0.85
              : path === '/pricing' || path === '/how-it-works' || path === '/technicians'
                ? 0.75
                : 0.6,
    })),
  ];

  const detailEntries = serviceDetailPages.map((path) =>
    page(path, { lastModified: SITE_UPDATED, changeFrequency: 'monthly', priority: 0.8 }),
  );

  return [...publicEntries, ...detailEntries];
}
