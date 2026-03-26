'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import Footer from '@/components/layout/Footer';
import WhatsAppFAB from '@/components/ui/WhatsAppFAB';

export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const [barVisible, setBarVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const dismissed = localStorage.getItem('aurowater_bar_dismissed') === '1';
      setBarVisible(!dismissed);
    } catch {
      // If storage is unavailable, show the bar by default.
      setBarVisible(true);
    }
  }, []);

  if (isAdmin) {
    // Admin area has its own shell; keep public nav/footer out.
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <SiteNav offsetPx={barVisible ? 40 : 0} />
      <main className="flex-1">
        <div key={pathname} className="animate-scale-in">
          {children}
        </div>
      </main>
      <Footer />
      <WhatsAppFAB />
    </>
  );
}

