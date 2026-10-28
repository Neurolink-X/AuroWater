'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type DemandRow = {
  pincode: string;
  city: string;
  orders: number;
  cancelled: number;
  cancellationRate: number;
  assignedOrders: number;
  unassignedOrders: number;
  mappedSuppliers: number;
  coverageGap: boolean;
};
type Summary = {
  windowDays: number;
  ordersReviewed: number;
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatCustomerRate: number;
  ordersWithPincode: number;
  ordersWithoutPincode: number;
  cancelledOrders: number;
  cancellationRate: number;
  unassignedOrders: number;
  peakHour: number | null;
  peakHourOrders: number;
  demandByPincode: DemandRow[];
  serviceMix: Array<{ service: string; orders: number }>;
  dataLimited: boolean;
  stockSummary: {
    dataAvailable: boolean;
    eligibleSuppliers: number;
    suppliersWithStockRecord: number;
    suppliersWithUsableStock: number;
    lowStockSuppliers: number;
    totalCansAvailable: number | null;
    totalReservedCans: number | null;
    totalBufferCans: number | null;
  };
  supplierOutcomes: Array<{
    supplierId: string;
    supplierName: string;
    city: string;
    assignedOrders: number;
    completedOrders: number;
    cancelledOrFailedOrders: number;
    completionRate: number;
    averageRating: number | null;
    ratedOrders: number;
  }>;
  stockBySupplier: Array<{
    supplierId: string;
    supplierName: string;
    city: string;
    pincodes: string[];
    cansAvailable: number | null;
    reservedCans: number | null;
    bufferCans: number | null;
    dispatchableCans: number | null;
    lowStock: boolean | null;
    stockConfigured: boolean;
  }>;
  timezone: string;
  warnings: string[];
  generatedAt: string;
};

const number = new Intl.NumberFormat('en-IN');
const count = (n: number) => number.format(n);
const hourLabel = (hour: number | null) => hour === null
  ? 'Not enough timestamp data'
  : `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}–${(hour + 1) % 12 || 12}:00 ${(hour + 1) % 24 >= 12 ? 'PM' : 'AM'}`;

