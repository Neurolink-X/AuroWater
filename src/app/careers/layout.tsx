import { pageMeta } from '@/lib/seo';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';

export const metadata = pageMeta(
  'Careers at AuroWater | Supplier & Technician Opportunities',
  'Explore current supplier, delivery and technician opportunities with AuroWater.',
  '/careers'
);

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Careers', path: '/careers' }]} />
      {children}
    </>
  );
}
