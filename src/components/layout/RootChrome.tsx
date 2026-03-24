'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    // Admin area has its own shell; keep public nav/footer out.
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <a
        href="https://wa.me/919889305803"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 shadow-card hover:bg-emerald-700 transition-transform hover:-translate-y-0.5"
      >
        <span>WhatsApp</span>
      </a>
    </>
  );
}

