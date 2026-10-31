'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Row = { id: string; supplier_id: string; zone_id: string; service_keys: string[]; status: string; supplier_note: string | null; admin_note: string | null; created_at: string; profiles?: { full_name?: string; phone?: string; city?: string } | null; service_zones?: { city?: string; name?: string; status?: string; pincodes?: string[] } | null };
const requestedPins = (note: string | null) => { const match = note?.match(/Requested PIN codes:\s*([^\n]+)/i); return match ? [...new Set(match[1].split(/[\s,]+/).filter(pin => /^\d{6}$/.test(pin)))].slice(0, 3) : []; };
const supplierDetails = (note: string | null) => note?.replace(/Requested PIN codes:\s*[^\n]+\n?/i, '').trim() ?? '';

export default function AdminCoverageRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/admin/coverage-requests', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not load requests.');
      setRows(json.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 30_000);
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshOnFocus); };
  }, [load]);
  const review = async (row: Row, status: 'APPROVED'|'REJECTED') => {
    setBusy(row.id); setError(''); setMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/admin/coverage-requests', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: row.id, status, admin_note: notes[row.id] ?? '' }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Review failed.');
      setMessage(status === 'APPROVED' ? 'Supplier mapped to the selected area. Customer bookings still require the area to be marked Available/Limited separately.' : 'Coverage request rejected.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Review failed.'); }
    finally { setBusy(''); }
  };
  const pending = rows.filter(r => r.status === 'PENDING');
  return <main className="mx-auto max-w-5xl rounded-3xl bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <Link href="/admin/zones" className="text-sm font-semibold text-emerald-700 hover:underline">← Service zones</Link>
    <Link href="/admin/supplier-profile-requests" className="ml-4 text-sm font-semibold text-emerald-700 hover:underline">Review supplier profile changes →</Link>
    <h1 className="mt-4 text-3xl font-extrabold">Supplier coverage review</h1>
    <p className="mt-1 text-xs text-slate-500">Auto-refreshes every 30 seconds while this page is visible.</p>
    <p className="mt-2 text-sm text-slate-600">Review requested cities, pincodes/sectors, and service categories before mapping a supplier. Approval maps coverage only; it never automatically opens a Coming soon area for customer bookings.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{pending.length} pending</span><button onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50">Refresh</button></div>
    {loading ? <p className="py-8 text-slate-500">Loading requests…</p> : rows.length === 0 ? <p className="mt-6 rounded-2xl border p-6 text-slate-600">No supplier coverage requests yet.</p> :
      <div className="mt-5 space-y-4">{rows.map(r => <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-bold">{r.profiles?.full_name || 'Supplier'} · {r.service_zones?.name || r.service_zones?.city || 'Service area'}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{r.status}</span></div>
        <p className="mt-1 text-sm text-slate-600">{[r.profiles?.city,r.profiles?.phone,r.service_zones?.status].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 text-sm"><strong>Supplier registered city:</strong> {r.profiles?.city || 'Not provided'} · <strong>Requested area:</strong> {r.service_zones?.city || 'Unknown'}</p>
        <p className="mt-2 text-sm"><strong>Services:</strong> {r.service_keys.join(', ') || 'Not specified'}</p>
        {requestedPins(r.supplier_note).length > 0 && <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>New PIN codes requested (admin review):</strong> {requestedPins(r.supplier_note).join(', ')}<p className="mt-1 text-xs">These PINs are requests, not active coverage. Verify city, delivery radius, supplier capacity and zone configuration before approving.</p></div>}
        <p className="mt-1 text-sm"><strong>Configured pincodes:</strong> {r.service_zones?.pincodes?.join(', ') || 'None listed — ask supplier for exact sector/pincode coverage'}</p>
        {supplierDetails(r.supplier_note) && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm"><strong>Supplier details:</strong> {supplierDetails(r.supplier_note)}</p>}
        {r.status === 'PENDING' ? <><label className="mt-3 block text-sm font-semibold">Admin note<textarea rows={2} maxLength={500} value={notes[r.id] ?? ''} onChange={e => setNotes(old => ({...old,[r.id]:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Reason or conditions for approval/rejection"/></label><div className="mt-3 flex gap-2"><button disabled={busy===r.id} onClick={() => void review(r,'APPROVED')} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy===r.id?'Saving…':'Approve coverage'}</button><button disabled={busy===r.id} onClick={() => void review(r,'REJECTED')} className="rounded-xl border border-rose-200 px-4 py-2 font-bold text-rose-700 disabled:opacity-50">Reject</button></div></> : r.admin_note && <p className="mt-2 text-sm text-slate-600">Admin note: {r.admin_note}</p>}
      </article>)}</div>}
  </main>;
}
