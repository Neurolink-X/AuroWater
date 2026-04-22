// import type { MetadataRoute } from 'next';

// export default function manifest(): MetadataRoute.Manifest {
//   return {
//     name: 'AuroWater — Water & Plumber On Demand',
//     short_name: 'AuroWater',
//     description: 'Water delivery and verified plumber booking for Delhi & UP.',
//     start_url: '/',
//     scope: '/',
//     display: 'standalone',
//     background_color: '#F8FAFC',
//     theme_color: '#0A2744',
//     icons: [
//       {
//         src: '/favicon.svg',
//         sizes: 'any',
//         type: 'image/svg+xml',
//         purpose: 'any',
//       },
//       {
//         src: '/splash-logo.svg',
//         sizes: '400x400',
//         type: 'image/svg+xml',
//         purpose: 'maskable',
//       },
//       {
//         src: '/og-image.png',
//         sizes: '1200x630',
//         type: 'image/png',
//         purpose: 'any',
//       },
//     ],
//   };
// }


import type { MetadataRoute } from 'next';

/**
 * AuroTap — Web App Manifest
 * PWA-ready, optimised for Android Chrome, iOS Safari, Windows PWA, and
 * Google Play (Trusted Web Activity). Covers all icon sizes, display modes,
 * share-target, shortcuts, and screenshots for a world-class install experience.
 *
 * 📍 Place this file at:  app/manifest.ts
 * 📚 Spec: https://developer.mozilla.org/en-US/docs/Web/Manifest
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    /* ─────────────────────────────────────────────
       IDENTITY
    ───────────────────────────────────────────── */
    name: 'AuroTap — Water & Plumber On Demand',
    short_name: 'AuroTap',
    description:
      'Book water delivery & verified plumbers in seconds. Same-day service across Delhi & UP. Tap once — sorted.',

    /* ─────────────────────────────────────────────
       URLS
    ───────────────────────────────────────────── */
    id: 'https://aurotap.in/',           // Unique app identity (prevents duplicates)
    start_url: '/?source=pwa',          // Track installs separately in analytics
    scope: '/',

    /* ─────────────────────────────────────────────
       DISPLAY & ORIENTATION
    ───────────────────────────────────────────── */
    display: 'standalone',              // Hides browser chrome — feels native
    display_override: [
      'window-controls-overlay',       // Desktop PWA: custom title bar
      'standalone',
      'minimal-ui',
    ],
    orientation: 'portrait-primary',

    /* ─────────────────────────────────────────────
       BRANDING & COLOURS
    ───────────────────────────────────────────── */
    background_color: '#020D1A',        // Splash screen bg (matches dark theme)
    theme_color: '#0EA5E9',             // Browser toolbar / status bar colour

    /* ─────────────────────────────────────────────
       LANGUAGE & REGION
    ───────────────────────────────────────────── */
    lang: 'en-IN',
    dir: 'ltr',

    /* ─────────────────────────────────────────────
       ICONS
       Full set: small → large, maskable for Android
       adaptive icons, monochrome for notification badges.

       ⚠️  Generate PNG icons from your SVGs using:
           https://realfavicongenerator.net
           or: npx pwa-asset-generator splash-logo.svg ./public/icons
    ───────────────────────────────────────────── */
    icons: [
      // ── Favicon / tab icon (SVG — modern browsers)
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },

      // ── Android home screen (standard)
      { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },

      // ── Maskable (Android adaptive icon — fills the safe zone)
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

      // ── Monochrome (notification badge, Windows taskbar)
      {
        src: '/icons/icon-monochrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'monochrome',
      },

      // ── Apple touch icon (iOS Safari Add to Home Screen)
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],

    /* ─────────────────────────────────────────────
       SPLASH SCREENS / SCREENSHOTS
       Shown in the PWA install sheet on Chrome Android.
       Wide = desktop/tablet, Narrow = mobile.
    ───────────────────────────────────────────── */
    screenshots: [
      {
        src: '/screenshots/mobile-home.png',
        sizes: '390x844',
       
        form_factor: 'narrow',
        type: 'image/png',
        label: 'Home — Book water or a plumber in one tap',
      },
      {
        src: '/screenshots/mobile-booking.png',
        sizes: '390x844',
     
        form_factor: 'narrow',
        type: 'image/png',
        label: 'Booking — Choose time slot & address',
      },
      {
        src: '/screenshots/desktop-dashboard.png',
        sizes: '1280x800',
       
        form_factor: 'wide',
        type: 'image/png',
        label: 'Dashboard — Track all your orders',
      },
    ],

    /* ─────────────────────────────────────────────
       APP SHORTCUTS
       Long-press the home screen icon on Android
       to jump directly to key features.
    ───────────────────────────────────────────── */
    
    shortcuts: [
      {
        name: 'Order Water',
        short_name: 'Water',
        description: 'Place a same-day water delivery order',
        url: '/order/water?source=shortcut',
        icons: [{ src: '/icons/shortcut-water.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'Book Plumber',
        short_name: 'Plumber',
        description: 'Book a verified plumber near you',
        url: '/order/plumber?source=shortcut',
        icons: [{ src: '/icons/shortcut-plumber.png', sizes: '96x96', type: 'image/png' }],
      },
      {
        name: 'My Orders',
        short_name: 'Orders',
        description: 'Track and manage your active orders',
        url: '/account/orders?source=shortcut',
        icons: [{ src: '/icons/shortcut-orders.png', sizes: '96x96', type: 'image/png' }],
      },
    ],

    /* ─────────────────────────────────────────────
       SHARE TARGET
       Lets users share content FROM other apps
       directly INTO AuroTap (e.g. share a location).
    ───────────────────────────────────────────── */
    
    share_target: {
      action: '/share-target',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
      },
    },

    /* ─────────────────────────────────────────────
       PROTOCOL HANDLERS
       Lets aurotap:// deep links open the PWA directly.
    ───────────────────────────────────────────── */
    
    protocol_handlers: [
      {
        protocol: 'web+aurotap',
        url: '/?uri=%s',
      },
    ],

    /* ─────────────────────────────────────────────
       CATEGORIES
       Helps app stores & discovery engines classify your PWA.
    ───────────────────────────────────────────── */
   
    categories: ['utilities', 'lifestyle', 'shopping', 'productivity'],

    /* ─────────────────────────────────────────────
       RELATED APPS
       Link to your native apps (if/when you publish them).
       Browsers will suggest the native app over the PWA
       if prefer_related_applications = true.
    ───────────────────────────────────────────── */
    prefer_related_applications: false, // Keep false — prefer PWA install
    // related_applications: [
    //   { platform: 'play', url: 'https://play.google.com/store/apps/details?id=in.aurotap', id: 'in.aurotap' },
    //   { platform: 'itunes', url: 'https://apps.apple.com/app/aurotap/id000000000' },
    // ],
  };
}