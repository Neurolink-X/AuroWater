import { pageMeta } from '@/lib/seo';

export const metadata = {
  ...pageMeta('Book Water Delivery | AuroWater — Same Day Delivery UP', 'Book same-day water can delivery in Gorakhpur, Kanpur and Lucknow.', '/book'),
  robots: { index: false },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
