import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Unique, stable ID for the app (do not change after launch)
    id: '/?source=pwa',
    name: 'AuroTap – Fresh Water Delivery in UP',
    short_name: 'AuroTap',
    description:
      'Book fresh drinking water delivery in Delhi & UP. Gorakhpur, Kanpur and Lucknow. Track orders, earn loyalty points and pay easily.',
    lang: 'en-IN',
    dir: 'ltr',

    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',

    background_color: '#FFFFFF',
    theme_color: '#06B6D4',

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
