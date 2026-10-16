import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { PAGE_DESCRIPTION, PAGE_KEYWORDS, PAGE_PATH, PAGE_TITLE } from './pricing-shared';

// Your existing helper stays the single place that builds canonical, Open Graph and Twitter tags.
// Keywords are merged on top; the title, description and path now come from pricing-shared.ts.
export const metadata: Metadata = {
  ...pageMeta(PAGE_TITLE, PAGE_DESCRIPTION, PAGE_PATH),
  keywords: PAGE_KEYWORDS,
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
