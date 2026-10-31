'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type City = {
  city: string;
  zones: number;
  available_zones: number;
  approved_suppliers: number;
  online_stocked_assigned_suppliers: number;
  zones_missing_pincodes: { id: string; name: string }[];
  operational_signal: boolean;
};
type Report = { cities: City[]; checked_at: string; note: string };

export default function CityReadinessPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Admin session required. Please sign in again.');
        const response = await fetch('/api/admin/city-readiness', {
          signal: controller.signal, cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.data || !Array.isArray(body.data.cities)) {
          throw new Error(body?.error ?? `Readiness request failed (HTTP ${response.status})`);
        }
        if (mounted) setReport(body.data as Report);
      } catch (cause) {
        if (mounted && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to check city readiness.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; controller.abort(); };
  }, [revision]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/dashboard" className="text-sm font-semibold text-cyan-800 hover:underline">← Admin dashboard</Link>
          <div className="flex items-center gap-3">
            <Link href="/admin/zones" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Manage zones</Link>
            <button type="button" onClick={() => { setLoading(true); setError(''); setRevision(v => v + 1); }}
              disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Refresh</button>
          </div>
        </div>
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-800">Operations / All cities</p>
          <h1 className="mt-2 text-3xl font-extrabold">City readiness</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Read-only checks for configured cities. An available zone alone does not mean a service is dispatch-ready.
          </p>
        </header>
        {loading && <p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-600">Checking configured cities and supplier capacity…</p>}
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-950">
          <p className="font-semibold">City readiness could not load</p><p className="mt-1 text-sm">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(''); setRevision(v => v + 1); }} className="mt-3 rounded-lg bg-rose-900 px-4 py-2 text-sm font-semibold text-white">Retry</button>
        </div>}
        {report && !loading && <div className="space-y-4">
          <p className="text-xs text-slate-500">Last checked: {new Date(report.checked_at).toLocaleString('en-IN')}</p>
          {report.cities.length === 0 && <p className="rounded-xl bg-white p-5 text-sm">No configured service cities found. <Link href="/admin/zones" className="text-cyan-800 underline">Manage zones</Link>.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {report.cities.map(city => <section key={city.city} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{city.city}</h2>
                <span className={city.operational_signal ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900' : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950'}>
                  {city.operational_signal ? 'Capacity signal detected' : 'Needs readiness review'}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">Configured zones</dt><dd className="text-lg font-bold">{city.zones}</dd></div>
                <div><dt className="text-slate-500">Available zones with PINs</dt><dd className="text-lg font-bold">{city.available_zones}</dd></div>
                <div><dt className="text-slate-500">Approved suppliers</dt><dd className="text-lg font-bold">{city.approved_suppliers}</dd></div>
                <div><dt className="text-slate-500">Online, stocked, zone-assigned</dt><dd className="text-lg font-bold">{city.online_stocked_assigned_suppliers}</dd></div>
              </dl>
              {!!city.zones_missing_pincodes.length && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                <strong>Available zones missing PIN codes:</strong> {city.zones_missing_pincodes.map(z => z.name).join(', ')}.
              </div>}
              <Link href="/admin/zones" className="mt-4 inline-block text-sm font-semibold text-cyan-800 hover:underline">Review service zones →</Link>
            </section>)}
          </div>
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{report.note}</p>
        </div>}
      </div>
    </main>
  );
}
