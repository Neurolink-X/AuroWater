import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

import AuthPkceBridge from '@/components/auth/AuthPkceBridge';
import RootChrome from '@/components/layout/RootChrome';
import ScrollReveal from '@/components/ScrollReveal';
import SplashController from '@/components/SplashController';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { getSiteUrl } from '@/lib/env';
import { Toaster } from 'sonner';
import OrganizationJsonLd from '@/components/seo/OrganizationJsonLd';
import WebSiteJsonLd from '@/components/seo/WebSiteJsonLd';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import WebVitalsReporter from '@/components/observability/WebVitalsReporter';
import ScrollStallReporter from '@/components/observability/ScrollStallReporter';

/* ──────────────────────────────────────────────────────────────────────────
 * Fonts (self-hosted by Next.js)
 *
 * next/font downloads fonts at build time, serves them from your own domain
 * and adds a size-matched fallback, so text never "jumps".
 *
 *   --font-display    → Bricolage Grotesque (headings)
 *   --font-brand      → Syne (logo, hero words, splash screen)
 *   --font-sans       → DM Sans (body)
 *   --font-devanagari → Noto Sans Devanagari (Hindi)
 *
 * SPEED NOTE: every font file that is preloaded sits on the launch path.
 * DM Sans italic was removed because it doubled the body-font download.
 * If you really use `italic` somewhere, change style back to
 * ['normal', 'italic'].
 * ──────────────────────────────────────────────────────────────────────── */

// Font families are defined as system-first CSS stacks in globals.css.
// Avoid build-time network calls to Google Fonts so CI and production builds are deterministic.


/* ──────────────────────────────────────────────────────────────────────────
 * Site configuration
 *
 * ONE name for everything. Set NEXT_PUBLIC_APP_NAME=AuroTap in Vercel and the
 * title, OG tags, keywords and splash screen all switch together.
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
const SEO_TITLE = `${APP_NAME}: 20L Water Can Delivery in Kanpur, Lucknow & Gorakhpur`;

const SEO_DESCRIPTION =
  'Book 20L water can delivery, tanker, RO repair, plumber, borewell, pump repair and tank cleaning in Kanpur, Lucknow and Gorakhpur. Clear prices.';

const SEO_DESCRIPTION_SHORT =
  'Check 20L water can delivery and home service availability with clear pricing in Kanpur, Lucknow and Gorakhpur.';

const OG_IMAGE = {
  url: `${APP_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: `${APP_NAME}: Water Delivery & Home Services`,
  type: 'image/png',
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Splash screen
 *
 * How it works (simple version):
 *
 *  1. A tiny script in <head> runs BEFORE the first paint. It decides
 *     "show splash or not" and sets  <html data-splash="show">.
 *  2. The splash is plain HTML + inline CSS. It paints with the very first
 *     HTML bytes: no JS bundle, no image request chain, no flash of white.
 *  3. SplashController (client) fades it out as soon as the app is ready,
 *     but never earlier than MIN_SPLASH_MS (so it does not blink).
 *  4. FAIL-SAFE: even if JavaScript never runs, CSS hides it by itself
 *     after ~2.6s. It can never trap the user.
 *
 * Shown: once per session when the installed app (PWA) is opened.
 *        Also on the first visit of a browser session if SPLASH_ON_WEB.
 * Never: for Googlebot, Lighthouse/PageSpeed, headless browsers,
 *        reloads inside the same session, or users with JavaScript off.
 *
 * Colours are chosen to match manifest.webmanifest (background_color and
 * theme_color #F8FAFC) so Android's own splash flows into this one with
 * no colour jump.
 * ──────────────────────────────────────────────────────────────────────── */

//const SPLASH_ON_WEB = true; // false = installed app only
const SPLASH_ON_WEB = false; // installed app (PWA) only
const SPLASH_SESSION_KEY = 'aurotap_splash_seen';

