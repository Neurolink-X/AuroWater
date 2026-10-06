import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'How AuroWater Works | Book Water Delivery & Services',
  'Learn how AuroWater checks serviceability, routes orders to local suppliers or professionals and keeps customers updated from booking to completion.',
  '/how-it-works'
);

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
