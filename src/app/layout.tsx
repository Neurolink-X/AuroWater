import type { Metadata } from 'next';
import './globals.css';
import RootChrome from '@/components/layout/RootChrome';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Toaster } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';

const site =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: 'AuroWater - Premium Water Supply & Services',
  description:
    'Home water supply, submersible installation, and repair services. Book online with transparent pricing.',
  openGraph: {
    title: 'AuroWater — Pure water, at your door',
    description: 'Book water delivery, RO service, plumbing, and more across UP.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AuroWater — Pure Water Delivered',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
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
          <AnnouncementBar />
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
