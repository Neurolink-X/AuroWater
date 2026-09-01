import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Can Subscription Plans | ₹10–₹12/can | AuroWater',
  'Simple water can plans from ₹10–₹12 per can with same-day delivery in UP.',
  '/pricing'
);

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
