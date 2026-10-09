import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",

      /*
       * Next.js / React
       */
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",

      /*
       * Styles + Google Fonts
       */
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",

      /*
       * Images
       */
      "img-src 'self' data: blob: https:",

      /*
       * Supabase + realtime
       */
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",

      /*
       * Prevent unexpected embedded content.
       */
      "object-src 'none'",
      "media-src 'self' https:",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  /*
   * Production performance
   */
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production',
  },

  /*
   * Do not expose Next.js version information.
   */
  poweredByHeader: false,

  /*
   * Modern image formats.
   *
   * Keep remote domains restricted to sources actually used
   * by the application.
   */
  images: {
    formats: ['image/avif', 'image/webp'],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mwfcwhxdlnqldciigicl.supabase.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },

  /*
   * Global security headers.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },

      /*
       * Web App Manifest
       */
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },

      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },

      /*
       * Public application settings.
       *
       * Only keep this public cache rule if the endpoint contains
       * non-sensitive public settings.
       */
      {
        source: '/api/settings',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },

  /*
   * Canonical URL migrations only.
   *
   * Never redirect admin authentication pages to the homepage.
   */
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/customer/home',
        permanent: true,
      },

      {
        source: '/dashboard/orders/:id',
        destination: '/customer/track/:id',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;









// import type { NextConfig } from 'next';

// const securityHeaders = [
//   { key: 'X-DNS-Prefetch-Control', value: 'on' },
//   { key: 'X-Frame-Options', value: 'DENY' },
//   { key: 'X-Content-Type-Options', value: 'nosniff' },
//   { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
//   {
//     key: 'Permissions-Policy',
//     value: 'camera=(), microphone=(), geolocation=(self)',
//   },
//   {
//     key: 'Content-Security-Policy',
//     value: [
//       "default-src 'self'",
//       "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com",
//       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
//       "font-src 'self' https://fonts.gstatic.com",
//       "img-src 'self' data: blob: https:",
//       "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
//       "frame-ancestors 'none'",
//     ].join('; '),
//   },
// ];

// const nextConfig: NextConfig = {
//   compiler: {
//     removeConsole: process.env.NODE_ENV === 'production',
//   },
//   images: {
//     formats: ['image/avif', 'image/webp'],
//     remotePatterns: [
//       {
//         protocol: 'https',
//         hostname: '**.supabase.co',
//         pathname: '/**',
//       },
//       {
//         protocol: 'https',
//         hostname: 'mwfcwhxdlnqldciigicl.supabase.co',
//         pathname: '/**',
//       },
//     ],
//   },
//   async headers() {
//     return [
//       {
//         source: '/(.*)',
//         headers: securityHeaders,
//       },
//       {
//         source: '/manifest.json',
//         headers: [
//           { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
//           { key: 'Cache-Control', value: 'public, max-age=3600' },
//         ],
//       },
//       {
//         source: '/manifest.webmanifest',
//         headers: [
//           { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' },
//           { key: 'Cache-Control', value: 'public, max-age=3600' },
//         ],
//       },
//       {
//         source: '/api/settings',
//         headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' }],
//       },
//     ];
//   },
//   async redirects() {
//     return [
//       { source: '/dashboard', destination: '/customer/home', permanent: true },
//       { source: '/dashboard/orders/:id', destination: '/customer/track/:id', permanent: true },
//       { source: '/admin/login', destination: '/', permanent: false },
//       { source: '/admin/register', destination: '/', permanent: false },
//     ];
//   },
// };

// export default nextConfig;
