// import type { Metadata } from 'next';
// import './globals.css';
// import AuthPkceBridge from '@/components/auth/AuthPkceBridge';
// import RootChrome from '@/components/layout/RootChrome';
// import { LanguageProvider } from '@/lib/i18n/LanguageContext';
// import { Toaster } from 'sonner';

// const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aurowater.in';



// export const metadata: Metadata = {
//   metadataBase: new URL(APP_URL),
//   applicationName: 'AuroWater',
//   icons: {
//     icon: [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
//     apple: [{ url: '/splash-logo.svg', type: 'image/svg+xml', sizes: '400x400' }],
//   },
//   themeColor: [
//     { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
//     { media: '(prefers-color-scheme: dark)', color: '#0A2744' },
//   ],
//   appleWebApp: {
//     capable: true,
//     title: 'AuroWater',
//     statusBarStyle: 'default',
//   },
//   title: {
//     default: 'AuroWater — Pure Water & Plumber On Demand | Delhi & UP',
//     template: '%s | AuroWater',
//   },
//   description:
//     'On-demand water delivery ₹10–15/can + verified plumber booking for Delhi, Meerut & UP. ' +
//     'Fast, free delivery. Cash & UPI accepted.',
//   keywords: [
//     'water delivery',
//     'plumber booking',
//     'Delhi',
//     'UP',
//     'Meerut',
//     'AuroWater',
//     'पानी डिलीवरी',
//   ],
//   authors: [{ name: 'AuroWater', url: APP_URL }],
//   creator: 'AuroWater',
//   openGraph: {
//     type: 'website',
//     locale: 'en_IN',
//     url: APP_URL,
//     siteName: 'AuroWater',
//     title: 'AuroWater — Pure Water & Plumber On Demand',
//     description: 'Water delivery ₹10–15/can + verified plumbers. Delhi & UP.',
//     images: [
//       {
//         url: `${APP_URL}/og-image.png`,
//         width: 1200,
//         height: 630,
//         alt: 'AuroWater — Pure Water, At Your Door',
//       },
//     ],
//   },
//   twitter: {
//     card: 'summary_large_image',
//     title: 'AuroWater — Pure Water On Demand',
//     description: 'Water delivery + plumber booking for Delhi & UP.',
//     images: [`${APP_URL}/og-image.png`],
//   },
//   robots: {
//     index: true,
//     follow: true,
//     googleBot: { index: true, follow: true },
//   },
//   alternates: {
//     canonical: APP_URL,
//   },
// };

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en" suppressHydrationWarning>
//       <head>
//         <link rel="preconnect" href="https://fonts.googleapis.com" />
//         <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
//         <link
//           href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=Syne:wght@700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
//           rel="stylesheet"
//         />
//       </head>
//       <body className="min-h-screen flex flex-col bg-slate-50" suppressHydrationWarning>
//         <LanguageProvider>
//           <AuthPkceBridge />
//           <RootChrome>{children}</RootChrome>
//           <Toaster
//             position="top-right"
//             richColors
//             toastOptions={{
//               duration: 3000,
//             }}
//           />
//         </LanguageProvider>
//       </body>
//     </html>
//   );
// }



import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import AuthPkceBridge from '@/components/auth/AuthPkceBridge';
import RootChrome from '@/components/layout/RootChrome';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Toaster } from 'sonner';

/* ── Constants ────────────────────────────────────────────────────────── */

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL  ?? 'https://aurowater.in';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'AuroWater';

const OG_IMAGE = {
  url:    `${APP_URL}/og-image.png`,
  width:  1200,
  height: 630,
  alt:    'AuroWater — Pure Water Delivered to Your Door',
} as const;

/* ── Viewport (extracted per Next.js 16 requirement) ─────────────────── */
// Must be a separate export — cannot live inside `metadata` in Next.js 16.
export const viewport: Viewport = {
  width:               'device-width',
  initialScale:        1,
  maximumScale:        5,           // allow pinch-zoom — don't lock users out
  userScalable:        true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)',  color: '#0A2744' },
  ],
  colorScheme: 'light dark',
};