const splashBootScript = `(function(){try{
var d=document.documentElement;
if(navigator.webdriver||/googlebot|bingbot|crawler|spider|lighthouse|pagespeed|gtmetrix|headlesschrome|prerender/i.test(navigator.userAgent))return;
var app=window.matchMedia('(display-mode: standalone), (display-mode: minimal-ui)').matches||navigator.standalone===true;
if(!app&&!${SPLASH_ON_WEB})return;
if(sessionStorage.getItem('${SPLASH_SESSION_KEY}'))return;
sessionStorage.setItem('${SPLASH_SESSION_KEY}','1');
d.setAttribute('data-splash','show');
}catch(e){}})();`;

// Inline = zero extra network request, so the splash styles are ready at first paint.
const splashCss = `
#app-splash{display:none}
html[data-splash] #app-splash{
  position:fixed;inset:0;z-index:100000;display:grid;place-items:center;
  background:#F8FAFC;opacity:1;visibility:visible;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  transition:opacity .35s ease,visibility 0s linear .35s;
}
html[data-splash="show"] #app-splash{animation:sp-failsafe .01s linear .75s forwards}
html[data-splash="done"] #app-splash{opacity:0;visibility:hidden;animation:none}
.sp-stage{display:flex;flex-direction:column;align-items:center;text-align:center}
.sp-orb{position:relative;display:grid;place-items:center;width:132px;height:132px}
.sp-ring{
  position:absolute;inset:0;border-radius:50%;border:2px solid #0284C7;
  opacity:0;transform:scale(.5);will-change:transform,opacity;
  animation:sp-ripple 1.9s cubic-bezier(.22,.61,.36,1) infinite;
}
.sp-ring:nth-child(2){animation-delay:.63s}
.sp-ring:nth-child(3){animation-delay:1.26s}
.sp-mark{
  position:relative;width:76px;height:76px;object-fit:contain;
  animation:sp-settle .6s cubic-bezier(.22,1,.36,1) both;
}
.sp-name{
  margin:22px 0 0;color:#0F172A;letter-spacing:-.01em;
  font:800 28px/1 var(--font-brand),system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
.sp-tag{
  margin:10px 0 0;color:#475569;
  font:500 14px/1.3 var(--font-sans),system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@keyframes sp-ripple{0%{transform:scale(.5);opacity:.5}100%{transform:scale(1.35);opacity:0}}
@keyframes sp-settle{from{transform:scale(.88)}to{transform:scale(1)}}
@keyframes sp-failsafe{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){
  .sp-ring{animation:none;opacity:.18;transform:scale(1)}
  .sp-ring:nth-child(n+2){display:none}
  .sp-mark{animation:none}
}
@media (pointer:coarse){
  .sp-ring{animation:none;opacity:.16;transform:scale(1)}
  .sp-ring:nth-child(n+2){display:none}
}
`;

/*
 * iOS launch images: [CSS width, CSS height, pixel ratio].
 * Generate the files once (they must exist in /public/splash):
 *   npx pwa-asset-generator public/splash-logo.svg public/splash \
 *     --background "#F8FAFC" --splash-only --portrait-only --type jpeg
 * Check the file names it writes match `apple-splash-{pixelW}-{pixelH}.jpg`.
 */
const IOS_SPLASH: ReadonlyArray<readonly [number, number, number]> = [
  [440, 956, 3], // iPhone 16 Pro Max / 17 Pro Max
  [430, 932, 3], // iPhone 16 Plus / 15 Plus / 14 Pro Max
  [420, 912, 3], // iPhone Air
  [402, 874, 3], // iPhone 16 Pro / 17 / 17 Pro
  [393, 852, 3], // iPhone 16 / 15 / 15 Pro / 14 Pro
  [390, 844, 3], // iPhone 14 / 13 / 12 / 16e
  [414, 896, 2], // iPhone 11 / XR
  [375, 667, 2], // iPhone SE / 8
  [834, 1194, 2], // iPad Pro 11"
  [820, 1180, 2], // iPad Air / iPad 10.9"
];

