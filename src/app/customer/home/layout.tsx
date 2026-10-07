import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * The page itself is a client component, so metadata lives here.
 * A signed-in dashboard is private: it should never appear in Google (noindex).
 * Your public pages (/, /services, /pricing, /how-it-works) carry the real SEO.
 */
export const metadata: Metadata = {
  title: 'My dashboard',
  description:
    'Track your water and home service orders, reorder in one tap and manage your AuroTap account.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CustomerHomeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
