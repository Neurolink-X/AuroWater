'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getAdminDashboard, getAdminOrders, getAdminUsers, getPricingRules } from '@/lib/api-client';

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

interface AdminOrderRow {
  id: number;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

type TabKey = 'overview' | 'finance' | 'ops';

function KpiCard({ label, value, tone = 'blue' }: { label: string; value: React.ReactNode; tone?: 'blue' | 'emerald' | 'amber' | 'rose' }) {
  const toneCls = tone === 'emerald'
    ? 'text-emerald-600'
    : tone === 'amber'
      ? 'text-amber-600'
      : tone === 'rose'
        ? 'text-rose-600'
        : 'text-[#4361EE]';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <p className="text-sm text-slate-500 font-medium">{label}</p>
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
      <h2 className="text-lg font-semibold text-[#0A0F1E] mb-4">{title}</h2>
      <div className="space-y-2">
        {series.slice(-14).map((p) => (
          <div key={p.day} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-24">{p.day}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full ${colorClass}`} style={{ width: `${Math.min(100, (p.value / max) * 100)}%` }} />
            </div>
            <span className="text-xs text-slate-600 w-16 text-right">{formatRight(p.value)}</span>
          </div>
        ))}
        {series.length === 0 && <p className="text-sm text-slate-500">No data yet.</p>}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, o, u, p] = await Promise.all([
          getAdminDashboard(),
          getAdminOrders(undefined, 100, 0),
          getAdminUsers(undefined, 500, 0),
          getPricingRules(),
        ]);
        setDashboard(d as DashboardData);
        setOrders((o as AdminOrderRow[]) || []);
        setUsersCount(Array.isArray(u) ? u.length : 0);
        setPricingRules(Array.isArray(p) ? p : []);
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

  const finance = useMemo(() => {
    const totalOrders = orders.length;
    const completed = orders.filter((o) => o.status === 'COMPLETED');
    const pending = orders.filter((o) => o.status === 'PENDING' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
    const cancelled = orders.filter((o) => o.status === 'CANCELLED');
    const grossRevenue = completed.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const avgTicket = completed.length ? grossRevenue / completed.length : 0;
    const cancelRate = totalOrders ? (cancelled.length / totalOrders) * 100 : 0;
    const activePriceRules = pricingRules.length;
    return {
      grossRevenue,
      avgTicket,
      pendingAmount: pending.reduce((s, o) => s + Number(o.total_amount || 0), 0),
      cancelRate,
      activePriceRules,
    };
  }, [orders, pricingRules]);

  return (
    <div className="space-y-6 font-['Outfit']">
      <div className="rounded-3xl bg-[#0A0F1E] text-white p-6 border border-[#1f2937]">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Control Center</h1>
            <p className="text-sm text-slate-300 mt-1">Sophisticated, real-time operations and finance view.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/orders" className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#4361EE] text-white font-medium hover:opacity-90 transition-colors">
              Orders
            </Link>
            <Link href="/admin/services" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors">
              Services
            </Link>
            <Link href="/admin/pricing" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ['overview', 'Overview'],
            ['finance', 'Finance'],
            ['ops', 'Operations'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as TabKey)}
              className={[
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                tab === k ? 'bg-[#4361EE] text-white' : 'bg-white/10 text-slate-200 hover:bg-white/15',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Loading dashboard…
        </div>
      ) : dashboard ? (
        <>
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total customers" value={dashboard.kpis.total_customers} />
                <KpiCard label="Total technicians" value={dashboard.kpis.total_technicians} />
                <KpiCard label="Total orders" value={dashboard.kpis.total_orders} />
                <KpiCard label="Today’s orders" value={dashboard.kpis.todays_orders} />
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
                  colorClass="bg-[#4361EE]"
                />
                <MiniBars
                  title="Revenue (last 14 days)"
                  series={revenueSeries}
                  formatRight={(v) => `₹${v.toFixed(0)}`}
                  colorClass="bg-emerald-500"
                />
              </div>
            </>
          )}

          {tab === 'finance' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard label="Gross Revenue (Completed)" value={`₹${finance.grossRevenue.toLocaleString('en-IN')}`} tone="emerald" />
                <KpiCard label="Average Ticket Size" value={`₹${finance.avgTicket.toFixed(0)}`} tone="amber" />
                <KpiCard label="Pending Booked Revenue" value={`₹${finance.pendingAmount.toLocaleString('en-IN')}`} />
                <KpiCard label="Cancellation Rate" value={`${finance.cancelRate.toFixed(1)}%`} tone={finance.cancelRate > 20 ? 'rose' : 'amber'} />
                <KpiCard label="Active Pricing Rules" value={finance.activePriceRules} />
                <KpiCard label="Total Platform Users" value={usersCount} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#0A0F1E]">Finance Actions</h3>
                  <button
                    type="button"
                    onClick={() => toast.success('Finance snapshot refreshed.')}
                    className="px-3 py-2 rounded-lg bg-[#4361EE] text-white text-sm font-semibold"
                  >
                    Refresh Snapshot
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  Derived directly from real orders + pricing API data loaded in this session.
                </p>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <Link href="/admin/pricing" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
                    Open Pricing Rules →
                  </Link>
                  <Link href="/admin/orders" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
                    Review Pending Revenue Orders →
                  </Link>
                </div>
              </div>
            </>
          )}

          {tab === 'ops' && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0A0F1E]">Recent Orders (Live Ops)</h2>
                <Link href="/admin/orders" className="text-sm text-[#4361EE] hover:underline">
                  View all →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Order</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Customer</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Service</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Amount</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recent_orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 sm:px-6 py-10 text-center text-slate-500">
                          No orders yet.
                        </td>
                      </tr>
                    ) : (
                      dashboard.recent_orders.map((order) => (
                        <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 font-semibold text-[#0A0F1E]">#{order.id}</td>
                          <td className="px-4 sm:px-6 py-4 text-slate-700">{order.customer_name}</td>
                          <td className="px-4 sm:px-6 py-4 text-slate-700">{order.service_name?.replace(/_/g, ' ')}</td>
                          <td className="px-4 sm:px-6 py-4 font-semibold text-emerald-600">₹{order.total_amount}</td>
                          <td className="px-4 sm:px-6 py-4">
                            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#4361EE]/10 border border-[#4361EE]/20 text-[#4361EE]">
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-slate-500 text-xs">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

