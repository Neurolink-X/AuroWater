import { NextResponse, type NextRequest } from 'next/server';

/**
 * AuroWater — Edge Proxy
 *
 * Responsibilities:
 * 1. Allow public/SEO routes without authentication
 * 2. Keep application APIs out of browser-login redirects
 * 3. Protect private application routes
 * 4. Keep Admin authentication completely separate in the URL
 * 5. Enforce role-based browser routing
 * 6. Smart /dashboard routing
 * 7. Apply security headers
 * 8. Sanitize returnTo to prevent open redirects
 *
 * IMPORTANT:
 * Cookie-based routing here is NOT the authoritative security layer.
 * API route handlers must still verify the Supabase session and role
 * server-side.
 *
 * Session cookies:
 *   aw_session = '1'
 *   aw_role    = '<role>'
 *
 * Edge-safe:
 *   Only next/server APIs are used.
 */

type AuthRole =
  | 'customer'
  | 'technician'
  | 'supplier'
  | 'admin';

interface SessionData {
  authenticated: boolean;
  role: AuthRole | null;
}

/* ================================================================
   PUBLIC ROUTES
   ================================================================ */

/**
 * Exact public pages.
 *
 * These pages must never require authentication.
 */
const PUBLIC_EXACT: ReadonlySet<string> = new Set([
  /* Core public pages */
  '/',
  '/services',
  '/pricing',
  '/how-it-works',
  '/contact',
  '/about',
  '/technicians',
  '/book',

  /* Public SEO landing pages */
  '/water-delivery',
  '/water-can-delivery',
  '/water-tanker-delivery',
  '/tanker-water-delivery',
  '/plumber',
  '/borewell',
  '/submersible-pump',
  '/motor-repair',
  '/ro-service',
  '/tank-cleaning',

  /* Kanpur SEO pages */
  '/kanpur',
  '/kanpur/water-delivery',
  '/kanpur/kalyanpur',
  '/kanpur/kakadeo',
  '/kanpur/barra',
  '/kanpur/swaroop-nagar',

  /* Public content */
  '/blog',
  '/reviews',
  '/faq',
  '/careers',
  '/cookies',
  '/security',
  '/privacy',
  '/terms',
  '/offline',

  /* General authentication */
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
  '/auth/verify',
  '/auth/otp',
  '/auth/update-password',

  /* Legacy auth URLs */
  '/login',
  '/register',
  '/register/pending',
  '/register/pro',

  /* ADMIN authentication */
  '/admin/login',
  '/admin/register',
  '/admin/forgot-password',

  /* PWA / system */
  '/manifest.json',
  '/manifest.webmanifest',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
]);

/**
 * Public prefixes.
 *
 * APIs are intentionally allowed through the proxy.
 * Their individual route handlers perform real authentication.
 */
const PUBLIC_PREFIXES: readonly string[] = [
  /* Public APIs */
  '/api/auth/',
  '/api/settings',
  '/api/services',
  '/api/contact',
  '/api/founding-members',

  /*
   * Protected APIs.
   *
   * DO NOT redirect these requests to /auth/login.
   *
   * Server route handlers must return JSON 401/403.
   */
  '/api/customer/',
  '/api/admin/',
  '/api/supplier/',
  '/api/technician/',
  '/api/seller/',
  '/api/agent/',

  /* Public content */
  '/blog/',
  '/images/',
  '/icons/',
  '/fonts/',
  '/_next/',
];

/* ================================================================
   ROLE GUARDS
   ================================================================ */

