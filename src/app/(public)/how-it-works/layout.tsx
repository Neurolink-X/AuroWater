import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'How AuroWater Works | Water Delivery & Home Services',
  'See how AuroWater booking, service matching, delivery and home-service completion work from start to finish.',
  '/how-it-works'
);

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
