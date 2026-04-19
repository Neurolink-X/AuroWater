'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError, profileToSession } from '@/lib/api-client';
import { postLoginPath } from '@/lib/auth/post-login-redirect';
import type { ProfileRow } from '@/lib/db/types';
import { writeSession } from '@/hooks/useAuth';
import { createClient } from '@/utils/supabase/client';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const errParam =
        searchParams.get('error_description') || searchParams.get('error');
      if (errParam) {
        const msg = errParam;
        toast.error(msg);
        router.replace(`/auth/login?error=${encodeURIComponent(msg)}`);
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          router.replace(`/auth/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (sessionErr || !session) {
        const msg =
          'Could not establish a session. If you opened an email link, confirm the Site URL in Supabase includes /auth/callback.';
        toast.error(msg);
        router.replace(`/auth/login?error=${encodeURIComponent(msg)}`);
        return;
      }

      const returnTo = searchParams.get('returnTo');

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: 'include',
        });
        const envelope = (await res.json()) as {
          success?: boolean;
          data?: ProfileRow;
          error?: string;
        };

        if (!res.ok || envelope.success === false) {
          const errText =
            typeof envelope.error === 'string' ? envelope.error : `HTTP ${res.status}`;
          throw new ApiError(errText, res.status);
        }

        const profile = envelope.data;
        if (!profile) {
          throw new ApiError('Profile response was empty', 500);
        }

        writeSession(
          profileToSession(profile, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at ?? null,
          })
        );

        if (cancelled) return;

        toast.success('Welcome back! 👋');
        router.replace(postLoginPath(profile.role, returnTo));
      } catch (e: unknown) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Sign-in failed';
        toast.error(msg);
        router.replace(`/auth/login?error=${encodeURIComponent(msg)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-slate-50 px-4">
      <p className="text-slate-700 font-semibold">Completing sign-in…</p>
      <p className="text-slate-500 text-sm">You can close this tab if nothing happens.</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
          Loading…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
