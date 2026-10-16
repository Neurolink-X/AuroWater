import type { MetadataRoute } from 'next';

import { BRAND, LIVE_CITIES } from '@/app/(public)/services/services-data';

/**
 * src/app/manifest.ts
 *
 * Android builds its native splash screen from:
 *   background_color + the 512px icon + the app name.
 * It must match the in-app splash in layout.tsx (#F8FAFC) and the
 * viewport themeColor, or you see a colour jump while the app opens.
 *
 * Brand name and cities come from services-data.ts, so the app name,
 * the website titles and this file can never disagree.
 */
const BRAND_LIGHT = '#F8FAFC';

// "Kanpur, Lucknow and Gorakhpur"
const CITIES_AND =
  LIVE_CITIES.length > 1
    ? `${LIVE_CITIES.slice(0, -1).join(', ')} and ${LIVE_CITIES[LIVE_CITIES.length - 1]}`
    : LIVE_CITIES.join('');

const ICON_192 = { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' } as const;

// Where the installed app opens. The default is the home page, exactly as before.
// Returning customers open a lighter page faster: set NEXT_PUBLIC_PWA_START_PATH=/book in .env.
// Must be a path on your own site (starts with "/"), anything else falls back to "/".
const RAW_START = process.env.NEXT_PUBLIC_PWA_START_PATH?.trim() || '/';
const START_PATH = RAW_START.startsWith('/') && !RAW_START.startsWith('//') ? RAW_START : '/';
const START_URL = `${START_PATH}${START_PATH.includes('?') ? '&' : '?'}source=pwa`;

// Long-press the app icon on Android to see these. ?source=shortcut lets you count how often they are used.
const shortcut = (name: string, short_name: string, description: string, url: string) => ({
  name,
  short_name,
  description,
  url: `${url}${url.includes('?') ? '&' : '?'}source=shortcut`,
  icons: [ICON_192],
});

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Keep this value unchanged: browsers use it to recognise the installed app.
    id: '/?source=pwa',
    name: `${BRAND} – Fresh Water Delivery in UP`,
    short_name: BRAND,
    description: `Order 20L water cans and request plumbing, RO purifier repair, pump service and water tank cleaning in eligible areas of ${CITIES_AND}.`,
    lang: 'en-IN',
    dir: 'ltr',

    start_url: START_URL,
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    // 'portrait' (not 'portrait-primary') also allows an upside-down phone and does not trap tablet users
    orientation: 'portrait',

    // Same colour as the in-app splash = no flash between the two screens
    background_color: BRAND_LIGHT,
    theme_color: BRAND_LIGHT,

    categories: ['shopping', 'lifestyle', 'utilities', 'business'],
    prefer_related_applications: false,

    shortcuts: [
      shortcut('Order 20L Water', '20L Water', 'Order drinking water cans', '/book?service=water_can'),
      shortcut('Book a Plumber', 'Plumber', 'Leaks, taps and pipe repair', '/book?service=plumbing'),
      shortcut('RO Service & Repair', 'RO Service', 'Filter change and purifier repair', '/book?service=ro_service'),
      shortcut('All Services', 'Services', 'See every water and home service', '/services'),
    ],

    icons: [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}












// import type { MetadataRoute } from 'next';

// /**
//  * src/app/manifest.ts
//  *
//  * Android builds its native splash screen from:
//  *   background_color + the 512px icon + the app name.
//  * It must match the in-app splash in layout.tsx (#F8FAFC) and the
//  * viewport themeColor, or you see a colour jump while the app opens.
//  */
// const BRAND_LIGHT = '#F8FAFC';

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

//     // Same colour as the in-app splash = no flash between the two screens
//     background_color: BRAND_LIGHT,
//     theme_color: BRAND_LIGHT,

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


















