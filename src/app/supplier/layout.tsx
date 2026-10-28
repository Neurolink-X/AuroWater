import type { Metadata, Viewport } from 'next';

import type { ReactNode } from 'react';
import SupplierNav from '@/components/supplier/SupplierNav';

/**
 * src/app/supplier/layout.tsx
 *
 * Server component on purpose: `metadata` and `viewport` exports are not allowed in 'use client'
 * files, so the interactive navigation lives in SupplierNav.tsx (which starts with 'use client').
 *
 * Design: a light, calm "fresh water" look. Soft mint page, white cards, emerald as the positive
 * brand colour, teal and amber as supporting accents. Child pages should use white surfaces with
 * `border-slate-200`, `text-slate-900` for text and `emerald-600` for primary actions.
 *
 * Do not render another <main> inside child pages; this layout provides the content landmark.
 */

const BRAND_BG = '#F4FAF7';

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
  // Gives a proper title and chrome when a supplier adds the portal to their iPhone home screen.
  appleWebApp: { capable: true, title: 'AuroTap Supplier', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: BRAND_BG,
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  // Uses the full screen on notched phones; the nav and content pad with env(safe-area-inset-*).
  viewportFit: 'cover',
  // Deliberately no maximumScale or userScalable: pinch-zoom stays available for accessibility.
};

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative isolate min-h-dvh bg-[#F4FAF7] text-slate-900 antialiased"
      style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', colorScheme: 'light' }}
    >
      {/* Soft brand glow behind the header area. Decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(60%_60%_at_12%_0%,rgba(16,185,129,0.16),transparent),radial-gradient(50%_50%_at_92%_0%,rgba(20,184,166,0.13),transparent),radial-gradient(40%_40%_at_60%_0%,rgba(251,191,36,0.07),transparent)]"
      />

      <a
        href="#supplier-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-emerald-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
      >
        Skip to content
      </a>

      <SupplierNav />

      {/* tabIndex=-1 lets the skip link move keyboard focus here in every browser. The bottom
          padding clears the mobile tab bar and the iPhone home indicator. */}
      <div
        id="supplier-content"
        tabIndex={-1}
        className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:pb-0"
      >
        <noscript>
          <p className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
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

// /**
//  * src/app/supplier/layout.tsx
//  *
//  * Server component on purpose: `metadata` / `viewport` exports are not allowed
//  * in 'use client' files, so the interactive nav lives in SupplierNav.tsx
//  * (which must start with 'use client').
//  */

// // Lexend is a variable font: omitting `weight` loads ONE file covering 100–900
// // instead of one file per weight.
// const lexend = Lexend({
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-lexend',
// });

// const BRAND_BG = '#060C17';

// export const metadata: Metadata = {
//   title: {
//     default: 'Supplier Portal',
//     // Child pages that export `metadata = { title: 'Orders' }` become "Orders | AuroTap Supplier".
//     template: '%s | AuroTap Supplier',
//   },
//   description:
//     'Manage water can deliveries, live inventory, dispatch availability and earnings on the AuroTap Supplier Portal.',
//   applicationName: 'AuroTap Supplier Portal',
//   // Private, authenticated area: keep it out of search indexes, caches and snippets.
//   robots: {
//     index: false,
//     follow: false,
//     nocache: true,
//     noarchive: true,
//     nosnippet: true,
//     googleBot: {
//       index: false,
//       follow: false,
//       noarchive: true,
//       nosnippet: true,
//       noimageindex: true,
//     },
//   },
//   referrer: 'strict-origin-when-cross-origin',
//   formatDetection: { telephone: false, email: false, address: false },
// };

// export const viewport: Viewport = {
//   themeColor: BRAND_BG,
//   colorScheme: 'dark',
//   width: 'device-width',
//   initialScale: 1,
//   // Lets the layout use the full screen on notched phones; pair with env(safe-area-inset-*) in CSS.
//   viewportFit: 'cover',
//   // Deliberately no maximumScale / userScalable: pinch-zoom stays available for accessibility.
// };

// export default function SupplierLayout({ children }: { children: ReactNode }) {
//   return (
//     <div
//       className={`${lexend.variable} min-h-dvh text-slate-100 antialiased`}
//       style={{
//         fontFamily: 'var(--font-lexend), system-ui, sans-serif',
//         background: BRAND_BG,
//       }}
//     >
//       <a
//         href="#supplier-content"
//         className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-emerald-950 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
//       >
//         Skip to content
//       </a>

//       <SupplierNav />

//       {/* tabIndex=-1 lets the skip link move keyboard focus here in every browser. */}
//       <div id="supplier-content" tabIndex={-1} className="outline-none">
//         <noscript>
//           <p style={{ padding: 16, color: '#fecdd3' }}>
//             The supplier portal needs JavaScript to load your orders. Enable JavaScript and reload.
//           </p>
//         </noscript>
//         {children}
//       </div>
//     </div>
//   );
// }






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
