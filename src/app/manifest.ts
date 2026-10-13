import type { MetadataRoute } from 'next';

/**
 * src/app/manifest.ts
 *
 * Android builds its native splash screen from:
 *   background_color + the 512px icon + the app name.
 * It must match the in-app splash in layout.tsx (#F8FAFC) and the
 * viewport themeColor, or you see a colour jump while the app opens.
 */
const BRAND_LIGHT = '#F8FAFC';

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
    background_color: BRAND_LIGHT,
    theme_color: BRAND_LIGHT,

    categories: ['shopping', 'lifestyle', 'utilities', 'business'],
    prefer_related_applications: false,

    shortcuts: [
      {
        name: 'Book Water Delivery',
        short_name: 'Book',
        description: 'Order fresh water now',
        url: '/book?source=shortcut',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    ],

    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
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
