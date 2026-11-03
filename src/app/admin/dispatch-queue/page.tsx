'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/api-client';

type DeadLetter = {
  order_id: string;
  last_result_code: string;
  attempts: number;
  updated_at: string;
};
type Health = {
  enabled: boolean;
  ready: number;
  leased: number;
  dead: number;
  oldest_wait_seconds: number;
  pending_orders_over_2h: number;
  global_concurrency_cap: number;
  local_concurrency_cap: number;
  checked_at: string;
  dead_letters: DeadLetter[];
};

async function adminRequest<T>(method: 'GET' | 'POST', payload?: object): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Admin sign-in required.');
  const response = await fetch('/api/admin/dispatch/queue-health', {
    method,
    cache: 'no-store',
    headers: {
      'Authorization': 'Bearer ' + token,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(result?.error || 'Queue health is temporarily unavailable');
  }
  return result.data as T;
}

export default function DispatchQueuePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyOrder, setBusyOrder] = useState('');
  const lastSync = useRef(0);
  const fetching = useRef(false);

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setRefreshing(true);
    try {
      const value = await adminRequest<Health>('GET');
      setHealth(value);
      lastSync.current = Date.now();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load queue health.');
    } finally {
      fetching.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSync.current > 30_000) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onReturn);
    return () => document.removeEventListener('visibilitychange', onReturn);
  }, [refresh]);

  const retry = async (orderId: string) => {
    if (busyOrder || !window.confirm('Requeue this order after checking its eligibility and dispatch failure?')) return;
    setBusyOrder(orderId);
    try {
      await adminRequest('POST', { order_id: orderId });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not requeue this order.');
    } finally {
      setBusyOrder('');
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 text-slate-900 sm:px-6">
      <Link href="/admin/order-health" className="text-sm font-semibold text-blue-700 hover:underline">
        Back to order health
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-black sm:text-3xl">Dispatch queue health</h1>
        <p className="text-sm text-slate-600">Review durable recovery, backlog and dead letters. The queue does not change customer orders or payment status by itself.</p>
      </header>
      <button type="button" onClick={() => void refresh()} disabled={refreshing}
        className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50">
        Refresh current data
      </button>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {loading && <p role="status">Loading operational statistics…</p>}
      {health && <>
        <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Queue configuration">
          <p className="text-sm font-bold">
            Queue rollout: {health.enabled ? 'Enabled' : 'Off — existing dispatch remains active'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Database global concurrency cap: {health.global_concurrency_cap}; per-worker cap: {health.local_concurrency_cap}.
            Last checked: {new Date(health.checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.
          </p>
        </section>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Dispatch queue metrics">
          {([
            ['Ready', health.ready],
            ['In progress', health.leased],
            ['Needs review', health.dead],
            ['Pending orders over 2h', health.pending_orders_over_2h],
            ['Oldest queue wait (sec)', health.oldest_wait_seconds],
          ] as const).map(([name, count]) => (
            <div key={name} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-600">{name}</p>
              <p className="mt-2 text-2xl font-black tabular-nums">{count.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </section>
        {(health.dead > 0 || health.pending_orders_over_2h > 0) &&
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Orders need investigation. Review supplier availability, coverage, approved professionals and customer schedule. Do not auto-cancel pending bookings.
          </p>}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Dead-letter recovery</h2>
          <p className="mt-1 text-sm text-slate-600">
            Only failed internal dispatch work appears here; requeue only after investigating the cause.
          </p>
          {health.dead_letters.length === 0
            ? <p className="mt-4 text-sm text-slate-500">No dead-letter entries.</p>
            : <div className="mt-4 divide-y divide-slate-100">
              {health.dead_letters.map(row => (
                <article key={row.order_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="break-all font-mono text-xs font-semibold">{row.order_id}</p>
                    <p className="mt-1 text-slate-600">{row.last_result_code} · {row.attempts} attempts</p>
                  </div>
                  <button type="button" onClick={() => void retry(row.order_id)}
                    disabled={Boolean(busyOrder) || !health.enabled}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">
                    {busyOrder === row.order_id ? 'Requeuing…' : 'Requeue after review'}
                  </button>
                </article>
              ))}
            </div>}
        </section>
      </>}
      <p className="text-xs text-slate-500">
        This page measures operational queue state, not proven 100,000-user capacity.
        Load testing must run on a disposable database with dedicated test fixtures.
      </p>
    </main>
  );
}
