import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Privacy Policy | AuroWater',
  'Read how AuroWater handles account information, contact details, delivery addresses, service requests and privacy choices.',
  '/privacy'
);

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
