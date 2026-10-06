import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'AuroWater FAQ | Water Delivery, Bookings, Payments & Support',
  'Answers about AuroWater water delivery, serviceability, scheduling, payments, recurring deliveries and service operations.',
  '/faq'
);

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
