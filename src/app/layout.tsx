import type { Metadata, Viewport } from 'next';
import './globals.css';

import AuthPkceBridge from '@/components/auth/AuthPkceBridge';
import RootChrome from '@/components/layout/RootChrome';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { getSiteUrl } from '@/lib/env';
import { Toaster } from 'sonner';
import OrganizationJsonLd from '@/components/seo/OrganizationJsonLd';
import WebSiteJsonLd from '@/components/seo/WebSiteJsonLd';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';

/* ──────────────────────────────────────────────────────────────────────────
 * Site configuration
 * ──────────────────────────────────────────────────────────────────────── */

const APP_URL = getSiteUrl();
const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'AuroWater';

const OG_IMAGE = {
  url: `${APP_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: 'AuroWater — Water Delivery & Home Services',
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Viewport
 *
 * Next.js 16 requires viewport configuration to be exported separately
 * from metadata.
 * ──────────────────────────────────────────────────────────────────────── */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,

  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: '#F8FAFC',
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: '#0A2744',
    },
  ],

  colorScheme: 'light dark',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Global SEO metadata
 *
 * This is the DEFAULT metadata for the website.
 *
 * Individual public pages should override title, description, canonical,
 * OG image and page-specific structured data where appropriate.
 * ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  applicationName: APP_NAME,

  /* ── Browser icons ───────────────────────────────────────────────────── */

  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      },
    ],

    shortcut: [
      {
        url: '/favicon.svg',
      },
    ],

    apple: [
      {
        url: '/splash-logo.svg',
        type: 'image/svg+xml',
        sizes: '400x400',
      },
    ],

    other: [
      {
        rel: 'mask-icon',
        url: '/favicon.svg',
        color: '#2563EB',
      },
    ],
  },

  /* ── PWA ─────────────────────────────────────────────────────────────── */

  manifest: '/manifest.webmanifest',

  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',

    startupImage: [
      {
        url: '/splash-logo.svg',
      },
    ],
  },

  /* ── Titles ───────────────────────────────────────────────────────────── */

  title: {
    default:
      'AuroWater | Water Delivery & Home Services in Kanpur',

    template: `%s | ${APP_NAME}`,
  },

  /* ── Description ─────────────────────────────────────────────────────── */

  description:
    'Book water delivery, water cans, plumbers, borewell services, pump repair, RO service and other home services with AuroWater in Kanpur & NCR.',

  /* ── Keywords ────────────────────────────────────────────────────────── */

  keywords: [
    'AuroWater',
    'water delivery Kanpur',
    'water can delivery Kanpur',
    'water tanker Kanpur',
    'plumber Kanpur',
    'plumber service Kanpur',
    'plumber near me Kanpur',
    'borewell service Kanpur',
    'borewell drilling Kanpur',
    'submersible pump Kanpur',
    'motor repair Kanpur',
    'RO service Kanpur',
    'tank cleaning Kanpur',
    'home services Kanpur',
  ],

  authors: [
    {
      name: APP_NAME,
      url: APP_URL,
    },
  ],

  creator: APP_NAME,
  publisher: APP_NAME,

  /* ── Open Graph ─────────────────────────────────────────────────────── */

  openGraph: {
    type: 'website',

    locale: 'en_IN',

    url: APP_URL,

    siteName: APP_NAME,

    title:
      'AuroWater | Water Delivery & Home Services in Kanpur',

    description:
      'Book reliable water delivery and home services with AuroWater in Kanpur & NCR.',

    images: [OG_IMAGE],
  },

  /* ── X / Twitter ────────────────────────────────────────────────────── */

  twitter: {
    card: 'summary_large_image',

    title:
      'AuroWater | Water Delivery & Home Services in Kanpur',

    description:
      'Book reliable water delivery and home services with AuroWater in Kanpur.',

    images: [OG_IMAGE.url],
  },

  /* ── Search engine crawling ─────────────────────────────────────────── */

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,

      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  /* ── Canonical ───────────────────────────────────────────────────────── */

  alternates: {
    canonical: APP_URL,
  },

  /* ── Search engine verification ──────────────────────────────────────
   *
   * Add the real verification token when Search Console is configured.
   * Do not put fake tokens here.
   * ──────────────────────────────────────────────────────────────────── */

  verification: {
    // google: 'YOUR_REAL_GOOGLE_SEARCH_CONSOLE_TOKEN',
  },

  category: 'utilities',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Global structured data
 *
 * Keep the root schema conservative.
 *
 * Organization + WebSite belong globally.
 *
 * Do NOT put a hardcoded physical address, GPS coordinates, fake ratings,
 * prices or every service/location into the global layout.
 *
 * Those belong on the relevant public pages once the information is
 * verified and actually represented on those pages.
 * ──────────────────────────────────────────────────────────────────────── */

// const organizationJsonLd = {
//   '@context': 'https://schema.org',
//   '@type': 'Organization',

//   '@id': `${APP_URL}/#organization`,

//   name: APP_NAME,

//   url: APP_URL,

//   logo: {
//     '@type': 'ImageObject',
//     url: `${APP_URL}/splash-logo.svg`,
//   },
// };


/* ──────────────────────────────────────────────────────────────────────────
 * Root layout
 * ──────────────────────────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <head>
          <OrganizationJsonLd />
          <WebSiteJsonLd />
        
        {/* ── Supabase connection hints ──────────────────────────────── */}

        <link
          rel="dns-prefetch"
          href="https://mwfcwhxdlnqldciigicl.supabase.co"
        />

        <link
          rel="preconnect"
          href="https://mwfcwhxdlnqldciigicl.supabase.co"
          crossOrigin="anonymous"
        />

        {/* ── Google Fonts ───────────────────────────────────────────── */}

        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />

        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        <link
          rel="stylesheet"
          href={[
            'https://fonts.googleapis.com/css2?',
            'family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800',
            '&family=Syne:wght@700;800;900',
            '&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400',
            '&family=Noto+Sans+Devanagari:wght@400;500;600;700',
            '&display=swap',
          ].join('')}
        />

        {/* ── Critical brand assets ──────────────────────────────────── */}

        <link
          rel="preload"
          href="/splash-logo.svg"
          as="image"
          type="image/svg+xml"
        />

        <link
          rel="preload"
          href="/favicon.svg"
          as="image"
          type="image/svg+xml"
        />

        {/* ── PWA / mobile ───────────────────────────────────────────── */}

        <meta
          name="mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="format-detection"
          content="telephone=yes,address=yes,email=yes"
        />

        {/* ── Organization structured data ───────────────────────────── */}

        {/* <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        /> */}

        {/* ── WebSite structured data ───────────────────────────────── */}

        {/* <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        /> */}
        
      </head>

      <body
        className="min-h-screen flex flex-col bg-slate-50"
        suppressHydrationWarning
      >
        <LanguageProvider>
          {/* Service Worker registration — silent, production-only offline support */}

          <ServiceWorkerRegistration />

          {/* OAuth / PKCE callback bridge */}

          <AuthPkceBridge />

          {/* Main application shell */}

          <RootChrome>
            {children}
          </RootChrome>

          {/* Toast notifications */}

          <Toaster
            position="bottom-center"
            richColors
            expand
            closeButton
            toastOptions={{
              duration: 4000,

              classNames: {
                toast: 'font-sans text-sm',
                title: 'font-semibold',
                description: 'text-xs opacity-80',
              },
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  );
}
