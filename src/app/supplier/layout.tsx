import type { Metadata, Viewport } from 'next';
import { Lexend } from 'next/font/google';
import type { ReactNode } from 'react';
import SupplierNav from '@/components/supplier/SupplierNav';

/**
 * src/app/supplier/layout.tsx
 *
 * Server component on purpose: `metadata` / `viewport` exports are not allowed
 * in 'use client' files, so the interactive nav lives in SupplierNav.tsx
 * (which must start with 'use client').
 */

// Lexend is a variable font: omitting `weight` loads ONE file covering 100–900
// instead of one file per weight.
const lexend = Lexend({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lexend',
});

const BRAND_BG = '#060C17';

export const metadata: Metadata = {
  title: {
    default: 'Supplier Portal',
    // Child pages that export `metadata = { title: 'Orders' }` become "Orders | AuroTap Supplier".
    template: '%s | AuroTap Supplier',
  },
  description:
    'Manage water can deliveries, live inventory, dispatch availability and earnings on the AuroTap Supplier Portal.',
  applicationName: 'AuroTap Supplier Portal',
  // Private, authenticated area: keep it out of search indexes, caches and snippets.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
  },
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: BRAND_BG,
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // Lets the layout use the full screen on notched phones; pair with env(safe-area-inset-*) in CSS.
  viewportFit: 'cover',
  // Deliberately no maximumScale / userScalable: pinch-zoom stays available for accessibility.
};

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${lexend.variable} min-h-dvh text-slate-100 antialiased`}
      style={{
        fontFamily: 'var(--font-lexend), system-ui, sans-serif',
        background: BRAND_BG,
      }}
    >
      <a
        href="#supplier-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-emerald-950 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>

      <SupplierNav />

      {/* tabIndex=-1 lets the skip link move keyboard focus here in every browser. */}
      <div id="supplier-content" tabIndex={-1} className="outline-none">
        <noscript>
          <p style={{ padding: 16, color: '#fecdd3' }}>
            The supplier portal needs JavaScript to load your orders. Enable JavaScript and reload.
          </p>
        </noscript>
        {children}
      </div>
    </div>
  );
}






// import type { Metadata, Viewport } from 'next';
// import { Lexend } from 'next/font/google';
// import type { ReactNode } from 'react';
// import SupplierNav from '@/components/supplier/SupplierNav';

// // Server component on purpose: `metadata` / `viewport` exports are not allowed
// // in 'use client' files, so the interactive nav lives in SupplierNav.tsx.

// const lexend = Lexend({
//   subsets: ['latin'],
//   weight: ['400', '500', '600', '700', '800', '900'],
//   display: 'swap',
//   variable: '--font-lexend',
// });

// export const metadata: Metadata = {
//   title: {
//     default: 'Supplier Portal | AuroTap',
//     template: '%s | AuroTap Supplier',
//   },
//   description:
//     'Manage water can deliveries, live inventory, dispatch availability and earnings on the AuroTap Supplier Portal.',
//   applicationName: 'AuroTap Supplier Portal',
//   // Private, authenticated area: keep out of search indexes.
//   robots: { index: false, follow: false, nocache: true },
//   formatDetection: { telephone: false, email: false, address: false },
//   openGraph: {
//     title: 'AuroTap Supplier Portal',
//     description: 'Orders, inventory and earnings in one live dashboard.',
//     siteName: 'AuroTap',
//     type: 'website',
//     locale: 'en_IN',
//   },
// };

// export const viewport: Viewport = {
//   themeColor: '#060C17',
//   colorScheme: 'dark',
//   width: 'device-width',
//   initialScale: 1,
// };

// export default function SupplierLayout({ children }: { children: ReactNode }) {
//   return (
//     <div
//       className={lexend.variable}
//       style={{ fontFamily: 'var(--font-lexend), system-ui, sans-serif' }}
//     >
//       <a
//         href="#supplier-content"
//         className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-emerald-600 focus:px-3.5 focus:py-2 focus:text-[13px] focus:font-bold focus:text-white"
//       >
//         Skip to content
//       </a>
//       <SupplierNav />
//       <div id="supplier-content">{children}</div>
//     </div>
//   );
// }
