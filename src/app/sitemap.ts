import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

const BASE_URL = getSiteUrl().replace(/\/+$/, '');

/**
 * Keep these values aligned with the actual public routes
 * implemented in the application.
 *
 * Do NOT add a URL merely because it is a useful keyword.
 * Every URL in this sitemap must be:
 * - publicly accessible
 * - indexable
 * - canonical
 * - useful to a real customer
 * - not a thin duplicate of another page
 */
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
  '/services',
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

/**
 * Use stable modification dates.
 *
 * Do NOT use new Date() for every sitemap generation.
 * That falsely tells crawlers that every page changed today.
 *
 * Replace these with the real dates when your pages/content
 * were last materially updated.
 */
const SITE_UPDATED = new Date('2026-10-09T00:00:00+05:30');

const CONTENT_UPDATED = new Date('2026-10-06T00:00:00+05:30');

function page(
  path: string,
  options: {
    lastModified?: Date;
    changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority?: number;
  } = {}
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE_URL}${path}`,
    lastModified: options.lastModified ?? CONTENT_UPDATED,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  /*
   * ================================================================
   * CORE PUBLIC PAGES
   * ================================================================
   */
  const corePages: MetadataRoute.Sitemap = [
    page('', {
      lastModified: SITE_UPDATED,
      changeFrequency: 'weekly',
      priority: 1,
    }),

    ...publicPages.map((path) =>
      page(path, {
        lastModified: CONTENT_UPDATED,
        changeFrequency: path === '/contact' ? 'monthly' : 'weekly',
        priority:
          path === '/services'
            ? 0.9
            : path === '/pricing' || path === '/how-it-works' || path === '/technicians'
              ? 0.75
              : 0.6,
      }),
    ),
  ];

  const detailPages: MetadataRoute.Sitemap = serviceDetailPages.map((path) =>
    page(path, { lastModified: SITE_UPDATED, changeFrequency: 'monthly', priority: 0.8 }),
  );

  return [...corePages, ...detailPages];
}
