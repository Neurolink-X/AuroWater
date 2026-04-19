import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge-only: `next/server` only — no @/ imports (no Node crypto / jwt chains).
 * Gate: aw_session === '1', aw_role decoded from cookie (set by useAuth + setAuthGateCookies).
 * Next.js 16+: file must be named `proxy.ts` (middleware filename is deprecated).
 */

const PUBLIC_PATHS = [
  '/',
  '/book',
  '/services',
  '/pricing',
  '/about',
  '/contact',
  '/how-it-works',
  '/technicians',
  '/privacy',
  '/terms',
  '/register',
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/settings',
  '/api/services',
  '/api/contact',
  '/api/founding-members',
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/register/') ||
    pathname.startsWith('/api/auth/')
  );
}

function roleFromCookie(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/auth/login';
  url.searchParams.set('returnTo', pathname);
  return NextResponse.redirect(url);
}

function redirectHome(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/', request.url));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  /** Stubs: must not require admin cookie (see next.config redirects too). */
  if (pathname === '/admin/login' || pathname === '/admin/register') {
    return redirectHome(request);
  }

  const session = request.cookies.get('aw_session')?.value;
  const role = roleFromCookie(request.cookies.get('aw_role')?.value);

  const isLoggedIn = session === '1';

  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn || role !== 'admin') {
      return redirectToLogin(request, pathname);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/supplier')) {
    if (!isLoggedIn || !role) {
      return redirectToLogin(request, pathname);
    }
    if (role !== 'supplier' && role !== 'admin') {
      return redirectHome(request);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/technician') || pathname.startsWith('/plumber')) {
    if (!isLoggedIn || !role) {
      return redirectToLogin(request, pathname);
    }
    if (role !== 'technician' && role !== 'admin') {
      return redirectHome(request);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/customer') || pathname.startsWith('/dashboard')) {
    if (!isLoggedIn || !role) {
      return redirectToLogin(request, pathname);
    }
    const allowed = ['customer', 'supplier', 'technician', 'admin'];
    if (!allowed.includes(role)) {
      return redirectHome(request);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images|fonts).*)'],
};
