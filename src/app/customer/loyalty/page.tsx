'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { parseLoyaltyPayload, type LoyaltyData, type LoyaltyEvent, type LoyaltyStreak } from '@/lib/loyalty';

/* ───────────────────────── formatting ───────────────────────── */

const numberFormat = new Intl.NumberFormat('en-IN');
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

const fmtDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : dateFormat.format(d);
};
const fmtMonth = (v: string | null) => {
  if (!v) return null;
  const d = new Date(/^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v);
  return Number.isNaN(d.getTime()) ? v : monthFormat.format(d);
};
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const eventLabel = (e: LoyaltyEvent) => {
  if (e.description) return e.description;
  const t = e.event_type.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* ───────────────────────── data layer ───────────────────────── */

class HttpError extends Error {
  constructor(public status: number, message: string, public retryable: boolean) {
    super(message);
  }
}

const MAX_AUTO_RETRIES = 5;
const STALE_AFTER_MS = 60_000;
const redirectToLogin = () =>
  window.location.replace(`/auth/login?returnTo=${encodeURIComponent('/customer/loyalty')}`);

async function fetchLoyalty(token: string, opts: { cursor?: string | null; signal?: AbortSignal } = {}): Promise<LoyaltyData> {
  const qs = new URLSearchParams({ limit: '25' });
  if (opts.cursor) qs.set('cursor', opts.cursor);
  let response: Response;
  try {
    response = await fetch(`/api/customer/loyalty?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new HttpError(0, 'You appear to be offline. We’ll reconnect automatically.', true);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
    throw new HttpError(response.status, result.error ?? 'We could not load your rewards right now.', retryable);
  }
  const parsed = parseLoyaltyPayload(result.data ?? result);
  if (!parsed) throw new HttpError(502, 'Rewards data is temporarily unavailable.', true);
  return parsed;
}

function useLoyalty(enabled: boolean) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');

  const dataRef = useRef<LoyaltyData | null>(null);
  const attempts = useRef(0);
  const lastOk = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => { dataRef.current = data; }, [data]);

  const load = useCallback(async () => {
    controller.current?.abort();
    clearTimeout(timer.current);
    const c = new AbortController();
    controller.current = c;
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) throw new HttpError(401, 'Your session has expired. Please sign in again.', false);
      const next = await fetchLoyalty(token, { signal: c.signal });
      if (c.signal.aborted) return;
      setData(next);
      setError('');
      attempts.current = 0;
      lastOk.current = Date.now();
    } catch (e) {
      if (c.signal.aborted) return;
      const err = e instanceof HttpError ? e : new HttpError(0, 'We could not load your rewards right now.', true);
      if (err.status === 401) return redirectToLogin();
      setError(err.message);
      // Self-heal: retry quietly with exponential backoff + jitter.
      if (err.retryable && attempts.current < MAX_AUTO_RETRIES) {
        const delay = Math.min(30_000, 2_000 * 2 ** attempts.current) + Math.random() * 500;
        attempts.current += 1;
        timer.current = setTimeout(() => void load(), delay);
      }
    } finally {
      if (!c.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const retry = useCallback(() => {
    attempts.current = 0;
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    const cursor = dataRef.current?.next_cursor;
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError('');
    try {
      const token = await getToken();
      if (!token) throw new HttpError(401, 'Your session has expired.', false);
      const page = await fetchLoyalty(token, { cursor });
      setData((prev) => {
        if (!prev) return prev;
        const seen = new Set(prev.events.map((e) => e.id));
        return { ...prev, events: [...prev.events, ...page.events.filter((e) => !seen.has(e.id))], has_more: page.has_more, next_cursor: page.next_cursor };
      });
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) return redirectToLogin();
      setMoreError('Could not load earlier activity. Try again.');
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    // Refresh when the customer returns to the tab or the network comes back.
    const wake = () => {
      if (document.visibilityState === 'hidden') return;
      if (dataRef.current === null || Date.now() - lastOk.current > STALE_AFTER_MS) retry();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', retry);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', retry);
      clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [enabled, load, retry]);

  return { data, loading, refreshing, error, retry, loadMore, loadingMore, moreError };
}

/* ───────────────────────── pieces ───────────────────────── */

const ring = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B8A97]';

/** A water bottle that fills toward the next reward. The one animated moment on the page. */
function Bottle({ percent, complete }: { percent: number; complete: boolean }) {
  const id = useId().replace(/:/g, '');
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <figure className="m-0 shrink-0" aria-label={`${pct}% of the way to your next reward`}>
      <style>{`
        @keyframes at-rise { from { transform: translateY(100%); } }
        .at-water { animation: at-rise 1.4s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .at-water { animation: none; } }
      `}</style>
      <svg viewBox="0 0 120 164" className="h-44 w-auto sm:h-56" role="img" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d="M42 8h36v16c0 6 22 12 22 34v84a14 14 0 0 1-14 14H34a14 14 0 0 1-14-14V58c0-22 22-28 22-34Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="0" y="0" width="120" height="164" fill="#123C4D" />
          <rect
            className="at-water"
            x="0" y="24" width="120" height="132"
            fill={complete ? '#E0A93B' : '#35C0CF'}
            style={{ transform: `translateY(${100 - pct}%)`, transformBox: 'fill-box' }}
          />
        </g>
        <path
          d="M42 8h36v16c0 6 22 12 22 34v84a14 14 0 0 1-14 14H34a14 14 0 0 1-14-14V58c0-22 22-28 22-34Z"
          fill="none" stroke="#9FD8DF" strokeOpacity=".55" strokeWidth="2"
        />
        <rect x="40" y="2" width="40" height="8" rx="3" fill="#9FD8DF" fillOpacity=".7" />
      </svg>
    </figure>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#DCE9EC] motion-reduce:animate-none ${className}`} />;
}

function StreakRow({ streak, span, bonus }: { streak: LoyaltyStreak; span: number; bonus: number }) {
  const filled = streak.consecutive_months === 0 ? 0 : ((streak.consecutive_months - 1) % span) + 1;
  const last = fmtMonth(streak.last_renewal_month);
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{streak.consecutive_months} {plural(streak.consecutive_months, 'month')} in a row</p>
        <p className="text-sm text-[#4F6A75]">{last ? `Last renewal: ${last}` : 'No renewal yet'}</p>
      </div>
      <div className="mt-3 flex items-center gap-1.5" role="img" aria-label={`${filled} of ${span} renewals toward the next bonus`}>
        {Array.from({ length: span }, (_, i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-full ${i < filled ? 'bg-[#1B8A97]' : 'bg-[#DCE9EC]'}`} />
        ))}
      </div>
      <p className="mt-2 text-sm text-[#4F6A75]">
        {streak.bonus_in === 0 && streak.consecutive_months > 0
          ? `Bonus earned: +${numberFormat.format(bonus)} points.`
          : `${streak.bonus_in} more ${plural(streak.bonus_in, 'renewal')} for a +${numberFormat.format(bonus)} point bonus.`}
      </p>
    </li>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function CustomerLoyaltyPage() {
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const ready = hydrated && isLoggedIn && isCustomer;
  const { data, loading, refreshing, error, retry, loadMore, loadingMore, moreError } = useLoyalty(ready);

  useEffect(() => {
    if (hydrated && !isLoggedIn) redirectToLogin();
  }, [hydrated, isLoggedIn]);

  if (!hydrated || !isLoggedIn) {
    return <main className="grid min-h-[50vh] place-items-center px-4 text-sm font-medium text-[#4F6A75]" aria-live="polite">Opening your rewards…</main>;
  }
  if (!isCustomer) {
    return (
      <main className="grid min-h-[50vh] place-items-center px-4 text-center">
        <div>
          <p className="font-semibold text-[#16313D]">Rewards are available for customer accounts.</p>
          <Link href="/" className={`mt-3 inline-flex min-h-11 items-center font-semibold text-[#126F7A] underline ${ring}`}>Go to home</Link>
        </div>
      </main>
    );
  }

  const initial = loading && !data;
  const offers = data?.offers;
  const serviceKinds = offers ? [offers.plumbing && 'plumbing', offers.tank_cleaning && 'tank-cleaning'].filter(Boolean) as string[] : [];
  const showFreeCan = Boolean(data?.enabled && offers?.free_can);
  const showService = Boolean(data?.enabled && offers?.service_discount && serviceKinds.length);
  const offersHidden = data?.degraded.includes('offers_unavailable');
  const complete = Boolean(data && data.rewards_available > 0 && data.points_to_next_reward === 0);

  let headline = 'Your rewards';
  let subline = 'Earn points on every completed, paid subscription renewal.';
  if (data) {
    if (!data.enabled) {
      headline = 'Rewards are paused for now';
      subline = 'Your points and history are safe. Earning resumes when the programme restarts.';
    } else if (data.rewards_available > 0) {
      headline = `${data.rewards_available} ${plural(data.rewards_available, 'reward')} ready to use`;
      subline = 'Choose a reward at checkout. Your balance is checked again when you pay.';
    } else {
      headline = `${numberFormat.format(data.points_to_next_reward)} points to your next reward`;
      subline = `Each paid renewal adds ${numberFormat.format(data.points_per_renewal)} points.`;
    }
  }

  return (
    <main className="min-h-screen bg-[#F1F7F8] px-4 pb-16 pt-5 text-[#16313D] sm:px-6 sm:pt-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/customer/home" className={`inline-flex min-h-11 items-center text-sm font-semibold text-[#126F7A] hover:underline ${ring}`}>← Dashboard</Link>

        {/* Hero */}
        <header className="mt-2 overflow-hidden rounded-3xl bg-[#0B2B3A] text-white">
          <div className="flex flex-col-reverse items-center gap-6 p-6 sm:flex-row sm:justify-between sm:p-10">
            <div className="w-full max-w-xl">
              {initial ? (
                <><Skeleton className="h-9 w-4/5 !bg-white/15" /><Skeleton className="mt-3 h-5 w-3/5 !bg-white/10" /></>
              ) : (
                <>
                  <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" aria-live="polite">{headline}</h1>
                  <p className="mt-3 max-w-md text-base leading-7 text-[#C6DDE2]">{subline}</p>
                </>
              )}
              <dl className="mt-7 grid grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-4 text-center sm:text-left">
                {[
                  ['Points', data ? numberFormat.format(data.points_balance) : '—'],
                  ['Per renewal', data ? `+${numberFormat.format(data.points_per_renewal)}` : '—'],
                  ['Per reward', data ? numberFormat.format(data.offers.points_per_reward) : '—'],
                ].map(([label, value], i) => (
                  <div key={label} className={i === 0 ? 'pr-3' : 'px-3 sm:px-5'}>
                    <dt className="text-xs text-[#9FC3CB]">{label}</dt>
                    <dd className="mt-1 text-2xl font-extrabold tabular-nums">{initial ? <Skeleton className="mx-auto h-7 w-14 !bg-white/15 sm:mx-0" /> : value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Bottle percent={data?.progress_percent ?? 0} complete={complete} />
          </div>
        </header>

        {/* Status banners */}
        {error && !data && (
          <section role="alert" className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E4C27A] bg-[#FFF8E6] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">We couldn’t load your rewards</p>
              <p className="mt-1 text-sm text-[#5C4310]">{error} Your points are not affected.</p>
            </div>
            <button type="button" onClick={retry} disabled={refreshing} className={`min-h-11 rounded-xl bg-[#16313D] px-5 text-sm font-semibold text-white disabled:opacity-60 ${ring}`}>
              {refreshing ? 'Retrying…' : 'Try again'}
            </button>
          </section>
        )}
        {data && (error || data.status === 'degraded') && (
          <p role="status" className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#BFDDE2] bg-white px-4 py-3 text-sm text-[#355560]">
            <span>
              {error
                ? 'Showing your last saved view. Reconnecting automatically.'
                : data.degraded.includes('balance_recalculated')
                  ? 'Your balance was recalculated from your activity and will match once our systems sync.'
                  : 'Some details are catching up. Your points are safe.'}
            </span>
            <button type="button" onClick={retry} disabled={refreshing} className={`font-semibold text-[#126F7A] underline disabled:opacity-60 ${ring}`}>
              {refreshing ? 'Checking…' : 'Refresh now'}
            </button>
          </p>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="space-y-10">
            {/* Rewards */}
            <section aria-labelledby="rewards-h">
              <h2 id="rewards-h" className="text-xl font-extrabold tracking-tight">What you can use points for</h2>
              {initial ? <div className="mt-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                : !data ? null
                : !data.enabled ? <p className="mt-3 leading-7 text-[#4F6A75]">The programme is paused. Nothing is lost while it’s off.</p>
                : offersHidden ? <p className="mt-3 leading-7 text-[#4F6A75]">Rewards are being refreshed. They’ll show here in a moment.</p>
                : showFreeCan || showService ? (
                  <ul className="mt-4 space-y-3">
                    {showFreeCan && (
                      <li className="rounded-2xl border-l-4 border-[#1B8A97] bg-white p-5">
                        <h3 className="font-bold">Free standard RO can</h3>
                        <p className="mt-1 text-sm leading-6 text-[#4F6A75]">Redeem {numberFormat.format(data.offers.points_per_reward)} points for one eligible, standard one-time can.</p>
                      </li>
                    )}
                    {showService && (
                      <li className="rounded-2xl border-l-4 border-[#C28A2B] bg-white p-5">
                        <h3 className="font-bold">Discount on home services</h3>
                        <p className="mt-1 text-sm leading-6 text-[#4F6A75]">Up to {data.offers.max_discount_percent}% off eligible {serviceKinds.join(' and ')} bookings.</p>
                      </li>
                    )}
                  </ul>
                ) : <p className="mt-3 leading-7 text-[#4F6A75]">No rewards are open right now. Your points stay in your account.</p>}
            </section>

            {/* Streaks */}
            <section aria-labelledby="streaks-h">
              <h2 id="streaks-h" className="text-xl font-extrabold tracking-tight">Renewal streaks</h2>
              <p className="mt-1 text-sm leading-6 text-[#4F6A75]">One paid renewal per month, per subscription, counts toward a bonus.</p>
              <div className="mt-4 rounded-2xl bg-white p-5">
                {initial ? <Skeleton className="h-24" />
                  : data?.streaks.length ? (
                    <ul className="divide-y divide-[#E3EEF0]">
                      {data.streaks.map((s) => <StreakRow key={s.subscription_id} streak={s} span={data.streak_months} bonus={data.streak_bonus_points} />)}
                    </ul>
                  ) : <p className="leading-7 text-[#4F6A75]">Renew a subscription and pay to start your first streak.</p>}
              </div>
            </section>
          </div>

          {/* Activity */}
          <section aria-labelledby="activity-h">
            <h2 id="activity-h" className="text-xl font-extrabold tracking-tight">Points activity</h2>
            <div className="mt-4 rounded-2xl bg-white px-5">
              {initial ? <div className="space-y-3 py-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                : data?.events.length ? (
                  <ul className="divide-y divide-[#E3EEF0]">
                    {data.events.map((e) => {
                      const gain = e.points_delta > 0;
                      return (
                        <li key={e.id} className="flex items-center justify-between gap-4 py-4">
                          <div className="min-w-0">
                            <p className="break-words font-semibold">{eventLabel(e)}</p>
                            <p className="mt-0.5 text-xs text-[#4F6A75]">{fmtDate(e.created_at)}</p>
                          </div>
                          <span className={`shrink-0 font-extrabold tabular-nums ${gain ? 'text-[#0F7A4D]' : 'text-[#B42341]'}`}>
                            <span aria-hidden="true">{gain ? '+' : ''}{numberFormat.format(e.points_delta)}</span>
                            <span className="sr-only">{gain ? 'Earned' : 'Used'} {numberFormat.format(Math.abs(e.points_delta))} points</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : data?.degraded.includes('activity_unavailable')
                  ? <p className="py-5 leading-7 text-[#4F6A75]">Activity can’t be shown right now. It will reappear automatically.</p>
                  : <p className="py-5 leading-7 text-[#4F6A75]">Points you earn or use will be listed here.</p>}
            </div>
            {data?.has_more && (
              <div className="mt-3">
                <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className={`min-h-11 rounded-xl border border-[#BFDDE2] bg-white px-5 text-sm font-semibold text-[#126F7A] disabled:opacity-60 ${ring}`}>
                  {loadingMore ? 'Loading…' : 'Show earlier activity'}
                </button>
                {moreError && <p role="alert" className="mt-2 text-sm text-[#B42341]">{moreError}</p>}
              </div>
            )}
            <p className="mt-5 text-xs leading-5 text-[#4F6A75]">Only completed, paid subscription renewals earn points. Opening this page never changes your balance.</p>
          </section>
        </div>
      </div>
    </main>
  );
}








// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import Link from 'next/link';
// import { getToken } from '@/lib/api-client';
// import { useAuth } from '@/hooks/useAuth';

// type LoyaltyData = {
//   points_balance: number;
//   points_to_next_reward: number;
//   points_per_renewal: number;
//   enabled: boolean;
//   offers: { free_can: boolean; service_discount: boolean; plumbing: boolean; tank_cleaning: boolean; points_per_rupee: number; max_discount_percent: number; points_per_reward: number };
//   streaks: Array<{ subscription_id: string; last_renewal_month: string | null; consecutive_months: number }>;
//   events: Array<{ id: string; event_type: string; points_delta: number; description: string; created_at: string }>;
// };

// const numberFormat = new Intl.NumberFormat('en-IN');
// const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// export default function CustomerLoyaltyPage() {
//   const { hydrated, isLoggedIn, isCustomer } = useAuth();
//   const [data, setData] = useState<LoyaltyData | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');
//   const [retrying, setRetrying] = useState(false);

//   const load = useCallback(async (isRetry = false) => {
//     if (isRetry) setRetrying(true);
//     else setLoading(true);
//     try {
//       const token = await getToken();
//       if (!token) throw new Error('Your session has expired. Please sign in again.');
//       const response = await fetch('/api/customer/loyalty', {
//         headers: { Authorization: `Bearer ${token}` },
//         cache: 'no-store',
//         credentials: 'same-origin',
//       });
//       const result = await response.json().catch(() => ({}));
//       if (!response.ok) throw new Error(result.error ?? 'We could not load your rewards right now.');
//       const payload = result.data ?? result;
//       if (typeof payload.points_balance !== 'number' || !Array.isArray(payload.streaks) || !Array.isArray(payload.events)) {
//         throw new Error('Rewards data is temporarily unavailable. Please try again.');
//       }
//       setData(payload as LoyaltyData);
//       setError('');
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'We could not load your rewards right now.');
//     } finally {
//       setLoading(false);
//       setRetrying(false);
//     }
//   }, []);

//   useEffect(() => { if (hydrated && isLoggedIn && isCustomer) void load(); }, [hydrated, isLoggedIn, isCustomer, load]);
//   useEffect(() => {
//     if (hydrated && !isLoggedIn) window.location.replace(`/auth/login?returnTo=${encodeURIComponent('/customer/loyalty')}`);
//   }, [hydrated, isLoggedIn]);

//   if (!hydrated || !isLoggedIn || !isCustomer) {
//     return <main className="grid min-h-[50vh] place-items-center px-4 text-sm font-medium text-slate-600" aria-live="polite">Opening your rewards…</main>;
//   }

//   const showInitialLoading = loading && !data;
//   const hasOffers = Boolean(data?.enabled && (data.offers.free_can || (data.offers.service_discount && (data.offers.plumbing || data.offers.tank_cleaning))));

//   return (
//     <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
//       <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
//         <Link href="/customer/home" className="inline-flex min-h-10 items-center text-sm font-bold text-sky-800 transition hover:text-sky-950 hover:underline">← Back to dashboard</Link>

//         <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-5 text-white shadow-lg shadow-slate-900/10 sm:p-8">
//           <div className="flex flex-wrap items-start justify-between gap-4">
//             <div className="max-w-2xl">
//               <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-200">AuroTap membership</p>
//               <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Good renewals deserve rewards.</h1>
//               <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">Earn points on completed, paid subscription renewals and use eligible rewards for water or home services.</p>
//             </div>
//             {data && <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${data.enabled ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/20 bg-white/10 text-slate-200'}`}>{data.enabled ? 'Programme active' : 'Programme paused'}</span>}
//           </div>

//           <div className="mt-6 grid gap-3 sm:grid-cols-3">
//             <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:p-5">
//               <p className="text-xs font-semibold text-sky-100">Available points</p>
//               {showInitialLoading ? <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/15" /> : <p className="mt-2 text-3xl font-black tabular-nums">{data ? numberFormat.format(data.points_balance) : '—'}</p>}
//               <p className="mt-1 text-xs text-slate-300">Your current balance</p>
//             </div>
//             <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:p-5">
//               <p className="text-xs font-semibold text-sky-100">Points per renewal</p>
//               {showInitialLoading ? <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/15" /> : <p className="mt-2 text-3xl font-black tabular-nums">{data ? numberFormat.format(data.points_per_renewal) : '—'}</p>}
//               <p className="mt-1 text-xs text-slate-300">After a paid renewal qualifies</p>
//             </div>
//             <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:p-5">
//               <p className="text-xs font-semibold text-sky-100">Next reward</p>
//               {showInitialLoading ? <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/15" /> : <p className="mt-2 text-3xl font-black tabular-nums">{data ? numberFormat.format(data.points_to_next_reward) : '—'}</p>}
//               <p className="mt-1 text-xs text-slate-300">Points to the next milestone</p>
//             </div>
//           </div>
//           {data && data.points_to_next_reward === 0 && data.enabled && <p className="mt-4 rounded-xl border border-emerald-200/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">You’ve reached a reward milestone. Check the available offers below.</p>}
//         </header>

//         {error && (
//           <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
//             <div>
//               <p className="font-bold text-amber-950">We couldn’t refresh your rewards</p>
//               <p className="mt-1 text-sm leading-5 text-amber-900">{error}</p>
//               <p className="mt-1 text-xs text-amber-800">Your points are not changed by viewing this page. If this continues, please try again shortly.</p>
//             </div>
//             <button type="button" onClick={() => void load(true)} disabled={retrying} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-950 disabled:cursor-wait disabled:opacity-60">
//               {retrying ? 'Retrying…' : 'Try again'}
//             </button>
//           </section>
//         )}

//         <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
//           <div>
//             <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-800">Consistency pays</p>
//             <h2 className="mt-1 text-xl font-black tracking-tight">Your renewal streaks</h2>
//             <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A streak counts at most one completed, paid renewal per calendar month for each subscription.</p>
//           </div>
//           {showInitialLoading ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="h-20 animate-pulse rounded-2xl bg-slate-100" /><div className="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
//             : data?.streaks.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.streaks.map((streak) => <article key={streak.subscription_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="font-bold">{streak.consecutive_months} consecutive month{streak.consecutive_months === 1 ? '' : 's'}</p><p className="mt-1 text-sm text-slate-600">Last qualifying month: {streak.last_renewal_month ?? 'Not yet earned'}</p></article>)}</div>
//               : data ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Your first streak will appear after a completed and paid subscription renewal.</p>
//                 : !error ? <p className="mt-4 text-sm text-slate-500">Loading your streaks…</p> : null}
//         </section>

//         <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
//           <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-800">Made for your home</p>
//           <h2 className="mt-1 text-xl font-black tracking-tight">Available rewards</h2>
//           {showInitialLoading ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /></div>
//             : !data ? <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Offers will appear once your reward balance is available. The programme status hasn’t been confirmed yet.</p>
//               : !data.enabled ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">The loyalty programme is paused by the team right now. Your points and history are preserved.</p>
//                 : hasOffers ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
//                   {data.offers.free_can && <article className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5"><span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-900">Water reward</span><h3 className="mt-3 font-extrabold text-sky-950">Free standard RO can</h3><p className="mt-1 text-sm leading-6 text-sky-900">Redeem {numberFormat.format(data.offers.points_per_reward)} points on one eligible, standard one-time can.</p></article>}
//                   {data.offers.service_discount && (data.offers.plumbing || data.offers.tank_cleaning) && <article className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5"><span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">Home service reward</span><h3 className="mt-3 font-extrabold text-emerald-950">Save on home services</h3><p className="mt-1 text-sm leading-6 text-emerald-900">Use points for up to {data.offers.max_discount_percent}% off eligible {data.offers.plumbing && data.offers.tank_cleaning ? 'plumbing or tank-cleaning' : data.offers.plumbing ? 'plumbing' : 'tank-cleaning'} bookings.</p></article>}
//                 </div> : <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">There are no active redemption offers at the moment. Your points remain safe.</p>}
//         </section>

//         <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
//           <div className="flex flex-wrap items-end justify-between gap-2">
//             <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-800">Your account</p><h2 className="mt-1 text-xl font-black tracking-tight">Points activity</h2></div>
//             {data && <span className="text-xs text-slate-500">Latest {data.events.length} {data.events.length === 1 ? 'entry' : 'entries'}</span>}
//           </div>
//           {showInitialLoading ? <div className="mt-4 space-y-3"><div className="h-12 animate-pulse rounded-xl bg-slate-100" /><div className="h-12 animate-pulse rounded-xl bg-slate-100" /></div>
//             : data?.events.length ? <ul className="mt-3 divide-y divide-slate-100">{data.events.map((event) => <li key={event.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words font-semibold">{event.description || event.event_type}</p><p className="mt-1 text-xs text-slate-500">{dateFormat.format(new Date(event.created_at))}</p></div><span className={`shrink-0 rounded-lg px-2.5 py-1 font-extrabold tabular-nums ${event.points_delta > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{event.points_delta > 0 ? '+' : ''}{numberFormat.format(event.points_delta)} pts</span></li>)}</ul>
//               : data ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">No points activity yet. Your first qualifying paid renewal will appear here.</p>
//                 : !error ? <p className="mt-4 text-sm text-slate-500">Loading your activity…</p> : null}
//           <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Only completed, paid subscription renewals earn points. Redemptions are checked again at checkout. Your balance and history are not changed just by opening this page.</p>
//         </section>
//       </div>
//     </main>
//   );
// }
