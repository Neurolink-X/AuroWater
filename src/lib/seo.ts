import type { Metadata } from 'next';

export const APP_ORIGIN = 'https://aurotap.in';

export const BASE_META = {
  metadataBase: new URL(APP_ORIGIN),
  openGraph: { siteName: 'AuroWater', locale: 'en_IN', type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, site: '@AuroWater' },
};

export function pageMeta(title: string, description: string, path = '/'): Metadata {
  const url = `${APP_ORIGIN}${path}`;
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
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      ...BASE_META.twitter,
      title,
      description,
      images: ['/og-image.png'],
    },
  };
}
