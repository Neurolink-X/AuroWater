'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { profileToSession } from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import OtpDigitInputs from '@/components/auth/OtpDigitInputs';

const RESEND_SEC = 60;
const PHONE_RE = /^[6-9]\d{9}$/;

function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return '+91 **********';
  return `+91 ${d.slice(0, 2)}****${d.slice(6)}`;
}

function OtpPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [wrong, setWrong] = useState(false);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(0);

  const e164 = useMemo(() => {
    const d = phone.replace(/\D/g, '').slice(-10);
    return PHONE_RE.test(d) ? `+91${d}` : '';
  }, [phone]);

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const sendOtp = async () => {
    if (!e164) {
      toast.error('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    setWrong(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
      setLeft(RESEND_SEC);
      toast.success('OTP sent via SMS.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send OTP.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code: string) => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setWrong(false);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: code,
        type: 'sms',
      });
      if (error || !data.session || !data.user) {
        setWrong(true);
        setOtp('');
        throw error ?? new Error('Wrong OTP');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const role =
        profile && typeof profile.role === 'string'
          ? (profile.role as 'customer' | 'technician' | 'supplier' | 'admin')
          : 'customer';

      writeSession(
        profileToSession(
          (profile as typeof profile & { id: string }) ?? {
            id: data.user.id,
            full_name: 'Customer',
            email: data.user.email ?? `${e164.replace('+', '')}@phone.aurotap.in`,
            phone: e164,
            role: 'customer',
            aurotap_id: null,
            avatar_url: null,
            status: 'active',
            city: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
          }
        )
      );
      setAuthGateCookies(role);
      toast.success('Verified. Welcome!');

      const returnTo = searchParams.get('returnTo');
      if (returnTo?.startsWith('/')) router.push(returnTo);
      else if (role === 'admin') router.push('/admin/dashboard');
      else if (role === 'supplier') router.push('/supplier/dashboard');
      else if (role === 'technician') router.push('/technician/dashboard');
      else router.push('/');
    } catch {
      toast.error('Wrong OTP');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.length === 6) void verify(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-submit on 6th digit
  }, [otp]);

  const ringPct = left > 0 ? (left / RESEND_SEC) * 100 : 0;

  return (
    <div className="otp-screen">
      <style>{`
        .otp-screen {
          min-height: 100vh; background: #0A1628;
          display: flex; align-items: center; justify-content: center;
          padding: 24px; font-family: 'DM Sans', sans-serif;
        }
        .otp-card {
          width: 100%; max-width: 420px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(6,182,212,0.25);
          border-radius: 24px; padding: 32px 28px;
          backdrop-filter: blur(16px);
          box-shadow: 0 24px 80px rgba(0,0,0,0.45);
        }
        .otp-title {
          font-family: Syne, sans-serif; font-weight: 900;
          color: #fff; font-size: 1.6rem; letter-spacing: -0.04em; margin: 0 0 8px;
        }
        .otp-sub { color: rgba(255,255,255,0.55); font-size: 14px; margin: 0 0 24px; }
        .otp-label { color: #67E8F9; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .otp-phone {
          margin-top: 8px; width: 100%; border-radius: 12px; padding: 12px 14px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          color: #fff; font-size: 16px; outline: none;
        }
        .otp-phone:focus { border-color: #06B6D4; }
        .otp-row { display: flex; gap: 8px; justify-content: space-between; margin: 8px 0 16px; }
        .otp-row-err { animation: otpShake 0.4s ease; }
        .otp-box {
          width: 48px; height: 56px; text-align: center; font-size: 22px; font-weight: 800;
          border-radius: 12px; background: rgba(10,22,40,0.8); color: #fff;
          border: 1px solid rgba(6,182,212,0.35);
        }
        .otp-row-err .otp-box { border-color: #F87171; }
        @keyframes otpShake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .otp-btn {
          width: 100%; border: none; border-radius: 14px; padding: 14px;
          background: #06B6D4; color: #0A1628; font-weight: 800; font-size: 15px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .otp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .otp-spin {
          width: 18px; height: 18px; border: 2px solid rgba(10,22,40,0.2);
          border-top-color: #0A1628; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .otp-ring-wrap { display: flex; align-items: center; gap: 12px; margin-top: 16px; color: rgba(255,255,255,0.6); font-size: 13px; }
        .otp-ring { transform: rotate(-90deg); }
        .otp-err { color: #FCA5A5; font-size: 13px; font-weight: 700; margin: 0 0 8px; }
        .otp-back { display: inline-block; margin-top: 20px; color: #67E8F9; font-size: 13px; font-weight: 700; }
      `}</style>

      <div className="otp-card">
        <p className="otp-label">AuroWater</p>
        <h1 className="otp-title">{sent ? 'Enter OTP' : 'Sign in with OTP'}</h1>
        <p className="otp-sub">
          {sent
            ? `Code sent to ${maskPhone(phone)}`
            : 'We’ll text a 6-digit code. No password needed.'}
        </p>

        {!sent ? (
          <>
            <label className="otp-label" htmlFor="otp-phone">Mobile number</label>
            <input
              id="otp-phone"
              className="otp-phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <button type="button" className="otp-btn" style={{ marginTop: 18 }} disabled={loading} onClick={() => void sendOtp()}>
              {loading ? <span className="otp-spin" aria-hidden /> : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            {wrong && <p className="otp-err">Wrong OTP</p>}
            <OtpDigitInputs value={otp} onChange={setOtp} disabled={loading} error={wrong} />
            {loading && (
              <button type="button" className="otp-btn" disabled>
                <span className="otp-spin" aria-hidden /> Verifying…
              </button>
            )}
            <div className="otp-ring-wrap">
              <svg className="otp-ring" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#06B6D4"
                  strokeWidth="3"
                  strokeDasharray={`${(ringPct / 100) * 94} 94`}
                  strokeLinecap="round"
                />
              </svg>
              {left > 0 ? (
                <span>Resend in {left}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  style={{ background: 'none', border: 'none', color: '#67E8F9', fontWeight: 800, cursor: 'pointer' }}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </>
        )}

        <Link href="/auth/login" className="otp-back">← Email & password login</Link>
      </div>
    </div>
  );
}

export default function OtpPage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A1628' }} />}>
      <OtpPageInner />
    </React.Suspense>
  );
}
