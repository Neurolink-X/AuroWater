import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Subscriptions | AuroTap',
  description:
    'Manage your recurring AuroTap water deliveries, delivery frequency and upcoming orders.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerSubscriptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
