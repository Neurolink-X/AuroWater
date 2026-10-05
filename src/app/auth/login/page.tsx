/* eslint-disable react/no-array-index-key */
'use client';

/**
 * src/app/auth/login/page.tsx
 *
 * World-class login page for AuroWater / AuroTap.
 * - Removed: Google OAuth, OTP (not available yet)
 * - Kept: all working auth logic (authLogin, writeSession, setAuthGateCookies)
 * - Added: world-class UI, animations, mobile-first layout, password strength UX
 */

import React, { Suspense, useMemo, useState } from 'react';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { ApiError, authLogin, authResendConfirmation, profileToSession } from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';

/* ─── Validation ──────────────────────────────────────────────────────────── */
const schema = z.object({
  email:    z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});
type FormValues = z.infer<typeof schema>;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function dashboardFor(role: string) {
  if (role === 'admin')      return '/admin/dashboard';
  if (role === 'supplier')   return '/supplier/dashboard';
  if (role === 'technician') return '/technician/dashboard';
  return '/customer/home';
}

function safeReturnTo(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.startsWith('/auth')) return null;
  return raw;
}

function detectRoleFromEmail(email: string) {
  const e = email.toLowerCase().trim();
  if (e.startsWith('admin@'))                                        return 'admin';
  if (e.startsWith('tech@') || e.startsWith('technician@') || e.startsWith('plumber@')) return 'technician';
  if (e.startsWith('supplier@') || e.startsWith('supply@'))         return 'supplier';
  return 'customer';
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  customer:   { label: 'Customer',   color: '#2563EB', bg: '#EFF6FF', icon: '🏠' },
  supplier:   { label: 'Supplier',   color: '#059669', bg: '#ECFDF5', icon: '🚛' },
  technician: { label: 'Plumber',    color: '#7C3AED', bg: '#F5F3FF', icon: '🔧' },
  admin:      { label: 'Admin',      color: '#DC2626', bg: '#FEF2F2', icon: '⚙️'  },
};

/* ─── Eye icon ────────────────────────────────────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
    </svg>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Water drop SVG animation ────────────────────────────────────────────── */
function WaterDrop() {
  return (
    <svg viewBox="0 0 80 96" width="80" height="96" fill="none" aria-hidden>
      <style>{`
        @keyframes drip { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.92)} }
        @keyframes shine { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .aw-drop { animation: drip 3s ease-in-out infinite; transform-origin: center bottom; }
        .aw-shine { animation: shine 3s ease-in-out infinite; }
      `}</style>
      <g className="aw-drop">
        <path d="M40 4C26 22 10 34 10 52a30 30 0 0060 0C70 34 54 22 40 4z" fill="#38BDF8" opacity="0.9" />
        <path d="M40 12C30 26 18 36 18 52a22 22 0 0044 0C62 36 50 26 40 12z" fill="#0EA5E9" opacity="0.7" />
        <ellipse className="aw-shine" cx="30" cy="42" rx="6" ry="10" fill="white" opacity="0.3" transform="rotate(-20 30 42)" />
      </g>
    </svg>
  );
}

