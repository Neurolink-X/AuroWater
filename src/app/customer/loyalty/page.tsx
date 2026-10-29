'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

type LoyaltyData = {
  points_balance: number;
  points_to_next_reward: number;
  points_per_renewal: number;
  enabled: boolean;
  offers: { free_can: boolean; service_discount: boolean; plumbing: boolean; tank_cleaning: boolean; points_per_rupee: number; max_discount_percent: number; points_per_reward: number };
  streaks: Array<{ subscription_id: string; last_renewal_month: string | null; consecutive_months: number }>;
  events: Array<{ id: string; event_type: string; points_delta: number; description: string; created_at: string }>;
};

const numberFormat = new Intl.NumberFormat('en-IN');
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function CustomerLoyaltyPage() {
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/customer/loyalty', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'We could not load your rewards right now.');
      const payload = result.data ?? result;
      if (typeof payload.points_balance !== 'number' || !Array.isArray(payload.streaks) || !Array.isArray(payload.events)) {
        throw new Error('Rewards data is temporarily unavailable. Please try again.');
      }
      setData(payload as LoyaltyData);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not load your rewards right now.');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => { if (hydrated && isLoggedIn && isCustomer) void load(); }, [hydrated, isLoggedIn, isCustomer, load]);
  useEffect(() => {
    if (hydrated && !isLoggedIn) window.location.replace(`/auth/login?returnTo=${encodeURIComponent('/customer/loyalty')}`);
  }, [hydrated, isLoggedIn]);

  if (!hydrated || !isLoggedIn || !isCustomer) {
    return <main className="grid min-h-[50vh] place-items-center px-4 text-sm font-medium text-slate-600" aria-live="polite">Opening your rewards…</main>;
  }

  const showInitialLoading = loading && !data;
  const hasOffers = Boolean(data?.enabled && (data.offers.free_can || (data.offers.service_discount && (data.offers.plumbing || data.offers.tank_cleaning))));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        <Link href="/customer/home" className="inline-flex min-h-10 items-center text-sm font-bold text-sky-800 transition hover:text-sky-950 hover:underline">← Back to dashboard</Link>

        <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-5 text-white shadow-lg shadow-slate-900/10 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-sky-200">AuroTap membership</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Good renewals deserve rewards.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">Earn points on completed, paid subscription renewals and use eligible rewards for water or home services.</p>
            </div>
            {data && <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${data.enabled ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-white/20 bg-white/10 text-slate-200'}`}>{data.enabled ? 'Programme active' : 'Programme paused'}</span>}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:p-5">
              <p className="text-xs font-semibold text-sky-100">Available points</p>
              {showInitialLoading ? <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/15" /> : <p className="mt-2 text-3xl font-black tabular-nums">{data ? numberFormat.format(data.points_balance) : '—'}</p>}
              <p className="mt-1 text-xs text-slate-300">Your current balance</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:p-5">
              <p className="text-xs font-semibold text-sky-100">Points per renewal</p>
              {showInitialLoading ? <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/15" /> : <p className="mt-2 text-3xl font-black tabular-nums">{data ? numberFormat.format(data.points_per_renewal) : '—'}</p>}
              <p className="mt-1 text-xs text-slate-300">After a paid renewal qualifies</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 sm:p-5">
              <p className="text-xs font-semibold text-sky-100">Next reward</p>
              {showInitialLoading ? <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-white/15" /> : <p className="mt-2 text-3xl font-black tabular-nums">{data ? numberFormat.format(data.points_to_next_reward) : '—'}</p>}
              <p className="mt-1 text-xs text-slate-300">Points to the next milestone</p>
            </div>
          </div>
          {data && data.points_to_next_reward === 0 && data.enabled && <p className="mt-4 rounded-xl border border-emerald-200/20 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">You’ve reached a reward milestone. Check the available offers below.</p>}
        </header>

        {error && (
          <section role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-amber-950">We couldn’t refresh your rewards</p>
              <p className="mt-1 text-sm leading-5 text-amber-900">{error}</p>
              <p className="mt-1 text-xs text-amber-800">Your points are not changed by viewing this page. If this continues, please try again shortly.</p>
            </div>
            <button type="button" onClick={() => void load(true)} disabled={retrying} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-950 disabled:cursor-wait disabled:opacity-60">
              {retrying ? 'Retrying…' : 'Try again'}
            </button>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-800">Consistency pays</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Your renewal streaks</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A streak counts at most one completed, paid renewal per calendar month for each subscription.</p>
          </div>
          {showInitialLoading ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="h-20 animate-pulse rounded-2xl bg-slate-100" /><div className="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>
            : data?.streaks.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.streaks.map((streak) => <article key={streak.subscription_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="font-bold">{streak.consecutive_months} consecutive month{streak.consecutive_months === 1 ? '' : 's'}</p><p className="mt-1 text-sm text-slate-600">Last qualifying month: {streak.last_renewal_month ?? 'Not yet earned'}</p></article>)}</div>
              : data ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Your first streak will appear after a completed and paid subscription renewal.</p>
                : !error ? <p className="mt-4 text-sm text-slate-500">Loading your streaks…</p> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-800">Made for your home</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Available rewards</h2>
          {showInitialLoading ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /></div>
            : !data ? <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Offers will appear once your reward balance is available. The programme status hasn’t been confirmed yet.</p>
              : !data.enabled ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">The loyalty programme is paused by the team right now. Your points and history are preserved.</p>
                : hasOffers ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {data.offers.free_can && <article className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5"><span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-900">Water reward</span><h3 className="mt-3 font-extrabold text-sky-950">Free standard RO can</h3><p className="mt-1 text-sm leading-6 text-sky-900">Redeem {numberFormat.format(data.offers.points_per_reward)} points on one eligible, standard one-time can.</p></article>}
                  {data.offers.service_discount && (data.offers.plumbing || data.offers.tank_cleaning) && <article className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5"><span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">Home service reward</span><h3 className="mt-3 font-extrabold text-emerald-950">Save on home services</h3><p className="mt-1 text-sm leading-6 text-emerald-900">Use points for up to {data.offers.max_discount_percent}% off eligible {data.offers.plumbing && data.offers.tank_cleaning ? 'plumbing or tank-cleaning' : data.offers.plumbing ? 'plumbing' : 'tank-cleaning'} bookings.</p></article>}
                </div> : <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">There are no active redemption offers at the moment. Your points remain safe.</p>}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-sky-800">Your account</p><h2 className="mt-1 text-xl font-black tracking-tight">Points activity</h2></div>
            {data && <span className="text-xs text-slate-500">Latest {data.events.length} {data.events.length === 1 ? 'entry' : 'entries'}</span>}
          </div>
          {showInitialLoading ? <div className="mt-4 space-y-3"><div className="h-12 animate-pulse rounded-xl bg-slate-100" /><div className="h-12 animate-pulse rounded-xl bg-slate-100" /></div>
            : data?.events.length ? <ul className="mt-3 divide-y divide-slate-100">{data.events.map((event) => <li key={event.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words font-semibold">{event.description || event.event_type}</p><p className="mt-1 text-xs text-slate-500">{dateFormat.format(new Date(event.created_at))}</p></div><span className={`shrink-0 rounded-lg px-2.5 py-1 font-extrabold tabular-nums ${event.points_delta > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{event.points_delta > 0 ? '+' : ''}{numberFormat.format(event.points_delta)} pts</span></li>)}</ul>
              : data ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">No points activity yet. Your first qualifying paid renewal will appear here.</p>
                : !error ? <p className="mt-4 text-sm text-slate-500">Loading your activity…</p> : null}
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Only completed, paid subscription renewals earn points. Redemptions are checked again at checkout. Your balance and history are not changed just by opening this page.</p>
        </section>
      </div>
    </main>
  );
}
