'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import BottomNav from '@/components/customer/BottomNav';
import { clearSession, getInitials, useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';
import { useLang, setLang, type TKey, type Lang } from '@/lib/i18n';

/* ───────────────────────────── Types ───────────────────────────── */

type Settings = {
  notifications?: { whatsapp?: boolean; sms?: boolean; email?: boolean; push?: boolean };
  language?: Lang;
  notifications_enabled?: boolean; // legacy read-only
  [key: string]: unknown;
};
type Profile = {
  id: string; full_name: string | null; city: string | null; phone: string | null;
  created_at: string | null; settings?: Settings | null;
};
type Stats = {
  total_orders?: number; total_spent?: number; cans_ordered?: number;
  member_since?: string | null; avg_rating?: number | null; total_reviews?: number;
};
type Envelope<T> = { success?: boolean; data?: T; error?: string };
type Toast = { kind: 'success' | 'error' | 'info'; text: string } | null;
type Errors = Partial<Record<'full_name' | 'city' | 'phone', string>>;

/* ──────────────────────────── Constants ─────────────────────────── */

const PHONE = '+919889305803';
const wa = (text: string) => `https://wa.me/919889305803?text=${encodeURIComponent(text)}`;
const CITIES = ['Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad'];
const NAME_MAX = 80;
const CACHE_KEY = 'aurotap-account-v1';
const STALE_MS = 30_000;

/* ───────────────────── Resilient networking layer ─────────────────── */

class AuthError extends Error {}
class FatalError extends Error {} // non-retryable server/validation error

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with timeout, exponential-backoff retries (network errors, 408/429/5xx),
 * safe JSON parsing and 401 detection. This is what makes the page "self-healing":
 * transient failures never reach the user unless every retry fails.
 */
async function api<T>(path: string, init: RequestInit = {}, token: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(path, {
        ...init,
        signal: ctrl.signal,
        credentials: 'include',
        cache: 'no-store',
        headers: (() => {
          const h = new Headers(init.headers);
          if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
          h.set('Authorization', `Bearer ${token}`);
          return h;
        })(),
      });
      if (res.status === 401) throw new AuthError('Session expired');
      const json = (await res.json().catch(() => ({}))) as Envelope<T>;
      if (res.ok && json.success !== false) return (json.data ?? ({} as T)) as T;
      const retryable = [408, 429].includes(res.status) || res.status >= 500;
      lastError = new Error(json.error ?? `Request failed (${res.status})`);
      if (!retryable) throw new FatalError((lastError as Error).message);
    } catch (e) {
      if (e instanceof AuthError || e instanceof FatalError) throw e;
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(400 * 2 ** attempt + Math.random() * 200);
  }
  throw lastError instanceof Error ? lastError : new Error('Network error');
}

const readCache = (): { profile: Profile | null; stats: Stats | null } | null => {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null'); } catch { return null; }
};
const writeCache = (v: { profile: Profile | null; stats: Stats | null }) => {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
};

/* ───────────────────────────── Helpers ──────────────────────────── */

const inr = (v: unknown) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const digits = (v: string) => v.replace(/\D/g, '');
const maskPhone = (v: string) => (digits(v).length < 6 ? v || '—' : `${digits(v).slice(0, 2)}••••${digits(v).slice(-4)}`);

function monthYear(iso?: string | null, lang: Lang = 'en') {
  const ts = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(ts) ? '—' : new Date(ts).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' });
}

function notificationsOn(s?: Settings | null): boolean {
  if (!s) return true;
  if (typeof s.notifications_enabled === 'boolean') return s.notifications_enabled;
  const v = Object.values(s.notifications ?? {}).filter((x): x is boolean => typeof x === 'boolean');
  return v.length ? v.some(Boolean) : true;
}

/* ─────────────────────────── UI primitives ──────────────────────── */

const focusRing = 'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

