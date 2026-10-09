import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Terms of Service | AuroWater',
  'Review the terms for using AuroWater water-can delivery, home water services, bookings, payments, cancellations and customer accounts.',
  '/terms'
);

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
