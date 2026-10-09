
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { ensureProfileForUser } from '@/lib/auth/ensure-profile';

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function getSafeNextPath(
  value: string | null,
  type: string | null
): string {
  const fallback =
    type === 'recovery'
      ? '/auth/update-password'
      : '/customer/home';

  if (!value) return fallback;

  // Prevent external redirects and protocol-relative URLs.
  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  // Only allow the existing password recovery route under /auth.
  if (value.startsWith('/auth/') && value !== '/auth/update-password') {
    return fallback;
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');

  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get('next'),
    type
  );

  const cookieStore = await cookies();
  const cookiesToSet: CookieToSet[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[auth/callback] Supabase environment variables are missing.');

    return NextResponse.redirect(
      new URL('/auth/login?error=auth_configuration_error', requestUrl.origin)
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookies) {
        cookiesToSet.push(...cookies);
      },
    },
  });

  let authError: string | null = null;

  if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    authError = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    authError = error?.message ?? null;
  } else {
    authError = 'Missing authentication code or token.';
  }

  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');

  // Use the configured production domain when provided.
  const redirectOrigin = configuredSiteUrl
    ? new URL(configuredSiteUrl).origin
    : requestUrl.origin;

  function redirect(path: string): NextResponse {
    const response = NextResponse.redirect(
      new URL(path, `${redirectOrigin}/`)
    );

    // Preserve Supabase session cookies on the redirect response.
    for (const cookie of cookiesToSet) {
      response.cookies.set(
        cookie.name,
        cookie.value,
        cookie.options
      );
    }

    return response;
  }

  if (authError) {
    console.error(
      '[auth/callback] Authentication exchange failed:',
      authError
    );

    return redirect('/auth/login?error=oauth_callback_failed');
  }

  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    console.error(
      '[auth/callback] Session validation failed:',
      userError?.message ?? 'No authenticated user returned'
    );

    return redirect('/auth/login?error=session_validation_failed');
  }

  let role = 'customer';

  try {
    const profile = await ensureProfileForUser(data.user);

    if (!profile) {
      console.error('[auth/callback] User profile was not returned.');

      return redirect('/auth/login?error=profile_setup_failed');
    }

    role = profile.role ?? 'customer';
  } catch (error) {
    console.error(
      '[auth/callback] Profile setup failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return redirect('/auth/login?error=profile_setup_failed');
  }

  const response = redirect(nextPath);

  // Compatibility cookies only; never use these as proof of authentication.
  response.cookies.set('aw_session', '1', {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });

  response.cookies.set('aw_role', role, {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
