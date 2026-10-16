import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { pageMeta } from '@/lib/seo';
import { BRAND, PAGE_DESCRIPTION, PAGE_KEYWORDS, PAGE_TITLE } from './services-data';

/* All metadata for /services lives here (one source of truth).
   pageMeta() still builds the title, description and canonical URL exactly as before;
   we only add extra search signals on top of what it returns. */
export const metadata: Metadata = {
  ...pageMeta(PAGE_TITLE, PAGE_DESCRIPTION, '/services'),
  keywords: PAGE_KEYWORDS,
  applicationName: BRAND,
  category: 'Home services',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A1628',
};

export default function ServicesLayout({ children }: { children: ReactNode }) {
  return children;
}
