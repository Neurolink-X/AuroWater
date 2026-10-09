import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'About AuroWater | Local Water Delivery & Home Services',
  'Learn about AuroWater, a local-first platform for 20L water-can delivery and home water services in eligible areas of Kanpur, Lucknow and Gorakhpur.',
  '/about'
);

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