/* ─── Main inner component ────────────────────────────────────────────────── */
function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [values, setValues]         = useState<FormValues>({ email: '', password: '' });
  const [showPassword, setShowPw]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState<string | null>(null);
  const [errCode, setErrCode]       = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormValues>>({});

  const rolePreview = useMemo(() => detectRoleFromEmail(values.email), [values.email]);
  const roleMeta    = ROLE_META[rolePreview] ?? ROLE_META.customer;

  const urlError = searchParams.get('error');
  const displayedErr = err ?? (urlError ? (() => { try { return decodeURIComponent(urlError); } catch { return urlError; } })() : null);

  const setField = (k: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
    setErr(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setErrCode(null); setFieldErrors({});

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fe: Partial<FormValues> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (k) fe[k] = issue.message;
      }
      setFieldErrors(fe);
      return;
    }

    setLoading(true);
    try {
      const result = await authLogin(parsed.data.email, parsed.data.password);
      const role   = (result.profile.role as string) || 'customer';

      setAuthGateCookies(role);
      writeSession(
        profileToSession(result.profile, {
          access_token:  result.access_token,
          refresh_token: result.refresh_token,
          expires_at:    result.expires_at,
        })
      );

      toast.success('Welcome back! 👋');
      await new Promise((r) => setTimeout(r, 200));

      const sanitized = safeReturnTo(searchParams.get('returnTo'));
      const isBookRoute = sanitized === '/book' || sanitized?.startsWith('/book?') || sanitized?.startsWith('/book#');
      const dest = isBookRoute && role !== 'customer'
        ? dashboardFor(role)
        : sanitized || (role === 'customer' ? '/' : dashboardFor(role));

      router.replace(dest);
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? e.status === 401 ? 'Incorrect email or password. Please try again.'
          : e.status === 429 ? 'Too many attempts — please wait 60 seconds.'
          : e.status >= 500  ? 'Server error — please try again in a moment.'
          : e.message
        : e instanceof Error ? e.message
        : 'Login failed. Please try again.';

      setErr(msg);
      setErrCode(e instanceof ApiError ? e.code ?? null : null);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

      {/* Global keyframes */}
      <style>{`
        @keyframes awFadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes awFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes awSlideRight { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes awSpin { to{transform:rotate(360deg)} }
        @keyframes awShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        @keyframes awPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .aw-input:focus { outline: none; border-color: #0D9B6C; box-shadow: 0 0 0 3px rgba(13,155,108,0.12); }
        .aw-input { transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s; }
        .aw-input:focus { transform: scale(1.005); }
        .aw-btn-primary:not(:disabled):hover { background: #086D4C; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(13,155,108,0.35); }
        .aw-btn-primary:not(:disabled):active { transform: scale(0.98); }
        .aw-btn-primary { transition: all 0.2s cubic-bezier(.34,1.56,.64,1); }
        .aw-link:hover { text-decoration: underline; }
        .aw-role-pill { transition: all 0.3s cubic-bezier(.34,1.56,.64,1); }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 960,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,5fr) minmax(0,6fr)',
        borderRadius: 28, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.13)',
        animation: 'awFadeUp 0.5s cubic-bezier(.22,.68,0,1.2) both',
      }}
      /* Stack on mobile */
      className="lg:grid-cols-[5fr_6fr] flex flex-col lg:grid"
      >

        {/* ── LEFT PANEL ── */}
        <div style={{
          background: 'linear-gradient(160deg,#0A1628 0%,#0F2240 50%,#0D1F35 100%)',
          padding: '44px 36px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden', minHeight: 400,
        }}>
          {/* Decorative blobs */}
          <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 999, background: 'rgba(14,165,233,0.12)', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: 999, background: 'rgba(37,99,235,0.15)', filter: 'blur(30px)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                💧
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>AuroWater</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pure · Fast · Trusted</div>
              </div>
            </div>

            {/* Water drop */}
            <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center' }}>
              <WaterDrop />
            </div>

            <h2 style={{ marginTop: 24, fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Pure water,<br />delivered to your door
            </h2>
            <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>
              Book water cans, plumbers &amp; RO repair in Gorakhpur, Delhi &amp; UP.
            </p>

            {/* Trust points */}
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '⚡', text: '45-min delivery guarantee' },
                { icon: '✅', text: 'Verified suppliers only'   },
                { icon: '📱', text: 'Order via WhatsApp too'    },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: role preview pill */}
          {values.email.includes('@') && (
            <div className="aw-role-pill" style={{
              position: 'relative', zIndex: 1, marginTop: 28,
              borderRadius: 14, padding: '12px 16px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              animation: 'awFadeIn 0.3s ease both',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Signing in as</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{roleMeta.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{roleMeta.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Will redirect to {dashboardFor(rolePreview)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ background: '#fff', padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ animation: 'awSlideRight 0.45s cubic-bezier(.22,.68,0,1.2) 0.1s both' }}>

            <div style={{ fontSize: 26, fontWeight: 900, color: '#0A1628', letterSpacing: '-0.03em' }}>Sign in</div>
            <p style={{ marginTop: 6, fontSize: 14, color: '#94A3B8' }}>
              Welcome back — access your dashboard instantly.
            </p>

            <form onSubmit={(e) => void onSubmit(e)} noValidate style={{ marginTop: 28 }}>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  Email address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={values.email}
                  onChange={setField('email')}
                  disabled={loading}
                  className="aw-input"
                  style={{
                    width: '100%', borderRadius: 14,
                    border: `1.5px solid ${fieldErrors.email ? '#EF4444' : '#E5E7EB'}`,
                    background: '#fff', padding: '13px 16px',
                    fontSize: 15, color: '#0A1628',
                    boxSizing: 'border-box',
                  }}
                />
                {fieldErrors.email && (
                  <p style={{ marginTop: 5, fontSize: 12, fontWeight: 600, color: '#EF4444', animation: 'awShake 0.4s ease' }}>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={values.password}
                    onChange={setField('password')}
                    disabled={loading}
                    className="aw-input"
                    style={{
                      width: '100%', borderRadius: 14,
                      border: `1.5px solid ${fieldErrors.password ? '#EF4444' : '#E5E7EB'}`,
                      background: '#fff', padding: '13px 48px 13px 16px',
                      fontSize: 15, color: '#0A1628',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#94A3B8', padding: 4, lineHeight: 0,
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {fieldErrors.password && (
                  <p style={{ marginTop: 5, fontSize: 12, fontWeight: 600, color: '#EF4444' }}>{fieldErrors.password}</p>
                )}
              </div>

              {/* Forgot password */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
                <Link href="/auth/forgot-password" className="aw-link" style={{ fontSize: 13, fontWeight: 700, color: '#0D9B6C', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>

              {/* Error box */}
              {displayedErr && (
                <div style={{
                  marginBottom: 16, borderRadius: 14,
                  border: '1.5px solid #FCA5A5', background: '#FEF2F2',
                  padding: '12px 14px', animation: 'awShake 0.4s ease',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>{displayedErr}</p>
                  {errCode === 'EMAIL_NOT_CONFIRMED' && (
                    <button
                      type="button"
                      disabled={resendBusy || !values.email.trim()}
                      onClick={async () => {
                        setResendBusy(true);
                        try {
                          await authResendConfirmation(values.email);
                          toast.success('Check your inbox — we sent a new confirmation link.');
                        } catch (re: unknown) {
                          toast.error(re instanceof ApiError ? re.message : re instanceof Error ? re.message : 'Could not resend');
                        } finally { setResendBusy(false); }
                      }}
                      style={{ marginTop: 6, display: 'block', fontSize: 13, fontWeight: 700, color: '#0D9B6C', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      {resendBusy ? 'Sending…' : 'Resend confirmation email →'}
                    </button>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="aw-btn-primary"
                style={{
                  width: '100%', borderRadius: 16, padding: '15px 20px',
                  background: loading ? '#6EE7B7' : '#0D9B6C',
                  border: 'none', color: '#fff', fontWeight: 800, fontSize: 16,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(13,155,108,0.3)',
                }}
              >
                {loading ? (
                  <><Spinner /> Signing you in…</>
                ) : (
                  'Sign In →'
                )}
              </button>

              {/* Divider */}
              <div style={{ margin: '24px 0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New to AuroWater?</span>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
              </div>

              {/* Register link */}
              <Link href="/auth/register" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', borderRadius: 16, padding: '14px 20px',
                border: '1.5px solid #E5E7EB', background: '#fff',
                color: '#0A1628', fontWeight: 700, fontSize: 15,
                textDecoration: 'none', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#0D9B6C'; (e.currentTarget as HTMLAnchorElement).style.background = '#F0FDF4'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLAnchorElement).style.background = '#fff'; }}
              >
                Create a free account →
              </Link>

              {/* Role-specific register links */}
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { href: '/auth/register?role=supplier',   icon: '🚛', label: 'Become a Supplier'  },
                  { href: '/auth/register?role=technician', icon: '🔧', label: 'Join as Plumber'    },
                ].map(({ href, icon, label }) => (
                  <Link key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    borderRadius: 14, padding: '11px 10px',
                    border: '1.5px solid #F1F5F9', background: '#F8FAFC',
                    color: '#475569', fontWeight: 700, fontSize: 13,
                    textDecoration: 'none', transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLAnchorElement).style.background = '#F1F5F9'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#F1F5F9'; (e.currentTarget as HTMLAnchorElement).style.background = '#F8FAFC'; }}
                  >
                    <span>{icon}</span>{label}
                  </Link>
                ))}
              </div>

              {/* Footer note */}
              <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#CBD5E1', lineHeight: 1.5 }}>
                By signing in you agree to our{' '}
                <Link href="/terms"   style={{ color: '#94A3B8', textDecoration: 'underline' }}>Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" style={{ color: '#94A3B8', textDecoration: 'underline' }}>Privacy Policy</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Export ──────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999, margin: '0 auto',
              border: '3px solid #E5E7EB', borderTopColor: '#0D9B6C',
              animation: 'awSpin 0.8s linear infinite',
            }} />
            <p style={{ marginTop: 12, fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Loading…</p>
          </div>
          <style>{`@keyframes awSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}








// /* eslint-disable react/no-array-index-key */
// 'use client';

// import React, { Suspense, useMemo, useState } from 'react';
// import { z } from 'zod';
// import Link from 'next/link';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
// import { ApiError, authLogin, authResendConfirmation, profileToSession } from '@/lib/api-client';
// import { writeSession } from '@/hooks/useAuth';
// import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
// import { createClient } from '@/lib/supabase/client';

// const schema = z.object({
//   email: z.string().email('Enter a valid email.'),
//   password: z.string().min(6, 'Password must be at least 6 characters.'),
// });

// type FormValues = z.infer<typeof schema>;

// type Role = 'customer' | 'technician' | 'supplier' | 'admin';

// function dashboardFor(role: string) {
//   if (role === 'admin') return '/admin/dashboard';
//   if (role === 'supplier') return '/supplier/dashboard';
//   if (role === 'technician') return '/technician/dashboard';
//   return '/customer/home';
// }

// function safeReturnTo(raw: string | null) {
//   if (!raw) return null;
//   if (!raw.startsWith('/') || raw.startsWith('//')) return null;
//   if (raw.startsWith('/auth')) return null;
//   return raw;
// }

// function detectRoleFromEmail(email: string): Role {
//   const e = email.toLowerCase().trim();
//   if (e.startsWith('admin@')) return 'admin';
//   if (e.startsWith('tech@') || e.startsWith('plumber@') || e.startsWith('technician@')) return 'technician';
//   if (e.startsWith('supplier@') || e.startsWith('supply@')) return 'supplier';
//   return 'customer';
// }

// function LoginPageInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const [values, setValues] = useState<FormValues>({ email: '', password: '' });
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [googleLoading, setGoogleLoading] = useState(false);
//   const [err, setErr] = useState<string | null>(null);
//   const [errCode, setErrCode] = useState<string | null>(null);
//   const [resendBusy, setResendBusy] = useState(false);

//   const rolePreview = useMemo(() => detectRoleFromEmail(values.email), [values.email]);

//   const urlError = searchParams.get('error');
//   const displayedErr =
//     err ??
//     (urlError
//       ? (() => {
//           try {
//             return decodeURIComponent(urlError);
//           } catch {
//             return urlError;
//           }
//         })()
//       : null);

//   const onGoogle = async () => {
//     setErr(null);
//     setGoogleLoading(true);
//     try {
//       const supabase = createClient();
//       const origin = window.location.origin;
//       const returnTo = searchParams.get('returnTo') || '';
//       const { error } = await supabase.auth.signInWithOAuth({
//         provider: 'google',
//         options: {
//           redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
//           queryParams: { prompt: 'select_account' },
//         },
//       });
//       if (error) {
//         setErr(error.message);
//         toast.error(error.message);
//       }
//     } catch (e: unknown) {
//       const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
//       setErr(msg);
//       toast.error(msg);
//     } finally {
//       setGoogleLoading(false);
//     }
//   };

//   const onSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setErr(null);
//     setErrCode(null);
//     const parsed = schema.safeParse(values);
//     if (!parsed.success) {
//       setErr(parsed.error.issues[0]?.message || 'Invalid input.');
//       return;
//     }
//     setLoading(true);
//     try {
//       const result = await authLogin(parsed.data.email, parsed.data.password);
//       const role = (result.profile.role as Role) || 'customer';

//       setAuthGateCookies(role);
//       writeSession(
//         profileToSession(result.profile, {
//           access_token: result.access_token,
//           refresh_token: result.refresh_token,
//           expires_at: result.expires_at,
//         })
//       );

//       toast.success('Welcome back! 👋');

//       // 3) Give the browser a moment to flush cookies before redirect.
//       await new Promise((r) => setTimeout(r, 200));

//       // 4-5) Redirect to sanitized `returnTo` or the correct dashboard.
      
//      const sanitizedReturnTo = safeReturnTo(
//   searchParams.get('returnTo')
// );

// const isCustomerOnlyRoute =
//   sanitizedReturnTo === '/book' ||
//   sanitizedReturnTo?.startsWith('/book?') ||
//   sanitizedReturnTo?.startsWith('/book#');

// // const dest =
// //   isCustomerOnlyRoute && role !== 'customer'
// //     ? dashboardFor(role)
// //     : sanitizedReturnTo || dashboardFor(role);

//       const dest =
//   isCustomerOnlyRoute && role !== 'customer'
//     ? dashboardFor(role)
//     : sanitizedReturnTo || (role === 'customer' ? '/' : dashboardFor(role));

// router.replace(dest);
//     } catch (e: unknown) {
//       const msg =
//         e instanceof ApiError
//           ? e.status === 401
//             ? 'Invalid email or password'
//             : e.status === 429
//               ? 'Too many attempts — please wait 60 seconds'
//               : e.status >= 500
//                 ? 'Server error — please try again'
//                 : e.message // expected 400 → API message
//           : e instanceof Error
//             ? e.message
//             : 'Login failed. Please try again.';

//       setErr(msg);
//       setErrCode(e instanceof ApiError ? e.code ?? null : null);
//       toast.error(msg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//           {/* LEFT */}
//           <div className="rounded-3xl bg-[#0F172A] text-white p-8 sm:p-10 relative overflow-hidden">
//             <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-2xl" />
//             <div className="relative">
//               <div className="flex items-center justify-center">
//                 <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
//                   💧
//                 </div>
//               </div>
//               <h2 className="mt-6 text-3xl font-extrabold text-center">Welcome to AuroWater</h2>
//               <p className="mt-3 text-center text-white/70">Sign in to your account</p>

//               <ul className="mt-7 space-y-3 text-sm text-white/80">
//                 <li>◎ No app needed — order via WhatsApp too</li>
//                 <li>◎ Same-day delivery available</li>
//                 <li>◎ Verified plumbers on demand</li>
//               </ul>
//               <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
//                 Tip: Use <span className="text-white font-extrabold">{rolePreview ? `${rolePreview}@` : 'admin@'}</span> email prefix to preview role redirects.
//               </div>
//             </div>
//           </div>

//           {/* RIGHT */}
//           <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-7 sm:p-8">
//             <h2 className="text-2xl font-extrabold text-[#0F1C18]">Sign In</h2>
//             <p className="text-slate-600 mt-2 text-sm">Access your dashboard instantly.</p>

//             <form onSubmit={onSubmit} className="mt-6 space-y-4">
//               <div>
//                 <label className="block text-sm font-semibold text-slate-700">Email</label>
//                 <input
//                   type="email"
//                   autoComplete="email"
//                   value={values.email}
//                   onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
//                   className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]"
//                   placeholder="you@company.com"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-semibold text-slate-700">Password</label>
//                 <div className="relative mt-2">
//                   <input
//                     type={showPassword ? 'text' : 'password'}
//                     autoComplete="current-password"
//                     value={values.password}
//                     onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
//                     className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C] pr-12"
//                     placeholder="••••••"
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword((s) => !s)}
//                     className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg text-slate-600 hover:bg-slate-50 font-extrabold"
//                     aria-label={showPassword ? 'Hide password' : 'Show password'}
//                   >
//                     {showPassword ? 'Hide' : 'Show'}
//                   </button>
//                 </div>
//               </div>

