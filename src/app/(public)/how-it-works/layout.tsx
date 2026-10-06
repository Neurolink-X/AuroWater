import { pageMeta } from '@/lib/seo';
import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';

export const metadata = pageMeta(
  'How AuroWater Works | Book, Track & Manage Water Services',
  'See how AuroWater handles address serviceability, booking, supplier assignment, delivery tracking and recurring water orders.',
  '/how-it-works'
);

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'How it works', path: '/how-it-works' }]} />
      {children}
    </>
  );
}
