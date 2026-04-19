import type { Metadata } from 'next';
import './globals.css';
import AuthPkceBridge from '@/components/auth/AuthPkceBridge';
import RootChrome from '@/components/layout/RootChrome';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Toaster } from 'sonner';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aurowater.in';



export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: 'AuroWater',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/splash-logo.svg', type: 'image/svg+xml', sizes: '400x400' }],
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0A2744' },
  ],
  appleWebApp: {
    capable: true,
    title: 'AuroWater',
    statusBarStyle: 'default',
  },
  title: {
    default: 'AuroWater — Pure Water & Plumber On Demand | Delhi & UP',
    template: '%s | AuroWater',
  },
  description:
    'On-demand water delivery ₹10–15/can + verified plumber booking for Delhi, Meerut & UP. ' +
    'Fast, free delivery. Cash & UPI accepted.',
  keywords: [
    'water delivery',
    'plumber booking',
    'Delhi',
    'UP',
    'Meerut',
    'AuroWater',
    'पानी डिलीवरी',
  ],
  authors: [{ name: 'AuroWater', url: APP_URL }],
  creator: 'AuroWater',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: APP_URL,
    siteName: 'AuroWater',
    title: 'AuroWater — Pure Water & Plumber On Demand',
    description: 'Water delivery ₹10–15/can + verified plumbers. Delhi & UP.',
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'AuroWater — Pure Water, At Your Door',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AuroWater — Pure Water On Demand',
    description: 'Water delivery + plumber booking for Delhi & UP.',
    images: [`${APP_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&family=Syne:wght@700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50">
        <LanguageProvider>
          <AuthPkceBridge />
          <RootChrome>{children}</RootChrome>
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              duration: 3000,
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  );
}