/* ── SEO Metadata ─────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  metadataBase:     new URL(APP_URL),
  applicationName:  APP_NAME,

  /* ── Favicon + Apple touch ──────────────────────────────────────────── */
  icons: {
    icon:      [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
    shortcut:  [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple:     [{ url: '/splash-logo.svg', type: 'image/svg+xml', sizes: '400x400' }],
    other:     [{ rel: 'mask-icon', url: '/favicon.svg', color: '#2563EB' }],
  },

  /* ── PWA ────────────────────────────────────────────────────────────── */
  manifest: '/manifest.json',
  appleWebApp: {
    capable:         true,
    title:           APP_NAME,
    statusBarStyle:  'default',
    startupImage:    [{ url: '/splash-logo.svg' }],
  },

  /* ── Titles ─────────────────────────────────────────────────────────── */
  title: {
    default:  `${APP_NAME} — Pure Water & Plumber On Demand | Delhi & UP`,
    template: `%s | ${APP_NAME}`,
  },

  /* ── Description + keywords ─────────────────────────────────────────── */
  description:
    'On-demand water delivery ₹10–15/can + verified plumber booking for Delhi, Meerut & UP. ' +
    'Fast, free delivery. Cash & UPI accepted.',
  keywords: [
    'water delivery', 'water can delivery', 'पानी डिलीवरी',
    'plumber booking', 'plumber near me', 'नल की मरम्मत',
    'RO service', 'borewell', 'tank cleaning',
    'Delhi', 'Meerut', 'Gorakhpur', 'UP', 'Uttar Pradesh',
    APP_NAME,
  ],
  authors:  [{ name: APP_NAME, url: APP_URL }],
  creator:  APP_NAME,
  publisher: APP_NAME,

  /* ── Open Graph ─────────────────────────────────────────────────────── */
  openGraph: {
    type:        'website',
    locale:      'en_IN',
    url:         APP_URL,
    siteName:    APP_NAME,
    title:       `${APP_NAME} — Pure Water & Plumber On Demand`,
    description: 'Water delivery ₹10–15/can + verified plumbers. Delhi & UP.',
    images:      [OG_IMAGE],
  },

  /* ── Twitter / X ────────────────────────────────────────────────────── */
  twitter: {
    card:        'summary_large_image',
    title:       `${APP_NAME} — Pure Water On Demand`,
    description: 'Water delivery + plumber booking for Delhi & UP.',
    images:      [OG_IMAGE.url],
    // site:     '@aurowater',   // add when you have a Twitter account
  },

  /* ── Robots ─────────────────────────────────────────────────────────── */
  robots: {
    index:     true,
    follow:    true,
    googleBot: {
      index:              true,
      follow:             true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  /* ── Canonical ───────────────────────────────────────────────────────── */
  alternates: {
    canonical:  APP_URL,
    languages:  {
      'en-IN': APP_URL,
      'hi-IN': `${APP_URL}/hi`,   // ready for when /hi locale is added
    },
  },

  /* ── Verification (add tokens when accounts are created) ─────────────── */
  verification: {
    // google:  'ADD_GOOGLE_SEARCH_CONSOLE_TOKEN',
    // yandex:  'ADD_YANDEX_TOKEN',
  },

  /* ── Category ────────────────────────────────────────────────────────── */
  category: 'utilities',
};

/* ── JSON-LD structured data ──────────────────────────────────────────── */
// LocalBusiness schema helps Google show rich results (address, hours, phone).
const jsonLd = {
  '@context':      'https://schema.org',
  '@type':         'LocalBusiness',
  name:            APP_NAME,
  description:     'On-demand water delivery and plumber booking platform for Delhi & UP, India.',
  url:             APP_URL,
  logo:            `${APP_URL}/splash-logo.svg`,
  image:           OG_IMAGE.url,
  telephone:       '+91-9889305803',
  email:           'support.aurotap@gmail.com',
  sameAs: [
    'https://wa.me/919889305803',
    // 'https://instagram.com/aurowater',
    // 'https://facebook.com/aurowater',
  ],
  address: {
    '@type':           'PostalAddress',
    addressLocality:   'Gorakhpur',
    addressRegion:     'Uttar Pradesh',
    addressCountry:    'IN',
  },
  geo: {
    '@type':    'GeoCoordinates',
    latitude:   26.7606,
    longitude:  83.3732,
  },
  openingHoursSpecification: [
    {
      '@type':     'OpeningHoursSpecification',
      dayOfWeek:   ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
      opens:       '06:00',
      closes:      '22:00',
    },
  ],
  areaServed: [
    { '@type': 'City', name: 'Gorakhpur' },
    { '@type': 'City', name: 'Delhi' },
    { '@type': 'City', name: 'Meerut' },
  ],
  priceRange:     '₹10–₹499',
  currenciesAccepted: 'INR',
  paymentAccepted:    'Cash, UPI, QR Code',
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Water & Plumbing Services',
    itemListElement: [
      {
        '@type':       'Offer',
        itemOffered:   { '@type': 'Service', name: '20L Water Can Delivery' },
        priceSpecification: {
          '@type':    'PriceSpecification',
          price:      12,
          priceCurrency: 'INR',
          minPrice:   10,
          maxPrice:   15,
        },
      },
      {
        '@type':     'Offer',
        itemOffered: { '@type': 'Service', name: 'Plumber Booking' },
        priceSpecification: {
          '@type':       'PriceSpecification',
          price:         250,
          priceCurrency: 'INR',
        },
      },
    ],
  },
} as const;

/* ── Mobile App schema ────────────────────────────────────────────────── */
// Helps Google index the web app as a mobile product.
const mobileAppLd = {
  '@context':       'https://schema.org',
  '@type':          'WebApplication',
  name:             APP_NAME,
  url:              APP_URL,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem:  'Any',
  offers: {
    '@type': 'Offer',
    price:   '0',
    priceCurrency: 'INR',
  },
} as const;

/* ── Root layout ──────────────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ── DNS prefetch for Supabase realtime + storage ── */}
        <link rel="dns-prefetch"    href="https://mwfcwhxdlnqldciigicl.supabase.co" />
        <link rel="preconnect"      href="https://mwfcwhxdlnqldciigicl.supabase.co" crossOrigin="anonymous" />

        {/* ── Google Fonts preconnect ── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com"    crossOrigin="anonymous" />

        {/* ── Font load (single request, swap prevents FOIT) ── */}
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

        {/* ── Critical resource preload hints ── */}
        <link rel="preload" href="/splash-logo.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/favicon.svg"     as="image" type="image/svg+xml" />

        {/* ── PWA meta that Next.js doesn't auto-emit ── */}
        <meta name="mobile-web-app-capable"       content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="format-detection"             content="telephone=yes,address=yes,email=yes" />
        {/* Prevent iOS from auto-linking phone numbers in unexpected places */}

        {/* ── JSON-LD structured data ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(mobileAppLd) }}
        />
      </head>

      <body className="min-h-screen flex flex-col bg-slate-50" suppressHydrationWarning>
        <LanguageProvider>
          {/*
           * AuthPkceBridge: picks up ?code= from OAuth/magic-link redirects
           * on the home page and forwards them to /auth/callback.
           * Must render before RootChrome so session is established first.
           */}
          <AuthPkceBridge />

          <RootChrome>{children}</RootChrome>

          {/*
           * Sonner toast container.
           * position="bottom-center" is more thumb-friendly on mobile than top-right.
           * expand=true shows all toasts stacked, not collapsed.
           */}
          <Toaster
            position="bottom-center"
            richColors
            expand
            closeButton
            toastOptions={{
              duration:   4000,
              classNames: {
                toast:       'font-sans text-sm',
                title:       'font-semibold',
                description: 'text-xs opacity-80',
              },
            }}
          />
        </LanguageProvider>

        {/*
         * Partytown / analytics would go here as next/script with strategy="lazyOnload".
         * Add Google Analytics / Clarity once tracking consent is implemented.
         *
         * Example (uncomment when ready):
         * <Script
         *   src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
         *   strategy="lazyOnload"
         * />
         */}
      </body>
    </html>
  );
}