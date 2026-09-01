import type { MetadataRoute } from 'next';

/**
 * Production-safe manifest: references only files that currently exist in /public.
 * This avoids runtime 404s such as /icons/icon-144x144.png.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AuroTap — Water Delivery',
    short_name: 'AuroTap',
    description: 'On-demand water delivery and plumber booking for Delhi & UP',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#070A12',
    theme_color: '#0D9B6C',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/splash-logo.svg',
        sizes: '400x400',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/og-image.png',
        sizes: '1200x630',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
