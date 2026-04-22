// import { NextResponse, type NextRequest } from 'next/server';

// /**
//  * Edge-only: `next/server` only — no @/ imports (no Node crypto / jwt chains).
//  * Gate: aw_session === '1', aw_role decoded from cookie (set by useAuth + setAuthGateCookies).
//  * Next.js 16+: file must be named `proxy.ts` (middleware filename is deprecated).
//  */

// function roleFromCookie(raw: string | undefined): string {
//   if (!raw) return '';
//   try {
//     return decodeURIComponent(raw);
//   } catch {
//     return raw;
//   }
// }

// function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
//   const url = request.nextUrl.clone();
//   url.pathname = '/auth/login';
//   url.searchParams.set('returnTo', pathname + request.nextUrl.search);
//   return NextResponse.redirect(url);
// }

// export function proxy(request: NextRequest) {
//   const { pathname } = request.nextUrl;

//   const session = request.cookies.get('aw_session')?.value;
//   const role = roleFromCookie(request.cookies.get('aw_role')?.value);

//   if (!session || session !== '1' || !role) {
//     return redirectToLogin(request, pathname);
//   }

//   if (pathname === '/dashboard') {
//     const dest =
//       role === 'admin'
//         ? '/admin/dashboard'
//         : role === 'supplier'
//           ? '/supplier/dashboard'
//           : role === 'technician'
//             ? '/technician/dashboard'
//             : '/customer/home';
//     return NextResponse.redirect(new URL(dest, request.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     '/customer/:path*',
//     '/supplier/:path*',
//     '/technician/:path*',
//     '/admin/:path*',
//     '/dashboard/:path*',
//     '/dashboard',
//   ],
// };



import { NextResponse, type NextRequest } from 'next/server';

/**
 * AuroWater — Edge Middleware (proxy.ts)
 *
 * Responsibilities (in execution order):
 *   1. Allow public routes without any auth check
 *   2. Enforce authentication — redirect to login if no valid session
 *   3. Enforce role-based access — redirect to own dashboard if wrong role
 *   4. Smart /dashboard redirect → role-appropriate page
 *   5. Add security headers on every response
 *   6. Sanitize returnTo to prevent open-redirect attacks
 *
 * Session contract (set by useAuth + setAuthGateCookies after login):
 *   aw_session = '1'            (presence = authenticated)
 *   aw_role    = '<role>'       (URL-encoded role string)
 *
 * Edge-only: only next/server imports — no Node.js, no crypto, no @/ aliases.
 */

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

type AuthRole = 'customer' | 'technician' | 'supplier' | 'admin';

interface SessionData {
  authenticated: boolean;
  role: AuthRole | null;
}

/* ═══════════════════════════════════════════════════════════════
   ROUTE CONFIGURATION
═══════════════════════════════════════════════════════════════ */

/**
 * Routes that never require authentication.
 * Exact matches AND prefix matches (paths ending in /) are checked.
 */
const PUBLIC_EXACT: Set<string> = new Set([
  '/',
  '/services',
  '/pricing',
  '/how-it-works',
  '/contact',
  '/about',
  '/technicians',
  '/book',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',       // OAuth return URL — MUST be public
  '/auth/verify',
  '/register',
  '/register/pro',
  '/privacy',
  '/terms',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
]);

const PUBLIC_PREFIXES: readonly string[] = [
  '/api/auth/',          // all auth API routes are public
  '/api/settings',
  '/api/services',
  '/api/contact',
  '/api/founding-members',
  '/supplier/',          // public supplier profile pages e.g. /supplier/raj-kanpur
  '/blog/',
  '/_next/',
  '/images/',
  '/icons/',
  '/fonts/',
];

/**
 * Which roles are allowed to access each protected prefix.
 * Admin always passes every role check (superuser).
 */
const ROLE_GUARDS: ReadonlyArray<{
  prefix: string;
  allowed: readonly AuthRole[];
  fallback: string;       // where to redirect if wrong role
}> = [
  {
    prefix:   '/admin',
    allowed:  ['admin'],
    fallback: '/customer/home',
  },
  {
    prefix:   '/supplier',
    allowed:  ['supplier', 'admin'],
    fallback: '/customer/home',
  },
  {
    prefix:   '/technician',
    allowed:  ['technician', 'admin'],
    fallback: '/customer/home',
  },
  {
    prefix:   '/customer',
    allowed:  ['customer', 'supplier', 'technician', 'admin'],
    fallback: '/auth/login',
  },
];

/**
 * After successful login, where should each role go?
 */
const ROLE_DASHBOARD: Record<AuthRole, string> = {
  admin:      '/admin/dashboard',
  supplier:   '/supplier/dashboard',
  technician: '/technician/dashboard',
  customer:   '/customer/home',
};

/* ═══════════════════════════════════════════════════════════════
   SECURITY HEADERS
   Applied to every response — both authenticated and public.
═══════════════════════════════════════════════════════════════ */

