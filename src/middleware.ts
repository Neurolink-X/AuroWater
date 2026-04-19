import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/utils/supabase/middleware';

/**
 * Route gate: `aw_session=1` and `aw_role=<role>` are set in the **browser** after login
 * via `setAuthGateCookies` inside `useAuth.writeSession` (not HttpOnly API cookies).
 * Supabase access tokens stay in localStorage / `api-client` Bearer headers for `/api/*`.
 * Edge middleware cannot read Bearer tokens; it only checks these first-party cookies.
 */

const PROTECTED: Record<string, string[]> = {
  '/admin': ['admin'],
  '/supplier': ['supplier', 'admin'],
  '/technician': ['technician', 'admin'],
  '/customer': ['customer', 'supplier', 'technician', 'admin'],
};

const ALLOW_UNAUTHENTICATED = ['/admin/login', '/admin/register'];

function withSupabaseCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (ALLOW_UNAUTHENTICATED.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  const matchedPrefix = Object.keys(PROTECTED).find((p) => pathname.startsWith(p));
  if (!matchedPrefix) {
    return supabaseResponse;
  }

  const sessionOk = request.cookies.get('aw_session')?.value === '1';
  const rawRole = request.cookies.get('aw_role')?.value;
  const role = rawRole ? decodeURIComponent(rawRole) : '';

  if (!sessionOk || !role) {
    const login = new URL('/auth/login', request.url);
    login.searchParams.set('returnTo', pathname);
    return withSupabaseCookies(supabaseResponse, NextResponse.redirect(login));
  }

  const allowed = PROTECTED[matchedPrefix];
  if (!allowed.includes(role)) {
    return withSupabaseCookies(supabaseResponse, NextResponse.redirect(new URL('/', request.url)));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/admin/:path*', '/supplier/:path*', '/technician/:path*', '/customer/:path*'],
};
