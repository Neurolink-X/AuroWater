import type { Metadata } from 'next';
import './globals.css';
import RootChrome from '@/components/layout/RootChrome';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Toaster } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';

export const metadata: Metadata = {
  title: 'AuroWater - Premium Water Supply & Services',
  description:
    'Home water supply, submersible installation, and repair services. Book online with transparent pricing.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
