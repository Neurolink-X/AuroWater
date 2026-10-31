'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type Mode = 'overdue' | 'unpaid_completed' | 'assigned_unpaid';
type Order = {
  id: string; order_number: string; status: string; service_type: string | null;
  payment_status: string | null; payment_method: string | null;
  amount: number; created_at: string; supplier_assigned: boolean;
};
type Payload = {
  mode: Mode; count: number; page: number; page_size: number;
  orders: Order[]; disclaimer: string;
};
const MODES: { value: Mode; name: string }[] = [
  { value: 'overdue', name: 'Older open orders' },
  { value: 'unpaid_completed', name: 'Completed, recorded unpaid' },
  { value: 'assigned_unpaid', name: 'Assigned, recorded unpaid' },
];
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export default function OrderHealthPage() {
  const [mode, setMode] = useState<Mode>('overdue');
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setPayload(null);
    const load = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Admin sign-in required.');
        const response = await fetch(`/api/admin/order-health?mode=${mode}&page=${page}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const envelope = await response.json();
        if (!response.ok || !envelope.success) throw new Error(envelope.error || 'Could not load order health.');
        if (active) setPayload(envelope.data as Payload);
      } catch (cause) {
        if (active && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load the report.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; controller.abort(); };
  }, [mode, page, version]);

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-900">
    <Link href="/admin/dashboard" className="text-sm font-semibold text-cyan-700 hover:underline">← Admin dashboard</Link>
    <header>
      <h1 className="text-3xl font-extrabold">Order health & reconciliation</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        Investigate old orders and recorded payment exceptions. No automatic cancellation, refund, payout or payment-status update happens here.
      </p>
    </header>
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <strong>Before changing any order:</strong> confirm the supplier handover, customer communication, payment evidence and whether this is a test or cash-on-delivery order.
    </section>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="health-filter" className="text-sm font-semibold">Review queue</label>
      <select id="health-filter" value={mode}
        onChange={(e) => { setMode(e.target.value as Mode); setPage(0); }}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">
        {MODES.map(option => <option key={option.value} value={option.value}>{option.name}</option>)}
      </select>
      <button onClick={() => setVersion(v => v + 1)} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold hover:bg-slate-50">Refresh</button>
      <Link href="/admin/finance" className="inline-flex min-h-11 items-center font-semibold text-cyan-800 hover:underline">Open finance →</Link>
    </div>
    {loading && <p role="status" className="rounded-xl border bg-white p-5">Checking orders…</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</p>}
    {payload && <section aria-label="Orders to review" className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-bold">{payload.count.toLocaleString('en-IN')} orders need review in this filter</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{payload.disclaimer}</p>
      </div>
      <div className="divide-y">
        {payload.orders.length === 0 && <p className="p-5 text-sm text-slate-500">No matching orders. Check other filters or refresh.</p>}
        {payload.orders.map(order => <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-bold">{order.order_number}</p>
            <p className="mt-1 text-xs text-slate-600">{order.service_type ?? 'Service'} · {order.status} · {order.payment_status ?? 'unknown'} · {order.payment_method ?? 'unknown method'}</p>
            <p className="mt-1 text-xs text-slate-500">Placed {new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · Supplier assigned: {order.supplier_assigned ? 'yes' : 'no'}</p>
          </div>
          <div className="flex items-center gap-4">
            <strong className="tabular-nums">{money.format(order.amount)}</strong>
            <Link href="/admin/orders" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-200 px-3 text-sm font-bold text-cyan-800 hover:bg-cyan-50">Review in Orders →</Link>
          </div>
        </article>)}
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-5 py-4">
        <button disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0,p-1))} className="min-h-11 rounded-lg border px-4 disabled:opacity-40">Previous</button>
        <span className="text-xs text-slate-600">Page {page+1}</span>
        <button disabled={loading || (page+1)*payload.page_size >= payload.count} onClick={() => setPage(p => p+1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-40">Next</button>
      </div>
    </section>}
  </main>;
}
