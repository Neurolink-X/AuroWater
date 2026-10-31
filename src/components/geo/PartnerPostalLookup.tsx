'use client';

import { useEffect, useState } from 'react';

/** India Post directory lookup. This does not establish serviceability. */
export default function PartnerPostalLookup({ label = 'PIN code reference' }: { label?: string }) {
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<{ name: string; district: string; state: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) {
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch(`/api/geo/postal?pincode=${encodeURIComponent(pin)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Postal lookup unavailable');
        const body = await res.json();
        if (!controller.signal.aborted) setResult(Array.isArray(body.results) ? body.results.slice(0, 8) : []);
      } catch {
        if (!controller.signal.aborted) setError('Could not check the postal directory.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(t); controller.abort(); };
  }, [pin]);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
    <h2 className="text-base font-bold">{label}</h2>
    <p className="mt-1 text-xs leading-5 text-slate-600">Check postal office and district details before confirming a visit or delivery. This is not proof that a job can be accepted.</p>
    <label className="mt-3 block text-xs font-semibold" htmlFor="partner-postal-pin">Indian 6-digit PIN
      <input id="partner-postal-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6}
        value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0,6)); setResult([]); setError(''); }}
        className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-base" placeholder="208001" />
    </label>
    {loading && <p role="status" className="mt-3 text-xs text-slate-500">Checking India Post directory…</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    {pin.length === 6 && !loading && !error && result.length === 0 &&
      <p className="mt-3 text-xs text-slate-600">No postal matches found. Check the address manually.</p>}
    {result.length > 0 && <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm" aria-label="Postal matches">
      {result.map((x, i) => <li key={x.name + i} className="rounded-lg bg-slate-50 p-3">
        <span className="font-semibold">{x.name}</span><span className="block text-xs text-slate-600">{x.district}, {x.state}</span>
      </li>)}
    </ul>}
  </section>;
}