const APPLE_STARTUP_IMAGES = IOS_SPLASH.map(([w, h, r]) => ({
  url: `/splash/apple-splash-${w * r}-${h * r}.jpg`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));

/* ──────────────────────────────────────────────────────────────────────────
 * Viewport
 *
 * The site UI is light-only, so browser chrome and form controls stay light
 * too (a dark theme-color over a light page looks broken on dark-mode phones).
 * ──────────────────────────────────────────────────────────────────────── */

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,

  // Lets the app use the full screen on phones with notches.
  // Fixed bars need env(safe-area-inset-*) padding.
  viewportFit: 'cover',

  // The on-screen keyboard resizes the page, so booking forms and bottom
  // buttons are never hidden behind it on Android.
  interactiveWidget: 'resizes-content',

  themeColor: '#F8FAFC',

  colorScheme: 'light',
};

/* ──────────────────────────────────────────────────────────────────────────
 * Global SEO metadata
 *
 * DEFAULT metadata for the whole website. Individual public pages should
 * override title, description, canonical, OG image and structured data.
 * ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  applicationName: APP_NAME,

  /* ── Titles ─────────────────────────────────────────────────────────── */

  title: {
    default: SEO_TITLE,
    // A page that sets only "title: 'Plumber in Kanpur'" becomes
    // "Plumber in Kanpur | <APP_NAME>".
    template: `%s | ${APP_NAME}`,
  },

  description: SEO_DESCRIPTION,

  /* ── Keywords (Google ignores them; Bing and some local engines read them) ── */

  keywords: [
    APP_NAME,
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
  referrer: 'origin-when-cross-origin',

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
    // One launch image per device size (see IOS_SPLASH above).
    startupImage: APPLE_STARTUP_IMAGES,
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
    alternateLocale: ['hi_IN'],
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

  /* ── Canonical ──────────────────────────────────────────────────────────
   * Deliberately NOT set here. A canonical in the root layout is inherited by
   * every page that doesn't define its own, which tells Google that all of
   * them are duplicates of the homepage. Set it in each page instead:
   *
   *   export const metadata = { alternates: { canonical: '/plumber-kanpur' } };
   *
   * (homepage: canonical '/'). metadataBase turns it into the full URL.
   * ──────────────────────────────────────────────────────────────────────── */

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
      // Lets Next.js skip the animated scroll on route changes while keeping
      // smooth scrolling for in-page anchors (needs scroll-behavior: smooth in CSS).
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* ── Splash: decide show/skip BEFORE first paint, then style it ── */}
        <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
        <style dangerouslySetInnerHTML={{ __html: splashCss }} />

        {/* ── Supabase: open the connection early so the first API call is faster ── */}
        {SUPABASE_ORIGIN ? (
          <>
            <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
          </>
        ) : null}

        {/* ── Sitemap hint for crawlers (generated by app/sitemap.ts) ── */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        {/* ── Structured data ── */}
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>

      <body
        className="flex min-h-dvh flex-col bg-slate-50 font-sans antialiased"
        style={{
          // Works even if Tailwind's font-sans is not mapped yet.
          fontFamily:
            'var(--font-sans), var(--font-devanagari), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          WebkitTextSizeAdjust: '100%',
         // textRendering: 'optimizeLegibility',
        }}
        suppressHydrationWarning
      >
        {/* ── Splash: first thing in <body>, so it paints first ──
            Hidden by default (display:none). Only shows when the boot script
            sets data-splash="show". aria-hidden: screen readers skip it. */}
        <div id="app-splash" aria-hidden="true">
          <div className="sp-stage">
            <div className="sp-orb">
              <span className="sp-ring" />
              <span className="sp-ring" />
              <span className="sp-ring" />
              {/* Plain <img> on purpose: the splash must not wait for any JS or image pipeline. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="sp-mark"
                src="/aurotap-mark.svg"
                alt=""
                width={76}
                height={76}
                decoding="sync"
                fetchPriority="high"
              />
            </div>
            <p className="sp-name">{APP_NAME}</p>
            <p className="sp-tag">Fresh water. Trusted home services.</p>
          </div>
        </div>

        {/* Hides the splash when the app is ready (min time, max time, fonts) */}
        <SplashController />

        {/* Scroll reveal: mounted once for the whole site */}
        <ScrollReveal />

        <LanguageProvider>
          {/* Sampled Core Web Vitals: no PII, no blocking network request */}
          <WebVitalsReporter />
        <ScrollStallReporter />

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
            "lazyOnload" waits until the browser is idle after the page has
            loaded, so analytics never competes with the app launch. */}
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="lazyOnload"
            />
            <Script id="ga-init" strategy="lazyOnload">
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









