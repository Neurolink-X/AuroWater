import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/env';

export const APP_ORIGIN = getSiteUrl();

export const BASE_META: Pick<Metadata, 'metadataBase' | 'openGraph' | 'twitter'> = {
  metadataBase: new URL(APP_ORIGIN),
  openGraph: {
    siteName: 'AuroWater',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export function pageMeta(
  title: string,
  description: string,
  path = '/',
): Metadata {
  const url = new URL(path, APP_ORIGIN).toString();

  return {
    ...BASE_META,
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...BASE_META.openGraph,
      title,
      description,
      url,
      images: [
        {
          url: new URL('/og-image.png', APP_ORIGIN).toString(),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      ...BASE_META.twitter,
      title,
      description,
      images: [new URL('/og-image.png', APP_ORIGIN).toString()],
    },
  };
}
