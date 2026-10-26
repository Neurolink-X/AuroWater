'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Row = { id: string; supplier_id: string; requested_changes: Record<string, unknown>; status: string; admin_note: string | null; created_at: string; profiles?: { full_name?: string; phone?: string; city?: string; email?: string } | null };
const pretty = (v: unknown) => typeof v === 'string' && v.trim() ? v : '—';

export default function AdminSupplierProfileRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/admin/supplier-profile-requests', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Could not load requests.');
      setRows(json.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const review = async (row: Row, status: 'APPROVED'|'REJECTED') => {
    setBusy(row.id); setError(''); setMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/admin/supplier-profile-requests', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: row.id, status, admin_note: notes[row.id] ?? '' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Review failed.');
      setMessage(status === 'APPROVED' ? 'Profile changes approved and applied.' : 'Profile change request rejected.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Review failed.'); }
    finally { setBusy(''); }
  };
  const pending = rows.filter(r => r.status === 'PENDING');
  return <main className="mx-auto max-w-5xl px-4 py-8 text-slate-900">
    <Link href="/admin/coverage-requests" className="text-sm font-semibold text-emerald-700 hover:underline">← Coverage requests</Link>
    <h1 className="mt-4 text-3xl font-extrabold">Supplier profile change requests</h1>
    <p className="mt-2 text-sm text-slate-600">Review business details, phone, service address and PIN-code changes. Approval updates the registered details; it does not automatically activate a new service zone.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-5 flex gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{pending.length} pending</span><button onClick={() => void load()} disabled={loading} className="rounded-xl border px-4 py-2 text-sm font-semibold">Refresh</button></div>
    {loading ? <p className="py-8 text-slate-500">Loading requests…</p> : rows.length === 0 ? <p className="mt-6 rounded-2xl border bg-white p-6 text-slate-600">No profile change requests yet.</p> :
      <div className="mt-5 space-y-4">{rows.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-bold">{row.profiles?.full_name || 'Supplier'} · {row.profiles?.city || 'City not set'}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{row.status}</span></div>
        <p className="mt-1 text-sm text-slate-600">{[row.profiles?.email,row.profiles?.phone,row.supplier_id].filter(Boolean).join(' · ')}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(row.requested_changes ?? {}).filter(([k]) => k !== 'reason').map(([key,val]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs uppercase text-slate-500">{key.replaceAll('_',' ')}</dt><dd className="mt-1 break-words font-semibold">{pretty(val)}</dd></div>)}</dl>
        {row.requested_changes?.reason && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm"><strong>Reason:</strong> {pretty(row.requested_changes.reason)}</p>}
        {row.status === 'PENDING' ? <><label className="mt-3 block text-sm font-semibold">Admin note<textarea rows={2} maxLength={500} value={notes[row.id] ?? ''} onChange={e => setNotes(old => ({...old,[row.id]:e.target.value}))} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label><div className="mt-3 flex gap-2"><button disabled={busy===row.id} onClick={() => void review(row,'APPROVED')} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy===row.id?'Saving…':'Approve & apply'}</button><button disabled={busy===row.id} onClick={() => void review(row,'REJECTED')} className="rounded-xl border border-rose-200 px-4 py-2 font-bold text-rose-700">Reject</button></div></> : row.admin_note && <p className="mt-2 text-sm text-slate-600">Admin note: {row.admin_note}</p>}
      </article>)}</div>}
  </main>;
}