export default function LocalIntelligencePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    setError('');
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your admin session is unavailable. Sign in again.');
      const response = await fetch('/api/admin/local-intelligence?days=30', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await response.json() as { ok?: boolean; data?: Summary; error?: string; message?: string };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? json.message ?? 'Could not load local intelligence.');
      }
      setSummary(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load local intelligence.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/dashboard" className="text-sm text-cyan-300 hover:text-cyan-200">← Admin dashboard</Link>
          <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
            {refreshing ? 'Refreshing…' : 'Refresh insights'}
          </button>
        </div>

        <header className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">AuroTap Operations · Read-only intelligence</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Local Intelligence Engine</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Use actual order and approved coverage data to spot demand hotspots, cancellation patterns,
            unassigned orders, and PIN codes that may need more supplier capacity.
          </p>
          <p className="mt-2 text-xs text-slate-400">Last 30 days · India Standard Time · No automatic supplier ranking or dispatch changes.</p>
        </header>

        {error && <div role="alert" className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div>}
        {loading && !summary && <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">Loading operational signals…</div>}

        {summary && <>
          {summary.warnings.length > 0 && <div role="status" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            <strong>Partial data:</strong><ul className="mt-2 list-disc pl-5">{summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>}
          {summary.dataLimited && <div role="status" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            The report reached its 1,000-order cap. Counts describe the latest records returned, not necessarily every order in the full 30-day window.
          </div>}

          <section aria-label="Demand overview" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Orders reviewed', value: count(summary.ordersReviewed), note: 'Latest 30-day records' },
              { label: 'Cancel / failure rate', value: `${summary.cancellationRate}%`, note: `${count(summary.cancelledOrders)} cancelled or failed` },
              { label: 'Unassigned pending', value: count(summary.unassignedOrders), note: 'Pending orders without supplier' },
              { label: 'Peak order hour', value: hourLabel(summary.peakHour), note: `${count(summary.peakHourOrders)} orders in busiest hour` },
              { label: 'Repeat customers', value: count(summary.repeatCustomers), note: `${summary.repeatCustomerRate}% of customers ordered 2+ times in this window` },
            ].map((card) => <article key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">{card.value}</p>
              <p className="mt-2 text-xs text-slate-400">{card.note}</p>
            </article>)}
          </section>

          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Supplier stock visibility</h2>
                <p className="mt-1 text-sm text-slate-400">Available after reservations and buffer = cans available − reserved cans − reservation buffer. This is a stock snapshot, not a promise that a supplier is online or eligible for every service.</p>
              </div>
              {!summary.stockSummary.dataAvailable && <span className="rounded-full bg-rose-300/10 px-3 py-1 text-xs font-semibold text-rose-200">Stock data unavailable</span>}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Eligible suppliers', value: count(summary.stockSummary.eligibleSuppliers) },
                { label: 'With usable stock', value: count(summary.stockSummary.suppliersWithUsableStock) },
                { label: 'Low stock', value: count(summary.stockSummary.lowStockSuppliers) },
                { label: 'Available cans', value: summary.stockSummary.totalCansAvailable === null ? '—' : count(Math.max(0, summary.stockSummary.totalCansAvailable - (summary.stockSummary.totalReservedCans ?? 0) - (summary.stockSummary.totalBufferCans ?? 0))) },
              ].map((card) => <article key={card.label} className="rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs text-slate-400">{card.label}</p>
                <p className="mt-1 text-xl font-bold">{card.value}</p>
              </article>)}
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                  <tr>{['Supplier','City','Approved coverage PINs','Available cans','Reserved','Buffer','Usable stock','Stock status'].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.stockBySupplier.slice(0, 30).map((row) => <tr key={row.supplierId} className="hover:bg-white/[0.03]">
                    <td className="px-3 py-3 font-semibold">{row.supplierName}</td>
                    <td className="px-3 py-3">{row.city || '—'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{row.pincodes.join(', ') || 'No active zone mapping'}</td>
                    <td className="px-3 py-3">{row.stockConfigured ? count(row.cansAvailable ?? 0) : 'Not configured'}</td>
                    <td className="px-3 py-3">{row.stockConfigured ? count(row.reservedCans ?? 0) : '—'}</td>
                    <td className="px-3 py-3">{row.stockConfigured ? count(row.bufferCans ?? 0) : '—'}</td>
                    <td className="px-3 py-3 font-semibold">{row.dispatchableCans === null ? '—' : count(row.dispatchableCans)}</td>
                    <td className="px-3 py-3">{!row.stockConfigured
                      ? <span className="text-xs text-slate-400">No stock row</span>
                      : row.lowStock
                        ? <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">Low stock</span>
                        : (row.dispatchableCans ?? 0) > 0
                          ? <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">Stock available</span>
                          : <span className="rounded-full bg-rose-300/10 px-2.5 py-1 text-xs font-semibold text-rose-200">No usable stock</span>}</td>
                  </tr>)}
                </tbody>
              </table>
              {!summary.stockBySupplier.length && <p className="p-4 text-sm text-slate-400">No dispatch-eligible supplier profiles were returned.</p>}
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-lg font-bold">Supplier outcomes — assigned orders only</h2>
              <p className="mt-1 text-sm text-slate-400">Shows completed work and customer ratings for orders actually assigned in the reporting window. Suppliers being offline or unavailable is not counted as poor performance. Cancellation/failure is a review signal only because customer-initiated cancellations may also be included. Do not use this table as an automatic penalty or ranking rule.</p>
            </div>
            {summary.supplierOutcomes.length ? <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                  <tr>{['Supplier','City','Assigned','Completed','Completion rate','Cancelled / failed','Average rating'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.supplierOutcomes.slice(0, 30).map((row) => <tr key={row.supplierId} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-semibold">{row.supplierName}</td>
                    <td className="px-4 py-3">{row.city || '—'}</td>
                    <td className="px-4 py-3">{count(row.assignedOrders)}</td>
                    <td className="px-4 py-3">{count(row.completedOrders)}</td>
                    <td className="px-4 py-3">{row.completionRate}%</td>
                    <td className="px-4 py-3">{count(row.cancelledOrFailedOrders)}</td>
                    <td className="px-4 py-3">{row.averageRating === null ? 'Not rated' : `${row.averageRating.toFixed(2)} / 5 (${count(row.ratedOrders)})`}</td>
                  </tr>)}
                </tbody>
              </table>
            </div> : <p className="p-5 text-sm text-slate-400">No assigned supplier orders were found in this window.</p>}
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-lg font-bold">PIN-code demand and coverage signals</h2>
              <p className="mt-1 text-sm text-slate-400">Coverage counts include active/approved supplier profiles mapped to zones marked Available or Limited. They are signals, not a guarantee of live stock or a bookable slot.</p>
            </div>
            {summary.demandByPincode.length === 0 ? <p className="p-6 text-sm text-slate-400">No valid PIN-code data was found in the reviewed orders.</p> : <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                  <tr>{['PIN code','City / area','Orders','Cancelled','Cancel rate','Mapped suppliers','Pending without supplier','Signal'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.demandByPincode.slice(0, 30).map((row) => <tr key={row.pincode} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-mono font-semibold">{row.pincode}</td>
                    <td className="px-4 py-3">{row.city}</td>
                    <td className="px-4 py-3">{count(row.orders)}</td>
                    <td className="px-4 py-3">{count(row.cancelled)}</td>
                    <td className="px-4 py-3">{row.cancellationRate}%</td>
                    <td className="px-4 py-3">{count(row.mappedSuppliers)}</td>
                    <td className="px-4 py-3">{count(row.unassignedOrders)}</td>
                    <td className="px-4 py-3">{row.coverageGap
                      ? <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">Review coverage</span>
                      : <span className="text-xs text-emerald-200">No immediate signal</span>}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-bold">Service mix</h2>
              <p className="mt-1 text-sm text-slate-400">Most frequently booked service types in the reviewed records.</p>
              <div className="mt-4 space-y-3">
                {summary.serviceMix.slice(0, 8).map((item) => {
                  const width = summary.ordersReviewed ? Math.max(3, item.orders / summary.ordersReviewed * 100) : 0;
                  return <div key={item.service}>
                    <div className="mb-1 flex justify-between gap-3 text-sm"><span className="break-all">{item.service}</span><span className="text-slate-300">{count(item.orders)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${width}%` }} /></div>
                  </div>;
                })}
                {summary.serviceMix.length === 0 && <p className="text-sm text-slate-400">No service data available.</p>}
              </div>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-bold">Data quality and next actions</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Orders with valid PIN</dt><dd className="font-semibold">{count(summary.ordersWithPincode)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Orders without valid PIN</dt><dd className="font-semibold">{count(summary.ordersWithoutPincode)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-slate-400">Report timezone</dt><dd className="font-semibold">{summary.timezone}</dd></div>
              </dl>
              <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300">
                <strong className="text-cyan-200">How to use this safely:</strong> investigate repeated cancellations and coverage gaps, verify current stock and supplier availability, then decide whether to recruit suppliers. This report never changes assignment, payout, eligibility, or serviceability.
              </div>
            </article>
          </section>
          <p className="mt-4 text-xs text-slate-500">Generated {new Date(summary.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. Operational signals can be incomplete if address snapshots or coverage mappings are missing.</p>
        </>}
      </div>
    </main>
  );
}
