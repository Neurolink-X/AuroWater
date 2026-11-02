'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Result = {
  pincode: string; postal_exists: boolean; post_office_count: number; postal_result_capped: boolean;
  districts: { district: string; state: string; offices: number }[];
  conflicting_districts: boolean;
  coordinate_coverage: { sampled: number; with_coordinates: number };
  matching_service_zones: { slug: string; city: string; status: string; city_status: string }[];
  available_zones: number; active_city_zones: number;
  potential_water_suppliers: number | null; supplier_signal_verified: boolean;
  delivery_bookable: null; interpretation: string; lookup_ms: number;
};

export default function PostalIntelligenceTool() {
  const [pin, setPin] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin) || busy) return;
    setBusy(true); setData(null); setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in with your admin account first.');
      const response = await fetch(`/api/admin/postal-intelligence?pincode=${pin}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Postal lookup failed.');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify PIN information.');
    } finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900" aria-labelledby="postal-tool-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="postal-tool-heading" className="text-xl font-bold">PIN Intelligence</h2>
        <p className="mt-1 text-sm text-slate-600">India Post directory + configured zones + potential water supplier capacity. This is not an order-acceptance decision.</p>
      </div>
      <Link href="/admin/local-intelligence" className="text-sm font-semibold text-cyan-800">Explore demand and coverage gaps</Link>
    </div>
    <form onSubmit={check} className="flex flex-wrap items-end gap-3">
      <label htmlFor="postal-pin" className="min-w-[10rem] flex-1 text-sm font-semibold">
        Six-digit PIN code
        <input id="postal-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6}
          required pattern="[0-9]{6}" value={pin}
          onChange={e => {setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setData(null);}}
          placeholder="e.g. 208001"
          className="mt-2 block w-full rounded-xl border border-slate-300 p-3" />
      </label>
      <button type="submit" disabled={busy || pin.length !== 6}
        className="min-h-11 rounded-xl bg-cyan-800 px-5 py-3 font-bold text-white disabled:opacity-50">
        {busy ? 'Checking…' : 'Analyze PIN'}
      </button>
    </form>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {data && <div className="space-y-4" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ['Post offices', data.post_office_count],
          ['Matching zones', data.matching_service_zones.length],
          ['Active-city zones', data.active_city_zones],
          ['Potential water suppliers', data.potential_water_suppliers ?? 'Not verified'],
        ] as const).map(([label, value]) =>
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-600">{label}</p>
            <p className="mt-1 text-xl font-extrabold">{value}</p>
          </div>)}
      </div>
      <p className="text-sm text-slate-700">
        {data.postal_exists ? 'PIN found in the postal directory.' : 'No matching PIN found in the current directory.'}
        {' '}Coordinates: {data.coordinate_coverage.with_coordinates}/{data.coordinate_coverage.sampled} sampled offices.
        {' '}Lookup: {data.lookup_ms} ms.
      </p>
      {data.conflicting_districts && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Postal records disagree on district/state. Validate the exact address before using location data.
      </p>}
      {data.postal_result_capped && <p className="text-xs text-amber-800">Office preview is capped; postal counts cover all matching records.</p>}
      <div>
        <h3 className="text-sm font-bold">Postal districts</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.districts.map(d => <span key={d.district + '|' + d.state} className="rounded-lg bg-slate-100 px-3 py-2 text-xs">
            {d.district}, {d.state} ({d.offices} sampled)
          </span>)}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold">Configured zones and city status</h3>
        {data.matching_service_zones.length === 0
          ? <p className="mt-1 text-sm text-amber-900">No configured matching service zone. Postal validity alone cannot enable booking.</p>
          : <ul className="mt-2 space-y-2">
            {data.matching_service_zones.map(z => <li key={z.slug} className="rounded-lg bg-slate-100 p-3 text-xs">
              {z.city} · {z.slug} · Zone {z.status} · City {z.city_status}
            </li>)}
          </ul>}
      </div>
      {!data.supplier_signal_verified && <p className="text-sm text-amber-900">Supplier availability could not be fully verified; do not interpret the count as zero.</p>}
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.interpretation}</p>
    </div>}
  </section>;
}
