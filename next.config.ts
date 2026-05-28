import type { NextConfig } from 'next';

function buildConnectSrc(): string {
  const parts = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://aurotap.in',
    'https://www.aurotap.in',
    'https://*.vercel.app',
    'wss://*.vercel.app',
  ];
  if (process.env.NODE_ENV === 'development') {
    parts.push('http://localhost:3000', 'ws://localhost:3000', 'http://127.0.0.1:3000');
  }
  return parts.join(' ');
}

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      `connect-src ${buildConnectSrc()}`,
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['aurotap.in', 'www.aurotap.in', 'localhost:3000'],
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/customer/home', permanent: true },
      { source: '/dashboard/orders/:id', destination: '/customer/track/:id', permanent: true },
      { source: '/admin/login', destination: '/', permanent: false },
      { source: '/admin/register', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
