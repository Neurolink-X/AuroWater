'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Zone = { id: string; city: string; name: string; status: string; pincodes: string[] | null; services: string[] | null };
type RequestRow = { id: string; zone_id: string; service_keys: string[]; status: string; supplier_note: string | null; admin_note: string | null; created_at: string };
type Payload = { zones: Zone[]; requests: RequestRow[] };
const SERVICE_OPTIONS = [
  ['water_can', '20L water-can delivery'], ['plumbing', 'Plumbing'], ['ro_service', 'RO purifier service'],
  ['tank_cleaning', 'Water-tank cleaning'], ['borewell', 'Borewell services'], ['motor_pump', 'Motor/pump service'],
  ['installation', 'Installation'], ['maintenance', 'General maintenance'],
];

export default function SupplierCoveragePage() {
  const [payload, setPayload] = useState<Payload>({ zones: [], requests: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>(['water_can']);
  const [note, setNote] = useState('');
  const [requestedPincodes, setRequestedPincodes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const client = createClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/supplier/coverage-requests', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not load coverage.');
      setPayload(json.data ?? json);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load coverage.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    if (!selected.length) { setError('Choose at least one city or service area.'); return; }
    if (!services.length) { setError('Choose at least one service.'); return; }
    const pinList = requestedPincodes.split(/[\\s,]+/).map(p => p.trim()).filter(Boolean);
    if (pinList.some(p => !/^[0-9]{6}$/.test(p))) { setError('Enter valid 6-digit PIN codes, separated by commas or spaces.'); return; }
    const requestNote = [pinList.length ? 'Requested PIN codes: ' + [...new Set(pinList)].join(', ') : '', note.trim()].filter(Boolean).join('\\n');
    setSaving(true); setError(''); setMessage('');
    try {
      const client = createClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/supplier/coverage-requests', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_ids: selected, service_keys: services, supplier_note: requestNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not submit request.');
      setMessage('Coverage request sent to AuroTap admin for review. Your selected areas are not active until approval.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit request.'); }
    finally { setSaving(false); }
  };
  return <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900">
    <Link href="/supplier/settings" className="text-sm font-semibold text-emerald-700 hover:underline">← Back to dispatch settings</Link>
    <h1 className="mt-4 text-3xl font-extrabold">My service areas</h1>
    <p className="mt-2 text-sm text-slate-600">Tell us which cities/areas and services you can reliably fulfil. Admin reviews each request before it is mapped to your account. This does not open a city for customer bookings by itself.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">1. Select service areas</h2>
      {loading ? <p className="py-6 text-sm text-slate-500">Loading configured service areas…</p> : payload.zones.length === 0 ? <p className="py-4 text-sm text-slate-500">No service areas are configured yet. Contact AuroTap support.</p> :
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{payload.zones.map(z => <label key={z.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
        <input type="checkbox" className="mt-1" checked={selected.includes(z.id)} onChange={e => setSelected(old => e.target.checked ? [...old,z.id] : old.filter(id => id !== z.id))}/>
        <span><span className="block font-semibold">{z.name}</span><span className="block text-xs text-slate-500">{z.city} · {z.status.replaceAll('_',' ')}</span>{z.pincodes?.length ? <span className="mt-1 block text-xs text-slate-600">Configured PINs: {z.pincodes.join(', ')}</span> : <span className="mt-1 block text-xs text-amber-700">No PIN codes configured; request exact coverage below.</span></span>
      </label>)}</div>}
      <h2 className="mt-6 text-lg font-bold">2. Services you can fulfil</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{SERVICE_OPTIONS.map(([key,label]) => <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={services.includes(key)} onChange={e => setServices(old => e.target.checked ? [...old,key] : old.filter(x => x !== key))}/><span className="text-sm">{label}</span></label>)}</div>
      <label className="mt-5 block text-sm font-semibold">Request additional 6-digit PIN codes (optional)
        <input value={requestedPincodes} onChange={e => setRequestedPincodes(e.target.value)} maxLength={300} placeholder="e.g. 201301, 201307" className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal" />
        <span className="mt-1 block text-xs font-normal text-slate-500">These are a request for admin review, not an instant service-area activation.</span>
      </label>
      <label className="mt-5 block text-sm font-semibold">Coverage details (optional)
        <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Sectors/pincodes you cover, delivery hours, capacity, vehicle/stock details…" className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"/>
      </label>
      <button disabled={saving || loading || !payload.zones.length} onClick={() => void submit()} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for admin review'}</button>
    </section>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Request history</h2>
      {payload.requests.length === 0 ? <p className="mt-2 text-sm text-slate-500">No coverage requests submitted yet.</p> : <div className="mt-3 space-y-3">{payload.requests.map(r => {
        const zone = payload.zones.find(z => z.id === r.zone_id);
        return <article key={r.id} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap justify-between gap-2"><strong>{zone?.name ?? 'Service area'}</strong><span className="text-xs font-bold">{r.status}</span></div><p className="mt-1 text-sm text-slate-600">Services: {r.service_keys.join(', ')}</p>{r.admin_note && <p className="mt-1 text-sm">Admin note: {r.admin_note}</p>}</article>;
      })}</div>}
    </section>
  </main>;
}
