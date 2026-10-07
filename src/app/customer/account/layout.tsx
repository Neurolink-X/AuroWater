import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * The page is a client component, so metadata lives here.
 * Account pages are private: keep them out of search results.
 */
export const metadata: Metadata = {
  title: 'My account',
  description: 'Manage your AuroTap profile, notifications and account activity.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CustomerAccountLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
