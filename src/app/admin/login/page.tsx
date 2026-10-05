'use client';

import React, { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ApiError, authLogin, profileToSession } from '@/lib/api-client';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { writeSession } from '@/hooks/useAuth';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError('Enter your admin email and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await authLogin(cleanEmail, password);

      /*
       * IMPORTANT:
       * Never trust the email address to determine admin access.
       * The server response/profile is the source of truth.
       */
      if (result.profile.role !== 'admin') {
        setError('This account does not have administrator access.');
        return;
      }

      if (
        result.profile.status === 'suspended' ||
        result.profile.status === 'banned' ||
        result.profile.is_active === false
      ) {
        setError('This administrator account is currently inactive.');
        return;
      }

      setAuthGateCookies('admin');

      writeSession(
        profileToSession(result.profile, {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          expires_at: result.expires_at,
        })
      );

      const rawReturnTo = searchParams.get('returnTo');

      const returnTo =
        rawReturnTo &&
        rawReturnTo.startsWith('/') &&
        !rawReturnTo.startsWith('//') &&
        !rawReturnTo.startsWith('/auth') &&
        !rawReturnTo.startsWith('/admin/login')
          ? rawReturnTo
          : '/admin/dashboard';

      router.replace(returnTo);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? 'Invalid administrator email or password.'
            : err.status === 403
              ? 'Administrator access denied.'
              : err.status === 429
                ? 'Too many login attempts. Please wait and try again.'
                : err.message
          : err instanceof Error
            ? err.message
            : 'Unable to sign in. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07111F] text-white">
      <div className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">

        {/* LEFT — ADMIN BRANDING */}
        <section className="hidden lg:flex relative overflow-hidden items-center justify-center px-12 xl:px-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.18),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.14),transparent_35%)]" />

          <div className="relative max-w-xl">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xl font-black shadow-xl">
                AW
              </div>

              <div>
                <p className="text-2xl font-black tracking-tight">
                  AuroWater
                </p>
                <p className="text-sm text-white/50">
                  Admin Control Center
                </p>
              </div>
            </div>

            <h1 className="mt-12 text-5xl xl:text-6xl font-black leading-tight">
              Run your entire
              <span className="block text-cyan-400">
                water marketplace.
              </span>
            </h1>

            <p className="mt-6 text-lg leading-8 text-white/60">
              Secure operational control for orders, suppliers,
              technicians, customers, service zones, finance and
              business analytics.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              {[
                'Live Operations',
                'Orders & Dispatch',
                'Finance & Payouts',
                'Zones & Availability',
                'Supplier Management',
                'Security & Audit',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75"
                >
                  <span className="mr-2 text-emerald-400">✓</span>
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3 text-xs text-white/40">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              Protected administrator environment
            </div>
          </div>
        </section>

        {/* RIGHT — LOGIN */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">

            {/* Mobile logo */}
            <div className="lg:hidden mb-10 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black shadow-xl">
                AW
              </div>

              <h1 className="mt-4 text-2xl font-black">
                AuroWater Admin
              </h1>

              <p className="mt-1 text-sm text-white/50">
                Control Center
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
                  Secure Access
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Administrator Sign In
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/50">
                  Authorized AuroWater administrators only.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
              >
                {/* EMAIL */}
                <div>
                  <label
                    htmlFor="admin-email"
                    className="text-sm font-semibold text-white/80"
                  >
                    Admin email
                  </label>

                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    disabled={loading}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-50"
                  />
                </div>

                {/* PASSWORD */}
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="admin-password"
                      className="text-sm font-semibold text-white/80"
                    >
                      Password
                    </label>

                    <a
                      href="/admin/forgot-password"
                      className="text-xs font-bold text-cyan-400 hover:text-cyan-300"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <div className="relative mt-2">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={loading}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-20 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:opacity-50"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-xs font-bold text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {/* ERROR */}
                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </div>
                ) : null}

                {/* LOGIN */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 font-black text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Authenticating…' : 'Sign in securely'}
                </button>
              </form>

              <div className="mt-7 border-t border-white/10 pt-6">
                <div className="flex items-center justify-center gap-2 text-xs text-white/40">
                  <span>🔒</span>
                  <span>Secure AuroWater administrator access</span>
                </div>

                <p className="mt-4 text-center text-xs text-white/30">
                  Need administrator access?
                </p>

                <a
                  href="/admin/register"
                  className="mt-2 block text-center text-sm font-bold text-cyan-400 hover:text-cyan-300"
                >
                  Use an administrator invitation →
                </a>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-white/30">
              AuroWater • Internal Operations
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07111F] flex items-center justify-center text-white/50">
          Loading secure login…
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}








// import { redirect } from 'next/navigation';

// export default function AdminLoginDisabledPage() {
//   redirect('/');
// }

