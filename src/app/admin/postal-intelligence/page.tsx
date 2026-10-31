'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Result = {
  pincode: string; postal_exists: boolean; post_office_count: number;
  districts: { district: string; state: string }[];
  coordinate_coverage: { sampled: number; with_coordinates: number };
  matching_service_zones: { slug: string; city: string; status: string }[];
  available_zones: number; delivery_bookable: null; interpretation: string;
};
export default function PostalIntelligencePage() {
  const [pin,setPin] = useState('');
  const [data,setData] = useState<Result|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const check = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin) || busy) return;
    setBusy(true); setData(null); setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in as administrator to continue.');
      const resp = await fetch(`/api/admin/postal-intelligence?pincode=${pin}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || 'Postal lookup failed.');
      setData(body as Result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Lookup failed.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-3xl space-y-6">
    <Link href="/admin/dashboard" className="text-sm font-bold text-cyan-800 hover:underline">← Admin dashboard</Link>
    <header><p className="text-xs font-bold uppercase tracking-wider text-cyan-800">Operations intelligence</p>
      <h1 className="mt-2 text-3xl font-extrabold">PIN code coverage intelligence</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Validate localities against the India Post directory and configured service zones. A valid PIN is not a delivery guarantee.</p>
    </header>
    <form onSubmit={check} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-5">
      <label className="flex-1 text-sm font-semibold" htmlFor="postal-pin">6-digit Indian PIN code
        <input id="postal-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} required
          pattern="[0-9]{6}" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="e.g. 208001" className="mt-2 block w-full rounded-xl border border-slate-300 p-3" />
      </label>
      <button disabled={busy||pin.length!==6} className="self-end rounded-xl bg-cyan-800 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Checking…':'Check PIN'}</button>
    </form>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {data&&<section className="space-y-4" aria-live="polite">
      <div className="grid gap-3 sm:grid-cols-3">
        {([['Post offices',data.post_office_count],['Matching zones',data.matching_service_zones.length],['Available zones',data.available_zones]] as const)
          .map(([label,value])=><div key={label} className="rounded-xl border bg-white p-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
      </div>
      <div className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">Location and operational scope</h2>
        <p className="mt-2 text-sm text-slate-700">{data.postal_exists?'Postal directory match found.':'No postal directory match found.'}</p>
        {data.districts.map(d=><p key={d.district+'|'+d.state} className="mt-2 text-sm">{d.district}, {d.state}</p>)}
        <p className="mt-3 text-sm">Geocoded sample: {data.coordinate_coverage.with_coordinates} / {data.coordinate_coverage.sampled}</p>
        <div className="mt-4 space-y-2">{data.matching_service_zones.map(z=><p key={z.slug} className="rounded-lg bg-slate-100 p-3 text-sm">{z.city} · {z.slug} · {z.status}</p>)}</div>
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{data.interpretation}</p>
      </div>
    </section>}
  </div></main>;
}
