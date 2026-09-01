import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Purifier Technicians | AuroWater Service',
  'Book verified water purifier and plumbing technicians with AuroWater.',
  '/technicians'
);

export default function TechniciansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
