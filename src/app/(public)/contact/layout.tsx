import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'Contact AuroWater | Water Delivery & Service Support',
  'Contact AuroWater for water delivery, tanker bookings, home water services, supplier partnerships and customer support.',
  '/contact'
);

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