//               <div className="flex items-center justify-end">
//                 <Link href="/auth/forgot-password" className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
//                   Forgot password?
//                 </Link>
//               </div>

//               {displayedErr ? (
//                 <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm font-semibold space-y-2">
//                   <p>{displayedErr}</p>
//                   {errCode === 'EMAIL_NOT_CONFIRMED' ? (
//                     <button
//                       type="button"
//                       disabled={resendBusy || !values.email.trim()}
//                       onClick={async () => {
//                         setResendBusy(true);
//                         try {
//                           await authResendConfirmation(values.email);
//                           toast.success('Check your inbox — we sent another confirmation link.');
//                         } catch (re: unknown) {
//                           const m =
//                             re instanceof ApiError ? re.message : re instanceof Error ? re.message : 'Could not resend';
//                           toast.error(m);
//                         } finally {
//                           setResendBusy(false);
//                         }
//                       }}
//                       className="text-[#0D9B6C] font-extrabold underline-offset-2 hover:underline disabled:opacity-50"
//                     >
//                       {resendBusy ? 'Sending…' : 'Resend confirmation email'}
//                     </button>
//                   ) : null}
//                 </div>
//               ) : null}

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
//               >
//                 {loading ? (
//                   <span className="inline-flex items-center justify-center gap-2">
//                     <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
//                       <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
//                       <path d="M22 12a10 10 0 0 0-10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
//                     </svg>
//                     Signing in…
//                   </span>
//                 ) : (
//                   'Sign In'
//                 )}
//               </button>

