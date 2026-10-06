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

    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
