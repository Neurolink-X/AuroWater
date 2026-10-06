'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFinance, adminPayoutFinalize, adminPayoutsList, type AdminPayoutRow } from '@/lib/api-client';

type RangeKey = '7d' | '30d' | '90d' | 'all';

type FinancePayload = {
  range: string;
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
};

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function AdminFinancePage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancePayload | null>(null);
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await adminFinance(range)) as FinancePayload;
      setData(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load finance');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPayouts = useCallback(async () => {
    setPayoutLoading(true);
    try {
      setPayouts(await adminPayoutsList('pending'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load supplier payouts');
    } finally {
      setPayoutLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayouts();
  }, [loadPayouts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="text-sm text-slate-300 mt-1">Completed orders only · live from GET /api/admin/finance</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeKey)}
          className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All (wide window)</option>
        </select>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : !data ? (
        <p className="text-rose-300">No data.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Completed orders', value: String(data.order_count), sub: `Range: ${data.range}` },
            { label: 'Gross revenue', value: inr(data.gross_revenue), sub: 'Sum of completed totals' },
            { label: 'Collected (paid)', value: inr(data.collected_revenue), sub: 'payment_status = paid' },
            { label: 'Pending vs gross', value: inr(data.pending_payments), sub: 'Booked but not marked paid' },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-bold text-white mt-2">{c.value}</p>
              <p className="text-xs text-slate-500 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Supplier settlement queue</h2>
            <p className="mt-1 text-sm text-slate-400">Only persisted payout requests appear here. Finalization updates the supplier ledger and eligible orders together.</p>
          </div>
          <button type="button" onClick={() => void loadPayouts()} className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-bold text-slate-100 sm:mt-0">Refresh</button>
        </div>
        <div className="mt-5 overflow-x-auto">
          {payoutLoading ? <p className="py-5 text-sm text-slate-400">Loading payout requests…</p> : payouts.length === 0 ? <p className="py-5 text-sm text-slate-400">No pending supplier payout requests.</p> : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-3">Supplier</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Requested</th><th className="px-3 py-3 text-right">Action</th></tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t border-white/10 text-slate-200">
                    <td className="px-3 py-4"><div className="font-bold">{p.supplier_name}</div><div className="text-xs text-slate-500">{p.supplier_city ?? '—'} · {p.supplier_phone ?? '—'}</div></td>
                    <td className="px-3 py-4 font-black">{inr(Number(p.amount))}</td>
                    <td className="px-3 py-4">{p.method ?? '—'}</td>
                    <td className="px-3 py-4 text-slate-400">{new Date(p.requested_at).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={async () => {
                          try { await adminPayoutFinalize(p.id, 'paid'); toast.success('Payout marked paid.'); await loadPayouts(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Could not finalize payout'); }
                        }} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Mark paid</button>
                        <button type="button" onClick={async () => {
                          try { await adminPayoutFinalize(p.id, 'rejected'); toast.success('Payout rejected and balance returned to pending.'); await loadPayouts(); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Could not reject payout'); }
                        }} className="rounded-xl border border-rose-300/40 px-3 py-2 text-xs font-black text-rose-200">Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
