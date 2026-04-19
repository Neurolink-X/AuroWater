'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminFinance } from '@/lib/api-client';

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
    </div>
  );
}
