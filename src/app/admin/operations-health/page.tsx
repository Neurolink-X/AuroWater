'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Probe = { status: 'healthy' | 'degraded'; latency_ms: number; code?: string };
type Report = {
  status: 'healthy' | 'degraded';
  checked_at: string;
  duration_ms: number;
  checks: Record<'database' | 'orders' | 'cities', Probe>;
  pending_sample: { checked: number; overdue_unassigned_water: number; overdue_unassigned_technician: number; capped: boolean } | null;
  recovery: string[];
  note: string;
};

export default function OperationsHealthPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in with an admin account to view operational diagnostics.');
      const response = await fetch('/api/admin/operations-health', {
        cache: 'no-store',
        signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(response.status === 403 ? 'Administrator access required.'
          : response.status === 401 ? 'Admin session unavailable; sign in again.'
          : 'Live operations data could not be verified. Check the external production watchdog.');
      }
      const body = await response.json() as { data?: Report };
      if (!body.data) throw new Error('Operations response was incomplete.');
      setReport(body.data);
      setError('');
    } catch (caught) {
      if (signal?.aborted) return;
      setReport(null); // Stale data must never look current during an incident.
      setError(caught instanceof Error ? caught.message : 'Could not refresh operations.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-slate-950 shadow-sm sm:rounded-3xl sm:px-7 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Operations health & recovery</h1>
          <p className="mt-1 text-sm text-slate-600">Verified backend signals, capped pending-order samples and actionable recovery guidance.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">
          {loading ? 'Checking…' : 'Refresh diagnostics'}
        </button>
      </header>

      <nav aria-label="Operations links" className="flex flex-wrap gap-3 text-sm font-bold text-cyan-900">
        <Link href="/admin/dispatch">Dispatch center</Link>
        <Link href="/admin/orders">Orders</Link>
        <Link href="/admin/city-readiness">City readiness</Link>
        <a href="https://github.com/Neurolink-X/AuroWater/actions/workflows/production-watchdog.yml"
          target="_blank" rel="noopener noreferrer">External incident monitor</a>
        <a href="https://supabase.com/dashboard/project/mwfcwhxdlnqldciigicl"
          target="_blank" rel="noopener noreferrer">Supabase diagnostics</a>
      </nav>

      {error && <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <strong>Live backend status unavailable.</strong> {error} Existing orders are not marked cancelled by this screen.
      </section>}

      {report && <>
        <section aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Health snapshot · {new Date(report.checked_at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})} IST</p>
          <p className={`mt-2 text-xl font-bold ${report.status === 'healthy' ? 'text-emerald-700' : 'text-amber-800'}`}>
            {report.status === 'healthy' ? 'Database checks healthy' : 'Some database checks need attention'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.entries(report.checks) as [string, Probe][]).map(([name, probe]) =>
              <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-600">{name}</p>
                <p className={`mt-1 font-semibold ${probe.status === 'healthy' ? 'text-emerald-700' : 'text-amber-800'}`}>{probe.status}</p>
                <p className="text-xs text-slate-500">{probe.latency_ms} ms {probe.code ? `· ${probe.code}` : ''}</p>
              </div>,
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Pending order investigation</h2>
          {report.pending_sample ? <>
            <p className="mt-2 text-sm text-slate-700">Oldest pending sample: {report.pending_sample.checked} checked.</p>
            <p className="mt-2 text-sm font-semibold text-amber-800">Overdue unassigned water orders: {report.pending_sample.overdue_unassigned_water}</p>
            <p className="mt-1 text-sm font-semibold text-amber-800">Overdue unassigned technician jobs: {report.pending_sample.overdue_unassigned_technician}</p>
            {report.pending_sample.capped && <p className="mt-1 text-sm text-amber-800">Sample capped at 100 orders. More may be pending.</p>}
          </> : <p className="mt-2 text-sm text-amber-800">Pending-order data could not be verified; no backlog estimate is available.</p>}
          <p className="mt-2 text-xs text-slate-500">{report.note}</p>
        </section>
        {report.recovery.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Where to investigate</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {report.recovery.map(message => <li key={message}>{message}</li>)}
          </ol>
        </section>}
      </>}
    </main>
  );
}