const ROLE_GUARDS: ReadonlyArray<{
  prefix: string;
  allowed: readonly AuthRole[];
  fallback: string;
}> = [
  {
    prefix: '/admin',
    allowed: ['admin'],
    fallback: '/admin/login',
  },
  {
    prefix: '/seller',
    allowed: ['supplier', 'admin'],
    fallback: '/customer/home',
  },
  {
    prefix: '/supplier',
    allowed: ['supplier', 'admin'],
    fallback: '/customer/home',
  },
  {
    prefix: '/agent',
    allowed: ['technician', 'admin'],
    fallback: '/customer/home',
  },
  {
    prefix: '/technician',
    allowed: ['technician', 'admin'],
    fallback: '/customer/home',
  },
  {
    prefix: '/customer',
    allowed: ['customer', 'supplier', 'technician', 'admin'],
    fallback: '/auth/login',
  },
];

/**
 * Role → default dashboard.
 */
const ROLE_DASHBOARD: Record<AuthRole, string> = {
  admin: '/admin/dashboard',
  supplier: '/supplier/dashboard',
  technician: '/technician/dashboard',
  customer: '/customer/home',
};

/* ================================================================
   SECURITY HEADERS
   ================================================================ */

const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  /* Clickjacking protection */
  ['X-Frame-Options', 'SAMEORIGIN'],

  /* MIME sniffing protection */
  ['X-Content-Type-Options', 'nosniff'],

  /* Referrer privacy */
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],

  /* Browser permissions */
  [
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)',
  ],

  /* Remove framework/server fingerprint */
  ['X-Powered-By', ''],

  /*
   * HSTS.
   *
   * Keep this only when all production subdomains are HTTPS.
   */
  [
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  ],

  /* Legacy browser XSS protection */
  ['X-XSS-Protection', '1; mode=block'],
];

/* ================================================================
   HELPERS
   ================================================================ */

/**
 * Read browser routing session.
 *
 * IMPORTANT:
 * These cookies are NOT trusted for API authorization.
 * API routes independently verify Supabase authentication.
 */
function readSession(request: NextRequest): SessionData {
  const sessionCookie = request.cookies.get('aw_session')?.value;
  const roleCookie = request.cookies.get('aw_role')?.value;

  if (sessionCookie !== '1') {
    return {
      authenticated: false,
      role: null,
    };
  }

  let rawRole = '';

  try {
    rawRole = roleCookie
      ? decodeURIComponent(roleCookie).trim().toLowerCase()
      : '';
  } catch {
    rawRole = roleCookie?.trim().toLowerCase() ?? '';
  }

  const validRoles: readonly string[] = [
    'customer',
    'technician',
    'supplier',
    'admin',
  ];

  const role = validRoles.includes(rawRole)
    ? (rawRole as AuthRole)
    : null;

  return {
    authenticated: role !== null,
    role,
  };
}

/**
 * Prevent open redirect attacks.
 *
 * Only same-origin relative paths are accepted.
 */
function sanitizeReturnTo(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);

    /* Must be a local path */
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//')
    ) {
      return null;
    }

    /* Block control characters */
    if (/[\x00-\x1f]/.test(decoded)) {
      return null;
    }

    /* Reasonable length limit */
    if (decoded.length > 500) {
      return null;
    }

    /* Prevent auth redirect loops */
    if (
      decoded.startsWith('/auth/') ||
      decoded.startsWith('/admin/login') ||
      decoded === '/dashboard'
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decide which login page should be used.
 *
 * Admin/private admin routes must never fall back
 * to the normal customer login.
 */
function getLoginPath(pathname: string): string {
  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  ) {
    return '/admin/login';
  }

  return '/auth/login';
}

/**
 * Redirect to the correct login page.
 */
function redirectToLogin(
  request: NextRequest,
  pathname: string
): NextResponse {
  const url = request.nextUrl.clone();

  url.pathname = getLoginPath(pathname);

  const returnTo = sanitizeReturnTo(
    pathname + request.nextUrl.search
  );

  if (
    returnTo &&
    returnTo !== '/' &&
    returnTo !== '/auth/login' &&
    returnTo !== '/admin/login'
  ) {
    url.searchParams.set('returnTo', returnTo);
  }

  return addSecurityHeaders(
    NextResponse.redirect(url)
  );
}

