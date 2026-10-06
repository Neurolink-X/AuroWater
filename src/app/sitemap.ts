import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

const BASE = getSiteUrl();

const publicPages: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/services', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/technicians', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/careers', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/security', changeFrequency: 'yearly', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicPages.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, BASE).toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}
