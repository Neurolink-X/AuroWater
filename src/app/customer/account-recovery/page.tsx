'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { requestJson } from '@/lib/account-recovery/http';
import { categoryAdminLabel } from '@/lib/account-recovery/shared';

type Ticket = { id: string; request_number: number; category: string; status: string; created_at: string };
export default function CustomerAccountRecoveryPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in to the account you recovered.');
      const result = await requestJson<Ticket[]>('/api/customer/account-recovery/confirm', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', retries: 1,
      });
      setTickets(Array.isArray(result.data) ? result.data : []);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load recovery cases.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const confirm = async (ticket: Ticket) => {
    if (busy) return;
    setBusy(ticket.id);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in to the recovered account.');
      await requestJson('/api/customer/account-recovery/confirm', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: ticket.id, confirmed: true }),
      });
      setSuccess(`Confirmation recorded for request #${ticket.request_number}. Support will verify and close the ticket.`);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Confirmation failed.'); }
    finally { setBusy(null); }
  };
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto max-w-2xl space-y-5">
        <Link href="/customer/account" className="text-sm font-semibold text-sky-700 underline">← Back to account</Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-2xl font-extrabold">Confirm account recovery</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Only confirm after you have successfully signed in to the original account and verified the problem is fixed. This confirmation will be recorded securely for support review. Never share a password, one-time code or reset link.</p>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {success && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
          {loading ? <p className="mt-5 text-sm text-slate-500">Checking your verified requests…</p> :
            tickets.length ? <ul className="mt-5 space-y-3">{tickets.map(ticket => (
              <li key={ticket.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-bold">Request #{ticket.request_number}</p>
                <p className="mt-1 text-sm text-slate-600">{categoryAdminLabel(ticket.category)} · {ticket.status.replace(/_/g, ' ')}</p>
                <button disabled={busy !== null} onClick={() => void confirm(ticket)}
                  className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                  {busy === ticket.id ? 'Confirming…' : 'I can sign in and my issue is fixed'}
                </button>
              </li>
            ))}</ul> : <p className="mt-5 text-sm text-slate-600">No pending verified recovery requests are linked to this account. If you cannot sign in, use account help instead.</p>}
        </div>
        <Link href="/account-help" className="text-sm font-semibold text-emerald-800 underline">Still need account help?</Link>
      </section>
    </main>
  );
}
