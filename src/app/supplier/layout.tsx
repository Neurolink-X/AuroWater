import type { Metadata, Viewport } from 'next';
import { Lexend } from 'next/font/google';
import type { ReactNode } from 'react';
import SupplierNav from '@/components/supplier/SupplierNav';

// Server component on purpose: `metadata` / `viewport` exports are not allowed
// in 'use client' files, so the interactive nav lives in SupplierNav.tsx.

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-lexend',
});

export const metadata: Metadata = {
  title: {
    default: 'Supplier Portal | AuroTap',
    template: '%s | AuroTap Supplier',
  },
  description:
    'Manage water can deliveries, live inventory, dispatch availability and earnings on the AuroTap Supplier Portal.',
  applicationName: 'AuroTap Supplier Portal',
  // Private, authenticated area: keep out of search indexes.
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: 'AuroTap Supplier Portal',
    description: 'Orders, inventory and earnings in one live dashboard.',
    siteName: 'AuroTap',
    type: 'website',
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  themeColor: '#060C17',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={lexend.variable}
      style={{ fontFamily: 'var(--font-lexend), system-ui, sans-serif' }}
    >
      <a
        href="#supplier-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-600 focus:px-3.5 focus:py-2 focus:text-[13px] focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <SupplierNav />
      <div id="supplier-content">{children}</div>
    </div>
  );
}import type { Metadata, Viewport } from 'next';
import { Lexend } from 'next/font/google';
import type { ReactNode } from 'react';
import SupplierNav from '@/components/supplier/SupplierNav';

// Server component on purpose: `metadata` / `viewport` exports are not allowed
// in 'use client' files, so the interactive nav lives in SupplierNav.tsx.

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-lexend',
});

export const metadata: Metadata = {
  title: {
    default: 'Supplier Portal | AuroTap',
    template: '%s | AuroTap Supplier',
  },
  description:
    'Manage water can deliveries, live inventory, dispatch availability and earnings on the AuroTap Supplier Portal.',
  applicationName: 'AuroTap Supplier Portal',
  // Private, authenticated area: keep out of search indexes.
  robots: { index: false, follow: false, nocache: true },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    title: 'AuroTap Supplier Portal',
    description: 'Orders, inventory and earnings in one live dashboard.',
    siteName: 'AuroTap',
    type: 'website',
    locale: 'en_IN',
  },
};

export const viewport: Viewport = {
  themeColor: '#060C17',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={lexend.variable}
      style={{ fontFamily: 'var(--font-lexend), system-ui, sans-serif' }}
    >
      <a
        href="#supplier-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-600 focus:px-3.5 focus:py-2 focus:text-[13px] focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <SupplierNav />
      <div id="supplier-content">{children}</div>
    </div>
  );
}
