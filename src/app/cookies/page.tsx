import type { Metadata } from 'next';
import CookiesClient from './CookiesClient';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = {
  ...pageMeta(
    'Cookie Policy | AuroTap Water Delivery & Home Services',
    'Learn how AuroTap uses essential cookies and browser storage, what they are used for, how optional analytics preferences work and how to manage your choices.',
    '/cookies'
  ),
  keywords: [
    'AuroTap cookie policy',
    'AuroWater cookie policy',
    'AuroTap cookies',
    'AuroTap browser storage',
    'water delivery cookie policy India',
    'AuroTap privacy cookies',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function CookiesPage() {
  return <CookiesClient />;
}