/**
 * Redirect to the correct dashboard.
 */
function redirectToDashboard(
  request: NextRequest,
  role: AuthRole
): NextResponse {
  const destination =
    ROLE_DASHBOARD[role] ?? '/customer/home';

  const url = new URL(
    destination,
    request.url
  );

  return addSecurityHeaders(
    NextResponse.redirect(url)
  );
}

/**
 * Apply security headers.
 */
function addSecurityHeaders(
  response: NextResponse
): NextResponse {
  for (const [key, value] of SECURITY_HEADERS) {
    if (value) {
      response.headers.set(key, value);
    } else {
      response.headers.delete(key);
    }
  }

  return response;
}

/**
 * Find applicable role guard.
 */
function findRoleGuard(pathname: string) {
  return (
    ROLE_GUARDS.find(
      (guard) =>
        pathname === guard.prefix ||
        pathname.startsWith(
          `${guard.prefix}/`
        )
    ) ?? null
  );
}

/**
 * Determine whether the request is public.
 */
function isPublicPath(
  pathname: string
): boolean {
  /* Exact route */
  if (PUBLIC_EXACT.has(pathname)) {
    return true;
  }

  /* Prefix route */
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }

  /*
   * Static assets.
   *
   * These should never trigger authentication redirects.
   */
  const extension =
    pathname
      .split('.')
      .pop()
      ?.toLowerCase() ?? '';

  const STATIC_EXTENSIONS = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'svg',
    'ico',
    'avif',
    'woff',
    'woff2',
    'ttf',
    'otf',
    'eot',
    'css',
    'js',
    'map',
    'json',
    'webmanifest',
    'txt',
    'xml',
    'pdf',
    'mp4',
    'webm',
  ]);

  return STATIC_EXTENSIONS.has(extension);
}

/* ================================================================
   MAIN PROXY
   ================================================================ */

export function proxy(
  request: NextRequest
): NextResponse {
  const { pathname } = request.nextUrl;

  /* --------------------------------------------------------------
     1. Public / SEO / API / assets
     -------------------------------------------------------------- */
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(
      NextResponse.next()
    );
  }

  /* --------------------------------------------------------------
     2. Read browser session
     -------------------------------------------------------------- */
  const session = readSession(request);

  /* --------------------------------------------------------------
     3. Authentication
     -------------------------------------------------------------- */
  if (
    !session.authenticated ||
    !session.role
  ) {
    return redirectToLogin(
      request,
      pathname
    );
  }

  const { role } = session;

  /* --------------------------------------------------------------
     4. Smart /dashboard
     -------------------------------------------------------------- */
  if (
    pathname === '/dashboard' ||
    pathname === '/dashboard/'
  ) {
    return redirectToDashboard(
      request,
      role
    );
  }

  /* --------------------------------------------------------------
     5. Role authorization
     -------------------------------------------------------------- */
  const guard =
    findRoleGuard(pathname);

  if (guard) {
    const hasAccess =
      role === 'admin' ||
      guard.allowed.includes(role);

    if (!hasAccess) {
      /*
       * Admin pages should never be used as a
       * fallback for another role.
       */
      const fallback =
        ROLE_DASHBOARD[role] ??
        guard.fallback;

      const url = new URL(
        fallback,
        request.url
      );

      return addSecurityHeaders(
        NextResponse.redirect(url)
      );
    }
  }

  /* --------------------------------------------------------------
     6. Everything passed
     -------------------------------------------------------------- */
  return addSecurityHeaders(
    NextResponse.next()
  );
}

/* ================================================================
   MATCHER
   ================================================================ */

