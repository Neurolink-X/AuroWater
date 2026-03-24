'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdminDashboard } from '@/lib/api-client';

interface DashboardData {
  kpis: {
    total_orders: number;
    todays_orders: number;
    total_revenue: number;
    revenue_today: number;
    active_jobs: number;
    emergency_bookings: number;
    total_customers: number;
    total_technicians: number;
  };
  charts: {
    orders_daily: Array<{ day: string; count: number }>;
    revenue_daily: Array<{ day: string; total: number }>;
  };
  recent_orders: Array<{
    id: number;
    customer_name: string;
    service_name: string;
    total_amount: number;
    status: string;
    created_at: string;
  }>;
}

function KpiCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'slate' | 'emerald' | 'sky' | 'rose' | 'amber' | 'violet';
}) {
  const toneCls =
    tone === 'emerald'
      ? 'text-emerald-200'
      : tone === 'sky'
        ? 'text-sky-200'
        : tone === 'rose'
          ? 'text-rose-200'
          : tone === 'amber'
            ? 'text-amber-200'
            : tone === 'violet'
              ? 'text-violet-200'
              : 'text-white';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card p-5">
      <p className="text-sm text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</p>
    </div>
  );
}

function MiniBars({
  title,
  series,
  formatRight,
  colorClass,
}: {
  title: string;
  series: Array<{ day: string; value: number }>;
  formatRight: (v: number) => string;
  colorClass: string;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card p-6">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div className="space-y-2">
        {series.slice(-14).map((p) => (
          <div key={p.day} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-24">{p.day}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full ${colorClass}`} style={{ width: `${Math.min(100, (p.value / max) * 100)}%` }} />
            </div>
            <span className="text-xs text-slate-300 w-16 text-right">{formatRight(p.value)}</span>
          </div>
        ))}
        {series.length === 0 && <p className="text-sm text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminDashboard();
        setDashboard(data as DashboardData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const ordersSeries = useMemo(
    () =>
      (dashboard?.charts?.orders_daily || []).map((x) => ({
        day: x.day,
        value: Number(x.count) || 0,
      })),
    [dashboard]
  );

  const revenueSeries = useMemo(
    () =>
      (dashboard?.charts?.revenue_daily || []).map((x) => ({
        day: x.day,
        value: Number(x.total) || 0,
      })),
    [dashboard]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-300 mt-1">Enterprise operations overview</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/orders" className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors">
            Orders
          </Link>
          <Link href="/admin/services" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors">
            Services
          </Link>
          <Link href="/admin/pricing" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors">
            Pricing
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-slate-300">
          Loading dashboard…
        </div>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total customers" value={dashboard.kpis.total_customers} />
            <KpiCard label="Total technicians" value={dashboard.kpis.total_technicians} />
            <KpiCard label="Total orders" value={dashboard.kpis.total_orders} />
            <KpiCard label="Today’s orders" value={dashboard.kpis.todays_orders} tone="sky" />
            <KpiCard label="Revenue today" value={`₹${Number(dashboard.kpis.revenue_today || 0).toFixed(0)}`} tone="emerald" />
            <KpiCard label="Total revenue" value={`₹${Number(dashboard.kpis.total_revenue || 0).toFixed(0)}`} tone="emerald" />
            <KpiCard label="Active jobs" value={dashboard.kpis.active_jobs} tone="amber" />
            <KpiCard label="Emergency bookings" value={dashboard.kpis.emergency_bookings} tone="rose" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MiniBars
              title="Orders (last 14 days)"
              series={ordersSeries}
              formatRight={(v) => String(v)}
              colorClass="bg-emerald-500/60"
            />
            <MiniBars
              title="Revenue (last 14 days)"
              series={revenueSeries}
              formatRight={(v) => `₹${v.toFixed(0)}`}
              colorClass="bg-sky-500/60"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent orders</h2>
              <Link href="/admin/orders" className="text-sm text-emerald-300 hover:text-emerald-200">
                View all →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/30">
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Order</th>
                    <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Customer</th>
                    <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Service</th>
                    <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Amount</th>
                    <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Status</th>
                    <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 sm:px-6 py-10 text-center text-slate-300">
                        No orders yet.
                      </td>
                    </tr>
                  ) : (
                    dashboard.recent_orders.map((order) => (
                      <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 sm:px-6 py-4 font-semibold text-white">#{order.id}</td>
                        <td className="px-4 sm:px-6 py-4 text-slate-200">{order.customer_name}</td>
                        <td className="px-4 sm:px-6 py-4 text-slate-200">{order.service_name?.replace(/_/g, ' ')}</td>
                        <td className="px-4 sm:px-6 py-4 font-semibold text-emerald-200">₹{order.total_amount}</td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-sky-500/10 border border-sky-500/20 text-sky-200">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-slate-400 text-xs">
                          {new Date(order.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
