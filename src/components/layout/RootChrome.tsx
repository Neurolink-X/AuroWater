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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
      <WhatsAppFAB />
    </div>
  );
}
