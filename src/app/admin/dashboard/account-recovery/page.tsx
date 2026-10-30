'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';

type RecoveryRequest = {
  id: string; request_number: number; user_id: string | null; contact_name: string;
  contact_email: string; contact_phone: string | null; category: string; message: string;
  status: string; admin_note: string | null; ownership_verified_at: string | null; created_at: string;
};
const statuses = ['open', 'in_review', 'waiting_customer', 'resolved', 'rejected'];
const labels: Record<string, string> = {
  forgot_password: 'Forgot password', lost_email_access: 'Lost email access',
  change_email: 'Change registered email', account_blocked: 'Account blocked',
  account_access: 'Cannot access account', other: 'Other issue',
};

export default function AdminAccountRecoveryPage() {
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [verify, setVerify] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch(`/api/admin/account-recovery?status=${status}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load requests.');
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const update = async (row: RecoveryRequest) => {
    setBusy(row.id);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch('/api/admin/account-recovery', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: row.id, status: row.status, admin_note: notes[row.id] ?? row.admin_note ?? '', verify_ownership: verify[row.id] === true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed.');
      toast.success('Request updated and audit event recorded.');
      setVerify((old) => ({ ...old, [row.id]: false }));
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Update failed.'); }
    finally { setBusy(null); }
  };

  return <main className="space-y-6 text-white">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Secure customer support</p><h1 className="mt-2 text-2xl font-black">Account Help &amp; Recovery</h1><p className="mt-1 text-sm text-slate-400">Review ownership evidence and track account-access requests without creating duplicate accounts.</p></div>
      <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh'}</button>
    </header>
    <div className="flex flex-wrap gap-2">{statuses.map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${status === s ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'}`}>{s.replace('_', ' ')}</button>)}</div>
    {loading ? <p className="py-12 text-center text-slate-400">Loading requests…</p> : rows.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">No {status.replace('_', ' ')} requests.</div> :
      <section className="grid gap-4">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-cyan-300">Request #{row.request_number} · {new Date(row.created_at).toLocaleString('en-IN')}</p><h2 className="mt-1 text-lg font-extrabold">{row.contact_name}</h2><p className="text-sm text-slate-300">{row.contact_email}{row.contact_phone ? ` · ${row.contact_phone}` : ''}</p><p className="mt-2 text-sm font-semibold text-amber-200">{labels[row.category] || row.category}</p></div><span className="rounded-lg border border-white/10 px-3 py-1 text-xs capitalize">{row.status.replace('_', ' ')}</span></div>
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-sm leading-6 text-slate-200">{row.message}</p>
        <p className="mt-3 text-xs text-slate-500">Linked account: {row.user_id || 'Not linked — verify identity before linking manually.'}</p>
        {row.ownership_verified_at && <p className="mt-2 text-xs font-bold text-emerald-300">Ownership verified · {new Date(row.ownership_verified_at).toLocaleString('en-IN')}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><textarea value={notes[row.id] ?? row.admin_note ?? ''} onChange={(e) => setNotes((old) => ({ ...old, [row.id]: e.target.value }))} maxLength={1000} rows={2} placeholder="Internal review note. Record how ownership was checked." className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500" />
          <div className="flex flex-col gap-2"><select value={row.status} onChange={(e) => setRows((old) => old.map((item) => item.id === row.id ? { ...item, status: e.target.value } : item))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">{statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={verify[row.id] === true} onChange={(e) => setVerify((old) => ({ ...old, [row.id]: e.target.checked }))} /> Confirm ownership verified</label><button onClick={() => void update(row)} disabled={busy === row.id} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{busy === row.id ? 'Saving…' : 'Save review'}</button></div>
        </div>
      </article>)}</section>}
    <aside className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100"><strong>Security rule:</strong> Never ask for passwords, OTPs or reset links. Do not change email/mobile or create another account from this queue. After ownership is independently verified, use the existing secure recovery process; keep the original Auth user ID and customer data.</aside>
  </main>;
}
