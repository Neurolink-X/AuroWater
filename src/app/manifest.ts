import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AuroWater — Water & Plumber On Demand',
    short_name: 'AuroWater',
    description: 'Water delivery and verified plumber booking for Delhi & UP.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#0A2744',
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
        purpose: 'maskable',
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
