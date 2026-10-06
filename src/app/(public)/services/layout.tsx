import { pageMeta } from '@/lib/seo';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';

export const metadata = pageMeta(
  'Water Delivery & Home Services in Kanpur | AuroWater',
  'Explore AuroWater services including water cans, tankers, RO service, plumbing, borewell, pump repair and tank cleaning. Check serviceability before booking.',
  '/services'
);

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }]} />
      {children}
    </>
  );
}
