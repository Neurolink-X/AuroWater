import { pageMeta } from '@/lib/seo';

export const metadata = {
  ...pageMeta('Book 20L Water Can Delivery & Home Services | AuroWater', 'Check address serviceability, available delivery slots and the final price for 20L water-can delivery and home water services in Kanpur, Lucknow and Gorakhpur.', '/book'),
  robots: { index: false },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
