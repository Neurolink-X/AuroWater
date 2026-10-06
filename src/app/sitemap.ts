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
const services = [
  'water-delivery',
  'water-can-delivery',
  'water-tanker-delivery',
  'plumber',
  'borewell',
  'submersible-pump',
  'motor-repair',
  'ro-service',
  'tank-cleaning',
] as const;

const kanpurAreas = [
  'kalyanpur',
  'kakadeo',
  'barra',
  'swaroop-nagar',
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
const SITE_UPDATED = new Date('2026-10-06T00:00:00+05:30');

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

    page('/services', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.9,
    }),

    page('/kanpur', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.95,
    }),

    page('/pricing', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.7,
    }),

    page('/how-it-works', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.7,
    }),

    page('/technicians', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.7,
    }),

    page('/about', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.6,
    }),

    page('/contact', {
      lastModified: SITE_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.6,
    }),

    page('/faq', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.6,
    }),

    page('/reviews', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.7,
    }),

    page('/blog', {
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.7,
    }),
  ];

  /*
   * ================================================================
   * NATIONAL / GENERAL SERVICE PAGES
   * ================================================================
   */
  const servicePages: MetadataRoute.Sitemap = services.map(
    (service) =>
      page(`/${service}`, {
        lastModified: CONTENT_UPDATED,
        changeFrequency: 'weekly',
        priority: 0.85,
      })
  );

  /*
   * ================================================================
   * KANPUR + SERVICE LANDING PAGES
   *
   * IMPORTANT:
   * Only keep these URLs if each page has genuinely unique,
   * useful Kanpur-specific content.
   * ================================================================
   */
  const kanpurServicePages: MetadataRoute.Sitemap =
    services.map((service) =>
      page(`/kanpur/${service}`, {
        lastModified: CONTENT_UPDATED,
        changeFrequency: 'weekly',
        priority: 0.85,
      })
    );

  /*
   * ================================================================
   * KANPUR LOCALITY PAGES
   *
   * These should contain real locality-specific information:
   * service coverage, response expectations, relevant services,
   * local FAQs, and useful customer information.
   *
   * Do not create hundreds of thin locality pages just for keywords.
   * ================================================================
   */
  const kanpurAreaPages: MetadataRoute.Sitemap =
    kanpurAreas.map((area) =>
      page(`/kanpur/${area}`, {
        lastModified: CONTENT_UPDATED,
        changeFrequency: 'monthly',
        priority: 0.75,
      })
    );

  /*
   * ================================================================
   * FINAL SITEMAP
   * ================================================================
   */
  return [
    ...corePages,
    ...servicePages,
    ...kanpurServicePages,
    ...kanpurAreaPages,
  ];
}
