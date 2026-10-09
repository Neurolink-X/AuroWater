import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Delivery & Home Services | AuroWater',
  'Explore 20L water-can delivery, water tanker service, RO repair, plumbing, borewell, motor-pump repair and tank cleaning in supported areas of Kanpur, Lucknow and Gorakhpur.',
  '/services'
);

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
