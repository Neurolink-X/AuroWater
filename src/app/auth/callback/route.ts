import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ensureProfileForUser } from '@/lib/auth/ensure-profile';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/customer/home';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const safeNext = next.startsWith('/') ? next : '/customer/home';
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
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}

