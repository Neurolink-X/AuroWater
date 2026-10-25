'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

/* Supplier settings: business details, dispatch preferences and payouts.
   The server (/api/supplier/settings) enforces the supplier role; this page only reacts to a 403. */

const CITIES = [
  'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut',
  'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad',
];

type Check = { key: string; ok: boolean; label: string; fix: string };
type Snap = {
  is_online?: boolean;
  zone_radius_km?: number;
  price_per_can?: number | null;
  auto_accept?: boolean;
  base_lat?: number | null;
  base_lng?: number | null;
  upi_id?: string | null;
  bank_account?: string | null;
  has_payout_details?: boolean;
  profile?: { full_name: string | null; phone: string | null; city: string | null } | null;
  readiness?: { ready_for_orders: boolean; checks: Check[] };
};

const NU = 'bg-[#E3EDF6] shadow-[9px_9px_18px_#b7c8d9,-9px_-9px_18px_#ffffff]';
const NU_SM = 'bg-[#E3EDF6] shadow-[5px_5px_10px_#b7c8d9,-5px_-5px_10px_#ffffff]';
const NU_IN = 'bg-[#E3EDF6] shadow-[inset_5px_5px_10px_#b7c8d9,inset_-5px_-5px_10px_#ffffff]';
const FOCUS = 'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/40';
const INPUT = `w-full min-h-[48px] rounded-2xl border-0 px-4 py-3 text-base font-medium text-slate-800 placeholder:text-slate-400 ${NU_IN} ${FOCUS}`;
const BTN = `inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 text-sm font-black text-white shadow-[6px_6px_14px_#b7c8d9,-6px_-6px_14px_#ffffff] transition hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

async function call(method: 'GET' | 'PUT', body?: unknown) {
  const token = await getToken();
  const res = await fetch('/api/supplier/settings', {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: Snap };
  return { status: res.status, ok: res.ok && json.success !== false, error: json.error, data: json.data };
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={`rounded-[28px] p-5 sm:p-6 ${NU}`}>
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm leading-6 text-slate-600">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-3 text-sm font-bold text-slate-700">
        {label}
        {hint ? <span className="text-xs font-medium text-slate-500">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function SupplierSettingsPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/supplier/settings';
  const { hydrated, isLoggedIn } = useAuth();

  const [snap, setSnap] = useState<Snap | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [saving, setSaving] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(5);
  const [price, setPrice] = useState('');
  const [autoAccept, setAutoAccept] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [upi, setUpi] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');

  const applySnap = useCallback((s: Snap, resetForm: boolean) => {
    setSnap(s);
    if (!resetForm) return;
    setFullName(s.profile?.full_name ?? '');
    setCity(s.profile?.city ?? '');
    setRadius(Number(s.zone_radius_km) || 5);
    setPrice(s.price_per_can ? String(s.price_per_can) : '');
    setAutoAccept(Boolean(s.auto_accept));
    setLat(s.base_lat != null ? String(s.base_lat) : '');
    setLng(s.base_lng != null ? String(s.base_lng) : '');
  }, []);

  useEffect(() => {
    if (hydrated && !isLoggedIn) router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [hydrated, isLoggedIn, router, pathname]);

  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await call('GET');
        if (cancelled) return;
        if (r.status === 403) return setState('forbidden');
        if (!r.ok || !r.data) return setState('error');
        applySnap(r.data, true);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [hydrated, isLoggedIn, applySnap]);

  const save = useCallback(async (key: string, body: Record<string, unknown>, okMessage: string) => {
    setSaving(key);
    try {
      const r = await call('PUT', body);
      if (!r.ok || !r.data) {
        toast.error(r.error ?? 'Could not save. Please try again.');
        return false;
      }
      applySnap(r.data, false);
      toast.success(okMessage);
      return true;
    } catch {
      toast.error('Network problem. Please try again.');
      return false;
    } finally {
      setSaving(null);
    }
  }, [applySnap]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Location is not available on this device.');
    toast.info('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Number(pos.coords.latitude.toFixed(6));
        const ln = Number(pos.coords.longitude.toFixed(6));
        setLat(String(la));
        setLng(String(ln));
        void save('location', { base_lat: la, base_lng: ln }, 'Service location saved.');
      },
      () => toast.error('Could not get your location. Allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const checks = snap?.readiness?.checks ?? [];
  const todo = useMemo(() => checks.filter((c) => !c.ok), [checks]);
  const cityOptions = useMemo(() => (city && !CITIES.includes(city) ? [city, ...CITIES] : CITIES), [city]);

  if (!hydrated || state === 'loading') {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#E3EDF6] px-4">
        <p className="text-sm font-semibold text-slate-600" role="status">Loading your settings…</p>
      </main>
    );
  }

  if (state === 'forbidden' || state === 'error') {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#E3EDF6] px-4">
        <div className={`w-full max-w-md rounded-3xl p-8 text-center ${NU}`}>
          <h1 className="text-xl font-black text-slate-900">
            {state === 'forbidden' ? 'Supplier accounts only' : 'Could not load settings'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {state === 'forbidden' ? 'This page is for supplier accounts.' : 'Check your connection and try again.'}
          </p>
          {state === 'error' ? (
            <button type="button" onClick={() => window.location.reload()} className={`${BTN} mt-5`}>Try again</button>
          ) : null}
        </div>
      </main>
    );
  }

  const online = Boolean(snap?.is_online);
  const ready = Boolean(snap?.readiness?.ready_for_orders);

  return (
    <main className="min-h-[100dvh] bg-[#E3EDF6] pb-[calc(7rem+env(safe-area-inset-bottom))] text-slate-900">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-6 sm:px-6">
        <header>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Your business details, where you deliver, and how you get paid.</p>
        </header>

        {/* Online switch + readiness */}
        <section className={`rounded-[28px] p-5 sm:p-6 ${NU}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-black">{online ? 'You are accepting orders' : 'You are offline'}</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {online ? 'New nearby orders can be sent to you.' : 'Turn on to start receiving orders.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={online}
              aria-label="Accepting orders"
              disabled={saving === 'online'}
              onClick={() => void save('online', { is_online: !online }, !online ? 'You are online.' : 'You are offline.')}
              className={`relative h-9 w-16 shrink-0 rounded-full transition ${NU_IN} ${FOCUS}`}
            >
              <span className={`absolute top-1 h-7 w-7 rounded-full shadow-md transition-all ${online ? 'left-8 bg-emerald-500' : 'left-1 bg-slate-400'}`} />
            </button>
          </div>

          <div className={`mt-5 rounded-2xl p-4 ${NU_IN}`} aria-live="polite">
            <p className={`text-sm font-black ${ready ? 'text-emerald-700' : 'text-amber-800'}`}>
              {ready ? 'You can receive orders.' : `Fix ${todo.length} thing${todo.length === 1 ? '' : 's'} so orders can reach you`}
            </p>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-sm">
                  <span aria-hidden className={c.ok ? 'text-emerald-600' : 'text-amber-600'}>{c.ok ? '✓' : '!'}</span>
                  <span>
                    <span className={c.ok ? 'font-semibold text-slate-700' : 'font-bold text-slate-900'}>{c.label}</span>
                    {!c.ok ? <span className="block text-xs text-slate-600">{c.fix}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Business details */}
        <Card title="Business details" hint="Your city is used to match nearby orders when no service location is set.">
          <Field label="Name" htmlFor="s-name">
            <input id="s-name" className={INPUT} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="City" htmlFor="s-city">
            <select id="s-city" className={INPUT} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Choose your city</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Mobile number" htmlFor="s-phone" hint="Contact support to change">
            <input id="s-phone" className={`${INPUT} opacity-70`} value={snap?.profile?.phone ?? ''} readOnly />
          </Field>
          <button
            type="button"
            className={BTN}
            disabled={saving === 'profile' || fullName.trim().length < 2 || city.trim().length < 2}
            onClick={() => void save('profile', { full_name: fullName.trim(), city: city.trim() }, 'Details saved.')}
          >
            {saving === 'profile' ? 'Saving…' : 'Save details'}
          </button>
        </Card>

        {/* Dispatch preferences */}
        <Card title="Where and how you deliver" hint="Orders are matched by distance from your base location.">
          <Field label="Delivery radius" htmlFor="s-radius" hint={`${radius} km`}>
            <input id="s-radius" type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-sky-600" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Base latitude" htmlFor="s-lat">
              <input id="s-lat" inputMode="decimal" className={INPUT} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="26.4499" />
            </Field>
            <Field label="Base longitude" htmlFor="s-lng">
              <input id="s-lng" inputMode="decimal" className={INPUT} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="80.3319" />
            </Field>
          </div>
          <button type="button" onClick={useMyLocation} disabled={saving === 'location'} className={`${NU_SM} inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-sm font-extrabold text-slate-700 active:shadow-[inset_4px_4px_8px_#b7c8d9,inset_-4px_-4px_8px_#ffffff] ${FOCUS}`}>
            📍 Use my current location
          </button>

          <Field label="Price per can (₹)" htmlFor="s-price">
            <input id="s-price" inputMode="decimal" className={`${INPUT} max-w-[180px]`} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="20" />
          </Field>

          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl px-1 text-sm font-bold text-slate-700">
            <span>Auto-accept orders<span className="block text-xs font-medium text-slate-500">Confirm new orders without tapping accept.</span></span>
            <input type="checkbox" checked={autoAccept} onChange={(e) => setAutoAccept(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
          </label>

          <button
            type="button"
            className={BTN}
            disabled={saving === 'service'}
            onClick={() => {
              const body: Record<string, unknown> = { zone_radius_km: radius, auto_accept: autoAccept };
              const p = Number(price);
              if (price.trim()) {
                if (!Number.isFinite(p) || p < 1 || p > 1000) return toast.error('Price per can must be between ₹1 and ₹1000.');
                body.price_per_can = p;
              }
              const la = Number(lat);
              const ln = Number(lng);
              if (lat.trim() || lng.trim()) {
                if (!lat.trim() || !lng.trim() || !Number.isFinite(la) || !Number.isFinite(ln)) return toast.error('Enter both latitude and longitude, or use your current location.');
                body.base_lat = la;
                body.base_lng = ln;
              }
              void save('service', body, 'Delivery settings saved.');
            }}
          >
            {saving === 'service' ? 'Saving…' : 'Save delivery settings'}
          </button>
        </Card>

        {/* Payouts */}
        <Card title="Payouts" hint="Saved details are hidden for your safety. Enter new details only to replace them.">
          <p className={`rounded-2xl p-3 text-sm ${NU_IN}`}>
            {snap?.has_payout_details
              ? `Current: ${[snap.upi_id, snap.bank_account].filter(Boolean).join(' · ')}`
              : 'No payout details yet.'}
          </p>
          <Field label="UPI ID" htmlFor="s-upi">
            <input id="s-upi" className={INPUT} value={upi} onChange={(e) => setUpi(e.target.value)} autoCapitalize="none" autoComplete="off" placeholder="name@bank" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank account (optional)" htmlFor="s-acc">
              <input id="s-acc" inputMode="numeric" className={INPUT} value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
            </Field>
            <Field label="IFSC (optional)" htmlFor="s-ifsc">
              <input id="s-ifsc" className={`${INPUT} uppercase`} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} maxLength={11} autoComplete="off" />
            </Field>
          </div>
          <button
            type="button"
            className={BTN}
            disabled={saving === 'payout'}
            onClick={async () => {
              const body: Record<string, unknown> = {};
              if (upi.trim()) body.upi_id = upi.trim();
              if (account || ifsc) {
                if (!account || !ifsc) return toast.error('Add both account number and IFSC, or leave both empty.');
                body.bank_account = account;
                body.ifsc = ifsc;
              }
              if (!Object.keys(body).length) return toast.error('Enter a UPI ID or bank details to save.');
              if (await save('payout', body, 'Payout details saved.')) { setUpi(''); setAccount(''); setIfsc(''); }
            }}
          >
            {saving === 'payout' ? 'Saving…' : 'Save payout details'}
          </button>
        </Card>
      </div>
    </main>
  );
}
