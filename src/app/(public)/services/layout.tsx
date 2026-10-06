import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'Water Delivery & Home Services | AuroWater',
  'Explore AuroWater services including 20L water cans, water tankers, RO service, plumbing, borewell, pump repair and tank cleaning.',
  '/services'
);

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
