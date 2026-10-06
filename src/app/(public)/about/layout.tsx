import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'About AuroWater | Local Water & Home Service Platform',
  'Learn about AuroWater, a technology platform for coordinating water delivery and selected water-related home services through local operating partners.',
  '/about'
);

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
