'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Data = {
  profile: { id: string; full_name: string | null; email: string | null; phone: string | null; city: string | null; business_name: string | null; status: string; is_active: boolean | null; created_at: string } | null;
  settings: Record<string, unknown> | null;
  coverage: Array<{ zone_id: string; service_keys: string[]; service_zones: { city: string; name: string; status: string; pincodes: string[] | null } | null }>;
};
const value = (v: unknown) => typeof v === 'string' ? v : '';

export default function SupplierProfilePage() {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', business_name: '', city: '', address: '', pincode: '', reason: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const client = createClient();
      const { data: session } = await client.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/supplier/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not load supplier profile.');
      const d = (json.data ?? json) as Data;
      setData(d);
      const s = d.settings ?? {};
      setForm({
        full_name: value(d.profile?.full_name), phone: value(d.profile?.phone),
        business_name: value(d.profile?.business_name), city: value(d.profile?.city),
        address: value(s.business_address) || value(s.address),
        pincode: value(s.pincode), reason: '',
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load supplier profile.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = (key: keyof typeof form, v: string) => setForm(old => ({ ...old, [key]: v }));
  const submit = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const client = createClient();
      const { data: session } = await client.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/supplier/profile', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not submit profile changes.');
      setMessage(json?.data?.message ?? 'Profile change request sent to admin for review.');
      setForm(old => ({ ...old, reason: '' }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit profile changes.'); }
    finally { setSaving(false); }
  };
  const settings = data?.settings ?? {};
  return <main className="mx-auto max-w-4xl px-4 py-8 text-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold text-emerald-700">Supplier account</p><h1 className="mt-1 text-3xl font-extrabold">My profile & address</h1><p className="mt-2 text-sm text-slate-600">Review your registered details and request corrections. Changes that affect your account are sent to admin for approval.</p></div>
      <Link href="/supplier/coverage" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Manage service areas</Link>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {loading ? <p className="mt-6 rounded-2xl border bg-white p-6 text-sm text-slate-600">Loading your supplier details…</p> : <>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Current account & approval</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Account status</dt><dd className="mt-1 font-semibold">{data?.profile?.status ?? 'Unknown'}{data?.profile?.is_active === false ? ' · Inactive' : ''}</dd></div>
          <div><dt className="text-xs text-slate-500">Email (managed by sign-in)</dt><dd className="mt-1 break-all font-semibold">{data?.profile?.email ?? 'Not available'}</dd></div>
          <div><dt className="text-xs text-slate-500">Registered address</dt><dd className="mt-1 font-semibold">{value(settings.business_address) || value(settings.address) || 'No business address on file'}</dd></div>
          <div><dt className="text-xs text-slate-500">Registered PIN code</dt><dd className="mt-1 font-semibold">{value(settings.pincode) || 'No PIN code on file'}</dd></div>
          <div><dt className="text-xs text-slate-500">Base location coordinates</dt><dd className="mt-1 font-semibold">{settings.base_lat != null && settings.base_lng != null ? `${settings.base_lat}, ${settings.base_lng}` : 'Not configured'}</dd></div>
        </dl>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Request profile/address update</h2>
        <p className="mt-1 text-sm text-slate-600">Submit the corrected information below. This creates a pending request; it does not directly change your approved account or live dispatch area.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([
            ['full_name','Full name'],['phone','Phone number'],['business_name','Business name'],['city','City'],['address','Business/service address'],['pincode','PIN code'],
          ] as Array<[keyof typeof form,string]>).map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}<input value={form[key]} onChange={e => update(key,e.target.value)} maxLength={key === 'address' ? 300 : 100} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label>)}
        </div>
        <label className="mt-4 block text-sm font-semibold">Reason for change (optional)<textarea value={form.reason} onChange={e => update('reason',e.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="e.g. moved to a new shop or corrected PIN code" /></label>
        <button onClick={() => void submit()} disabled={saving} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Request admin approval'}</button>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Approved service coverage</h2>
        {data?.coverage.length ? <div className="mt-3 space-y-3">{data.coverage.map((c,i) => <article key={c.zone_id} className="rounded-xl border border-slate-100 p-3"><div className="font-semibold">{c.service_zones?.name ?? 'Service area'} · {c.service_zones?.city ?? ''}</div><div className="mt-1 text-xs text-slate-600">Status: {c.service_zones?.status ?? 'Unknown'}</div><div className="mt-1 text-sm">PIN codes: {c.service_zones?.pincodes?.join(', ') || 'Not configured'}</div><div className="mt-1 text-sm">Services: {c.service_keys?.join(', ') || 'Not listed'}</div></article>)}</div> : <p className="mt-2 text-sm text-slate-600">No approved service areas are mapped to your account yet.</p>}
        <p className="mt-3 text-xs text-slate-500">Dispatch eligibility also depends on service availability, approval, and stock/capacity.</p>
      </section>
    </>}
  </main>;
}
