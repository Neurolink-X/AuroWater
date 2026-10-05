// import { redirect } from 'next/navigation';

// export default function AdminRegisterDisabledPage() {
//   redirect('/');
// }


'use client';

import React, { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, authRegister, profileToSession } from '@/lib/api-client';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { writeSession } from '@/hooks/useAuth';

export default function AdminRegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    invite_code: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (form.full_name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }

    if (!form.email.trim()) {
      setError('Enter your administrator email.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(form.phone.trim())) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    if (!form.invite_code.trim()) {
      setError('Administrator invitation code is required.');
      return;
    }

    setLoading(true);

    try {
      const result = await authRegister({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        role: 'admin',
        invite_code: form.invite_code.trim(),
      } as Parameters<typeof authRegister>[0] & {
        invite_code: string;
      });

      if (!('access_token' in result)) {
        setError(
          'Administrator account requires email confirmation before access.'
        );
        return;
      }

      if (result.profile.role !== 'admin') {
        setError(
          'Administrator account was not created with admin privileges.'
        );
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

      router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.status === 403
            ? 'Invalid or expired administrator invitation code.'
            : err.status === 400
              ? err.message
              : err.status === 429
                ? 'Too many attempts. Please wait and try again.'
                : err.message
          : err instanceof Error
            ? err.message
            : 'Unable to create administrator account.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07111F] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">

          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 font-black shadow-xl">
              AW
            </div>

            <h1 className="mt-5 text-3xl font-black">
              Create Administrator Account
            </h1>

            <p className="mt-2 text-sm text-white/50">
              Invitation-only AuroWater Control Center access.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-8">

            <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="text-sm font-bold text-cyan-300">
                Administrator invitation required
              </p>

              <p className="mt-1 text-xs leading-5 text-white/50">
                Only users with a valid server-side administrator
                invitation code can create an admin account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              <div>
                <label className="text-sm font-semibold text-white/80">
                  Full name
                </label>

                <input
                  value={form.full_name}
                  onChange={(e) =>
                    update('full_name', e.target.value)
                  }
                  placeholder="Administrator name"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/80">
                  Work email
                </label>

                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) =>
                    update('email', e.target.value)
                  }
                  placeholder="admin@company.com"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/80">
                  Mobile number
                </label>

                <input
                  inputMode="numeric"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) =>
                    update(
                      'phone',
                      e.target.value.replace(/\D/g, '').slice(0, 10)
                    )
                  }
                  placeholder="10-digit mobile number"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/80">
                  Password
                </label>

                <div className="relative mt-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) =>
                      update('password', e.target.value)
                    }
                    placeholder="Minimum 8 characters"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-20 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
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

              <div>
                <label className="text-sm font-semibold text-white/80">
                  Confirm password
                </label>

                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={(e) =>
                    update('confirm_password', e.target.value)
                  }
                  placeholder="Repeat password"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white/80">
                  Administrator invitation code
                </label>

                <div className="relative mt-2">
                  <input
                    type={showInvite ? 'text' : 'password'}
                    value={form.invite_code}
                    onChange={(e) =>
                      update('invite_code', e.target.value)
                    }
                    placeholder="Enter invitation code"
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-20 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowInvite((value) => !value)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-xs font-bold text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    {showInvite ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 font-black shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-50"
              >
                {loading
                  ? 'Creating administrator…'
                  : 'Create administrator account'}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5 text-center">
              <a
                href="/admin/login"
                className="text-sm font-bold text-cyan-400 hover:text-cyan-300"
              >
                ← Back to administrator sign in
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/30">
            AuroWater Internal Operations • Restricted Access
          </p>
        </div>
      </div>
    </main>
  );
}
