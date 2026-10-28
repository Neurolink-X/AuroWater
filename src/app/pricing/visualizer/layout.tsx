import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Internal tool: it exposes commission splits. Hidden in production unless explicitly enabled,
// and always kept out of search results. Put it behind your admin auth as well.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_PRICING_VISUALIZER !== 'true') notFound();
  return <>{children}</>;
}