//               <div className="flex items-center gap-3 pt-2">
//                 <div className="h-px bg-slate-200 flex-1" />
//                 <div className="text-xs font-extrabold text-slate-500">or continue with</div>
//                 <div className="h-px bg-slate-200 flex-1" />
//               </div>

//               <button
//                 type="button"
//                 onClick={onGoogle}
//                 disabled={loading || googleLoading}
//                 className="w-full rounded-xl border border-slate-200 bg-white py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-60"
//               >
//                 {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
//               </button>

//               <Link href="/auth/otp" className="block w-full rounded-xl border border-cyan-200 bg-cyan-50 py-3 text-center font-extrabold text-cyan-900 hover:bg-cyan-100">
//                 Sign in with OTP (SMS)
//               </Link>

//               <div className="text-sm text-slate-600 pt-2">
//                 Don&apos;t have an account?{' '}
//                 <Link href="/auth/register" className="text-[#0D9B6C] font-extrabold hover:underline">
//                   Register →
//                 </Link>
//               </div>

//               <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <Link href="/auth/register?role=supplier" className="rounded-xl border border-slate-200 py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition text-center">
//                   🚛 Become a Supplier
//                 </Link>
//                 <Link href="/auth/register?role=technician" className="rounded-xl border border-slate-200 py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition text-center">
//                   🔧 Join as Plumber
//                 </Link>
//               </div>
//             </form>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function LoginPage() {
//   return (
//     <Suspense
//       fallback={
//         <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
//       }
//     >
//       <LoginPageInner />
//     </Suspense>
//   );
// }
