'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WhatsAppFAB from '@/components/ui/WhatsAppFAB';

const CHROME_EXCLUDE_PREFIXES = [
  '/admin',
  '/technician',
  '/supplier',
  '/auth',
  '/customer',
  '/dashboard',
  '/plumber',
  '/seller',
  '/agent',
  '/settings',
  '/login',
  '/register',
];

export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const suppressChrome = CHROME_EXCLUDE_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (suppressChrome) {
    return <main style={{ minHeight: '100vh' }}>{children}</main>;
  }

  // The footer transition should inherit the actual background at the end
  // of each public route. Avoid a large decorative divider or a hard cut.
  const previousBackground =
    pathname === '/' ? '#08111F' :
    pathname?.startsWith('/service-areas') ? '#f1f5f9' :
    pathname?.startsWith('/water-delivery') ? '#ffffff' :
    '#f8fafc';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50"
      style={{ '--footer-prev-bg': previousBackground } as React.CSSProperties}>
      <Header />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
      <WhatsAppFAB />
    </div>
  );
}
