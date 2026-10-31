'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Readiness = {
  city: string; launch_ready: boolean; scope: string;
  verified_suppliers: number; online_stocked_suppliers: number;
  available_pilot_zones: string[]; missing: string[]; note: string;
};

export default function NoidaReadinessPage() {
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Admin sign-in required.');
        const res = await fetch('/api/admin/noida-readiness', {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const envelope = await res.json();
        if (!res.ok || !envelope?.success) throw new Error(envelope?.error || 'Readiness check unavailable.');
        if (active) setData(envelope.data as Readiness);
      } catch (cause) {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load readiness.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [version]);
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/dashboard" className="text-sm font-semibold text-cyan-800 hover:underline">← Admin dashboard</Link>
      <header><p className="text-xs font-bold uppercase tracking-wider text-cyan-800">Operations / Pilot readiness</p>
        <h1 className="mt-2 text-3xl font-extrabold">Noida launch readiness</h1>
        <p className="mt-3 leading-7 text-slate-600">City discovery is not proof of delivery capacity. Check the verified, online and stocked supplier gate before advertising Noida as live.</p>
      </header>
      {loading && <p role="status">Checking live operational readiness…</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><p>{error}</p><button type="button" onClick={() => { setError(''); setLoading(true); setVersion(v => v + 1); }} className="mt-3 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white">Retry readiness check</button></div>}
      {data && <div className="space-y-5">
        <div className={data.launch_ready ? 'rounded-2xl border border-emerald-300 bg-emerald-50 p-6' : 'rounded-2xl border border-amber-300 bg-amber-50 p-6'}>
          <p className="text-xs font-bold uppercase">Pilot readiness gate</p>
          <p className="mt-2 text-2xl font-bold">{data.launch_ready ? 'Pilot suppliers ready for coverage checks' : 'Not operationally ready'}</p>
          <p className="mt-2 text-sm">{data.scope}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[['Verified suppliers',data.verified_suppliers],['Online with free stock',data.online_stocked_suppliers],['Available pilot zones',data.available_pilot_zones.length]].map(([label,value])=>
            <div key={String(label)} className="rounded-xl border bg-white p-5"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
        </div>
        {data.missing.length > 0 && <section className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Launch blockers</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm">{data.missing.map(item=><li key={item}>{item}</li>)}</ul>
        </section>}
        <p className="text-sm leading-6 text-slate-600">{data.note}</p>
        <Link href="/admin/approvals" className="inline-flex min-h-11 items-center rounded-lg bg-cyan-800 px-4 font-bold text-white">Review supplier approvals →</Link>
      </div>}
    </div>
  </main>;
}
