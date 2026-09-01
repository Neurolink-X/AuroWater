'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError, authRegister, profileToSession } from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { needsApproval, uiRoleToDb } from '@/lib/auth/roles';
import CitySelector from '@/components/ui/CitySelector';
import WaitlistPanel from '@/components/ui/WaitlistPanel';

type UiRole = 'customer' | 'seller' | 'agent';

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^\d{6}$/;

function strength(pw: string): { label: string; pct: number; color: string } {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  if (s <= 1) return { label: 'Weak', pct: 25, color: '#F87171' };
  if (s === 2) return { label: 'Medium', pct: 55, color: '#FBBF24' };
  return { label: 'Strong', pct: 100, color: '#34D399' };
}

function RegisterInner() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UiRole>('customer');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [cityId, setCityId] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [cityIsActive, setCityIsActive] = useState(false);
  const [pincode, setPincode] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Water depot');
  const [gst, setGst] = useState('');
  const [vehicle, setVehicle] = useState('Scooter');
  const [license, setLicense] = useState('');
  const [busy, setBusy] = useState(false);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});

  const bar = useMemo(() => strength(password), [password]);
  const phoneErr = blurred.phone && !PHONE_RE.test(phone) ? 'Enter valid 10-digit Indian mobile number' : '';
  const pinErr = blurred.pincode && pincode && !PIN_RE.test(pincode) ? 'Pincode must be 6 digits' : '';
  const pwErr =
    blurred.password && (!password || password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password))
      ? 'Min 8 characters, 1 uppercase, 1 number'
      : '';

  const submit = async () => {
    if (!fullName.trim() || !PHONE_RE.test(phone) || pwErr) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    if (!cityIsActive || !city.trim()) {
      toast.error('Pick a city where we already deliver, or join the waitlist below.');
      return;
    }
    setBusy(true);
    try {
      const result = await authRegister({
        password,
        full_name: fullName.trim(),
        phone,
        role,
        city,
        pincode,
        business_name: role === 'seller' ? businessName : undefined,
        business_type: role === 'seller' ? businessType : undefined,
        gst_number: role === 'seller' ? gst : undefined,
        vehicle_type: role === 'agent' ? vehicle : undefined,
        license_number: role === 'agent' ? license : undefined,
      });

      const dbRole = uiRoleToDb(role);
      if (needsApproval(dbRole) || ('pending' in result && result.pending)) {
        toast.success('Application submitted for review.');
        router.push('/register/pending');
        return;
      }

      if ('access_token' in result && result.access_token) {
        writeSession(
          profileToSession(result.profile, {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_at: result.expires_at,
          })
        );
        setAuthGateCookies(result.profile.role);
        toast.success('Welcome to AuroWater');
        router.push('/customer/home');
        return;
      }

      router.push('/login');
    } catch (e: unknown) {
      toast.error(e instanceof ApiError ? e.message : 'Could not register');
    } finally {
      setBusy(false);
    }
  };

  const card = (id: UiRole, emoji: string, title: string, desc: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setRole(id)}
      className={`rounded-2xl border p-5 text-left transition ${
        role === id ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div className="text-2xl">{emoji}</div>
      <div className="mt-2 font-[Syne] text-lg font-black text-white">{title}</div>
      <p className="mt-1 text-sm text-white/55">{desc}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-12 text-white">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-400">AuroWater</p>
        <h1 className="mt-2 font-[Syne] text-3xl font-black">Create your account</h1>
        <p className="mt-2 text-white/55">No email verification. Sellers and agents need a quick admin check.</p>

        {step === 1 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {card('customer', '💧', 'Customer', 'Order water cans to your home')}
            {card('seller', '🏪', 'Seller / Shop', 'Supply water in your city')}
            <div className="sm:col-span-2 sm:max-w-sm">
              {card('agent', '🛵', 'Delivery Agent', 'Earn by delivering')}
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="sm:col-span-2 mt-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-extrabold text-slate-950"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <button type="button" className="text-sm text-cyan-300" onClick={() => setStep(1)}>
              ← Change role
            </button>
            <input
              className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5"
              placeholder="Full name"
              value={fullName}
              onBlur={() => setBlurred((b) => ({ ...b, name: true }))}
              onChange={(e) => setFullName(e.target.value)}
            />
            <div>
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5"
                placeholder="Phone (10 digits)"
                inputMode="numeric"
                value={phone}
                onBlur={() => setBlurred((b) => ({ ...b, phone: true }))}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
              {phoneErr ? <p className="mt-1 text-xs text-rose-300">{phoneErr}</p> : null}
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5 pr-16"
                  placeholder="Password"
                  value={password}
                  onBlur={() => setBlurred((b) => ({ ...b, password: true }))}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-2.5 text-xs text-cyan-300" onClick={() => setShowPw((s) => !s)}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full" style={{ width: `${bar.pct}%`, background: bar.color }} />
              </div>
              <p className="mt-1 text-xs text-white/50">{bar.label}</p>
              {pwErr ? <p className="text-xs text-rose-300">{pwErr}</p> : null}
            </div>
            <CitySelector
              value={cityId}
              onChange={(id, name, isActive) => {
                setCityId(id);
                setCity(name);
                setCityIsActive(isActive);
              }}
            />
            {city && !cityIsActive ? (
              <WaitlistPanel
                key={`${cityId ?? city}-${role}`}
                cityName={city}
                cityId={cityId}
                role={role}
                source="register"
                defaultName={fullName}
                defaultPhone={phone}
              />
            ) : null}
            {cityIsActive ? (
              <>
            <div>
              <input
                className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5"
                placeholder="Pincode"
                value={pincode}
                onBlur={() => setBlurred((b) => ({ ...b, pincode: true }))}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {pinErr ? <p className="mt-1 text-xs text-rose-300">{pinErr}</p> : null}
            </div>
            {role === 'seller' && (
              <>
                <input className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                <select className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                  {['Water depot', 'RO plant', 'Distributor', 'Other'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5" placeholder="GST (optional)" value={gst} onChange={(e) => setGst(e.target.value)} />
              </>
            )}
            {role === 'agent' && (
              <>
                <select className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                  {['Bicycle', 'Scooter', 'Auto'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className="w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5" placeholder="License number" value={license} onChange={(e) => setLicense(e.target.value)} />
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-extrabold text-slate-950 disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create account'}
            </button>
              </>
            ) : (
              <p className="text-center text-xs text-white/45">
                Account creation is available in live cities only. Join the waitlist if we have not launched yet.
              </p>
            )}
            <p className="text-center text-sm text-white/50">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-cyan-300">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A1628]" />}>
      <RegisterInner />
    </Suspense>
  );
}
