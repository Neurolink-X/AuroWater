import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Delivery & Home Services | AuroWater',
  'Explore AuroWater water delivery, water tanker, RO service, plumbing, borewell, motor pump and water tank cleaning services in Uttar Pradesh.',
  '/services'
);

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
