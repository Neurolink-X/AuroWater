import { pageMeta } from '@/lib/seo';
import CookiesClient from './CookiesClient';

export const metadata = pageMeta(
  'Cookie Policy | AuroWater',
  'What cookies AuroWater uses — essential, analytics, and how you can manage preferences.',
  '/cookies'
);

export default function CookiesPage() {
  return <CookiesClient />;
}
