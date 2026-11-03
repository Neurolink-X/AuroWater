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
  release_approved: boolean;
  activation_ready: boolean;
  readiness: {
    queueCronReady: boolean;
    reconcileCronReady: boolean;
    secretReady: boolean;
    autoAssignEnabled: boolean;
    pendingWithoutQueue: number;
    staleOrdersAwaitingReview: number;
  };
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

async function adminRequest<T>(method: 'GET' | 'POST' | 'PATCH', payload?: object): Promise<T> {
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
  const [busyToggle, setBusyToggle] = useState(false);
  const [preparing, setPreparing] = useState(false);
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

  const setQueueEnabled = async (enable: boolean) => {
    if (busyToggle || !health) return;
    const prompt = enable
      ? 'Activate the new dispatch queue only after migrations, staging tests, cron and backlog handoff have been verified. Continue?'
      : 'Disable queue recovery and return to the existing legacy retry path? Pending orders are preserved.';
    if (!window.confirm(prompt)) return;
    setBusyToggle(true);
    try {
      await adminRequest('PATCH', {
        enabled: enable,
        ...(enable ? { confirmation: 'ENABLE_DISPATCH_QUEUE' } : {}),
      });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update queue mode.');
    } finally {
      setBusyToggle(false);
    }
  };

  const prepareBacklog = async () => {
    if (preparing || !health || health.enabled) return;
    if (!window.confirm('Prepare up to 100 pending order references for safe queue activation? Existing customer orders and payments are untouched; overdue appointments will require manual review.')) return;
    setPreparing(true);
    try {
      await adminRequest<{ prepared: number }>('POST', { action: 'prepare_backlog' });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the backlog.');
    } finally {
      setPreparing(false);
    }
  };

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
    <main className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-slate-950 shadow-sm sm:rounded-3xl sm:px-7 sm:py-8">
      <Link href="/admin/order-health" className="inline-flex min-h-11 items-center text-sm font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
        Back to order health
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Dispatch queue health</h1>
        <p className="text-sm text-slate-600">Review durable recovery, backlog and dead letters. The queue does not change customer orders or payment status by itself.</p>
      </header>
      <button type="button" onClick={() => void refresh()} disabled={refreshing}
        className="min-h-11 rounded-xl border border-slate-400 bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50">
        Refresh current data
      </button>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {loading && <p role="status">Loading operational statistics…</p>}
      {health && <>
        <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Queue configuration">
          <p className="text-base font-extrabold text-slate-950 sm:text-lg">
            Queue status: {health.enabled ? 'ON — controlled dispatch recovery active' : 'OFF — existing dispatch retries continue'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Database global concurrency cap: {health.global_concurrency_cap}; per-worker cap: {health.local_concurrency_cap}.
            Last checked: {new Date(health.checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Queue mode never switches ON automatically when traffic rises. Enabling requires verified
            release gates and server-side operational approval. Disabling preserves pending orders.
          </p>
          <div className="mt-4 rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm leading-6" aria-label="Queue activation readiness">
            <p className="font-semibold text-slate-900">Activation checks</p>
            <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {([
                ['Database queue scheduler', health.readiness.queueCronReady],
                ['Reconciliation scheduler', health.readiness.reconcileCronReady],
                ['Secure scheduled-worker token configured', health.readiness.secretReady],
                ['Automatic assignment allowed', health.readiness.autoAssignEnabled],
                ['Operator release approval', health.release_approved],
                ['Pending backlog within safe handoff limit', health.readiness.pendingWithoutQueue <= 100],
              ] as const).map(([label, ok]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm">
                  <dt className="font-medium text-slate-800">{label}</dt>
                  <dd className={ok ? 'font-bold text-emerald-800' : 'font-bold text-amber-900'}>
                    {ok ? 'Ready' : label === 'Operator release approval' ? 'Approval pending' : 'Needs attention'}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm font-medium text-slate-700">
              Pending orders awaiting queue handoff: {health.readiness.pendingWithoutQueue}. Stale appointments
              needing manual schedule/customer review: {health.readiness.staleOrdersAwaitingReview}.
              Missed slots over 24 hours are never automatically offered to a new provider.
            </p>
            {!health.enabled && health.readiness.pendingWithoutQueue > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button"
                  disabled={preparing || busyToggle || refreshing}
                  onClick={() => void prepareBacklog()}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40">
                  {preparing ? 'Preparing…' : 'Prepare next 100 pending orders (no dispatch)'}
                </button>
                <p className="text-xs text-slate-600">
                  Repeat if more than 100 are waiting. Old overdue slots move to manual review, not supplier assignment.
                </p>
              </div>
            )}
            {!health.enabled && !health.activation_ready && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="status">
                <p className="font-bold">Why is Enable disabled?</p>
                {!health.release_approved ? (
                  <p className="mt-1">Operator release approval is still pending. This is a deliberate production safety lock, not a failed database installation. The deployment owner must verify staging assignment, stock/idempotency, cron responses and rollback before configuring the server-only release approval in Vercel. A new deployment must pick up that setting.</p>
                ) : (
                  <p className="mt-1">One or more live database readiness checks need attention. Review the checks above and prepare any outstanding pending order references before activation.</p>
                )}
                <p className="mt-2 font-semibold">The existing booking and legacy retry system stays active. Do not bypass this release lock simply to enable the button.</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busyToggle || refreshing || health.enabled || !health.activation_ready}
              onClick={() => void setQueueEnabled(true)}
              className="min-h-11 rounded-xl border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-600">
              {busyToggle && !health.enabled ? 'Applying…' : 'Enable queue (release-gated)'}
            </button>
            <button type="button" disabled={busyToggle || refreshing || !health.enabled}
              onClick={() => void setQueueEnabled(false)}
              className="min-h-11 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
              {busyToggle && health.enabled ? 'Disabling…' : 'Disable queue / use legacy retries'}
            </button>
          </div>
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
        {(health.dead > 0 || health.pending_orders_over_2h > 0 || health.readiness.staleOrdersAwaitingReview > 0) &&
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Orders need investigation. Review supplier availability, coverage, approved professionals and customer schedule. Overdue appointments must be reconfirmed/rescheduled before retrying. Do not auto-cancel pending bookings.
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