// import type { Metadata, Viewport } from 'next';
// import {
//   Bricolage_Grotesque,
//   DM_Sans,
//   Noto_Sans_Devanagari,
//   Syne,
// } from 'next/font/google';
// import Script from 'next/script';
// import './globals.css';

// import AuthPkceBridge from '@/components/auth/AuthPkceBridge';
// import RootChrome from '@/components/layout/RootChrome';
// import ScrollReveal from '@/components/ScrollReveal';
// import { LanguageProvider } from '@/lib/i18n/LanguageContext';
// import { getSiteUrl } from '@/lib/env';
// import { Toaster } from 'sonner';
// import OrganizationJsonLd from '@/components/seo/OrganizationJsonLd';
// import WebSiteJsonLd from '@/components/seo/WebSiteJsonLd';
// import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';

// /* ──────────────────────────────────────────────────────────────────────────
//  * Fonts (self-hosted by Next.js)
//  *
//  * Why: the old <link> to Google Fonts blocked rendering and caused layout
//  * shift. next/font downloads fonts at build time, serves them from your own
//  * domain, and adds a size-matched fallback, so text never "jumps".
//  *
//  * Each font exposes a CSS variable. Use them in globals.css / Tailwind:
//  *   --font-display   → Bricolage Grotesque (headings)
//  *   --font-brand     → Syne (logo, hero words, splash screen)
//  *   --font-sans      → DM Sans (body)
//  *   --font-devanagari→ Noto Sans Devanagari (Hindi)
//  * ──────────────────────────────────────────────────────────────────────── */

// const fontDisplay = Bricolage_Grotesque({
//   subsets: ['latin'],
//   axes: ['opsz'],
//   display: 'swap',
//   variable: '--font-display',
// });

// const fontBrand = Syne({
//   subsets: ['latin'],
//   weight: ['700', '800'],
//   display: 'swap',
//   variable: '--font-brand',
// });

// const fontSans = DM_Sans({
//   subsets: ['latin'],
//   style: ['normal', 'italic'],
//   axes: ['opsz'],
//   display: 'swap',
//   variable: '--font-sans',
// });

// const fontDevanagari = Noto_Sans_Devanagari({
//   subsets: ['devanagari'],
//   weight: ['400', '500', '600', '700'],
//   display: 'swap',
//   // Hindi is optional, so don't preload it for English visitors.
//   preload: false,
//   variable: '--font-devanagari',
// });

// const FONT_VARIABLES = [
//   fontDisplay.variable,
//   fontBrand.variable,
//   fontSans.variable,
//   fontDevanagari.variable,
// ].join(' ');

// /* ──────────────────────────────────────────────────────────────────────────
//  * Site configuration
//  * ──────────────────────────────────────────────────────────────────────── */

// const APP_URL = getSiteUrl();
// const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'AuroWater';

// const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
// const GOOGLE_VERIFICATION =
//   process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
// const BING_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

// const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

// /*
//  * SEO copy.
//  * Google shows about 60 characters of title and 155 of description.
//  * Keep the main keyword and the city names at the front.
//  */
// const SEO_TITLE =
//   'AuroWater: 20L Water Can Delivery in Kanpur, Lucknow & Gorakhpur';

// const SEO_DESCRIPTION =
//   'Book 20L water can delivery, tanker, RO repair, plumber, borewell, pump repair and tank cleaning in Kanpur, Lucknow and Gorakhpur. Clear prices.';

