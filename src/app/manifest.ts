import type { MetadataRoute } from 'next';

const BRAND = '#0284C7';

export default function manifest(): MetadataRoute.Manifest {
  return {
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

    // Same colour as the in-app splash = no flash between the two screens
    background_color: BRAND,
    theme_color: BRAND,

    categories: ['shopping', 'lifestyle', 'utilities'],
    prefer_related_applications: false,

    // Long-press the app icon to jump straight to these
    shortcuts: [
      {
        name: 'Book Water Delivery',
        short_name: 'Book',
        description: 'Order fresh water now',
        url: '/book?source=shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'My Orders',
        short_name: 'Orders',
        description: 'Track your deliveries',
        url: '/orders?source=shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Home Services',
        short_name: 'Services',
        description: 'Plumbing, RO repair, tank cleaning',
        url: '/services?source=shortcut',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],

    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    // Gives the rich "App Store style" install popup on Android and desktop Chrome
    screenshots: [
      {
        src: '/screenshots/home-narrow.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Order water in 2 taps',
      },
      {
        src: '/screenshots/home-wide.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'AuroTap on desktop',
      },
    ],
  };
}









// import type { MetadataRoute } from 'next';

// export default function manifest(): MetadataRoute.Manifest {
//   return {
//     id: '/?source=pwa',
//     name: 'AuroTap – Fresh Water Delivery in UP',
//     short_name: 'AuroTap',
//     description:
//       'Order 20L water cans and request plumbing, RO purifier repair, pump service and water tank cleaning in eligible areas of Kanpur, Lucknow and Gorakhpur.',
//     lang: 'en-IN',
//     dir: 'ltr',

//     start_url: '/?source=pwa',
//     scope: '/',
//     display: 'standalone',
//     display_override: ['standalone', 'minimal-ui'],
//     orientation: 'portrait-primary',

//     background_color: '#0284C7',
//     theme_color: '#0284C7',

//     categories: ['shopping', 'lifestyle', 'utilities', 'business'],
//     prefer_related_applications: false,

//     shortcuts: [
//       {
//         name: 'Book Water Delivery',
//         short_name: 'Book',
//         description: 'Order fresh water now',
//         url: '/book?source=shortcut',
//         icons: [
//           {
//             src: '/icons/icon-192x192.png',
//             sizes: '192x192',
//             type: 'image/png',
//           },
//         ],
//       },
//     ],

//     icons: [
//       {
//         src: '/icons/icon-192x192.png',
//         sizes: '192x192',
//         type: 'image/png',
//         purpose: 'any',
//       },
//       {
//         src: '/icons/icon-512x512.png',
//         sizes: '512x512',
//         type: 'image/png',
//         purpose: 'any',
//       },
//       {
//         src: '/icons/icon-maskable-192x192.png',
//         sizes: '192x192',
//         type: 'image/png',
//         purpose: 'maskable',
//       },
//       {
//         src: '/icons/icon-maskable-512x512.png',
//         sizes: '512x512',
//         type: 'image/png',
//         purpose: 'maskable',
//       },
//     ],
//   };
// }
