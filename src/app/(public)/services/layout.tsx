import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { pageMeta } from '@/lib/seo';
import { BRAND, PAGE_TITLE } from './services-data';
import { getPublicServiceCities } from '@/lib/public-city-directory.server';

/* All metadata for /services lives here (one source of truth).
   pageMeta() still builds the title, description and canonical URL exactly as before;
   we only add extra search signals on top of what it returns. */
export async function generateMetadata(): Promise<Metadata> {
  const cities = await getPublicServiceCities();
  const live = cities.filter(city => city.status === 'active');
  const description = 'Book 20L water cans, water tankers, RO repair, plumbing, borewell, motor pump and tank cleaning. Check your PIN code and live service coverage before booking.';
  return {
    ...pageMeta(PAGE_TITLE, description, '/services'),
    keywords: ['RO water can delivery', 'plumber service', 'tank cleaning', 'water tanker booking',
      ...live.flatMap(city => [`RO water delivery ${city.name}`, `plumber ${city.name}`])],
    applicationName: BRAND,
    category: 'Home services',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A1628',
};

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return children;
}
