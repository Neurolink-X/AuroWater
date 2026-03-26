/* eslint-disable react/no-array-index-key */
'use client';

import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type FormValues = z.infer<typeof schema>;

type Role = 'customer' | 'technician' | 'supplier' | 'admin';

function detectRoleFromEmail(email: string): Role {
  const e = email.toLowerCase().trim();
  if (e.startsWith('admin@')) return 'admin';
  if (e.startsWith('tech@') || e.startsWith('plumber@') || e.startsWith('technician@')) return 'technician';
  if (e.startsWith('supplier@') || e.startsWith('supply@')) return 'supplier';
  return 'customer';
}

export default function LoginPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rolePreview = useMemo(() => detectRoleFromEmail(values.email), [values.email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message || 'Invalid input.');
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      const role = detectRoleFromEmail(values.email);
      const name = values.email.split('@')[0] || 'User';

      const session = {
        email: values.email,
        name,
        role,
        loggedIn: true,
        loginTime: Date.now(),
      };

      localStorage.setItem('aurowater_session', JSON.stringify(session));
      localStorage.setItem(
        'aurowater_profile',
        JSON.stringify({
          name,
          email: values.email,
          phone: '',
        })
      );

      toast.success('Welcome back! 👋');

      if (role === 'admin') router.replace('/admin');
      if (role === 'technician') router.replace('/technician/dashboard');
      if (role === 'supplier') router.replace('/supplier/dashboard');
      if (role === 'customer') router.replace('/dashboard');
    } catch {
      setErr('Login failed. Please try again.');
      toast.error('Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT */}
          <div className="rounded-3xl bg-[#0F172A] text-white p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  💧
                </div>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-center">Welcome to AuroWater</h2>
              <p className="mt-3 text-center text-white/70">Sign in to your account</p>

              <ul className="mt-7 space-y-3 text-sm text-white/80">
                <li>◎ No app needed — order via WhatsApp too</li>
                <li>◎ Same-day delivery available</li>
                <li>◎ Verified plumbers on demand</li>
              </ul>
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
                Tip: Use <span className="text-white font-extrabold">{rolePreview ? `${rolePreview}@` : 'admin@'}</span> email prefix to preview role redirects.
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-7 sm:p-8">
            <h2 className="text-2xl font-extrabold text-[#0F1C18]">Sign In</h2>
            <p className="text-slate-600 mt-2 text-sm">Access your dashboard instantly.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative mt-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={values.password}
                    onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C] pr-12"
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg text-slate-600 hover:bg-slate-50 font-extrabold"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link href="/auth/forgot-password" className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
                  Forgot password?
                </Link>
              </div>

              {err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm font-semibold">{err}</div> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="flex items-center gap-3 pt-2">
                <div className="h-px bg-slate-200 flex-1" />
                <div className="text-xs font-extrabold text-slate-500">or continue with</div>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Continue with Google
              </button>

              <div className="text-sm text-slate-600 pt-2">
                Don&apos;t have an account?{' '}
                <Link href="/auth/register" className="text-[#0D9B6C] font-extrabold hover:underline">
                  Register →
                </Link>
              </div>

              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link href="/auth/register?role=supplier" className="rounded-xl border border-slate-200 py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition text-center">
                  🚛 Become a Supplier
                </Link>
                <Link href="/auth/register?role=technician" className="rounded-xl border border-slate-200 py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition text-center">
                  🔧 Join as Plumber
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


