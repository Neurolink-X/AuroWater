import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Contact AuroWater | WhatsApp, Call & Email Support',
  'Reach AuroWater on WhatsApp, phone or email for water delivery support in UP.',
  '/contact'
);

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
