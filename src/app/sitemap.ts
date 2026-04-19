import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aurowater.in';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: BASE, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/services`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/how-it-works`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/technicians`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/about`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/book`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
