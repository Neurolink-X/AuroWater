// src/app/admin/layout.tsx
import type { Metadata, Viewport } from 'next';
import React from 'react';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Private admin area.
 * Server component: no "use client", no extra JavaScript added here.
 * Login and auth checks happen inside AdminShell.
 */
export const metadata: Metadata = {
  applicationName: 'AuroWater Admin',

  title: {
    default: 'AuroWater Admin Control Center',
    template: '%s | AuroWater Admin',
  },

  description:
    'AuroWater private administration and operations control center.',

  // Never let search engines list or store anything from the admin.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
      nosnippet: true,
      'max-snippet': -1,
      'max-image-preview': 'none',
      'max-video-preview': -1,
    },
  },

  // Do not share the admin page address when a link is clicked.
  referrer: 'no-referrer',

  // Stops phones from turning numbers (orders, amounts, PINs)
  // into phone-call links by mistake.
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

/**
 * Makes the phone browser bar match the dark admin theme,
 * and keeps form controls and scrollbars dark.
 * (slate-950 = #020617, same as your admin background)
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
  colorScheme: 'dark',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}






// import type { Metadata } from 'next';
// import React from 'react';
// import AdminShell from '@/components/admin/AdminShell';

// export const metadata: Metadata = {
//   title: {
//     default: 'AuroWater Admin Control Center',
//     template: '%s | AuroWater Admin',
//   },

//   description:
//     'AuroWater private administration and operations control center.',

//   robots: {
//     index: false,
//     follow: false,
//     nocache: true,
//     googleBot: {
//       index: false,
//       follow: false,
//       noimageindex: true,
//       'max-snippet': -1,
//       'max-image-preview': 'none',
//       'max-video-preview': -1,
//     },
//   },

//   referrer: 'no-referrer',
// };

// export default function AdminLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return <AdminShell>{children}</AdminShell>;
// }