const SECURITY_HEADERS: ReadonlyArray<[string, string]> = [
  // Prevent clickjacking
  ['X-Frame-Options', 'SAMEORIGIN'],
  // Prevent MIME sniffing
  ['X-Content-Type-Options', 'nosniff'],
  // Strict referrer
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  // Disable FLoC/Topics
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
  // Remove server fingerprint
  ['X-Powered-By', ''],
  // HSTS (only meaningful over HTTPS but harmless in dev)
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  // XSS protection (legacy IE — harmless on modern browsers)
  ['X-XSS-Protection', '1; mode=block'],
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/** Parse session from cookies. Returns null if missing or invalid. */
function readSession(request: NextRequest): SessionData {
  const sessionCookie = request.cookies.get('aw_session')?.value;
  const roleCookie    = request.cookies.get('aw_role')?.value;

  if (sessionCookie !== '1') {
    return { authenticated: false, role: null };
  }

  let rawRole = '';
  try {
    rawRole = roleCookie ? decodeURIComponent(roleCookie).trim().toLowerCase() : '';
  } catch {
    rawRole = roleCookie?.trim().toLowerCase() ?? '';
  }

  const VALID_ROLES: readonly string[] = ['customer', 'technician', 'supplier', 'admin'];
  const role = VALID_ROLES.includes(rawRole)
    ? (rawRole as AuthRole)
    : null;

  return {
    authenticated: role !== null,
    role,
  };
}

/**
 * Sanitize a returnTo URL to prevent open-redirect attacks.
 * Only allows same-origin relative paths.
 */
function sanitizeReturnTo(raw: string | null): string | null {
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);

    // Must start with / (relative) and not be a protocol-relative URL (//)
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;

    // Block null bytes, special characters that could cause issues
    if (/[\x00-\x1f]/.test(decoded)) return null;

    // Max length sanity check
    if (decoded.length > 500) return null;

    // Don't return to auth pages (prevents redirect loop)
    if (decoded.startsWith('/auth/') || decoded === '/dashboard') return null;

    return decoded;
  } catch {
    return null;
  }
}

/** Build a redirect response to the login page. */
function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';

  // Preserve the original path so login can redirect back
  const returnTo = pathname + request.nextUrl.search;
  if (returnTo !== '/' && returnTo !== '/auth/login') {
    url.searchParams.set('returnTo', returnTo);
  }

  return addSecurityHeaders(NextResponse.redirect(url));
}

/** Build a redirect to a role-appropriate dashboard. */
function redirectToDashboard(request: NextRequest, role: AuthRole): NextResponse {
  const dest = ROLE_DASHBOARD[role] ?? '/customer/home';
  const url  = new URL(dest, request.url);
  return addSecurityHeaders(NextResponse.redirect(url));
}

/** Apply security headers to any NextResponse. */
function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of SECURITY_HEADERS) {
    if (value) {
      response.headers.set(key, value);
    } else {
      response.headers.delete(key);
    }
  }
  return response;
}

/** Find which role guard applies to this pathname (if any). */
function findRoleGuard(pathname: string) {
  return ROLE_GUARDS.find(g => pathname.startsWith(g.prefix)) ?? null;
}

/** Is this pathname public (no auth required)? */
function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;

  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }

  // Static asset extensions
  const ext = pathname.split('.').pop()?.toLowerCase() ?? '';
  const STATIC_EXTS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'css', 'js', 'map',
    'json', 'txt', 'xml',
    'pdf', 'mp4', 'webm',
  ]);
  if (STATIC_EXTS.has(ext)) return true;

  return false;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN MIDDLEWARE FUNCTION
═══════════════════════════════════════════════════════════════ */

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  /* ── 1. Always allow public routes ─────────────────────────── */
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  /* ── 2. Read session from cookies ─────────────────────────── */
  const session = readSession(request);

  /* ── 3. Unauthenticated: redirect to login ─────────────────── */
  if (!session.authenticated || !session.role) {
    return redirectToLogin(request, pathname);
  }

  const { role } = session;

  /* ── 4. /dashboard: smart redirect to role dashboard ─────── */
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return redirectToDashboard(request, role);
  }

  /* ── 5. Role-based access control ─────────────────────────── */
  const guard = findRoleGuard(pathname);

  if (guard) {
    // Admin always passes (superuser bypass)
    const isAdmin   = role === 'admin';
    const hasAccess = isAdmin || guard.allowed.includes(role);

    if (!hasAccess) {
      // Wrong role — send to their own dashboard, not an error page
      const fallback = ROLE_DASHBOARD[role] ?? guard.fallback;
      const url = new URL(fallback, request.url);
      return addSecurityHeaders(NextResponse.redirect(url));
    }
  }

  /* ── 6. All checks passed — add headers and continue ──────── */
  return addSecurityHeaders(NextResponse.next());
}

/* ═══════════════════════════════════════════════════════════════
   MATCHER CONFIG
   Match ONLY routes that need processing.
   Exclude Next.js internals and static files explicitly.
═══════════════════════════════════════════════════════════════ */
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static (static files)
     *   - _next/image  (image optimization)
     *   - favicon.ico  (favicon)
     *   - Files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|css|js|map|txt|xml|pdf)$).*)',
  ],
};