export const config = {
  matcher: [
    /*
     * Process application routes.
     *
     * Exclude:
     * - Next.js static files
     * - Next.js image optimizer
     * - common static assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|otf|eot|css|js|map|txt|xml|pdf|mp4|webm)$).*)',
  ],
};









// import { NextResponse, type NextRequest } from 'next/server';

// /**
//  * AuroWater — Edge Middleware (proxy.ts)
//  *
//  * Responsibilities (in execution order):
//  *   1. Allow public routes without any auth check
//  *   2. Enforce authentication — redirect to login if no valid session
//  *   3. Enforce role-based access — redirect to own dashboard if wrong role
//  *   4. Smart /dashboard redirect → role-appropriate page
//  *   5. Add security headers on every response
//  *   6. Sanitize returnTo to prevent open-redirect attacks
//  *
//  * Session contract (set by useAuth + setAuthGateCookies after login):
//  *   aw_session = '1'            (presence = authenticated)
//  *   aw_role    = '<role>'       (URL-encoded role string)
//  *
//  * Edge-only: only next/server imports — no Node.js, no crypto, no @/ aliases.
//  */

// /* ═══════════════════════════════════════════════════════════════
//    TYPES
// ═══════════════════════════════════════════════════════════════ */

// type AuthRole = 'customer' | 'technician' | 'supplier' | 'admin';

// interface SessionData {
//   authenticated: boolean;
//   role: AuthRole | null;
// }

// /* ═══════════════════════════════════════════════════════════════
//    ROUTE CONFIGURATION
// ═══════════════════════════════════════════════════════════════ */

// /**
//  * Routes that never require authentication.
//  * Exact matches AND prefix matches (paths ending in /) are checked.
//  */
// const PUBLIC_EXACT: Set<string> = new Set([
//   '/',
//   '/services',
//   '/pricing',
//   '/how-it-works',
//   '/contact',
//   '/about',
//   '/technicians',
//   '/book',
//   '/auth/login',
//   '/auth/register',
//   '/auth/forgot-password',
//   '/auth/reset-password',
//   '/auth/callback',       // OAuth return URL — MUST be public
//   '/auth/verify',
//   '/login',
//   '/register',
//   '/register/pending',
//   '/auth/otp',
//   '/auth/update-password',
//   '/manifest.json',
//   '/manifest.webmanifest',
//   '/cookies',
//   '/security',
//   '/careers',
//   '/offline',
//   '/register/pro',
//   '/privacy',
//   '/terms',
//   '/sitemap.xml',
//   '/robots.txt',
//   '/favicon.ico',
// ]);

// const PUBLIC_PREFIXES: readonly string[] = [
//   /*
//    * Public APIs
//    */
//   '/api/auth/',
//   '/api/settings',
//   '/api/services',
//   '/api/contact',
//   '/api/founding-members',

//   /*
//    * Protected application APIs.
//    *
//    * These must pass through the proxy without a browser-login redirect
//    * because the individual API route handlers authenticate the request
//    * using the Supabase session / Bearer token.
//    *
//    * IMPORTANT:
//    * Never redirect API requests to /auth/login.
//    * API routes must return JSON 401/403 responses instead.
//    */
//   '/api/customer/',
//   '/api/admin/',
//   '/api/supplier/',
//   '/api/technician/',
//   '/api/seller/',
//   '/api/agent/',

//   /*
//    * Public application assets/routes
//    */
//   '/blog/',
//   '/_next/',
//   '/images/',
//   '/icons/',
//   '/fonts/',
// ];

// /**
//  * Which roles are allowed to access each protected prefix.
//  * Admin always passes every role check (superuser).
//  */
// const ROLE_GUARDS: ReadonlyArray<{
//   prefix: string;
//   allowed: readonly AuthRole[];
//   fallback: string;       // where to redirect if wrong role
// }> = [
//   {
//     prefix:   '/admin',
//     allowed:  ['admin'],
//     fallback: '/customer/home',
//   },
//   {
//     prefix:   '/seller',
//     allowed:  ['supplier', 'admin'],
//     fallback: '/customer/home',
//   },
//   {
//     prefix:   '/supplier',
//     allowed:  ['supplier', 'admin'],
//     fallback: '/customer/home',
//   },
//   {
//     prefix:   '/agent',
//     allowed:  ['technician', 'admin'],
//     fallback: '/customer/home',
//   },
//   {
//     prefix:   '/technician',
//     allowed:  ['technician', 'admin'],
//     fallback: '/customer/home',
//   },
//   {
//     prefix:   '/customer',
//     allowed:  ['customer', 'supplier', 'technician', 'admin'],
//     fallback: '/auth/login',
//   },
// ];

// /**
//  * After successful login, where should each role go?
//  */
// const ROLE_DASHBOARD: Record<AuthRole, string> = {
//   admin:      '/admin/dashboard',
//   supplier:   '/supplier/dashboard',
//   technician: '/technician/dashboard',
//   customer:   '/customer/home',
// };

// /* ═══════════════════════════════════════════════════════════════
//    SECURITY HEADERS
//    Applied to every response — both authenticated and public.
// ═══════════════════════════════════════════════════════════════ */

// const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
//   // Prevent clickjacking
//   ['X-Frame-Options', 'SAMEORIGIN'],
//   // Prevent MIME sniffing
//   ['X-Content-Type-Options', 'nosniff'],
//   // Strict referrer
//   ['Referrer-Policy', 'strict-origin-when-cross-origin'],
//   // Disable FLoC/Topics
//   ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)'],
//   // Remove server fingerprint
//   ['X-Powered-By', ''],
//   // HSTS (only meaningful over HTTPS but harmless in dev)
//   ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
//   // XSS protection (legacy IE — harmless on modern browsers)
//   ['X-XSS-Protection', '1; mode=block'],
// ];

// /* ═══════════════════════════════════════════════════════════════
//    HELPERS
// ═══════════════════════════════════════════════════════════════ */

// /** Parse session from cookies. Returns null if missing or invalid. */
// function readSession(request: NextRequest): SessionData {
//   const sessionCookie = request.cookies.get('aw_session')?.value;
//   const roleCookie    = request.cookies.get('aw_role')?.value;

//   if (sessionCookie !== '1') {
//     return { authenticated: false, role: null };
//   }

//   let rawRole = '';
//   try {
//     rawRole = roleCookie ? decodeURIComponent(roleCookie).trim().toLowerCase() : '';
//   } catch {
//     rawRole = roleCookie?.trim().toLowerCase() ?? '';
//   }

//   const VALID_ROLES: readonly string[] = ['customer', 'technician', 'supplier', 'admin'];
//   const role = VALID_ROLES.includes(rawRole)
//     ? (rawRole as AuthRole)
//     : null;

//   return {
//     authenticated: role !== null,
//     role,
//   };
// }

// /**
//  * Sanitize a returnTo URL to prevent open-redirect attacks.
//  * Only allows same-origin relative paths.
//  */
// function sanitizeReturnTo(raw: string | null): string | null {
//   if (!raw) return null;

//   try {
//     const decoded = decodeURIComponent(raw);

//     // Must start with / (relative) and not be a protocol-relative URL (//)
//     if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;

//     // Block null bytes, special characters that could cause issues
//     if (/[\x00-\x1f]/.test(decoded)) return null;

//     // Max length sanity check
//     if (decoded.length > 500) return null;

//     // Don't return to auth pages (prevents redirect loop)
//     if (decoded.startsWith('/auth/') || decoded === '/dashboard') return null;

//     return decoded;
//   } catch {
//     return null;
//   }
// }

// /** Build a redirect response to the login page. */
// function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
//   const url = request.nextUrl.clone();
//   url.pathname = '/auth/login';

//   // Preserve the original path so login can redirect back
//   const returnTo = pathname + request.nextUrl.search;
//   if (returnTo !== '/' && returnTo !== '/auth/login') {
//     url.searchParams.set('returnTo', returnTo);
//   }

//   return addSecurityHeaders(NextResponse.redirect(url));
// }

// /** Build a redirect to a role-appropriate dashboard. */
// function redirectToDashboard(request: NextRequest, role: AuthRole): NextResponse {
//   const dest = ROLE_DASHBOARD[role] ?? '/customer/home';
//   const url  = new URL(dest, request.url);
//   return addSecurityHeaders(NextResponse.redirect(url));
// }

// /** Apply security headers to any NextResponse. */
// function addSecurityHeaders(response: NextResponse): NextResponse {
//   for (const [key, value] of SECURITY_HEADERS) {
//     if (value) {
//       response.headers.set(key, value);
//     } else {
//       response.headers.delete(key);
//     }
//   }
//   return response;
// }

// /** Find which role guard applies to this pathname (if any). */
// function findRoleGuard(pathname: string) {
//   return ROLE_GUARDS.find(
//     (g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`)
//   ) ?? null;
// }

// /** Is this pathname public (no auth required)? */
// function isPublicPath(pathname: string): boolean {
//   if (PUBLIC_EXACT.has(pathname)) return true;

//   for (const prefix of PUBLIC_PREFIXES) {
//     if (pathname.startsWith(prefix)) return true;
//   }

//   // Static asset extensions
//   const ext = pathname.split('.').pop()?.toLowerCase() ?? '';
//   const STATIC_EXTS = new Set([
//     'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico',
//     'woff', 'woff2', 'ttf', 'otf', 'eot',
//     'css', 'js', 'map',
//     'json', 'webmanifest', 'txt', 'xml',
//     'pdf', 'mp4', 'webm',
//   ]);
//   if (STATIC_EXTS.has(ext)) return true;

//   return false;
// }

// /* ═══════════════════════════════════════════════════════════════
//    MAIN MIDDLEWARE FUNCTION
// ═══════════════════════════════════════════════════════════════ */

// export function proxy(request: NextRequest): NextResponse {
//   const { pathname } = request.nextUrl;

//   /* ── 1. Always allow public routes ─────────────────────────── */
//   if (isPublicPath(pathname)) {
//     return addSecurityHeaders(NextResponse.next());
//   }

//   /* ── 2. Read session from cookies ─────────────────────────── */
//   const session = readSession(request);

//   /* ── 3. Unauthenticated: redirect to login ─────────────────── */
//   if (!session.authenticated || !session.role) {
//     return redirectToLogin(request, pathname);
//   }

//   const { role } = session;

//   /* ── 4. /dashboard: smart redirect to role dashboard ─────── */
//   if (pathname === '/dashboard' || pathname === '/dashboard/') {
//     return redirectToDashboard(request, role);
//   }

//   /* ── 5. Role-based access control ─────────────────────────── */
//   const guard = findRoleGuard(pathname);

//   if (guard) {
//     // Admin always passes (superuser bypass)
//     const isAdmin   = role === 'admin';
//     const hasAccess = isAdmin || guard.allowed.includes(role);

//     if (!hasAccess) {
//       // Wrong role — send to their own dashboard, not an error page
//       const fallback = ROLE_DASHBOARD[role] ?? guard.fallback;
//       const url = new URL(fallback, request.url);
//       return addSecurityHeaders(NextResponse.redirect(url));
//     }
//   }

//   /* ── 6. All checks passed — add headers and continue ──────── */
//   return addSecurityHeaders(NextResponse.next());
// }

// /* ═══════════════════════════════════════════════════════════════
//    MATCHER CONFIG
//    Match ONLY routes that need processing.
//    Exclude Next.js internals and static files explicitly.
// ═══════════════════════════════════════════════════════════════ */
// export const config = {
//   matcher: [
//     /*
//      * Match all request paths EXCEPT:
//      *   - _next/static (static files)
//      *   - _next/image  (image optimization)
//      *   - favicon.ico  (favicon)
//      *   - Files with extensions (images, fonts, etc.)
//      */
//     '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|css|js|map|txt|xml|pdf|webmanifest|json)$).*)',
//   ],
// };
