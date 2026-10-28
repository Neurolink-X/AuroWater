'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type Data = {
  profile: { id: string; full_name: string | null; email: string | null; phone: string | null; city: string | null; business_name: string | null; status: string; is_active: boolean | null; verification_status?: string | null; created_at: string } | null;
  settings: Record<string, unknown> | null;
  coverage: Array<{ zone_id: string; service_keys: string[]; service_zones: { city: string; name: string; status: string; pincodes: string[] | null } | null }>;
  settings_warning?: boolean;
  coverage_warning?: boolean;
};
const value = (v: unknown) => typeof v === 'string' ? v : '';

export default function SupplierProfilePage() {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
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
  const fieldLabelsHi: Record<keyof typeof form, string> = {
    full_name: 'पूरा नाम', phone: 'फोन नंबर', business_name: 'व्यवसाय का नाम',
    city: 'शहर', address: 'व्यवसाय/सेवा का पता', pincode: 'PIN कोड', reason: 'बदलाव का कारण (वैकल्पिक)',
  };
  return <main className="mx-auto w-full max-w-4xl min-w-0 px-3 py-5 pb-10 text-slate-900 sm:px-4 sm:py-8">
    <div className="flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div><p className="text-sm font-semibold text-emerald-700">Supplier account</p><h1 className="mt-1 break-words text-2xl font-extrabold sm:text-3xl">{isHindi ? 'मेरी प्रोफ़ाइल और पता' : 'My profile & address'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{isHindi ? 'अपनी पंजीकृत जानकारी देखें और सुधार का अनुरोध करें। खाते में बदलाव एडमिन की मंजूरी के बाद लागू होंगे।' : 'Review your registered details and request corrections. Changes that affect your account are sent to admin for approval.'}</p></div>
      <Link href="/supplier/coverage" className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-center text-sm font-bold text-white">{isHindi ? 'सेवा क्षेत्र प्रबंधित करें' : 'Manage service areas'}</Link>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {data?.settings_warning && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your account loaded, but registered address settings could not be read. Approved coverage PIN codes are shown below where available. Please contact admin if your registered address is missing.</p>}
    {data?.coverage_warning && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Approved service coverage could not be fully loaded. Refresh later or contact admin; this does not change your dispatch eligibility.</p>}
    {loading ? <p className="mt-6 rounded-2xl border bg-white p-6 text-sm text-slate-600">Loading your supplier details…</p> : <>
      <section className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-bold">{isHindi ? 'खाता और मंजूरी की स्थिति' : 'Current account & approval'}</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Account status</dt><dd className="mt-1 font-semibold">{data?.profile?.status ?? 'Unknown'}{data?.profile?.is_active === false ? ' · Inactive' : ''}</dd><dt className="mt-2 text-xs text-slate-500">Verification</dt><dd className="mt-1 font-semibold">{data?.profile?.verification_status ?? 'Not available — contact admin to confirm'}</dd></div>
          <div><dt className="text-xs text-slate-500">Email (managed by sign-in)</dt><dd className="mt-1 break-all font-semibold">{data?.profile?.email ?? 'Not available'}</dd></div>
          <div><dt className="text-xs text-slate-500">Registered address</dt><dd className="mt-1 font-semibold">{value(settings.business_address) || value(settings.address) || 'No business address on file'}</dd></div>
          <div><dt className="text-xs text-slate-500">Registered PIN code</dt><dd className="mt-1 font-semibold">{value(settings.pincode) || (data?.coverage.flatMap(c => c.service_zones?.pincodes ?? []).filter(Boolean).length ? `Not registered · approved coverage: ${[...new Set(data.coverage.flatMap(c => c.service_zones?.pincodes ?? []))].join(', ')}` : 'No PIN code on file')}</dd></div>
          <div><dt className="text-xs text-slate-500">Base location coordinates</dt><dd className="mt-1 font-semibold">{settings.base_lat != null && settings.base_lng != null ? `${settings.base_lat}, ${settings.base_lng}` : 'Not configured'}</dd></div>
        </dl>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">{isHindi ? 'प्रोफ़ाइल/पते में बदलाव का अनुरोध' : 'Request profile/address update'}</h2>
        <p className="mt-1 text-sm text-slate-600">{isHindi ? 'नीचे सही जानकारी दें। अनुरोध एडमिन की समीक्षा के लिए जाएगा; मंजूरी से पहले आपका स्वीकृत खाता या सेवा क्षेत्र नहीं बदलेगा।' : 'Submit the corrected information below. This creates a pending request; it does not directly change your approved account or live dispatch area.'}</p>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          {([
            ['full_name','Full name'],['phone','Phone number'],['business_name','Business name'],['city','City'],['address','Business/service address'],['pincode','PIN code'],
          ] as Array<[keyof typeof form,string]>).map(([key,label]) => <label key={key} className="text-sm font-semibold">{isHindi ? fieldLabelsHi[key] : label}<input value={form[key]} onChange={e => update(key,e.target.value)} maxLength={key === 'address' ? 300 : key === 'pincode' ? 6 : 100} inputMode={key === 'pincode' ? 'numeric' : key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'pincode' ? 'postal-code' : key === 'phone' ? 'tel' : 'off'} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 p-3 font-normal" /></label>)}
        </div>
        <label className="mt-4 block text-sm font-semibold">Reason for change (optional)<textarea value={form.reason} onChange={e => update('reason',e.target.value)} maxLength={300} rows={2} className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 p-3 font-normal" placeholder={isHindi ? 'उदाहरण: नया पता या सही PIN code' : 'e.g. moved to a new shop or corrected PIN code'} /></label>
        <button onClick={() => void submit()} disabled={saving} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? (isHindi ? 'भेजा जा रहा है…' : 'Submitting…') : (isHindi ? 'एडमिन मंजूरी का अनुरोध करें' : 'Request admin approval')}</button>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">{isHindi ? 'स्वीकृत सेवा क्षेत्र' : 'Approved service coverage'}</h2>
        {data?.coverage.length ? <div className="mt-3 space-y-3">{data.coverage.map((c,i) => <article key={c.zone_id} className="rounded-xl border border-slate-100 p-3"><div className="font-semibold">{c.service_zones?.name ?? 'Service area'} · {c.service_zones?.city ?? ''}</div><div className="mt-1 text-xs text-slate-600">Status: {c.service_zones?.status ?? 'Unknown'}</div><div className="mt-1 text-sm">PIN codes: {c.service_zones?.pincodes?.join(', ') || 'Not configured'}</div><div className="mt-1 text-sm">Services: {c.service_keys?.join(', ') || 'Not listed'}</div></article>)}</div> : <p className="mt-2 text-sm text-slate-600">No approved service areas are mapped to your account yet.</p>}
        <p className="mt-3 text-xs text-slate-500">Dispatch eligibility also depends on service availability, approval, and stock/capacity.</p>
      </section>
    </>}
  </main>;
}
