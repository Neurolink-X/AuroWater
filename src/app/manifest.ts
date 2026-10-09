import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Unique, stable ID for the app (do not change after launch)
    id: '/?source=pwa',
    name: 'AuroTap – Fresh Water Delivery in UP',
    short_name: 'AuroTap',
    description:
      'Order 20L water cans and request plumbing, RO purifier repair, pump service and water tank cleaning in eligible areas of Kanpur, Lucknow and Gorakhpur.',
    lang: 'en-IN',
    dir: 'ltr',

    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',

    background_color: '#071A2B',
    theme_color: '#087EBD',

    categories: ['shopping', 'lifestyle', 'utilities', 'business'],
    prefer_related_applications: false,

    // Long-press the app icon on Android to get these shortcuts
    shortcuts: [
      {
        name: 'Book Water Delivery',
        short_name: 'Book',
        description: 'Order fresh water now',
        url: '/book?source=shortcut',

        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],

    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
