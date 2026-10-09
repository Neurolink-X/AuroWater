
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
  const defaultPath =
    type === 'recovery'
      ? '/auth/update-password'
      : '/customer/home';

  if (!value) return defaultPath;

  // Allow only same-site relative paths.
  if (!value.startsWith('/') || value.startsWith('//')) {
    return defaultPath;
  }

  // Preserve the existing recovery-route restriction.
  if (value.startsWith('/auth/') && value !== '/auth/update-password') {
    return defaultPath;
  }

  return value;
}

function getRedirectOrigin(requestUrl: URL): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!configuredUrl) {
    return requestUrl.origin;
  }

  try {
    const parsed = new URL(configuredUrl);

    if (
      process.env.NODE_ENV === 'production' &&
      parsed.protocol !== 'https:'
    ) {
      throw new Error('Production site URL must use HTTPS.');
    }

    return parsed.origin;
  } catch (error) {
    console.error(
      '[auth/callback] Invalid NEXT_PUBLIC_SITE_URL:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return requestUrl.origin;
  }
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

  const redirectOrigin = getRedirectOrigin(requestUrl);
  const loginUrl = new URL('/auth/login', redirectOrigin);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[auth/callback] Supabase URL or public key is missing.'
    );

    loginUrl.searchParams.set('error', 'auth_configuration_error');
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

     
setAll(cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    // Make the new session available to getUser()
    // during this callback request.
    cookieStore.set(name, value, options);

    // Also preserve cookies for the redirect response.
    cookiesToSet.push({ name, value, options });
  });
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

  function redirect(path: string): NextResponse {
    const response = NextResponse.redirect(
      new URL(path, `${redirectOrigin}/`)
    );

    // Persist all Supabase cookies generated during authentication.
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
    // Do not expose internal authentication errors in the URL.
    console.error(
      '[auth/callback] Authentication exchange failed:',
      authError
    );

    return redirect('/auth/login?error=oauth_callback_failed');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(
      '[auth/callback] Session validation failed:',
      userError?.message ?? 'No authenticated user returned'
    );

    return redirect('/auth/login?error=session_validation_failed');
  }

  let role: string;
  let profilePhone: string | null = null;

  try {
    const profile = await ensureProfileForUser(user);

    if (!profile?.role) {
      console.error(
        '[auth/callback] User profile or role is missing.'
      );

      return redirect('/auth/login?error=profile_setup_failed');
    }

    role = profile.role;
    profilePhone = profile.phone ?? null;
  } catch (error) {
    console.error(
      '[auth/callback] Profile setup failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return redirect('/auth/login?error=profile_setup_failed');
  }

  // Google does not reliably provide a phone number. Route customers with
  // missing contact details to the existing account page, where they can add it.
  const destination =
    role === 'customer' && !profilePhone
      ? '/customer/account?complete=phone'
      : nextPath;
  const response = redirect(destination);

  // Compatibility cookies only; never use these to authorize requests.
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
