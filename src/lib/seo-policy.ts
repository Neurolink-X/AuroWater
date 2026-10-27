export type IndexingEnvironment = {
  vercelEnv?: string;
  nodeEnv?: string;
  allowIndexing?: string;
};

export type RobotsPolicy = {
  rules: Array<{
    userAgent: string;
    allow?: string | string[];
    disallow: string | string[];
  }>;
  sitemap?: string;
};

const PRIVATE_PATHS = [
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
  '/api',
  '/api/',
  '/internal',
  '/internal/',
  '/private',
  '/private/',
] as const;

/**
 * Only the actual Vercel production deployment may be indexed.
 * Preview builds and local/test environments fail closed by default.
 */
export function canIndexDeployment(environment: IndexingEnvironment): boolean {
  return (
    environment.vercelEnv === 'production' &&
    environment.nodeEnv === 'production' &&
    environment.allowIndexing !== 'false'
  );
}

/** Build robots rules without blocking Next.js assets needed to render public pages. */
export function createRobotsPolicy(
  canIndex: boolean,
  baseUrl: string,
): RobotsPolicy {
  if (!canIndex) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...PRIVATE_PATHS],
      },
    ],
    ...(baseUrl ? { sitemap: `${baseUrl.replace(/\\/+$/, '')}/sitemap.xml` } : {}),
  };
}