// const SEO_DESCRIPTION_SHORT =
//   'Check 20L water can delivery and home service availability with clear pricing in Kanpur, Lucknow and Gorakhpur.';

// const OG_IMAGE = {
//   url: `${APP_URL}/og-image.png`,
//   width: 1200,
//   height: 630,
//   alt: 'AuroWater: Water Delivery & Home Services',
//   type: 'image/png',
// } as const;

// /* ──────────────────────────────────────────────────────────────────────────
//  * Splash screen
//  *
//  * Two layers, so it feels like a native app everywhere:
//  *
//  * 1) In-app splash (below, pure CSS, no JS dependency to hide it):
//  *    a light brand screen with a water-ripple animation that fades out by
//  *    itself after ~1.6s. It shows
//  *      - every time the installed app (PWA) is launched, and
//  *      - on the first visit of a browser session if SPLASH_ON_WEB is true.
//  *    It is never shown to search-engine bots or speed-test tools, so it can't
//  *    affect crawling, indexing or Lighthouse scores.
//  *
//  * 2) iOS launch images (IOS_SPLASH): the native splash iPhones/iPads show while
//  *    the installed app starts. Android builds its own from manifest.webmanifest
//  *    (background_color #F8FAFC + the 512px icon).
//  *
//  * The overlay has no text for screen readers (aria-hidden) and is
//  * pointer-events: none once it fades, so it never blocks taps.
//  * ──────────────────────────────────────────────────────────────────────── */

// const SPLASH_ON_WEB = true; // false = installed app only


// /*
//  * iOS launch images: [CSS width, CSS height, pixel ratio].
//  * Generate the files once (they must exist in /public/splash):
//  *   npx pwa-asset-generator public/splash-logo.svg public/splash \
//  *     --background "#F8FAFC" --splash-only --portrait-only --type jpeg
//  * Check the file names it writes match `apple-splash-{pixelW}-{pixelH}.jpg`.
//  */
// const IOS_SPLASH: ReadonlyArray<readonly [number, number, number]> = [
//   [430, 932, 3], // iPhone 16/15 Pro Max, 15/14 Plus
//   [393, 852, 3], // iPhone 16/15/15 Pro
//   [390, 844, 3], // iPhone 14/13/12
//   [414, 896, 2], // iPhone 11 / XR
//   [375, 667, 2], // iPhone SE / 8
//   [834, 1194, 2], // iPad Pro 11"
//   [820, 1180, 2], // iPad Air / iPad 10.9"
// ];

// const APPLE_STARTUP_IMAGES = IOS_SPLASH.map(([w, h, r]) => ({
//   url: `/splash/apple-splash-${w * r}-${h * r}.jpg`,
//   media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
// }));

// /* ──────────────────────────────────────────────────────────────────────────
//  * Viewport
//  *
//  * Next.js requires viewport configuration to be exported separately
//  * from metadata.
//  *
//  * The site UI is light-only, so browser chrome and form controls stay light
//  * too (a dark theme-color over a light page looks broken on dark-mode phones).
//  * ──────────────────────────────────────────────────────────────────────── */

// export const viewport: Viewport = {
//   width: 'device-width',
//   initialScale: 1,
//   maximumScale: 5,
//   userScalable: true,

//   // Lets the app use the full screen on phones with notches.
//   // Fixed bars need env(safe-area-inset-*) padding.
//   viewportFit: 'cover',

//   // The on-screen keyboard resizes the page, so booking forms and bottom
//   // buttons are never hidden behind it on Android.
//   interactiveWidget: 'resizes-content',

//   themeColor: '#F8FAFC',

//   colorScheme: 'light',
// };

// /* ──────────────────────────────────────────────────────────────────────────
//  * Global SEO metadata
//  *
//  * This is the DEFAULT metadata for the whole website.
//  * Individual public pages should override title, description, canonical,
//  * OG image and page-specific structured data.
//  * ──────────────────────────────────────────────────────────────────────── */

// export const metadata: Metadata = {
//   metadataBase: new URL(APP_URL),

//   applicationName: APP_NAME,

