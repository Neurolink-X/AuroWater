import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'About AuroWater | Trusted Water Delivery in UP',
  'AuroWater delivers fresh water cans in Gorakhpur, Kanpur and Lucknow.',
  '/about'
);

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
