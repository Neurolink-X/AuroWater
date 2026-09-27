'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';

const schema = z.object({
  email: z.string().min(5, 'Enter email or 10-digit phone.'),
});

export default function ForgotPasswordPage() {
  const [values, setValues] = useState({ email: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      const digits = parsed.data.email.replace(/\D/g, '');
      const body =
        /^[6-9]\d{9}$/.test(digits) && !parsed.data.email.includes('@')
          ? { phone: digits }
          : { email: parsed.data.email.trim() };
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || json.success === false) {
        throw new ApiError(json.error ?? 'Could not send reset link', res.status);
      }
      setDone(true);
      toast.success('If that account exists, a reset email is on the way.');
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Could not send reset link.';
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl bg-[#0F172A] p-8 text-white sm:p-10">
            <h2 className="text-3xl font-extrabold">Forgot Password</h2>
            <p className="mt-3 text-sm text-white/70">We send a real reset link through Supabase Auth (email).</p>
            <ul className="mt-7 space-y-3 text-sm text-white/80">
              <li>◎ Phone accounts use {`{10digits}`}@users.aurotap.in</li>
              <li>◎ Configure SMTP in Supabase Auth settings for delivery</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-card sm:p-8">
            {!done ? (
              <>
                <h2 className="text-2xl font-extrabold text-[#0F1C18]">Send Reset Link</h2>
                <p className="mt-2 text-sm text-slate-600">Email or 10-digit mobile number.</p>
                <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Email or phone</label>
                    <input
                      value={values.email}
                      onChange={(e) => setValues({ email: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800"
                      placeholder="you@company.com or 98XXXXXXXX"
                    />
                  </div>
                  {err ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                      {err}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#0D9B6C] py-3 font-extrabold text-white disabled:opacity-60"
                  >
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            ) : (
              <div className="mt-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-lg font-extrabold text-[#0F1C18]">Check your email</div>
                  <div className="mt-2 text-sm text-slate-600">
                    If the account exists, open the link and set a new password.
                  </div>
                </div>
                <Link href="/login" className="mt-5 inline-flex font-extrabold text-[#0D9B6C] hover:underline">
                  Back to Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