//   /* ── Titles ─────────────────────────────────────────────────────────── */

//   title: {
//     default: SEO_TITLE,
//     // Pages that set only "title: 'Plumber in Kanpur'" become
//     // "Plumber in Kanpur | AuroWater".
//     template: `%s | ${APP_NAME}`,
//   },

//   description: SEO_DESCRIPTION,

//   /* ── Keywords (Bing and some local engines still read these) ─────────── */

//   keywords: [
//     'AuroWater',
//     '20 litre water can delivery Kanpur',
//     'water can home delivery Kanpur',
//     'water delivery near me Kanpur',
//     '20 litre water can delivery Lucknow',
//     'water can home delivery Lucknow',
//     '20 litre water can delivery Gorakhpur',
//     'water can home delivery Gorakhpur',
//     'water tanker Kanpur',
//     'water tanker booking Lucknow',
//     'plumber near me Kanpur',
//     'plumber service Lucknow',
//     'RO water purifier repair Kanpur',
//     'borewell service Kanpur',
//     'submersible pump repair Kanpur',
//     'motor pump repair Lucknow',
//     'water tank cleaning Kanpur',
//     'home services Kanpur',
//   ],

//   authors: [{ name: APP_NAME, url: APP_URL }],
//   creator: APP_NAME,
//   publisher: APP_NAME,
//   referrer: 'origin-when-cross-origin',

//   /* ── Browser icons ──────────────────────────────────────────────────── */

//   icons: {
//     icon: [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
//     shortcut: [{ url: '/favicon.svg' }],
//     apple: [
//       {
//         url: '/icons/icon-512x512.png',
//         type: 'image/png',
//         sizes: '512x512',
//       },
//     ],
//     other: [{ rel: 'mask-icon', url: '/favicon.svg', color: '#2563EB' }],
//   },

//   /* ── PWA ────────────────────────────────────────────────────────────── */

//   // Relative URL keeps the PWA manifest on the current origin.
//   manifest: '/manifest.webmanifest',

//   appleWebApp: {
//     capable: true,
//     title: APP_NAME,
//     statusBarStyle: 'default',
//     // One launch image per device size (see IOS_SPLASH above).
//     startupImage: APPLE_STARTUP_IMAGES,
//   },

//   formatDetection: {
//     telephone: true,
//     address: true,
//     email: true,
//   },

//   /* ── Open Graph (WhatsApp, Facebook, LinkedIn previews) ──────────────── */

//   openGraph: {
//     type: 'website',
//     locale: 'en_IN',
//     alternateLocale: ['hi_IN'],
//     url: APP_URL,
//     siteName: APP_NAME,
//     title: SEO_TITLE,
//     description: SEO_DESCRIPTION,
//     images: [OG_IMAGE],
//   },

//   /* ── X / Twitter ────────────────────────────────────────────────────── */

//   twitter: {
//     card: 'summary_large_image',
//     title: SEO_TITLE,
//     description: SEO_DESCRIPTION_SHORT,
//     images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
//   },

//   /* ── Search engine crawling ─────────────────────────────────────────── */

//   robots: {
//     index: true,
//     follow: true,
//     googleBot: {
//       index: true,
//       follow: true,
//       'max-video-preview': -1,
//       'max-image-preview': 'large',
//       'max-snippet': -1,
//     },
//   },

//   /* ── Canonical ──────────────────────────────────────────────────────────
//    * Deliberately NOT set here. A canonical in the root layout is inherited by
//    * every page that doesn't define its own, which tells Google that all of
//    * them are duplicates of the homepage. Set it in each page instead:
//    *
//    *   export const metadata = { alternates: { canonical: '/plumber-kanpur' } };
//    *
//    * (homepage: canonical '/'). metadataBase turns it into the full URL.
//    * ──────────────────────────────────────────────────────────────────────── */

//   /* ── Search engine verification ─────────────────────────────────────
//    * Set in your environment (no fake tokens in code):
//    *   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
//    *   NEXT_PUBLIC_BING_SITE_VERIFICATION
//    * ─────────────────────────────────────────────────────────────────── */

