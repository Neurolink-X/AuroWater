'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let fallbackTimer: number | undefined;

    const markSession = (session: { access_token?: string } | null) => {
      if (cancelled) return;
      setHasSession(Boolean(session?.access_token));
      setReady(true);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        markSession(session);
      }
    });

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const tokenHash = params.get('token_hash');
        const code = params.get('code');
        const callbackError = params.get('error_description') ?? params.get('error') ??
          hashParams.get('error_description') ?? hashParams.get('error');

        if (callbackError) {
          if (!cancelled) {
            setErrorMessage('This reset link is invalid, expired, or already used. Request a fresh link to continue.');
            window.history.replaceState({}, document.title, '/auth/update-password');
          }
          setReady(true);
          return;
        }

        // Token-hash recovery is independent of the browser that requested the
        // email. This supports opening the email on another device/browser and
        // avoids the PKCE verifier being unavailable on that second device.
        if (tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (cancelled) return;
          if (error || !data.session) {
            setErrorMessage('This reset link is invalid, expired, or already used. Request a fresh link to continue.');
            window.history.replaceState({}, document.title, '/auth/update-password');
            setReady(true);
            return;
          }
          window.history.replaceState({}, document.title, '/auth/update-password');
          markSession(data.session);
          return;
        }

        // Backward compatibility for already-issued PKCE and legacy fragment links.
        // The browser client processes these using its existing singleton session.
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();
          if (cancelled) return;
          if (!error && data.session) {
            markSession(data.session);
            window.history.replaceState({}, document.title, '/auth/update-password');
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        if ((code || window.location.hash.includes('access_token')) && !cancelled) {
          setErrorMessage('We could not verify this reset link. It may have expired or already been used. Request a fresh link to continue.');
          window.history.replaceState({}, document.title, '/auth/update-password');
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('We could not verify this reset link. Request a fresh link and try again.');
        }
      }

      // Allow the Supabase client to process a token in the URL fragment before
      // declaring the link invalid. This is a bounded wait, not a page hang.
      fallbackTimer = window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 1200);
    })();

    return () => {
      cancelled = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match. Check both fields and try again.');
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success('Password updated successfully. Please sign in again.');
      window.location.replace('/login?passwordUpdated=1');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not update your password. Please try again.';
      setErrorMessage(message);
      toast.error('Password could not be updated');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 md:grid-cols-2">
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#0F172A] p-8 text-white sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-emerald-300">
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">A</span>
              AUROTAP
            </Link>
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Secure account recovery</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Create a new password.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              Choose a strong password you do not use on another website. Your password is never shown in an email.
            </p>
          </div>
          <p className="relative mt-10 text-xs leading-5 text-slate-400">
            For your security, password reset links are time-limited. If this link has expired, request a new one.
          </p>
        </section>

        <section className="p-6 sm:p-10">
          <h2 className="text-2xl font-extrabold text-slate-900">Set a new password</h2>
          {!ready ? (
            <div role="status" className="mt-5 flex items-center gap-3 text-sm text-slate-600">
              <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
              Securely verifying your reset link…
            </div>
          ) : !hasSession ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-bold text-amber-950">Reset link unavailable</h3>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                {errorMessage ?? 'This link may have expired or already been used. Request a new password-reset email to continue.'}
              </p>
              <Link href="/auth/forgot-password" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5" noValidate>
              <p className="text-sm leading-6 text-slate-600">Use at least 8 characters and enter the same password twice.</p>
              <div>
                <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700">New password</label>
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:bg-slate-100"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700">Confirm new password</label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:bg-slate-100"
                  placeholder="Re-enter new password"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} disabled={busy} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Show passwords
              </label>
              {errorMessage ? (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-700">{errorMessage}</div>
              ) : null}
              <button
                type="submit"
                disabled={busy || !password || !confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Updating password…</> : 'Update password'}
              </button>
            </form>
          )}
          <div className="mt-8 border-t border-slate-100 pt-5">
            <Link href="/login" className="text-sm font-bold text-slate-700 hover:text-emerald-700">← Back to sign in</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
