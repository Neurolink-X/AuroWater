import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'AuroWater Pricing | Water Delivery & Home Services',
  'View current AuroWater water-can rates, service starting prices, platform fees and checkout pricing rules.',
  '/pricing',
);

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
