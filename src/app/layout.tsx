import type { Metadata, Viewport } from 'next';
import {
  Bricolage_Grotesque,
  DM_Sans,
  Noto_Sans_Devanagari,
  Syne,
} from 'next/font/google';
import Script from 'next/script';
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
 * Fonts (self-hosted by Next.js)
 *
 * Why: the old <link> to Google Fonts blocked rendering and caused layout
 * shift. next/font downloads fonts at build time, serves them from your own
 * domain, and adds a size-matched fallback, so text never "jumps".
 *
 * Each font exposes a CSS variable. Use them in globals.css / Tailwind:
 *   --font-display   → Bricolage Grotesque (headings)
 *   --font-brand     → Syne (logo, hero words)
 *   --font-sans      → DM Sans (body)
 *   --font-devanagari→ Noto Sans Devanagari (Hindi)
 * ──────────────────────────────────────────────────────────────────────── */

const fontDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-display',
});

const fontBrand = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-brand',
});

const fontSans = DM_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
  variable: '--font-sans',
});

const fontDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  // Hindi is optional, so don't preload it for English visitors.
  preload: false,
  variable: '--font-devanagari',
});

const FONT_VARIABLES = [
  fontDisplay.variable,
  fontBrand.variable,
  fontSans.variable,
  fontDevanagari.variable,
].join(' ');

/* ──────────────────────────────────────────────────────────────────────────
 * Site configuration
 * ──────────────────────────────────────────────────────────────────────── */

const APP_URL = getSiteUrl();
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'AuroWater';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
const GOOGLE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
const BING_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

/*
 * SEO copy.
 * Google shows about 60 characters of title and 155 of description.
 * Keep the main keyword and the city names at the front.
 */
const SEO_TITLE =
  'AuroWater: 20L Water Can Delivery in Kanpur, Lucknow & Gorakhpur';

const SEO_DESCRIPTION =
  'Book 20L water can delivery, tanker, RO repair, plumber, borewell, pump repair and tank cleaning in Kanpur, Lucknow and Gorakhpur. Clear prices.';

const SEO_DESCRIPTION_SHORT =
  'Check 20L water can delivery and home service availability with clear pricing in Kanpur, Lucknow and Gorakhpur.';

const OG_IMAGE = {
  url: `${APP_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: 'AuroWater: Water Delivery & Home Services',
  type: 'image/png',
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Viewport
 *
 * Next.js requires viewport configuration to be exported separately
 * from metadata.
 * ──────────────────────────────────────────────────────────────────────── */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,

  // Lets the app use the full screen on phones with notches.
  viewportFit: 'cover',

  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0A2744' },
  ],

  colorScheme: 'light dark',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Global SEO metadata
 *
 * This is the DEFAULT metadata for the whole website.
 * Individual public pages should override title, description, canonical,
 * OG image and page-specific structured data.
 * ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  applicationName: APP_NAME,

  /* ── Titles ─────────────────────────────────────────────────────────── */

  title: {
    default: SEO_TITLE,
    // Pages that set only "title: 'Plumber in Kanpur'" become
    // "Plumber in Kanpur | AuroWater".
    template: `%s | ${APP_NAME}`,
  },

  description: SEO_DESCRIPTION,

  /* ── Keywords (Bing and some local engines still read these) ─────────── */

  keywords: [
    'AuroWater',
    '20 litre water can delivery Kanpur',
    'water can home delivery Kanpur',
    'water delivery near me Kanpur',
    '20 litre water can delivery Lucknow',
    'water can home delivery Lucknow',
    '20 litre water can delivery Gorakhpur',
    'water can home delivery Gorakhpur',
    'water tanker Kanpur',
    'water tanker booking Lucknow',
    'plumber near me Kanpur',
    'plumber service Lucknow',
    'RO water purifier repair Kanpur',
    'borewell service Kanpur',
    'submersible pump repair Kanpur',
    'motor pump repair Lucknow',
    'water tank cleaning Kanpur',
    'home services Kanpur',
  ],

  authors: [{ name: APP_NAME, url: APP_URL }],
  creator: APP_NAME,
  publisher: APP_NAME,

  /* ── Browser icons ──────────────────────────────────────────────────── */

  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
    shortcut: [{ url: '/favicon.svg' }],
    apple: [
      {
        url: '/icons/icon-512x512.png',
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    other: [{ rel: 'mask-icon', url: '/favicon.svg', color: '#2563EB' }],
  },

  /* ── PWA ────────────────────────────────────────────────────────────── */

  // Relative URL keeps the PWA manifest on the current origin.
  manifest: '/manifest.webmanifest',

  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
    startupImage: [{ url: '/icons/icon-512x512.png' }],
  },

  formatDetection: {
    telephone: true,
    address: true,
    email: true,
  },

  /* ── Open Graph (WhatsApp, Facebook, LinkedIn previews) ──────────────── */

  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: APP_URL,
    siteName: APP_NAME,
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
    images: [OG_IMAGE],
  },

  /* ── X / Twitter ────────────────────────────────────────────────────── */

  twitter: {
    card: 'summary_large_image',
    title: SEO_TITLE,
    description: SEO_DESCRIPTION_SHORT,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
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

  /* ── Canonical ──────────────────────────────────────────────────────── */

  alternates: {
    canonical: '/',
  },

  /* ── Search engine verification ─────────────────────────────────────
   * Set in your environment (no fake tokens in code):
   *   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
   *   NEXT_PUBLIC_BING_SITE_VERIFICATION
   * ─────────────────────────────────────────────────────────────────── */

  verification: {
    ...(GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : {}),
    ...(BING_VERIFICATION ? { other: { 'msvalidate.01': BING_VERIFICATION } } : {}),
  },

  category: 'utilities',

  /* ── Local SEO hints (used by Bing and some map-style engines) ───────── */

  other: {
    'mobile-web-app-capable': 'yes',
    'geo.region': 'IN-UP',
    'geo.placename': 'Kanpur, Lucknow, Gorakhpur',
    'content-language': 'en-IN',
  },
};

/* ──────────────────────────────────────────────────────────────────────────
 * Root layout
 *
 * Structured data (Organization + WebSite) lives in their own components.
 * Keep it conservative: no fake ratings, prices or addresses here.
 * Service and location schema belong on the matching pages.
 * ──────────────────────────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={FONT_VARIABLES}
      suppressHydrationWarning
    >
      <head>
        {/* ── Supabase: open the connection early so the first API call is faster ── */}
        {SUPABASE_ORIGIN ? (
          <>
            <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
          </>
        ) : null}

        {/* ── Critical brand asset ── */}
        <link
          rel="preload"
          href="/splash-logo.svg"
          as="image"
          type="image/svg+xml"
        />

        {/* ── Structured data ── */}
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>

      <body
        className="flex min-h-screen min-h-[100dvh] flex-col bg-slate-50 font-sans antialiased"
        style={{
          // Works even if Tailwind's font-sans is not mapped yet.
          fontFamily:
            'var(--font-sans), var(--font-devanagari), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          WebkitTextSizeAdjust: '100%',
          textRendering: 'optimizeLegibility',
        }}
        suppressHydrationWarning
      >
        <LanguageProvider>
          {/* Service Worker: silent, production-only offline support */}
          <ServiceWorkerRegistration />

          {/* OAuth / PKCE callback bridge */}
          <AuthPkceBridge />

          {/* Main application shell */}
          <RootChrome>{children}</RootChrome>

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

        {/* ── Google Analytics (only loads if NEXT_PUBLIC_GA_ID is set) ──
            "afterInteractive" means it never slows down your first paint. */}
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { anonymize_ip: true });
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
