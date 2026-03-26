'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ email: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message || 'Invalid email.');
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setDone(true);
      toast.success('Reset link sent (simulated).');
    } catch {
      setErr('Could not send reset link.');
      toast.error('Could not send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-[#0F172A] text-white p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-2xl" />
            <div className="relative">
              <h2 className="text-3xl font-extrabold">Forgot Password</h2>
              <p className="mt-3 text-white/70 text-sm">We’ll send a reset link to your email.</p>
              <ul className="mt-7 space-y-3 text-sm text-white/80">
                <li>◎ Safe simulated flow for now</li>
                <li>◎ No backend required</li>
              </ul>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-7 sm:p-8">
            {!done ? (
              <>
                <h2 className="text-2xl font-extrabold text-[#0F1C18]">Send Reset Link</h2>
                <p className="text-slate-600 mt-2 text-sm">Enter your email address.</p>

                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={values.email}
                      onChange={(e) => setValues({ email: e.target.value })}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]"
                      placeholder="you@company.com"
                    />
                  </div>
                  {err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm font-semibold">{err}</div> : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
                  >
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            ) : (
              <div className="mt-3">
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
                  <div className="text-3xl">📧</div>
                  <div className="text-lg font-extrabold text-[#0F1C18] mt-2">Check your email</div>
                  <div className="text-slate-600 mt-2 text-sm">If the address exists, you’ll receive a reset link shortly (simulated).</div>
                </div>
                <Link href="/auth/login" className="mt-5 inline-flex text-[#0D9B6C] font-extrabold hover:underline">
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

