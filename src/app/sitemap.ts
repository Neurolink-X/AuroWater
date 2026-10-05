import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

const BASE = getSiteUrl();

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
];

const kanpurAreas = [
  'kalyanpur',
  'kakadeo',
  'barra',
  'swaroop-nagar',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const corePages: MetadataRoute.Sitemap = [
    {
      url: BASE,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE}/services`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE}/kanpur`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${BASE}/pricing`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/how-it-works`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/technicians`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/contact`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/reviews`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  const servicePages: MetadataRoute.Sitemap = services.map(
    (service) => ({
      url: `${BASE}/${service}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    })
  );

  const kanpurServicePages: MetadataRoute.Sitemap =
    services.map((service) => ({
      url: `${BASE}/kanpur/${service}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.85,
    }));

  const kanpurAreaPages: MetadataRoute.Sitemap =
    kanpurAreas.map((area) => ({
      url: `${BASE}/kanpur/${area}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

  return [
    ...corePages,
    ...servicePages,
    ...kanpurServicePages,
    ...kanpurAreaPages,
  ];
}
