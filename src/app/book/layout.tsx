import type { Metadata } from 'next';

/** Book flow is authenticated mid-flow; keep off search indexes to avoid thin checkout URLs in SERPs. */
export const metadata: Metadata = {
  title: 'Book a Service',
  robots: { index: false },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