function Heading({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function Row({ href, icon, title, hint, external }: { href: string; icon: string; title: string; hint?: string; external?: boolean }) {
  const cls = `flex min-h-[64px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 ${focusRing}`;
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-lg" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        {hint && <span className="block truncate text-xs text-slate-500">{hint}</span>}
      </span>
      <span className="text-slate-300" aria-hidden>›</span>
    </>
  );
  return external ? (
    <a href={href} className={cls} {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{body}</a>
  ) : (
    <Link href={href} className={cls} prefetch>{body}</Link>
  );
}

function Stat({ icon, value, label, loading }: { icon: string; value: string; label: string; loading: boolean }) {
  if (loading) return <div className="h-[104px] animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" aria-hidden />;
  return (
    <Card className="p-4">
      <span className="text-xl" aria-hidden>{icon}</span>
      <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </Card>
  );
}

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-emerald-600' : 'bg-slate-300'} disabled:opacity-60 ${focusRing}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** Working language switch: state lives in lib/i18n.ts, so every component updates instantly. */
function LangSwitch({ onChange }: { onChange?: (l: Lang) => void }) {
  const { lang } = useLang();
  const opts: [Lang, string][] = [['en', 'English'], ['hi', 'हिन्दी']];
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex rounded-xl bg-slate-100 p-1">
      {opts.map(([code, name]) => (
        <button
          key={code} type="button" role="radio" aria-checked={lang === code}
          onClick={() => { setLang(code); onChange?.(code); }}
          className={`min-h-10 rounded-lg px-4 text-sm font-bold transition ${lang === code ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500'} ${focusRing}`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function Ring({ pct, loading }: { pct: number; loading: boolean }) {
  const r = 26, c = 2 * Math.PI * r, v = loading ? 0 : pct;
  return (
    <div className="relative h-16 w-16 shrink-0" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#7dd3fc" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-black">{loading ? '—' : `${pct}%`}</span>
    </div>
  );
}

/* ─────────────────────────────── Page ───────────────────────────── */

export default function CustomerAccountPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/account';
  const { t, lang } = useLang();
  const { hydrated, isLoggedIn, isCustomer, session, updateSession, logout } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [online, setOnline] = useState(true);

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notif, setNotif] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [needsPhone, setNeedsPhone] = useState(false);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const toastTimer = useRef<number | undefined>(undefined);
  const lastLoad = useRef(0);
  const inflight = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);

  const ready = hydrated && isLoggedIn && isCustomer;
  const loginUrl = `/auth/login?returnTo=${encodeURIComponent(pathname)}`;

  const say = useCallback((kind: NonNullable<Toast>['kind'], text: string) => {
    setToast({ kind, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    setNeedsPhone(new URLSearchParams(window.location.search).get('complete') === 'phone');
    setOnline(navigator.onLine);
  }, []);

  useEffect(() => { if (hydrated && !isLoggedIn) router.replace(loginUrl); }, [hydrated, isLoggedIn, router, loginUrl]);

  /** Fill form fields from server data, but never overwrite what the user is typing. */
  const applyProfile = useCallback((p: Profile | null, force = false) => {
    // Do not change the comparison baseline while the customer is editing.
    // A background refresh may return normalized/new server data; replacing the
    // baseline without replacing the form values falsely marks the form dirty.
    if (!force && dirtyRef.current) return;
    setProfile(p);
    setFullName(p?.full_name?.trim() ?? '');
    setCity(p?.city?.trim() ?? '');
    setPhoneInput(p?.phone?.trim() || session?.phone?.trim() || '');
    setNotif(notificationsOn(p?.settings));
    // Sync saved language preference across devices.
    const saved = p?.settings?.language;
    if (saved === 'en' || saved === 'hi') setLang(saved);
  }, [session?.phone]);

  const load = useCallback(async (silent = false) => {
    if (!ready || inflight.current) return;
    inflight.current = true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new AuthError('No token');

      // Independent requests: one failing must not blank the whole page.
      const [p, s] = await Promise.allSettled([
        api<Profile>('/api/customer/profile', {}, token),
        api<Stats>('/api/customer/stats', {}, token),
      ]);
      if ([p, s].some((r) => r.status === 'rejected' && r.reason instanceof AuthError)) throw new AuthError('Session expired');

      const nextProfile = p.status === 'fulfilled' ? p.value : null;
      const nextStats = s.status === 'fulfilled' ? s.value : null;
      if (!nextProfile && !profile) throw p.status === 'rejected' ? p.reason : new Error('Could not load your profile.');

      if (nextProfile) applyProfile(nextProfile);
      if (nextStats) setStats(nextStats);
      setPartial(!nextStats);
      if (nextProfile && nextStats) writeCache({ profile: nextProfile, stats: nextStats });
      lastLoad.current = Date.now();
    } catch (e) {
      if (e instanceof AuthError) { clearSession(); router.replace(loginUrl); return; }
      // Keep showing cached/previous data; only surface a hard error if we have nothing.
      if (!profile) setError(e instanceof Error ? e.message : 'Could not load your account.');
      else say('info', t('partial'));
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [ready, profile, applyProfile, router, loginUrl, say, t]);

  // Stale-while-revalidate: paint cached data instantly, refresh in the background.
  useEffect(() => {
    if (!ready) return;
    const cached = readCache();
    if (cached?.profile) { applyProfile(cached.profile); setStats(cached.stats); setLoading(false); }
    void load(Boolean(cached?.profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Auto-heal: refetch when the tab regains focus or the network returns.
  useEffect(() => {
    const refresh = () => { if (Date.now() - lastLoad.current > STALE_MS) void load(true); };
    const onVis = () => document.visibilityState === 'visible' && refresh();
    const on = () => { setOnline(true); void load(true); };
    const off = () => setOnline(false);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [load]);

  /* Form state */
  const origName = profile?.full_name?.trim() ?? '';
  const origCity = profile?.city?.trim() ?? '';
  const origPhone = profile?.phone?.trim() || session?.phone?.trim() || '';
  const origNotif = notificationsOn(profile?.settings);
  const hasChanges =
    fullName.trim() !== origName || city.trim() !== origCity ||
    digits(phoneInput) !== digits(origPhone) || notif !== origNotif;
  dirtyRef.current = hasChanges;

  useEffect(() => {
    // Saving is an intentional action; never interrupt it with the browser's
    // native unsaved-changes dialog. Only guard genuine, unsaved form edits.
    if (!hasChanges || saving || loading) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [hasChanges, saving, loading]);

  const email = session?.email?.trim() ?? '';
  const phone = origPhone;
  const initials = useMemo(() => getInitials(profile?.full_name ?? session?.name ?? 'AuroTap'), [profile?.full_name, session?.name]);

  const missing = useMemo(() => {
    const items: [TKey | string, boolean][] = [
      [lang === 'hi' ? 'नाम' : 'full name', origName.length >= 2],
      [lang === 'hi' ? 'शहर' : 'city', origCity.length >= 2],
      [lang === 'hi' ? 'मोबाइल' : 'mobile number', phone.length > 0],
      [lang === 'hi' ? 'ईमेल' : 'email', email.length > 0],
    ];
    return { pct: Math.round((items.filter((i) => i[1]).length / items.length) * 100), list: items.filter((i) => !i[1]).map((i) => i[0]) };
  }, [origName, origCity, phone, email, lang]);

  const validate = () => {
    const e: Errors = {};
    const name = fullName.trim(), p = digits(phoneInput);
    if (name && name.length < 2) e.full_name = t('nameShort');
    else if (!name && origName) e.full_name = t('nameShort');
    if (!city.trim() && origCity) e.city = t('selectCity');
    if (needsPhone && !origPhone && !p) e.phone = t('phoneNeed');
    else if (p && !/^[6-9]\d{9}$/.test(p)) e.phone = t('phoneBad');
    else if (!p && origPhone) e.phone = t('phoneBad');
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    // Guard against duplicate/no-op submissions from stale UI events.
    if (saving || !hasChanges || !validate()) return;
    if (!navigator.onLine) { say('error', t('offline')); return; }
    setSaving(true);
    const prev = profile;
    try {
      const token = await getToken();
      if (!token) throw new AuthError('No token');
      const base = profile?.settings ?? {};
      const settings: Settings = {
        ...base, language: lang,
        notifications: { ...(base.notifications ?? {}), whatsapp: notif, sms: notif, email: notif, push: notif },
      };
      const body: { full_name?: string; city?: string; phone?: string; settings: Settings } = { settings };
      if (fullName.trim()) body.full_name = fullName.trim();
      if (city.trim()) body.city = city.trim();
      if (digits(phoneInput)) body.phone = digits(phoneInput);
      const saved = await api<Profile>('/api/customer/profile', { method: 'PUT', body: JSON.stringify(body) }, token, 1);
      const next: Profile = saved?.id ? saved : ({ ...prev, ...body, phone: body.phone ?? prev?.phone ?? null } as unknown as Profile);
      dirtyRef.current = false;
      applyProfile(next, true);
      if (next.phone) setNeedsPhone(false);
      updateSession({ name: next.full_name ?? session?.name ?? '', phone: next.phone ?? '' });
      writeCache({ profile: next, stats });
      setErrors({});
      say('success', t('saved'));
      window.dispatchEvent(new CustomEvent('aurotap-profile-saved'));
    } catch (e) {
      if (e instanceof AuthError) { clearSession(); router.replace(loginUrl); return; }
      say('error', e instanceof Error && e.message ? e.message : t('saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    dirtyRef.current = false;
    applyProfile(profile, true);
    setErrors({});
  };

  const focusForm = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    formRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), reduce ? 0 : 350);
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); say('info', t('copied')); }
    catch { say('error', 'Copy is not available in this browser'); }
  };

  /* Guard states */
  if (!hydrated || !isLoggedIn) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-sky-50">
        <p className="text-sm font-semibold text-slate-500" role="status">{t('loading')}</p>
      </main>
    );
  }
  if (!isCustomer) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-xl font-black text-slate-900">{t('customerOnly')}</h1>
          <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white">AuroTap</Link>
        </Card>
      </main>
    );
  }

  const displayName = profile?.full_name || session?.name || 'Welcome';
  const reviews = stats?.total_reviews ?? 0;
  const field = (bad?: string) =>
    `mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${bad ? 'border-rose-300 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`;

  return (
    <>
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <nav aria-label="Account" className="mx-auto flex min-h-14 max-w-6xl items-center gap-1 px-3 sm:px-6">
          <Link href="/customer/account" className="mr-auto text-base font-black tracking-tight text-slate-900">Auro<span className="text-sky-600">Tap</span></Link>
          {([['/', 'home'], ['/customer/home', 'dashboard'], ['/customer/history', 'orders']] as const).map(([href, key]) => (
            <Link key={href} href={href} className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 ${focusRing}`}>{t(key)}</Link>
          ))}
          <span aria-current="page" className="inline-flex min-h-10 items-center rounded-xl bg-sky-50 px-3 text-sm font-bold text-sky-800">{t('account')}</span>
        </nav>
        {!online && <p className="bg-amber-100 px-4 py-1.5 text-center text-xs font-bold text-amber-900" role="status">{t('offline')}</p>}
      </div>

      <main className={`min-h-[100dvh] bg-gradient-to-b from-sky-50 to-white ${hasChanges ? 'pb-[calc(11rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'}`}>
        <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-6">
          {/* Hero: identity first, one accent */}
          <header className="rounded-3xl bg-[#0b2a4a] p-5 text-white sm:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sky-400 text-xl font-black text-[#0b2a4a] sm:h-20 sm:w-20 sm:text-2xl" aria-hidden>{initials}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/60">{t('myAccount')}</p>
                  <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{displayName}</h1>
                  <p className="mt-1 text-sm text-white/75">
                    {profile?.city || t('cityNotSet')} · {t('memberSince')} {monthYear(stats?.member_since ?? profile?.created_at, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5">
                <Ring pct={missing.pct} loading={loading} />
                <div>
                  <p className="text-sm font-black">{t('strength')}</p>
                  <p className="max-w-[12rem] text-xs text-white/70">
                    {loading ? '…' : missing.list.length === 0 ? t('allSet') : `${t('add')} ${missing.list.join(', ')}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:flex">
              <button type="button" onClick={focusForm} className={`min-h-11 rounded-xl bg-white px-5 text-sm font-black text-[#0b2a4a] ${focusRing}`}>{t('editProfile')}</button>
              <Link href="/customer/history" className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-bold ${focusRing}`}>{t('myOrders')}</Link>
            </div>
          </header>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
              <p className="font-black text-rose-900">{t('loadFail')}</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-3 min-h-10 rounded-xl bg-rose-700 px-4 text-sm font-black text-white">{t('retry')}</button>
            </div>
          )}
          {partial && !error && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
              {t('partial')} <button className="font-black underline" onClick={() => void load(true)}>{t('refresh')}</button>
            </p>
          )}

          {/* Activity */}
          <section className="mt-7" aria-label={t('activity')}>
            <Heading title={t('activity')} right={<Link href="/customer/history" className="text-sm font-black text-sky-700 hover:underline">{t('orders')} ›</Link>} />
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Stat loading={loading} icon="📦" value={String(stats?.total_orders ?? 0)} label={t('ordersStat')} />
              <Stat loading={loading} icon="💧" value={String(stats?.cans_ordered ?? 0)} label={t('cans')} />
              <Stat loading={loading} icon="₹" value={inr(stats?.total_spent)} label={t('spent')} />
              <Stat loading={loading} icon="⭐" value={stats?.avg_rating != null ? String(stats.avg_rating) : '—'} label={`${t('rating')}${reviews ? ` (${reviews})` : ''}`} />
            </div>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-5">
            <div className="space-y-8 lg:col-span-3">
              {/* Profile form */}
              <section ref={formRef} className="scroll-mt-20" aria-label={t('profile')}>
                <Heading title={t('profile')} />
                <Card>
                  <div className="space-y-5 p-5 sm:p-6">
                    <div>
                      <div className="flex justify-between">
                        <label htmlFor="f-name" className="text-sm font-bold text-slate-700">{t('fullName')}</label>
                        <span className="text-xs text-slate-400" aria-hidden>{fullName.length}/{NAME_MAX}</span>
                      </div>
                      <input ref={nameRef} id="f-name" value={fullName} maxLength={NAME_MAX} autoComplete="name"
                        onChange={(e) => { setFullName(e.target.value); setErrors((c) => ({ ...c, full_name: undefined })); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && hasChanges) { e.preventDefault(); void save(); } }}
                        className={field(errors.full_name)} aria-invalid={!!errors.full_name} aria-describedby={errors.full_name ? 'e-name' : undefined} />
                      {errors.full_name && <p id="e-name" className="mt-1.5 text-xs font-bold text-rose-600">{errors.full_name}</p>}
                    </div>

                    <div>
                      <label htmlFor="f-city" className="text-sm font-bold text-slate-700">{t('city')}</label>
                      <select id="f-city" value={city} onChange={(e) => { setCity(e.target.value); setErrors((c) => ({ ...c, city: undefined })); }}
                        className={`${field(errors.city)} cursor-pointer`} aria-invalid={!!errors.city}>
                        <option value="">{t('selectCity')}</option>
                        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        {city && !CITIES.includes(city) && <option value={city}>{city}</option>}
                      </select>
                      {errors.city && <p className="mt-1.5 text-xs font-bold text-rose-600">{errors.city}</p>}
                    </div>

                    <div>
                      <label htmlFor="f-phone" className="text-sm font-bold text-slate-700">{t('mobile')}</label>
                      <input id="f-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={16} value={phoneInput}
                        onChange={(e) => { setPhoneInput(e.target.value); setErrors((c) => ({ ...c, phone: undefined })); }}
                        className={field(errors.phone)} placeholder="9876543210" aria-invalid={!!errors.phone} aria-describedby="e-phone" />
                      <p id="e-phone" className={`mt-1.5 text-xs ${errors.phone ? 'font-bold text-rose-600' : 'text-slate-500'}`} role={errors.phone ? 'alert' : undefined}>
                        {errors.phone ?? t('mobileHint')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">{t('notifications')}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{t('notificationsHint')}</p>
                      </div>
                      <Switch on={notif} onChange={setNotif} disabled={saving} label={t('notifications')} />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-sm sm:px-6">
                    {([
                      ['✉️', 'Email', email || '—', email],
                      ['📱', t('mobile'), showPhone ? phone || '—' : maskPhone(phone), phone],
                    ] as const).map(([ic, label, shown, raw], i) => (
                      <div key={label} className="flex items-center gap-3 py-2.5">
                        <span aria-hidden>{ic}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-400">{label}</p>
                          <p className="truncate font-bold text-slate-900">{shown}</p>
                        </div>
                        {i === 1 && phone && <button type="button" className="min-h-9 px-2 text-xs font-bold text-sky-700" onClick={() => setShowPhone((s) => !s)}>{showPhone ? t('hide') : t('show')}</button>}
                        {raw && <button type="button" className="min-h-9 px-2 text-xs font-bold text-sky-700" onClick={() => void copy(raw)}>{t('copy')}</button>}
                      </div>
                    ))}
                  </div>
                </Card>
              </section>

              {/* Language */}
              <section aria-label={t('language')}>
                <Heading title={t('language')} hint={t('languageHint')} />
                <Card className="flex items-center justify-between gap-4 p-4">
                  <span className="text-2xl" aria-hidden>🌐</span>
                  <LangSwitch />
                </Card>
              </section>
            </div>

            <div className="space-y-8 lg:col-span-2">
              <section aria-label={t('shortcuts')}>
                <Heading title={t('shortcuts')} />
                <Card>
                  <Row href="/customer/subscriptions" icon="🔄" title={t('subscriptions')} hint={t('subscriptionsHint')} />
                  <Row href="/customer/loyalty" icon="⭐" title="Subscription rewards" hint="Points, streaks and available offers" />
                  <Row href="/customer/history" icon="📋" title={t('history')} />
                  <Row href="/customer/addresses" icon="📍" title={t('addresses')} />
                  <Row href="/customer/home" icon="📊" title={t('dashboard')} />
                </Card>
              </section>

              <section aria-label={t('support')}>
                <Heading title={t('support')} />
                <Card>
                  <Row href="/customer/support" icon="🎧" title={t('getSupport')} />
                  <Row external href={wa('Hi AuroTap! I need help with my account.')} icon="💬" title={t('whatsapp')} />
                  <Row external href={`tel:${PHONE}`} icon="📞" title={t('call')} hint={PHONE} />
                  <Row href="/terms" icon="📄" title={t('terms')} />
                  <Row external href={wa('Hi AuroTap, I would like to request deletion of my account and data.')} icon="🗑️" title={t('deleteAcc')} />
                </Card>
              </section>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button type="button" onClick={() => void load(true)} className="min-h-9 rounded-xl px-3 text-xs font-bold text-slate-400 hover:text-slate-600">↻ {t('refresh')}</button>
            <button type="button" onClick={() => setSignOutOpen(true)} className={`w-full rounded-2xl border border-rose-200 bg-white py-3.5 text-sm font-black text-rose-700 hover:bg-rose-50 ${focusRing}`}>{t('signOut')}</button>
          </div>
        </div>
      </main>

      {hasChanges && !loading && (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] flex justify-center px-3" role="region" aria-label={t('unsaved')}>
          <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 pl-4 shadow-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
            <p className="flex-1 truncate text-sm font-bold text-slate-800">{t('unsaved')}</p>
            <button type="button" onClick={discard} disabled={saving} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-60">{t('discard')}</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-60">{saving ? t('saving') : t('save')}</button>
          </div>
        </div>
      )}

      <div className={`pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4 ${hasChanges ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]'}`} role="status" aria-live="polite">
        {toast && <div className={`rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl ${toast.kind === 'error' ? 'bg-rose-600' : toast.kind === 'success' ? 'bg-emerald-600' : 'bg-slate-900'}`}>{toast.text}</div>}
      </div>

      {signOutOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="so-title"
          onMouseDown={(e) => e.target === e.currentTarget && setSignOutOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSignOutOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <h2 id="so-title" className="text-center text-xl font-black text-slate-900">{t('signOutQ')}</h2>
            <p className="mt-2 text-center text-sm text-slate-500">{t('signOutBody')}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button autoFocus type="button" onClick={() => setSignOutOpen(false)} className="min-h-11 rounded-xl border border-slate-200 text-sm font-black text-slate-700">{t('cancel')}</button>
              <button type="button" onClick={() => { setSignOutOpen(false); logout({ redirectTo: '/' }); }} className="min-h-11 rounded-xl bg-rose-600 text-sm font-black text-white">{t('signOut')}</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}









// 'use client';

// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import Image from 'next/image';
// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';

// import BottomNav from '@/components/customer/BottomNav';
// import LanguageToggle from '@/components/LanguageToggle';
// import { clearSession, getInitials, useAuth } from '@/hooks/useAuth';
// import { getToken } from '@/lib/api-client';

// /* ------------------------------------------------------------------------ */
// /* Types                                                                      */
// /* -------------------------------------------------------------------------- */

// type NotificationSettings = {
//   whatsapp?: boolean;
//   sms?: boolean;
//   email?: boolean;
//   push?: boolean;
// };

// type AccountSettings = {
//   notifications?: NotificationSettings;
//   language?: 'en' | 'hi';
//   default_payment?: 'cash' | 'upi' | 'online';
//   marketing_opt_in?: boolean;
//   default_address_id?: string | null;

//   /*
//    * Legacy compatibility.
//    * The backend does not use this key for new writes, but older records
//    * may still contain it.
//    */
//   notifications_enabled?: boolean;

//   [key: string]: unknown;
// };

// type ProfilePayload = {
//   id: string;
//   full_name: string | null;
//   city: string | null;
//   phone: string | null;
//   created_at: string | null;
//   settings?: AccountSettings | null;
// };

// type StatsPayload = {
//   total_orders?: number;
//   total_spent?: number;
//   cans_ordered?: number;
//   member_since?: string | null;
//   avg_rating?: number | null;
//   total_reviews?: number;
// };

// type ApiEnvelope<T> = {
//   success?: boolean;
//   data?: T;
//   error?: string;
// };

// type FormErrors = {
//   full_name?: string;
//   city?: string;
//   phone?: string;
// };

// type Toast = { kind: 'success' | 'error' | 'info'; text: string };

// /* -------------------------------------------------------------------------- */
// /* Constants                                                                  */
// /* -------------------------------------------------------------------------- */

// const SUPPORT_PHONE = '+919889305803';

// const WHATSAPP_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
//   'Hi AuroTap! I need help with my account.'
// )}`;

// const DELETE_REQUEST_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
//   'Hi AuroTap, I would like to request deletion of my account and data.'
// )}`;

// const SERVICE_CITIES = [
//   'Kanpur',
//   'Gorakhpur',
//   'Lucknow',
//   'Varanasi',
//   'Prayagraj',
//   'Agra',
//   'Meerut',
//   'Bareilly',
//   'Aligarh',
//   'Mathura',
//   'Delhi',
//   'Noida',
//   'Ghaziabad',
// ] as const;

// const NAME_MAX = 80;

// /* -------------------------------------------------------------------------- */
// /* Helpers                                                                    */
// /* -------------------------------------------------------------------------- */

// function formatINR(value: number | string | null | undefined): string {
//   const amount = Math.round(Number(value) || 0);

//   return `₹${amount.toLocaleString('en-IN')}`;
// }

// function formatMemberSince(iso: string | null | undefined): string {
//   if (!iso) return '—';

//   const timestamp = new Date(iso).getTime();

//   if (Number.isNaN(timestamp)) return '—';

//   return new Date(timestamp).toLocaleDateString('en-IN', {
//     month: 'short',
//     year: 'numeric',
//   });
// }

// function maskPhone(value: string | null | undefined): string {
//   if (!value) return '—';

//   const digits = value.replace(/\D/g, '');

//   if (digits.length < 6) return value;

//   return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
// }

// function getNotificationPreference(settings: AccountSettings | null | undefined): boolean {
//   if (!settings) return true;

//   if (typeof settings.notifications_enabled === 'boolean') {
//     return settings.notifications_enabled;
//   }

//   const notifications = settings.notifications;

//   if (!notifications) return true;

//   const values = [
//     notifications.whatsapp,
//     notifications.sms,
//     notifications.email,
//     notifications.push,
//   ].filter((value) => typeof value === 'boolean') as boolean[];

//   if (!values.length) return true;

//   return values.some(Boolean);
// }

// async function readJson<T>(response: Response): Promise<T> {
//   try {
//     return (await response.json()) as T;
//   } catch {
//     return {} as T;
//   }
// }

// /* -------------------------------------------------------------------------- */
// /* Icons                                                                      */
// /* -------------------------------------------------------------------------- */

// function HomeIcon() {
//   return (
//     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
//     </svg>
//   );
// }

// function GridIcon() {
//   return (
//     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <rect x="4" y="4" width="7" height="7" rx="1.5" />
//       <rect x="13" y="4" width="7" height="7" rx="1.5" />
//       <rect x="4" y="13" width="7" height="7" rx="1.5" />
//       <rect x="13" y="13" width="7" height="7" rx="1.5" />
//     </svg>
//   );
// }

// function ListIcon() {
//   return (
//     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
//     </svg>
//   );
// }

// function PinIcon() {
//   return (
//     <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
//       <circle cx="12" cy="10" r="2.5" />
//     </svg>
//   );
// }

// function ChevronDown() {
//   return (
//     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
//       <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
//     </svg>
//   );
// }

// function LockIcon() {
//   return (
//     <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <rect x="5" y="11" width="14" height="9" rx="2" />
//       <path strokeLinecap="round" d="M8 11V8a4 4 0 118 0v3" />
//     </svg>
//   );
// }

// /* -------------------------------------------------------------------------- */
// /* Small UI components                                                        */
// /* -------------------------------------------------------------------------- */

// /**
//  * Persistent top bar. The public site header is not rendered inside the customer area,
//  * so this gives a one-tap route back to the main site (Home) without losing the dashboard.
//  */
// function TopBar() {
//   const navItem =
//     'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100';
//   const activeItem = 'bg-sky-50 text-sky-800';
//   const idleItem = 'text-slate-600 hover:bg-slate-50 hover:text-sky-800';

//   return (
//     <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top)] shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl">
//       <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-3 sm:px-6 lg:px-8">
//         <Link
//           href="/customer/account"
//           className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
//           aria-label="AuroTap account"
//         >
//           <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-sky-100 transition-transform group-hover:scale-105">
//             <Image
//               src="/splash-logo.svg"
//               alt=""
//               width={36}
//               height={36}
//               className="h-full w-full object-contain"
//               unoptimized
//             />
//           </span>

//           <span className="hidden min-w-0 sm:block">
//             <span className="block truncate text-sm font-black tracking-tight text-slate-950">
//               Auro<span className="text-sky-600">Tap</span>
//             </span>
//             <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
//               Account
//             </span>
//           </span>
//         </Link>

//         <nav aria-label="Account navigation" className="ml-auto flex items-center gap-1">
//           <Link href="/" className={`${navItem} ${idleItem}`}>
//             <HomeIcon />
//             <span className="hidden sm:inline">Home</span>
//           </Link>

//           <Link href="/customer/home" className={`${navItem} ${idleItem}`}>
//             <GridIcon />
//             <span className="hidden sm:inline">Dashboard</span>
//           </Link>

//           <Link href="/customer/history" className={`${navItem} ${idleItem}`}>
//             <ListIcon />
//             <span className="hidden sm:inline">Orders</span>
//           </Link>

//           <span
//             aria-current="page"
//             className={`${navItem} ${activeItem} ml-0.5`}
//           >
//             <span className="hidden sm:inline">Account</span>
//             <span className="sm:hidden" aria-hidden="true">●</span>
//             <span className="sr-only sm:hidden">Account</span>
//           </span>
//         </nav>
//       </div>
//     </div>
//   );
// }

// function SectionTitle({
//   title,
//   description,
//   action,
// }: {
//   title: string;
//   description?: string;
//   action?: React.ReactNode;
// }) {
//   return (
//     <div className="mb-3 flex items-end justify-between gap-3">
//       <div className="min-w-0">
//         <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>

//         {description ? <p className="mt-0.5 text-sm leading-5 text-slate-500">{description}</p> : null}
//       </div>

//       {action ? <div className="shrink-0">{action}</div> : null}
//     </div>
//   );
// }

// function StrengthRing({ pct, loading }: { pct: number; loading: boolean }) {
//   const radius = 30;
//   const circumference = 2 * Math.PI * radius;
//   const offset = circumference * (1 - (loading ? 0 : pct) / 100);

//   return (
//     <div
//       className="relative h-[76px] w-[76px] shrink-0"
//       role="progressbar"
//       aria-label="Profile strength"
//       aria-valuemin={0}
//       aria-valuemax={100}
//       aria-valuenow={loading ? 0 : pct}
//     >
//       <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden="true">
//         <defs>
//           <linearGradient id="aurotap-ring" x1="0" y1="0" x2="1" y2="1">
//             <stop offset="0%" stopColor="#67e8f9" />
//             <stop offset="100%" stopColor="#6ee7b7" />
//           </linearGradient>
//         </defs>
//         <circle cx="38" cy="38" r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
//         <circle
//           cx="38"
//           cy="38"
//           r={radius}
//           fill="none"
//           stroke="url(#aurotap-ring)"
//           strokeWidth="6"
//           strokeLinecap="round"
//           strokeDasharray={circumference}
//           strokeDashoffset={offset}
//           style={{ transition: 'stroke-dashoffset 600ms ease' }}
//         />
//       </svg>

//       <span className="absolute inset-0 flex items-center justify-center text-sm font-black">
//         {loading ? '—' : `${pct}%`}
//       </span>
//     </div>
//   );
// }

// const STAT_TONES = {
//   sky: 'from-sky-100 to-sky-50 text-sky-700',
//   cyan: 'from-cyan-100 to-cyan-50 text-cyan-700',
//   emerald: 'from-emerald-100 to-emerald-50 text-emerald-700',
//   amber: 'from-amber-100 to-amber-50 text-amber-700',
// } as const;

// function StatCard({
//   icon,
//   value,
//   label,
//   hint,
//   tone,
//   loading,
// }: {
//   icon: string;
//   value: string;
//   label: string;
//   hint?: string;
//   tone: keyof typeof STAT_TONES;
//   loading: boolean;
// }) {
//   if (loading) {
//     return (
//       <div
//         className="h-[132px] animate-pulse rounded-2xl border border-slate-100 bg-white motion-reduce:animate-none"
//         aria-hidden="true"
//       />
//     );
//   }

//   return (
//     <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
//       <div
//         className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-lg ${STAT_TONES[tone]}`}
//         aria-hidden="true"
//       >
//         {icon}
//       </div>

//       <p className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950">{value}</p>

//       <p className="mt-0.5 text-sm font-semibold text-slate-600">{label}</p>

//       {hint ? <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p> : null}
//     </div>
//   );
// }

// /** One row used for shortcuts and support. Internal links use <Link>, others a plain <a>. */
// function ActionRow({
//   href,
//   icon,
//   title,
//   description,
//   external,
//   tone = 'sky',
// }: {
//   href: string;
//   icon: string;
//   title: string;
//   description: string;
//   external?: boolean;
//   tone?: 'sky' | 'emerald' | 'violet' | 'rose';
// }) {
//   const tones: Record<string, string> = {
//     sky: 'bg-sky-50',
//     emerald: 'bg-emerald-50',
//     violet: 'bg-violet-50',
//     rose: 'bg-rose-50',
//   };

//   const className =
//     'group flex min-h-[68px] items-center gap-3 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50';

//   const body = (
//     <>
//       <span
//         className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${tones[tone]}`}
//         aria-hidden="true"
//       >
//         {icon}
//       </span>

//       <span className="min-w-0 flex-1">
//         <span className="block text-sm font-bold text-slate-900">{title}</span>
//         <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
//       </span>

//       <span
//         className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500"
//         aria-hidden="true"
//       >
//         →
//       </span>
//     </>
//   );

//   if (external) {
//     const isWeb = href.startsWith('http');
//     return (
//       <a href={href} className={className} {...(isWeb ? { target: '_blank', rel: 'noreferrer' } : {})}>
//         {body}
//       </a>
//     );
//   }

//   return (
//     <Link href={href} className={className}>
//       {body}
//     </Link>
//   );
// }

// function ReadOnlyRow({
//   icon,
//   title,
//   value,
//   actions,
// }: {
//   icon: string;
//   title: string;
//   value: string;
//   actions?: React.ReactNode;
// }) {
//   return (
//     <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 last:border-b-0 sm:px-6">
//       <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg" aria-hidden="true">
//         {icon}
//       </span>

//       <div className="min-w-0 flex-1">
//         <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
//           {title}
//           <span className="text-slate-300">
//             <LockIcon />
//           </span>
//         </p>

//         <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{value}</p>
//       </div>

//       {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
//     </div>
//   );
// }

// function MiniButton({
//   onClick,
//   children,
//   label,
// }: {
//   onClick: () => void;
//   children: React.ReactNode;
//   label?: string;
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       aria-label={label}
//       className="min-h-9 rounded-lg px-2.5 text-xs font-bold text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
//     >
//       {children}
//     </button>
//   );
// }

// function Toggle({
//   checked,
//   onChange,
//   disabled,
//   label,
// }: {
//   checked: boolean;
//   onChange: (value: boolean) => void;
//   disabled?: boolean;
//   label: string;
// }) {
//   return (
//     <button
//       type="button"
//       role="switch"
//       aria-checked={checked}
//       aria-label={label}
//       disabled={disabled}
//       onClick={() => onChange(!checked)}
//       className={[
//         'relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100',
//         checked ? 'bg-emerald-600' : 'bg-slate-300',
//         disabled ? 'cursor-not-allowed opacity-60' : '',
//       ].join(' ')}
//     >
//       <span
//         className={[
//           'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
//           checked ? 'translate-x-6' : 'translate-x-1',
//         ].join(' ')}
//       />
//     </button>
//   );
// }

// function LoadingCard() {
//   return (
//     <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm" aria-hidden="true">
//       <div className="h-5 w-28 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-5 h-5 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-5 h-20 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
//     </div>
//   );
// }

// function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
//   return (
//     <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5" role="alert">
//       <div className="flex items-start gap-3">
//         <span
//           className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
//           aria-hidden="true"
//         >
//           !
//         </span>

//         <div className="min-w-0 flex-1">
//           <p className="font-black text-rose-900">We couldn&apos;t load your account</p>

//           <p className="mt-1 text-sm leading-6 text-rose-700">{message}</p>

//           <button
//             type="button"
//             onClick={onRetry}
//             className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
//           >
//             Try again
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ToastView({ toast, lifted }: { toast: Toast | null; lifted: boolean }) {
//   const tone =
//     toast?.kind === 'error' ? 'bg-rose-600' : toast?.kind === 'success' ? 'bg-emerald-600' : 'bg-slate-900';

//   return (
//     <div
//       className={`pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4 ${
//         lifted
//           ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]'
//           : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]'
//       }`}
//       role="status"
//       aria-live="polite"
//     >
//       {toast ? (
//         <div
//           className={`pointer-events-auto rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl shadow-slate-900/20 ${tone}`}
//         >
//           {toast.text}
//         </div>
//       ) : null}
//     </div>
//   );
// }

// /** Floating save bar. Sits above the bottom navigation so Save is always one tap away. */
// function UnsavedBar({
//   saving,
//   onDiscard,
//   onSave,
// }: {
//   saving: boolean;
//   onDiscard: () => void;
//   onSave: () => void;
// }) {
//   return (
//     <div
//       className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] flex justify-center px-3"
//       role="region"
//       aria-label="Unsaved changes"
//     >
//       <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-2.5 pl-4 shadow-2xl shadow-slate-900/15 backdrop-blur-xl">
//         <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
//           <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
//           <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
//         </span>

//         <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">Unsaved changes</p>

//         <button
//           type="button"
//           onClick={onDiscard}
//           disabled={saving}
//           className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 disabled:opacity-60"
//         >
//           Discard
//         </button>

//         <button
//           type="button"
//           onClick={onSave}
//           disabled={saving}
//           className="min-h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 text-sm font-black text-white shadow-md shadow-emerald-500/25 transition hover:opacity-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
//         >
//           {saving ? 'Saving…' : 'Save changes'}
//         </button>
//       </div>
//     </div>
//   );
// }

// function SignOutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
//   const cancelRef = useRef<HTMLButtonElement | null>(null);

//   useEffect(() => {
//     const onKeyDown = (event: KeyboardEvent) => {
//       if (event.key === 'Escape') onCancel();
//     };

//     const previous = document.body.style.overflow;
//     document.body.style.overflow = 'hidden';
//     document.addEventListener('keydown', onKeyDown);
//     cancelRef.current?.focus();

//     return () => {
//       document.body.style.overflow = previous;
//       document.removeEventListener('keydown', onKeyDown);
//     };
//   }, [onCancel]);

//   return (
//     <div
//       className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
//       role="dialog"
//       aria-modal="true"
//       aria-labelledby="sign-out-title"
//       onMouseDown={(event) => {
//         if (event.target === event.currentTarget) onCancel();
//       }}
//     >
//       <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
//         <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl" aria-hidden="true">
//           👋
//         </div>

//         <h2 id="sign-out-title" className="mt-5 text-center text-xl font-black text-slate-950">
//           Sign out of AuroTap?
//         </h2>

//         <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
//           You can sign in again whenever you need your orders, addresses, and account details.
//         </p>

//         <div className="mt-6 grid grid-cols-2 gap-3">
//           <button
//             ref={cancelRef}
//             type="button"
//             onClick={onCancel}
//             className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
//           >
//             Cancel
//           </button>

//           <button
//             type="button"
//             onClick={onConfirm}
//             className="min-h-11 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
//           >
//             Sign out
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* -------------------------------------------------------------------------- */
// /* Page                                                                       */
// /* -------------------------------------------------------------------------- */

// export default function CustomerAccountPage() {
//   const router = useRouter();
//   const pathname = usePathname() ?? '/customer/account';

//   const { hydrated, isLoggedIn, isCustomer, session, updateSession, logout } = useAuth();

//   const [profile, setProfile] = useState<ProfilePayload | null>(null);
//   const [stats, setStats] = useState<StatsPayload | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [saveError, setSaveError] = useState<string | null>(null);

//   const [fullName, setFullName] = useState('');
//   const [city, setCity] = useState('');
//   const [phoneInput, setPhoneInput] = useState('');
//   const [notificationsEnabled, setNotificationsEnabled] = useState(true);
//   const [formErrors, setFormErrors] = useState<FormErrors>({});

//   const [signOutOpen, setSignOutOpen] = useState(false);
//   const [showPhone, setShowPhone] = useState(false);
//   const [copied, setCopied] = useState<'phone' | 'email' | null>(null);
//   const [toast, setToast] = useState<Toast | null>(null);
//   const [needsPhoneCompletion, setNeedsPhoneCompletion] = useState(false);

//   const toastTimer = useRef<number | null>(null);
//   const copyTimer = useRef<number | null>(null);
//   const nameInputRef = useRef<HTMLInputElement | null>(null);
//   const formRef = useRef<HTMLElement | null>(null);

//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       setNeedsPhoneCompletion(new URLSearchParams(window.location.search).get('complete') === 'phone');
//     }
//   }, []);

//   const ready = hydrated && isLoggedIn && isCustomer;

//   const showToast = useCallback((next: Toast) => {
//     setToast(next);
//     if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
//     toastTimer.current = window.setTimeout(() => setToast(null), 2800);
//   }, []);

//   useEffect(
//     () => () => {
//       if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
//       if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
//     },
//     []
//   );

//   /* ── Auth guard ───────────────────────────────────────────────────── */
//   useEffect(() => {
//     if (!hydrated) return;

//     if (!isLoggedIn) {
//       router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//     }
//   }, [hydrated, isLoggedIn, router, pathname]);

//   /* ── Load account data in parallel ───────────────────────────────── */
//   const load = useCallback(
//     async (showRefreshState = false) => {
//       if (!hydrated) return;

//       if (!isLoggedIn || !isCustomer) {
//         router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }

//       if (showRefreshState) {
//         setRefreshing(true);
//       } else {
//         setLoading(true);
//       }

//       setError(null);

//       try {
//         const token = await getToken();

//         if (!token) {
//           clearSession();
//           router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//           return;
//         }

//         const headers = { Authorization: `Bearer ${token}` };

//         const [profileResponse, statsResponse] = await Promise.all([
//           fetch('/api/customer/profile', {
//             credentials: 'include',
//             headers,
//             cache: 'no-store',
//           }),
//           fetch('/api/customer/stats', {
//             credentials: 'include',
//             headers,
//             cache: 'no-store',
//           }),
//         ]);

//         if (profileResponse.status === 401 || statsResponse.status === 401) {
//           clearSession();
//           router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//           return;
//         }

//         const profileJson = await readJson<ApiEnvelope<ProfilePayload>>(profileResponse);
//         const statsJson = await readJson<ApiEnvelope<StatsPayload>>(statsResponse);

//         if (!profileResponse.ok || profileJson.success === false) {
//           throw new Error(profileJson.error ?? 'Could not load your profile.');
//         }

//         if (!statsResponse.ok || statsJson.success === false) {
//           throw new Error(statsJson.error ?? 'Could not load your account activity.');
//         }

//         const nextProfile = profileJson.data ?? null;
//         const nextStats = statsJson.data ?? null;

//         setProfile(nextProfile);
//         setStats(nextStats);

//         setFullName(nextProfile?.full_name?.trim() ?? '');
//         setCity(nextProfile?.city?.trim() ?? '');
//         setPhoneInput(nextProfile?.phone?.trim() || session?.phone?.trim() || '');
//         setNotificationsEnabled(getNotificationPreference(nextProfile?.settings));
//         setSaveError(null);
//       } catch (cause) {
//         setError(cause instanceof Error ? cause.message : 'Could not load your account.');
//       } finally {
//         setLoading(false);
//         setRefreshing(false);
//       }
//     },
//     [hydrated, isLoggedIn, isCustomer, pathname, router, session?.phone]
//   );

//   useEffect(() => {
//     if (ready) void load();
//   }, [ready, load]);

//   /* ── Form state ──────────────────────────────────────────────────── */
//   const originalName = profile?.full_name?.trim() ?? '';
//   const originalCity = profile?.city?.trim() ?? '';
//   const originalPhone = profile?.phone?.trim() || session?.phone?.trim() || '';
//   const originalNotifications = getNotificationPreference(profile?.settings);

//   const hasChanges =
//     fullName.trim() !== originalName ||
//     city.trim() !== originalCity ||
//     phoneInput.replace(/\D/g, '') !== originalPhone.replace(/\D/g, '') ||
//     notificationsEnabled !== originalNotifications;

//   const initials = useMemo(
//     () => getInitials(profile?.full_name ?? session?.name ?? 'AuroTap'),
//     [profile?.full_name, session?.name]
//   );

//   const email = session?.email?.trim() ?? '';
//   const phone = profile?.phone?.trim() || session?.phone?.trim() || '';

//   const memberSince = formatMemberSince(stats?.member_since ?? profile?.created_at);

//   /* ── Profile strength (from saved data, not unsaved edits) ───────── */
//   const completeness = useMemo(() => {
//     const items = [
//       { key: 'name', label: 'full name', done: originalName.length >= 2 },
//       { key: 'city', label: 'city', done: originalCity.length >= 2 },
//       { key: 'phone', label: 'mobile number', done: phone.length > 0 },
//       { key: 'email', label: 'email', done: email.length > 0 },
//     ];
//     const doneCount = items.filter((item) => item.done).length;

//     return {
//       pct: Math.round((doneCount / items.length) * 100),
//       missing: items.filter((item) => !item.done),
//     };
//   }, [originalName, originalCity, phone, email]);

//   /* ── Warn before closing the tab with unsaved edits ──────────────── */
//   useEffect(() => {
//     if (!hasChanges) return;

//     const onBeforeUnload = (event: BeforeUnloadEvent) => {
//       event.preventDefault();
//       event.returnValue = '';
//     };

//     window.addEventListener('beforeunload', onBeforeUnload);
//     return () => window.removeEventListener('beforeunload', onBeforeUnload);
//   }, [hasChanges]);

//   const validateForm = (): boolean => {
//     const nextErrors: FormErrors = {};

//     const name = fullName.trim();
//     const selectedCity = city.trim();
//     const normalizedPhone = phoneInput.replace(/\D/g, '');
//     const phoneIsRequired = needsPhoneCompletion && !originalPhone;

//     // A phone-only completion must not be blocked because a legacy profile has
//     // no city. Validate optional fields only when the user supplies/changes them.
//     if (name.length > 0 && name.length < 2) {
//       nextErrors.full_name = 'Enter at least 2 characters.';
//     } else if (name.length > NAME_MAX) {
//       nextErrors.full_name = `Name must be ${NAME_MAX} characters or fewer.`;
//     } else if (!name && originalName.length > 0) {
//       nextErrors.full_name = 'Full name cannot be empty.';
//     }

//     if (selectedCity.length > 0 && selectedCity.length < 2) {
//       nextErrors.city = 'Select a valid city.';
//     } else if (!selectedCity && originalCity.length > 0) {
//       nextErrors.city = 'City cannot be empty.';
//     }

//     if (phoneIsRequired && !normalizedPhone) {
//       nextErrors.phone = 'Enter your mobile number to finish account setup.';
//     } else if (normalizedPhone && !/^[6-9]\d{9}$/.test(normalizedPhone)) {
//       nextErrors.phone = 'Enter a valid 10-digit Indian mobile number.';
//     } else if (!normalizedPhone && originalPhone) {
//       nextErrors.phone = 'Enter a valid mobile number or keep the saved number.';
//     }

//     setFormErrors(nextErrors);

//     return Object.keys(nextErrors).length === 0;
//   };

//   /* ── Save ────────────────────────────────────────────────────────── */
//   const handleSave = async () => {
//     if (!validateForm() || saving) return;

//     setSaving(true);
//     setSaveError(null);

//     try {
//       const token = await getToken();

//       if (!token) {
//         clearSession();
//         router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }

//       const existingSettings = profile?.settings ?? {};
//       const existingNotifications = existingSettings.notifications ?? {};

//       /*
//        * IMPORTANT:
//        * The backend profile API accepts the nested `settings.notifications` structure.
//        * Do NOT send `notifications_enabled` as a new backend field because it is not
//        * part of the API whitelist.
//        */
//       const nextSettings: AccountSettings = {
//         ...existingSettings,
//         notifications: {
//           ...existingNotifications,
//           whatsapp: notificationsEnabled,
//           sms: notificationsEnabled,
//           email: notificationsEnabled,
//           push: notificationsEnabled,
//         },
//       };

//       const response = await fetch('/api/customer/profile', {
//         method: 'PUT',
//         credentials: 'include',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({
//           ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
//           ...(city.trim() ? { city: city.trim() } : {}),
//           ...(phoneInput.replace(/\D/g, '') ? { phone: phoneInput.replace(/\D/g, '') } : {}),
//           settings: nextSettings,
//         }),
//       });

//       if (response.status === 401) {
//         clearSession();
//         router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }

//       const json = await readJson<ApiEnvelope<ProfilePayload>>(response);

//       if (!response.ok || json.success === false) {
//         throw new Error(json.error ?? 'Could not save your profile.');
//       }

//       const savedProfile =
//         json.data ??
//         ({
//           ...profile,
//           full_name: fullName.trim() || profile?.full_name || '',
//           city: city.trim() || profile?.city || '',
//           phone: phoneInput.replace(/\D/g, '') || profile?.phone || null,
//           settings: nextSettings,
//         } as ProfilePayload);

//       setProfile(savedProfile);
//       if (savedProfile.phone) setNeedsPhoneCompletion(false);

//       updateSession({
//         name: savedProfile.full_name ?? session?.name ?? '',
//         phone: savedProfile.phone ?? '',
//       });

//       setFormErrors({});
//       showToast({ kind: 'success', text: 'Profile saved' });

//       window.dispatchEvent(new CustomEvent('aurotap-profile-saved'));
//     } catch (cause) {
//       const message = cause instanceof Error ? cause.message : 'Could not save your profile.';

//       setSaveError(message);
//       showToast({ kind: 'error', text: 'Could not save changes' });
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDiscard = () => {
//     setFullName(originalName);
//     setCity(originalCity);
//     setPhoneInput(originalPhone);
//     setNotificationsEnabled(originalNotifications);
//     setFormErrors({});
//     setSaveError(null);
//   };

//   const handleEditProfile = () => {
//     const reduce =
//       typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

//     formRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

//     window.setTimeout(() => nameInputRef.current?.focus({ preventScroll: true }), reduce ? 0 : 350);
//   };

//   /* ── Clipboard ───────────────────────────────────────────────────── */
//   const handleCopy = async (kind: 'phone' | 'email', value: string) => {
//     if (!value) return;

//     try {
//       await navigator.clipboard.writeText(value);

//       setCopied(kind);
//       if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
//       copyTimer.current = window.setTimeout(() => setCopied(null), 1800);

//       showToast({ kind: 'info', text: kind === 'phone' ? 'Number copied' : 'Email copied' });
//     } catch {
//       setCopied(null);
//       showToast({ kind: 'error', text: 'Copy is not available in this browser' });
//     }
//   };

//   /* ── States ──────────────────────────────────────────────────────── */
//   if (!hydrated || (hydrated && !isLoggedIn)) {
//     return (
//       <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
//         <div className="text-center">
//           <div
//             className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 motion-reduce:animate-none"
//             aria-hidden="true"
//           />

//           <p className="mt-4 text-sm font-semibold text-slate-500" role="status">
//             Loading your account…
//           </p>
//         </div>
//       </main>
//     );
//   }

//   if (!isCustomer) {
//     return (
//       <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
//         <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
//           <div
//             className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600"
//             aria-hidden="true"
//           >
//             !
//           </div>

//           <h1 className="mt-5 text-xl font-black text-slate-950">Customer account required</h1>

//           <p className="mt-2 text-sm leading-6 text-slate-500">
//             This account area is only available to customer accounts.
//           </p>

//           <Link
//             href="/"
//             className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
//           >
//             Back to AuroTap
//           </Link>
//         </div>
//       </main>
//     );
//   }

//   const displayName = profile?.full_name || session?.name || 'Welcome';
//   const reviewCount = stats?.total_reviews ?? 0;

//   const inputBase =
//     'mt-2 min-h-12 w-full rounded-xl border bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-4';

//   return (
//     <>
//       <style>{`
//         .aurotap-account {
//           min-height: 100dvh;
//           background:
//             radial-gradient(circle at top right, rgba(14,165,233,0.10), transparent 28%),
//             linear-gradient(180deg, #eff8ff 0%, #f8fbff 32%, #ffffff 100%);
//         }

//         .aurotap-account *,
//         .aurotap-account *::before,
//         .aurotap-account *::after {
//           box-sizing: border-box;
//         }

//         @media (prefers-reduced-motion: reduce) {
//           .aurotap-account *,
//           .aurotap-account *::before,
//           .aurotap-account *::after {
//             scroll-behavior: auto !important;
//             animation-duration: 0.01ms !important;
//             animation-iteration-count: 1 !important;
//             transition-duration: 0.01ms !important;
//           }
//         }
//       `}</style>

//       <TopBar />

//       <main
//         className={`aurotap-account ${
//           hasChanges
//             ? 'pb-[calc(11rem+env(safe-area-inset-bottom))]'
//             : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'
//         }`}
//       >
//         <div className="mx-auto w-full max-w-6xl px-3 pt-4 sm:px-5 sm:pt-6 lg:px-8">
//           {/* ---------------------------------------------------------------- */}
//           {/* Profile hero                                                     */}
//           {/* ---------------------------------------------------------------- */}
//           <header className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#071f38] via-[#0f4a8f] to-[#0ea5e9] p-4 text-white shadow-xl shadow-sky-300/30 sm:rounded-3xl sm:p-7">
//             <div className="pointer-events-none absolute inset-0" aria-hidden="true">
//               <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
//               <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
//             </div>

//             <div className="relative flex flex-col gap-5 sm:gap-6 md:flex-row md:items-center">
//               <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-5">
//                 <div
//                   className="shrink-0 rounded-full bg-gradient-to-br from-cyan-200 via-white/70 to-sky-300 p-[3px] shadow-lg shadow-black/20"
//                   aria-hidden="true"
//                 >
//                   <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0a3a6b] text-xl font-black sm:h-20 sm:w-20 sm:text-2xl">
//                     {initials}
//                   </div>
//                 </div>

//                 <div className="min-w-0">
//                   <p className="text-sm font-semibold text-white/65">My account</p>

//                   <h1 className="mt-0.5 truncate text-2xl font-black tracking-tight sm:text-3xl">
//                     {loading && !session?.name ? (
//                       <span
//                         className="inline-block h-7 w-44 animate-pulse rounded-lg bg-white/20 align-middle motion-reduce:animate-none"
//                         aria-label="Loading name"
//                       />
//                     ) : (
//                       displayName
//                     )}
//                   </h1>

//                   <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold">
//                     <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90">
//                       <PinIcon />
//                       {profile?.city || 'City not set'}
//                     </span>

//                     <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90">
//                       Member since {memberSince}
//                     </span>
//                   </div>
//                 </div>
//               </div>

//               <div className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 pr-4 backdrop-blur sm:w-auto sm:gap-4 sm:p-3.5 sm:pr-5">
//                 <StrengthRing pct={completeness.pct} loading={loading} />

//                 <div className="min-w-0">
//                   <p className="text-sm font-black">Profile strength</p>

//                   <p className="mt-0.5 max-w-[11rem] text-xs leading-4 text-white/70">
//                     {loading
//                       ? 'Checking your details…'
//                       : completeness.missing.length === 0
//                         ? 'All set for faster booking'
//                         : `Add your ${completeness.missing.map((item) => item.label).join(', ')}`}
//                   </p>
//                 </div>
//               </div>
//             </div>

//             <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
//               <button
//                 type="button"
//                 onClick={handleEditProfile}
//                 className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-3 text-sm font-black text-[#0a3a6b] shadow-md shadow-black/10 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40 sm:w-auto sm:px-5"
//               >
//                 Edit profile
//               </button>

//               <Link
//                 href="/customer/history"
//                 className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:w-auto sm:px-5"
//               >
//                 My orders
//               </Link>
//             </div>
//           </header>

//           {error ? (
//             <div className="mt-5">
//               <ErrorCard message={error} onRetry={() => void load()} />
//             </div>
//           ) : null}

//           {needsPhoneCompletion && !phone ? (
//             <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950" role="status">
//               <p className="font-black">Add your mobile number to finish setting up your account</p>
//               <p className="mt-1 text-sm leading-6">Google sign-in does not reliably share a phone number. Enter your 10-digit Indian mobile number under Profile details and save it so delivery updates can reach you.</p>
//               <button type="button" onClick={handleEditProfile} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">
//                 Add mobile number
//               </button>
//             </section>
//           ) : null}

//           {/* Activity */}
//           <section className="mt-6 sm:mt-8" aria-labelledby="account-activity">
//             <SectionTitle
//               title="Your activity"
//               description="A quick view of your AuroTap usage."
//               action={
//                 <Link href="/customer/history" className="text-sm font-black text-sky-700 hover:underline">
//                   View orders →
//                 </Link>
//               }
//             />
//             <span id="account-activity" className="sr-only">
//               Your activity
//             </span>

//             <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
//               <StatCard
//                 icon="📦"
//                 tone="sky"
//                 value={String(stats?.total_orders ?? 0)}
//                 label="Orders"
//                 hint="All time"
//                 loading={loading}
//               />

//               <StatCard
//                 icon="💧"
//                 tone="cyan"
//                 value={String(stats?.cans_ordered ?? 0)}
//                 label="Cans"
//                 hint="Delivered to you"
//                 loading={loading}
//               />

//               <StatCard
//                 icon="₹"
//                 tone="emerald"
//                 value={formatINR(stats?.total_spent ?? 0)}
//                 label="Total spent"
//                 hint="On completed orders"
//                 loading={loading}
//               />

//               <StatCard
//                 icon="⭐"
//                 tone="amber"
//                 value={stats?.avg_rating != null ? String(stats.avg_rating) : '—'}
//                 label="Your rating"
//                 hint={reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No ratings yet'}
//                 loading={loading}
//               />
//             </div>
//           </section>

//           <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-5">
//             {/* ───────── Left column: profile + preferences ───────── */}
//             <div className="space-y-8 lg:col-span-3">
//               <section ref={formRef} className="scroll-mt-20" aria-label="Profile details">
//                 <SectionTitle title="Profile details" description="Keep your delivery information up to date." />

//                 {loading ? (
//                   <LoadingCard />
//                 ) : (
//                   <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.14)]">
//                     <div className="space-y-5 p-5 sm:p-6">
//                       <div>
//                         <div className="flex items-baseline justify-between">
//                           <label htmlFor="customer-full-name" className="text-sm font-bold text-slate-700">
//                             Full name
//                           </label>

//                           <span className="text-xs font-medium text-slate-400" aria-hidden="true">
//                             {fullName.length}/{NAME_MAX}
//                           </span>
//                         </div>

//                         <input
//                           ref={nameInputRef}
//                           id="customer-full-name"
//                           value={fullName}
//                           onChange={(event) => {
//                             setFullName(event.target.value);

//                             if (formErrors.full_name) {
//                               setFormErrors((current) => ({ ...current, full_name: undefined }));
//                             }

//                             setSaveError(null);
//                           }}
//                           onKeyDown={(event) => {
//                             if (event.key === 'Enter' && hasChanges) {
//                               event.preventDefault();
//                               void handleSave();
//                             }
//                           }}
//                           autoComplete="name"
//                           maxLength={NAME_MAX}
//                           className={[
//                             inputBase,
//                             formErrors.full_name
//                               ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
//                               : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
//                           ].join(' ')}
//                           placeholder="Enter your full name"
//                           aria-invalid={Boolean(formErrors.full_name)}
//                           aria-describedby={formErrors.full_name ? 'full-name-error' : undefined}
//                         />

//                         {formErrors.full_name ? (
//                           <p id="full-name-error" className="mt-1.5 text-xs font-bold text-rose-600">
//                             {formErrors.full_name}
//                           </p>
//                         ) : null}
//                       </div>

//                       <div>
//                         <label htmlFor="customer-city" className="text-sm font-bold text-slate-700">
//                           City
//                         </label>

//                         <div className="relative">
//                           <select
//                             id="customer-city"
//                             value={city}
//                             onChange={(event) => {
//                               setCity(event.target.value);
//                               setFormErrors((current) => ({ ...current, city: undefined }));
//                               setSaveError(null);
//                             }}
//                             className={[
//                               inputBase,
//                               'cursor-pointer appearance-none pr-11',
//                               formErrors.city
//                                 ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
//                                 : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
//                             ].join(' ')}
//                             aria-invalid={Boolean(formErrors.city)}
//                             aria-describedby={formErrors.city ? 'city-error' : undefined}
//                           >
//                             <option value="">Select your city</option>

//                             {SERVICE_CITIES.map((serviceCity) => (
//                               <option key={serviceCity} value={serviceCity}>
//                                 {serviceCity}
//                               </option>
//                             ))}

//                             {city && !SERVICE_CITIES.includes(city as (typeof SERVICE_CITIES)[number]) ? (
//                               <option value={city}>{city}</option>
//                             ) : null}
//                           </select>

//                           <span className="pointer-events-none absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400">
//                             <ChevronDown />
//                           </span>
//                         </div>

//                         {formErrors.city ? (
//                           <p id="city-error" className="mt-1.5 text-xs font-bold text-rose-600">
//                             {formErrors.city}
//                           </p>
//                         ) : null}
//                       </div>

//                       <div>
//                         <label htmlFor="customer-phone" className="text-sm font-bold text-slate-700">
//                           Mobile number
//                         </label>
//                         <input
//                           id="customer-phone"
//                           type="tel"
//                           inputMode="numeric"
//                           autoComplete="tel-national"
//                           maxLength={16}
//                           value={phoneInput}
//                           onChange={(event) => {
//                             setPhoneInput(event.target.value);
//                             setFormErrors((current) => ({ ...current, phone: undefined }));
//                             setSaveError(null);
//                           }}
//                           className={[
//                             inputBase,
//                             formErrors.phone
//                               ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
//                               : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
//                           ].join(' ')}
//                           placeholder="Enter your 10-digit mobile number"
//                           aria-invalid={Boolean(formErrors.phone)}
//                           aria-describedby={formErrors.phone ? 'customer-phone-error' : 'customer-phone-hint'}
//                         />
//                         {formErrors.phone ? (
//                           <p id="customer-phone-error" className="mt-1.5 text-xs font-bold text-rose-600" role="alert">
//                             {formErrors.phone}
//                           </p>
//                         ) : (
//                           <p id="customer-phone-hint" className="mt-1.5 text-xs text-slate-500">
//                             Used for delivery coordination. Save a valid Indian mobile number.
//                           </p>
//                         )}
//                       </div>

//                       <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
//                         <div className="flex items-center justify-between gap-4">
//                           <div className="min-w-0">
//                             <p className="text-sm font-black text-slate-900">Order notifications</p>

//                             <p className="mt-1 text-xs leading-5 text-slate-500">
//                               Updates about your bookings and orders.
//                             </p>
//                           </div>

//                           <Toggle
//                             checked={notificationsEnabled}
//                             disabled={saving}
//                             label="Toggle order notifications"
//                             onChange={(value) => {
//                               setNotificationsEnabled(value);
//                               setSaveError(null);
//                             }}
//                           />
//                         </div>

//                         <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Channels">
//                           {['WhatsApp', 'SMS', 'Email', 'Push'].map((channel) => (
//                             <li
//                               key={channel}
//                               className={[
//                                 'rounded-full border px-2.5 py-1 text-[11px] font-bold transition',
//                                 notificationsEnabled
//                                   ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
//                                   : 'border-slate-200 bg-white text-slate-400',
//                               ].join(' ')}
//                             >
//                               {channel}
//                             </li>
//                           ))}
//                         </ul>
//                       </div>

//                       {saveError ? (
//                         <p
//                           className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
//                           role="alert"
//                         >
//                           {saveError}
//                         </p>
//                       ) : null}
//                     </div>

//                     {/* Read-only identity */}
//                     <div className="border-t border-slate-100 bg-slate-50/40">
//                       <ReadOnlyRow
//                         icon="✉️"
//                         title="Login email"
//                         value={email || 'Not available'}
//                         actions={
//                           email ? (
//                             <MiniButton onClick={() => void handleCopy('email', email)} label="Copy email">
//                               {copied === 'email' ? 'Copied' : 'Copy'}
//                             </MiniButton>
//                           ) : null
//                         }
//                       />

//                       <ReadOnlyRow
//                         icon="📱"
//                         title="Mobile number"
//                         value={showPhone ? phone || '—' : maskPhone(phone)}
//                         actions={
//                           phone ? (
//                             <>
//                               <MiniButton
//                                 onClick={() => setShowPhone((current) => !current)}
//                                 label={showPhone ? 'Hide mobile number' : 'Show mobile number'}
//                               >
//                                 {showPhone ? 'Hide' : 'Show'}
//                               </MiniButton>

//                               <MiniButton onClick={() => void handleCopy('phone', phone)} label="Copy mobile number">
//                                 {copied === 'phone' ? 'Copied' : 'Copy'}
//                               </MiniButton>
//                             </>
//                           ) : null
//                         }
//                       />

//                       <p className="px-5 pb-4 pt-1 text-xs leading-5 text-slate-500 sm:px-6">
//                         You can update your mobile number in Profile details. Your login email remains read-only for account security.
//                       </p>
//                     </div>
//                   </div>
//                 )}
//               </section>

//               {/* Language */}
//               <section aria-label="Language">
//                 <SectionTitle title="Language" description="Choose how AuroTap is displayed." />

//                 <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
//                   <div className="flex min-w-0 items-center gap-3">
//                     <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg" aria-hidden="true">
//                       🌐
//                     </span>

//                     <div>
//                       <p className="text-sm font-black text-slate-900">App language</p>

//                       <p className="mt-0.5 text-xs font-medium text-slate-500">English or Hindi</p>
//                     </div>
//                   </div>

//                   <LanguageToggle />
//                 </div>
//               </section>
//             </div>

//             {/* ───────── Right column: shortcuts + support ───────── */}
//             <div className="space-y-8 lg:col-span-2">
//               <section aria-label="Account shortcuts">
//                 <SectionTitle title="Account shortcuts" description="Quick access to the things you use most." />

//                 <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
//                   <ActionRow
//                     href="/"
//                     icon="🏠"
//                     title="AuroTap home"
//                     description="Back to the main website"
//                     tone="emerald"
//                   />

//                   <ActionRow
//                     href="/customer/home"
//                     icon="📊"
//                     title="Customer dashboard"
//                     description="Orders, tracking and quick actions"
//                   />

//                   <ActionRow
//                     href="/customer/addresses"
//                     icon="📍"
//                     title="My addresses"
//                     description="Your saved delivery locations"
//                   />

//                   <ActionRow
//                     href="/customer/history"
//                     icon="📋"
//                     title="Order history"
//                     description="Previous and current orders"
//                   />

//                   <ActionRow
//                     href="/customer/subscriptions"
//                     icon="🔄"
//                     title="My subscriptions"
//                     description="Pause, resume or cancel deliveries"
//                   />

//                   <ActionRow href="/pricing" icon="🏷️" title="Pricing" description="Available service pricing" />
//                 </div>
//               </section>

//               <section aria-label="Support">
//                 <SectionTitle title="AuroTap support" description="Reach us for anything about your account or orders." />

//                 <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
//                   <ActionRow
//                     href="/customer/support"
//                     icon="🎧"
//                     title="Get support"
//                     description="Help centre and tickets"
//                   />

//                   <ActionRow
//                     href={WHATSAPP_URL}
//                     external
//                     icon="💬"
//                     title="Chat on WhatsApp"
//                     description="Fastest way to reach us"
//                     tone="emerald"
//                   />

//                   <ActionRow
//                     href={`tel:${SUPPORT_PHONE}`}
//                     external
//                     icon="📞"
//                     title="Call support"
//                     description={SUPPORT_PHONE}
//                   />

//                   <ActionRow
//                     href="/terms"
//                     icon="📄"
//                     title="Terms & Privacy"
//                     description="Review AuroTap policies"
//                     tone="violet"
//                   />

//                   <ActionRow
//                     href={DELETE_REQUEST_URL}
//                     external
//                     icon="🗑️"
//                     title="Request account deletion"
//                     description="We will confirm on WhatsApp"
//                     tone="rose"
//                   />
//                 </div>
//               </section>
//             </div>
//           </div>

//           {/* Refresh */}
//           <div className="mt-8 flex justify-center">
//             <button
//               type="button"
//               onClick={() => void load(true)}
//               disabled={refreshing}
//               className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-60"
//             >
//               <span
//                 className={refreshing ? 'mr-1.5 animate-spin motion-reduce:animate-none' : 'mr-1.5'}
//                 aria-hidden="true"
//               >
//                 ↻
//               </span>

//               {refreshing ? 'Refreshing…' : 'Refresh account'}
//             </button>
//           </div>

//           {/* Sign out */}
//           <section className="mt-4" aria-label="Sign out">
//             <button
//               type="button"
//               onClick={() => setSignOutOpen(true)}
//               className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3.5 text-sm font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
//             >
//               Sign out
//             </button>
//           </section>

//           <footer className="px-2 pb-4 pt-6 text-center">
//             <p className="text-xs font-bold tracking-wide text-slate-300">aurotap.in</p>

//             <p className="mt-1 text-xs font-medium text-slate-400">
//               Your account, orders, and preferences in one place.
//             </p>
//           </footer>
//         </div>
//       </main>

//       {hasChanges && !loading ? (
//         <UnsavedBar saving={saving} onDiscard={handleDiscard} onSave={() => void handleSave()} />
//       ) : null}

//       <ToastView toast={toast} lifted={hasChanges && !loading} />

//       {signOutOpen ? (
//         <SignOutModal
//           onCancel={() => setSignOutOpen(false)}
//           onConfirm={() => {
//             setSignOutOpen(false);
//             logout({ redirectTo: '/' });
//           }}
//         />
//       ) : null}

//       <BottomNav />
//     </>
//   );
// }




