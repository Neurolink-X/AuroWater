import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Delivery Pricing & Recurring Plans | AuroWater',
  'Compare one-time and recurring 20L water-can delivery and home water-service prices in Kanpur, Lucknow and Gorakhpur. See the order fee and final total before confirming.',
  '/pricing'
);

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
