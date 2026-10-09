import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Purifier, Plumbing & Pump Services | AuroWater',
  'Explore water-purifier, plumbing and pump services in supported areas. Technician availability and service details are confirmed before booking.',
  '/technicians'
);

export default function TechniciansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
