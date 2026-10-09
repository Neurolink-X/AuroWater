import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Contact AuroWater | WhatsApp, Call & Email Support',
  'Contact AuroWater by WhatsApp, phone or email for water-can delivery and home water-service support in Kanpur, Lucknow and Gorakhpur.',
  '/contact'
);

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