//   verification: {
//     ...(GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : {}),
//     ...(BING_VERIFICATION ? { other: { 'msvalidate.01': BING_VERIFICATION } } : {}),
//   },

//   category: 'utilities',

//   /* ── Local SEO hints (used by Bing and some map-style engines) ───────── */

//   other: {
//     'mobile-web-app-capable': 'yes',
//     'geo.region': 'IN-UP',
//     'geo.placename': 'Kanpur, Lucknow, Gorakhpur',
//   },
// };

// /* ──────────────────────────────────────────────────────────────────────────
//  * Root layout
//  *
//  * Structured data (Organization + WebSite) lives in their own components.
//  * Keep it conservative: no fake ratings, prices or addresses here.
//  * Service and location schema belong on the matching pages.
//  * ──────────────────────────────────────────────────────────────────────── */

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html
//       lang="en"
//       className={FONT_VARIABLES}
//       // Lets Next.js skip the animated scroll on route changes while keeping
//       // smooth scrolling for in-page anchors (needs scroll-behavior: smooth in CSS).
//       data-scroll-behavior="smooth"
//       suppressHydrationWarning
//     >
//       <head>

//         {/* ── Supabase: open the connection early so the first API call is faster ── */}
//         {SUPABASE_ORIGIN ? (
//           <>
//             <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
//             <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
//           </>
//         ) : null}

//         {/* ── Analytics: warm up the connection only when GA is enabled ── */}
//         {GA_ID ? (
//           <link rel="preconnect" href="https://www.googletagmanager.com" />
//         ) : null}

//         {/* ── Critical brand asset (used by the splash screen) ── */}
//         <link
//           rel="preload"
//           href="/aurotap-mark.svg"
//           as="image"
//           type="image/svg+xml"
//           fetchPriority="high"
//         />

//         {/* ── Sitemap hint for crawlers (generated by app/sitemap.ts) ── */}
//         <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

//         {/* ── Structured data ── */}
//         <OrganizationJsonLd />
//         <WebSiteJsonLd />
//       </head>

//       <body
//         className="flex min-h-dvh flex-col bg-slate-50 font-sans antialiased"
//         style={{
//           // Works even if Tailwind's font-sans is not mapped yet.
//           fontFamily:
//             'var(--font-sans), var(--font-devanagari), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
//           WebkitTextSizeAdjust: '100%',
//           textRendering: 'optimizeLegibility',
//         }}
//         suppressHydrationWarning
//       >

//         {/* Scroll reveal: mounted once for the whole site */}
//         <ScrollReveal />

//         <LanguageProvider>
//           {/* Service Worker: silent, production-only offline support */}
//           <ServiceWorkerRegistration />

//           {/* OAuth / PKCE callback bridge */}
//           <AuthPkceBridge />

//           {/* Main application shell */}
//           <RootChrome>{children}</RootChrome>

//           {/* Toast notifications */}
//           <Toaster
//             position="bottom-center"
//             richColors
//             expand
//             closeButton
//             toastOptions={{
//               duration: 4000,
//               classNames: {
//                 toast: 'font-sans text-sm',
//                 title: 'font-semibold',
//                 description: 'text-xs opacity-80',
//               },
//             }}
//           />
//         </LanguageProvider>

//         {/* ── Google Analytics (only loads if NEXT_PUBLIC_GA_ID is set) ──
//             "afterInteractive" means it never slows down your first paint. */}
//         {GA_ID ? (
//           <>
//             <Script
//               src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
//               strategy="afterInteractive"
//             />
//             <Script id="ga-init" strategy="afterInteractive">
//               {`
//                 window.dataLayer = window.dataLayer || [];
//                 function gtag(){dataLayer.push(arguments);}
//                 gtag('js', new Date());
//                 gtag('config', '${GA_ID}', { anonymize_ip: true });
//               `}
//             </Script>
//           </>
//         ) : null}
//       </body>
//     </html>
//   );
// }

