'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your registered email address.').max(254, 'Email address is too long.').email('Enter a valid email address.'),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message || 'Check the details and try again.');
      return;
    }

    const value = parsed.data.email;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value.toLowerCase() }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; message?: string };
      if (!res.ok || json.success === false) {
        throw new ApiError(json.error ?? 'We could not process your request. Please try again.', res.status);
      }
      setDone(true);
      toast.success('Recovery request submitted');
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
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
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Account recovery</p>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Let’s get you back in.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              Recover access using the email address registered to your AuroTap account.
            </p>
          </div>
          <ul className="relative mt-10 space-y-3 text-sm text-slate-200">
            <li className="flex gap-3"><span className="text-emerald-300">✓</span> Secure, time-limited recovery link</li>
            <li className="flex gap-3"><span className="text-emerald-300">✓</span> Never share your reset link or password</li>
            <li className="flex gap-3"><span className="text-emerald-300">✓</span> Need help? Return to sign in anytime</li>
          </ul>
        </section>

        <section className="p-6 sm:p-10">
          {!done ? (
            <>
              <h2 className="text-2xl font-extrabold text-slate-900">Forgot your password?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Enter the email address registered to your AuroTap account.
              </p>
              <form onSubmit={(e) => void onSubmit(e)} className="mt-7 space-y-5" noValidate>
                <div>
                  <label htmlFor="recovery-identifier" className="block text-sm font-semibold text-slate-700">
                    Email address
                  </label>
                  <input
                    id="recovery-identifier"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(err)}
                    aria-describedby={err ? 'recovery-error' : 'recovery-help'}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:bg-slate-100"
                    placeholder="you@example.com"
                  />
                  <p id="recovery-help" className="mt-2 text-xs leading-5 text-slate-500">
                    We’ll send a secure reset link only to the email already registered to your account. To update account contact details, contact support for ownership verification.
                  </p>
                </div>
                {err ? (
                  <div id="recovery-error" role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {err}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Sending request…</>
                  ) : 'Send password reset link'}
                </button>
              </form>
            </>
          ) : (
            <div className="flex min-h-[360px] flex-col justify-center">
              <div aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">✓</div>
              <h2 className="mt-5 text-2xl font-extrabold text-slate-900">Check your inbox</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                If your details match an account with a registered recovery email, we’ve requested a reset email. Check that registered inbox and its spam folder. A reset email is not sent to an unregistered address.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                If you no longer have access to your registered email, contact AuroTap support. Our team must verify account ownership before changing recovery details.
              </p>
              <button type="button" onClick={() => { setDone(false); setErr(null); }} className="mt-6 self-start text-sm font-bold text-emerald-700 hover:text-emerald-800 hover:underline">
                Try another detail
              </button>
            </div>
          )}
          <div className="mt-8 border-t border-slate-100 pt-5">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-emerald-700">
              <span aria-hidden="true">←</span> Back to sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
