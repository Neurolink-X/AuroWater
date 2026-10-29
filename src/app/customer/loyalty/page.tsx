'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

type LoyaltyData = {
  points_balance: number;
  points_to_next_reward: number;
  points_per_renewal: number;
  streaks: Array<{ subscription_id: string; last_renewal_month: string | null; consecutive_months: number }>;
  events: Array<{ id: string; event_type: string; points_delta: number; description: string; created_at: string }>;
};

export default function CustomerLoyaltyPage() {
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch('/api/customer/loyalty', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not load loyalty points.');
      setData(result.data ?? result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load loyalty points.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (hydrated && isLoggedIn && isCustomer) void load(); }, [hydrated, isLoggedIn, isCustomer, load]);
  useEffect(() => {
    if (hydrated && !isLoggedIn) window.location.replace(`/auth/login?returnTo=${encodeURIComponent('/customer/loyalty')}`);
  }, [hydrated, isLoggedIn]);

  if (!hydrated || !isLoggedIn || !isCustomer) return <main className="p-6 text-slate-600">Loading loyalty rewards…</main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/customer/home" className="text-sm font-bold text-sky-700 hover:underline">← Back to dashboard</Link>
      <header className="rounded-3xl bg-gradient-to-br from-slate-950 to-sky-900 p-6 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">AuroTap membership</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Renew. Earn points. Save on services.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100">Earn points when a subscription delivery is completed and paid. Keep renewing month after month to unlock a streak bonus.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><p className="text-xs text-sky-100">Available points</p><p className="mt-1 text-3xl font-black">{loading ? '—' : data?.points_balance ?? 0}</p></div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><p className="text-xs text-sky-100">Points per renewal</p><p className="mt-1 text-3xl font-black">{data?.points_per_renewal ?? 100}</p></div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><p className="text-xs text-sky-100">Next reward</p><p className="mt-1 text-3xl font-black">{loading ? '—' : data?.points_to_next_reward ?? 300} points to go</p></div>
        </div>
      </header>
      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-black">Your renewal streaks</h2>
        <p className="mt-1 text-sm text-slate-600">A streak counts at most one completed, paid renewal per calendar month for each subscription.</p>
        {data?.streaks.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.streaks.map((streak) => <article key={streak.subscription_id} className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{streak.consecutive_months} consecutive month{streak.consecutive_months === 1 ? '' : 's'}</p><p className="mt-1 text-sm text-slate-600">Last qualifying month: {streak.last_renewal_month ?? 'Not yet earned'}</p></article>)}</div> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Your streak will appear after your first completed and paid subscription delivery.</p>}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-black">Points activity</h2>
        {data?.events.length ? <ul className="mt-4 divide-y divide-slate-100">{data.events.map((event) => <li key={event.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-semibold">{event.description || event.event_type}</p><p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString('en-IN')}</p></div><span className={`shrink-0 font-black ${event.points_delta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{event.points_delta > 0 ? '+' : ''}{event.points_delta} pts</span></li>)}</ul> : <p className="mt-4 text-sm text-slate-600">No points yet. Your first qualifying renewal earns points.</p>}
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Service discounts and free-can redemption are not enabled until checkout validation and redemption controls are connected. Your points balance is not spendable yet.</p>
      </section>
    </div>
  </main>;
}
