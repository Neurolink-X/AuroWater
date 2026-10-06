import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'AuroWater Pricing | Water Delivery & Home Services',
  'See AuroWater pricing for water cans, tanker delivery and selected home water services. Final availability and booking charges are validated during checkout.',
  '/pricing'
);

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
