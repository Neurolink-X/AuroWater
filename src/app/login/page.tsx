'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError, authLogin, profileToSession } from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { phoneToAuthEmail } from '@/lib/auth/roles';
import { createClient } from '@/utils/supabase/client';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [otpLeft, setOtpLeft] = useState(0);

  React.useEffect(() => {
    if (otpLeft <= 0) return;
    const t = window.setTimeout(() => setOtpLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [otpLeft]);

  const go = (role: string) => {
    const returnTo = searchParams.get('returnTo');
    if (returnTo?.startsWith('/')) {
      router.push(returnTo);
      return;
    }
    if (role === 'admin') router.push('/admin/dashboard');
    else if (role === 'supplier') router.push('/supplier/dashboard');
    else if (role === 'technician') router.push('/technician/dashboard');
    else router.push('/customer/home');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ident = mode === 'phone' ? phoneToAuthEmail(phone) : email.trim();
      const result = await authLogin(ident, password, mode === 'phone' ? { phone } : undefined);
      writeSession(
        profileToSession(result.profile, {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          expires_at: result.expires_at,
        })
      );
      setAuthGateCookies(result.profile.role);
      toast.success('Welcome back');
      go(result.profile.role);
    } catch (err: unknown) {
      const code = err instanceof ApiError ? err.code : null;
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      if (code === 'PENDING_APPROVAL' || code === 'APPLICATION_PENDING') {
        toast.error('Still under review');
        router.push('/register/pending');
        return;
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    if (otpLeft > 0) return;
    const e164 = `+91${otpPhone.replace(/\D/g, '').slice(-10)}`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    if (error) {
      toast.error(error.message);
      return;
    }
    setOtpSent(true);
    setOtpLeft(60);
    toast.success('OTP sent');
  };

  const resetPw = async () => {
    const e164 = `+91${otpPhone.replace(/\D/g, '').slice(-10)}`;
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: 'sms' });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: uErr } = await supabase.auth.updateUser({ password: newPw });
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success('Password updated. Sign in.');
    setForgotOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0A1628] text-white lg:grid lg:grid-cols-2">
      <div className="hidden flex-col justify-center px-16 lg:flex">
        <div className="text-5xl" aria-hidden>💧</div>
        <h2 className="mt-6 font-[Syne] text-4xl font-black">
          Fresh water.
          <br />
          <span className="text-cyan-400">Same day.</span>
        </h2>
        <p className="mt-4 max-w-sm text-white/50">Live in Gorakhpur, Kanpur &amp; Lucknow. Other UP cities can join the waitlist.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-16">
        <form onSubmit={(e) => void onSubmit(e)} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="font-[Syne] text-2xl font-black">Sign in</h1>
          <p className="mt-1 text-sm text-white/50">One login for customers, sellers, agents and admin.</p>

          <div className="mt-6 flex gap-2 text-xs font-bold">
            <button type="button" onClick={() => setMode('phone')} className={`rounded-lg px-3 py-1 ${mode === 'phone' ? 'bg-cyan-500 text-slate-950' : 'bg-white/10'}`}>
              Phone
            </button>
            <button type="button" onClick={() => setMode('email')} className={`rounded-lg px-3 py-1 ${mode === 'email' ? 'bg-cyan-500 text-slate-950' : 'bg-white/10'}`}>
              Email
            </button>
          </div>

          {mode === 'phone' ? (
            <input
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          ) : (
            <input
              type="email"
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <div className="relative mt-3">
            <input
              type={showPw ? 'text' : 'password'}
              className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5 pr-14"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="absolute right-3 top-2.5 text-xs text-cyan-300" onClick={() => setShowPw((s) => !s)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          <button type="button" className="mt-2 text-xs font-bold text-cyan-300" onClick={() => setForgotOpen(true)}>
            Forgot password?
          </button>
          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-extrabold text-slate-950 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-sm text-white/50">
            New here?{' '}
            <Link href="/register" className="font-bold text-white">
              Create account
            </Link>
          </p>
        </form>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="w-full max-w-sm rounded-2xl bg-[#0A1628] p-6 ring-1 ring-white/10">
            <h2 className="font-bold">Reset password</h2>
            <input
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              placeholder="Phone"
              value={otpPhone}
              onChange={(e) => setOtpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {!otpSent ? (
              <button type="button" disabled={otpLeft > 0} className="mt-4 w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-950" onClick={() => void sendOtp()}>
                {otpLeft > 0 ? `Wait ${otpLeft}s` : 'Send OTP'}
              </button>
            ) : (
              <>
                <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2" placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2" placeholder="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                <button type="button" className="mt-4 w-full rounded-xl bg-cyan-500 py-2 font-bold text-slate-950" onClick={() => void resetPw()}>
                  Update password
                </button>
                {otpLeft === 0 ? (
                  <button type="button" className="mt-2 w-full text-xs text-cyan-300" onClick={() => void sendOtp()}>
                    Resend OTP
                  </button>
                ) : (
                  <p className="mt-2 text-center text-xs text-white/40">Resend in {otpLeft}s</p>
                )}
              </>
            )}
            <button type="button" className="mt-4 w-full text-sm text-white/50" onClick={() => setForgotOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A1628]" />}>
      <LoginInner />
    </Suspense>
  );
}
