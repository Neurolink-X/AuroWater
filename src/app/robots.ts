// import type { MetadataRoute } from 'next';
// import { getSiteUrl } from '@/lib/env';

// /**
//  * src/app/robots.ts
//  *
//  * How this works with the noindex metadata on the private layouts:
//  * robots.txt stops crawlers from VISITING a URL; it does not by itself remove a URL from results.
//  * Private pages (admin, customer, supplier, technician) are behind login and never linked
//  * publicly, so blocking them here is the right default. If a private URL ever shows up in search,
//  * temporarily allow crawling for it so Google can read its noindex tag, then block it again.
//  */

// const BASE_URL = getSiteUrl().replace(/\/+$/, '');

// /** Real production deployment only. Previews and staging must never be indexed. */
// const IS_PRODUCTION = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production';

// /**
//  * Extra safety for non-Vercel staging that also runs with NODE_ENV=production:
//  * set ALLOW_INDEXING=false there and the whole site is blocked.
//  */
// const ALLOW_INDEXING = IS_PRODUCTION && process.env.ALLOW_INDEXING !== 'false';

// /**
//  * Policy switch. When true, asks AI-training crawlers not to use the site. Normal search crawlers
//  * (Google, Bing) are not affected. Leave false unless the business decides otherwise.
//  */
// const BLOCK_AI_TRAINING_CRAWLERS = false;

// const AI_TRAINING_CRAWLERS = [
//   'GPTBot',
//   'Google-Extended',
//   'CCBot',
//   'ClaudeBot',
//   'anthropic-ai',
//   'Applebot-Extended',
//   'Bytespider',
//   'Meta-ExternalAgent',
// ];

// /**
//  * Private or non-public top-level routes.
//  * Each segment is blocked precisely: "/admin" and everything under "/admin/", but NOT a public page
//  * like "/administration-tips" or "/customers". (A bare "/customer" rule would block both.)
//  * If you serve public images from an API route, such as /api/og, add an explicit allow for it.
//  */
// const PRIVATE_SEGMENTS = [
//   'admin',
//   'customer',
//   'supplier',
//   'technician',
//   'dashboard',
//   'auth',
//   'login',
//   'signup',
//   'register',
//   'forgot-password',
//   'reset-password',
//   'verify',
//   'internal',
//   'private',
//   'api',
// ];

// const blockSegment = (segment: string) => [`/${segment}$`, `/${segment}/`];

// export default function robots(): MetadataRoute.Robots {
//   // Previews, staging and local builds: block everything and publish no sitemap.
//   if (!ALLOW_INDEXING) {
//     return { rules: [{ userAgent: '*', disallow: '/' }] };
//   }

//   return {
//     rules: [
//       {
//         userAgent: '*',
//         allow: '/',
//         // Note: /_next/ is intentionally NOT blocked. Google needs your JS and CSS to render pages,
//         // and blocking them can hurt how your public pages are understood and ranked.
//         disallow: PRIVATE_SEGMENTS.flatMap(blockSegment),
//       },
//       ...(BLOCK_AI_TRAINING_CRAWLERS ? [{ userAgent: AI_TRAINING_CRAWLERS, disallow: '/' }] : []),
//     ],
//     ...(BASE_URL ? { sitemap: `${BASE_URL}/sitemap.xml` } : {}),
//   };
// }








import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env';

const BASE_URL = getSiteUrl().replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],

        disallow: [
          // ==========================================================
          // PRIVATE APPLICATION AREAS
          // ==========================================================
          '/admin',
          '/admin/',
          '/customer',
          '/customer/',
          '/supplier',
          '/supplier/',
          '/technician',
          '/technician/',
          '/dashboard',
          '/dashboard/',

          // ==========================================================
          // AUTHENTICATION / ACCOUNT FLOWS
          // ==========================================================
          '/auth',
          '/auth/',
          '/login',
          '/login/',
          '/signup',
          '/signup/',
          '/register',
          '/register/',
          '/forgot-password',
          '/forgot-password/',
          '/reset-password',
          '/reset-password/',
          '/verify',
          '/verify/',

          // ==========================================================
          // API / INTERNAL ENDPOINTS
          // ==========================================================
          '/api',
          '/api/',

          // ==========================================================
          // INTERNAL / NON-PUBLIC APPLICATION ROUTES
          // ==========================================================
          '/internal',
          '/internal/',
          '/private',
          '/private/',
          '/_next/',
        ],
      },
    ],

//     sitemap: `${BASE_URL}/sitemap.xml`,
//   };
// }
