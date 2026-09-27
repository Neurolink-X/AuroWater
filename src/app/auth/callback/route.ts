import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';
import { ensureProfileForUser } from '@/lib/auth/ensure-profile';

function supabaseFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>
        ) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const nextRaw = searchParams.get('next') ?? (type === 'recovery' ? '/auth/update-password' : '/customer/home');
  const safeNext = nextRaw.startsWith('/') ? nextRaw : '/customer/home';

  const cookieStore = await cookies();
  const supabase = supabaseFromCookies(cookieStore);

  let exchanged = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchanged = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    exchanged = !error;
  }

  if (!exchanged) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Reset link expired. Request a new one.')}`);
  }

  try {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const profile = await ensureProfileForUser(u.user);
      const role = profile?.role ?? 'customer';
      const res = NextResponse.redirect(`${origin}${safeNext}`);
      res.cookies.set('aw_session', '1', {
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });
      res.cookies.set('aw_role', role, {
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
      });
      return res;
    }
  } catch (e) {
    console.error('[auth/callback] cookie mirror failed', e);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
