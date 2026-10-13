
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  getAdminDashboard,
  getAdminOrders,
  getAdminUsers,
  getPricingRules,
  adminFinance,
} from '@/lib/api-client';
import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';
import AdminAttentionQueue from '@/app/admin/components/AdminAttentionQueue';
import PaymentReconciliationCard from '@/app/admin/components/PaymentReconciliationCard';

interface KpiBlock {
  total_orders: number;
  todays_orders: number;
  total_revenue: number;
  revenue_today: number;
  active_jobs: number;
  emergency_bookings: number;
  total_customers: number;
  total_technicians: number;
  attention?: {
    unaccepted_assignments: number;
    unpaid_completed_orders: number;
    unpaid_completed_amount: number;
    active_emergencies: number;
    stale_active_orders: number;
    open_quality_cases: number;
    unaccepted_technician_offers: number;
  };
}

interface DailyPoint {
  day: string;
  count?: number;
  total?: number;
}

interface RecentOrder {
  id: number;
  customer_name: string;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface DashboardData {
  kpis: KpiBlock;
  charts: {
    orders_daily: DailyPoint[];
    revenue_daily: DailyPoint[];
  };
  recent_orders: RecentOrder[];
}

interface AdminOrderRow {
  id: number;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  service_name?: string;
}

interface FinanceSnapshot {
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
}

type TabKey = 'overview' | 'finance' | 'ops';

type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

const STATUS_OPTIONS = [
  'ALL',
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '◈' },
  { key: 'finance', label: 'Finance', icon: '₹' },
  { key: 'ops', label: 'Operations', icon: '⚙' },
];

const STATUS_CFG: Record<
  string,
  { label: string; dot: string; pill: string }
> = {
  PENDING: {
    label: 'Pending',
    dot: '#d97706',
    pill: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  ASSIGNED: {
    label: 'Assigned',
    dot: '#0284c7',
    pill: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    dot: '#7c3aed',
    pill: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  COMPLETED: {
    label: 'Completed',
    dot: '#059669',
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: '#dc2626',
    pill: 'bg-red-50 text-red-800 border-red-200',
  },
};

function inr(value: number): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `₹${Math.round(safeValue).toLocaleString('en-IN')}`;
}

function pct(value: number, digits = 1): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;
}

function relTime(iso: string): string {
  const timestamp = new Date(iso).getTime();

  if (!Number.isFinite(timestamp)) return '—';

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function statusCfg(status: string) {
  return (
    STATUS_CFG[status] ?? {
      label: status.replaceAll('_', ' '),
      dot: '#64748b',
      pill: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.pill}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
  pulse = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: string;
  accent?: boolean;
  pulse?: boolean;
}) {
  return (
    <section
      className={[
        'relative min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5',
        'transition-shadow duration-200 hover:shadow-md',
        accent
          ? 'border-sky-200 bg-sky-50'
          : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="break-words text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p>
          )}
        </div>

        <div
          className={[
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
            accent ? 'bg-sky-100' : 'bg-slate-100',
          ].join(' ')}
          aria-hidden="true"
        >
          {pulse && (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"
              title="Requires attention"
            />
          )}
          {icon}
        </div>
      </div>
    </section>
  );
}

function BarRow({
  label,
  value,
  max,
  format,
}: {
  label: string;
  value: number;
  max: number;
  format: (value: number) => string;
}) {
  const width =
    max > 0
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : 0;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs text-slate-500">
        {label}
      </span>

      <div
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label={`${label}: ${format(value)}`}
      >
        <div
          className="h-full rounded-full bg-sky-600"
          style={{ width: `${width}%` }}
        />
      </div>

      <span className="w-20 shrink-0 text-right text-xs font-medium text-slate-600 tabular-nums">
        {format(value)}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
      <div className="mt-4 h-7 w-20 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded bg-slate-50" />
    </div>
  );
}

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

function TableEmpty({ message }: { message: string }) {
  return (
    <tr>
      <td
        colSpan={6}
        className="px-5 py-12 text-center text-sm text-slate-500"
      >
        <span className="mb-2 block text-2xl" aria-hidden="true">
          📭
        </span>
        {message}
      </td>
    </tr>
  );
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [pricingRules, setPricingRules] = useState<unknown[]>([]);
  const [financeSnapshot, setFinanceSnapshot] =
    useState<FinanceSnapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const mountedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const requestSequenceRef = useRef(0);

  const fetchAll = useCallback(
    async (silent = false) => {
      if (requestInFlightRef.current) return;

      requestInFlightRef.current = true;
      const requestId = ++requestSequenceRef.current;

      if (mountedRef.current) {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError(null);
      }

      try {
        const [dashboardResult, ordersResult, usersResult, pricingResult, financeResult] =
          await Promise.all([
            getAdminDashboard(),
            getAdminOrders(undefined, 200, 0),
            getAdminUsers(undefined, 1000, 0),
            getPricingRules(),
            adminFinance('30d'),
          ]);

        if (!mountedRef.current || requestId !== requestSequenceRef.current) {
          return;
        }

        if (dashboardResult) {
          setDashboard(dashboardResult as DashboardData);
        } else {
          setDashboard(null);
        }

        setOrders(
          Array.isArray(ordersResult)
            ? (ordersResult as AdminOrderRow[])
            : [],
        );

        setUsersCount(Array.isArray(usersResult) ? usersResult.length : 0);
        setPricingRules(Array.isArray(pricingResult) ? pricingResult : []);
        setFinanceSnapshot(
          financeResult ? (financeResult as FinanceSnapshot) : null,
        );
        setLastUpdated(new Date());
      } catch (cause: unknown) {
        if (!mountedRef.current) return;

        const message =
          cause instanceof Error
            ? cause.message
            : 'Unable to load the admin dashboard. Please try again.';

        setError(message);

        if (silent) toast.error(message);
      } finally {
        requestInFlightRef.current = false;

        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    void fetchAll();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchAll(true);
      }
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchAll(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      window.clearInterval(intervalId);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [fetchAll]);

  const ordersSeries = useMemo(
    () =>
      (dashboard?.charts?.orders_daily ?? []).map((point) => ({
        day: point.day,
        value: Number(point.count) || 0,
      })),
    [dashboard],
  );

  const revenueSeries = useMemo(
    () =>
      (dashboard?.charts?.revenue_daily ?? []).map((point) => ({
        day: point.day,
        value: Number(point.total) || 0,
      })),
    [dashboard],
  );

  const maxOrders = useMemo(
    () => Math.max(1, ...ordersSeries.map((point) => point.value)),
    [ordersSeries],
  );

  const maxRevenue = useMemo(
    () => Math.max(1, ...revenueSeries.map((point) => point.value)),
    [revenueSeries],
  );

  /*
   * The order list is paginated. These metrics describe the loaded order
   * sample only, not lifetime financial totals. Use financeSnapshot or
   * dashboard KPI aggregates for authoritative financial reporting.
   */
  const finance = useMemo(() => {
    const completed = orders.filter((order) => order.status === 'COMPLETED');
    const active = orders.filter((order) =>
      ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(order.status),
    );
    const cancelled = orders.filter((order) => order.status === 'CANCELLED');

    const grossRevenue = completed.reduce(
      (sum, order) => sum + (Number(order.total_amount) || 0),
      0,
    );

    const pendingRevenue = active.reduce(
      (sum, order) => sum + (Number(order.total_amount) || 0),
      0,
    );

    return {
      grossRevenue,
      pendingRevenue,
      averageTicket: completed.length ? grossRevenue / completed.length : 0,
      cancellationRate: orders.length
        ? (cancelled.length / orders.length) * 100
        : 0,
      completionRate: orders.length
        ? (completed.length / orders.length) * 100
        : 0,
      completedCount: completed.length,
      activeCount: active.length,
      cancelledCount: cancelled.length,
      loadedOrderCount: orders.length,
      activePricingRules: pricingRules.length,
    };
  }, [orders, pricingRules]);

  const allOpsOrders = useMemo(() => {
    const query = searchQ.trim().toLocaleLowerCase('en-IN');
    const recentOrders = dashboard?.recent_orders ?? [];

    return recentOrders.filter((order) => {
      const matchesStatus =
        statusFilter === 'ALL' || order.status === statusFilter;

      const matchesSearch =
        !query ||
        String(order.id).toLocaleLowerCase('en-IN').includes(query) ||
        (order.customer_name ?? '')
          .toLocaleLowerCase('en-IN')
          .includes(query) ||
        (order.service_name ?? '')
          .toLocaleLowerCase('en-IN')
          .includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [dashboard, searchQ, statusFilter]);

  const byService = useMemo(() => {
    const serviceMap: Record<string, { count: number; revenue: number }> = {};

    for (const order of orders) {
      const serviceName = (
        order.service_name ?? 'Unknown service'
      ).replace(/_/g, ' ');

      if (!serviceMap[serviceName]) {
        serviceMap[serviceName] = { count: 0, revenue: 0 };
      }

      serviceMap[serviceName].count += 1;

      if (order.status === 'COMPLETED') {
        serviceMap[serviceName].revenue +=
          Number(order.total_amount) || 0;
      }
    }

    return Object.entries(serviceMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6);
  }, [orders]);

  const maxServiceRevenue = useMemo(
    () => Math.max(1, ...byService.map(([, value]) => value.revenue)),
    [byService],
  );

  const recentOrders = dashboard?.recent_orders ?? [];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        .aurotap-admin {
          color-scheme: light;
        }

        .aurotap-admin button,
        .aurotap-admin input,
        .aurotap-admin select {
          font: inherit;
        }

        .aurotap-admin .admin-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 38px;
          padding: 0.55rem 0.9rem;
          border: 1px solid #dbe3ed;
          border-radius: 0.7rem;
          background: #fff;
          color: #334155;
          font-size: 0.8125rem;
          font-weight: 650;
          cursor: pointer;
          transition: background-color 140ms ease, border-color 140ms ease;
        }

        .aurotap-admin .admin-button:hover {
          background: #f8fafc;
          border-color: #b8c7d9;
        }

        .aurotap-admin .admin-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .aurotap-admin .admin-button-primary {
          border-color: #0369a1;
          background: #0369a1;
          color: #fff;
        }

        .aurotap-admin .admin-button-primary:hover {
          background: #075985;
          border-color: #075985;
        }

        .aurotap-admin .admin-tab {
          min-height: 40px;
          border: 1px solid transparent;
          border-radius: 0.7rem;
          padding: 0.55rem 0.9rem;
          color: #64748b;
          font-size: 0.8125rem;
          font-weight: 650;
          transition: background-color 140ms ease, color 140ms ease;
        }

        .aurotap-admin .admin-tab[aria-selected="true"] {
          background: #e0f2fe;
          color: #075985;
          border-color: #bae6fd;
        }

        .aurotap-admin .admin-input {
          width: 100%;
          min-height: 42px;
          border: 1px solid #cbd5e1;
          border-radius: 0.7rem;
          padding: 0.6rem 0.8rem;
          background: #fff;
          color: #0f172a;
          font-size: 0.875rem;
          outline: none;
        }

        .aurotap-admin .admin-input:focus-visible {
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.13);
        }

        .aurotap-admin .admin-table-row {
          border-bottom: 1px solid #f1f5f9;
        }

        .aurotap-admin .admin-table-row:hover {
          background: #f8fafc;
        }

        .aurotap-admin .admin-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: aurotap-spin 650ms linear infinite;
        }

        @keyframes aurotap-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .aurotap-admin *,
          .aurotap-admin *::before,
          .aurotap-admin *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <div className="aurotap-admin mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-white to-sky-50 px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-xl">
                    💧
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-800">
                    AuroTap · Administration
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Admin Control Center
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor operations, review finances and manage orders.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Auto-refresh enabled
                  </span>

                  {lastUpdated && (
                    <span>
                      Last updated{' '}
                      {lastUpdated.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}

                  <button
                    type="button"
                    className="admin-button"
                    onClick={() => void fetchAll(true)}
                    disabled={refreshing}
                    aria-label="Refresh dashboard data"
                  >
                    {refreshing ? (
                      <span className="admin-spinner" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true">↻</span>
                    )}
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </div>

              <nav
                aria-label="Admin shortcuts"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:max-w-[620px] xl:flex-wrap xl:justify-end"
              >
                {[
                  { href: '/admin/orders', label: 'Orders', primary: true },
                  { href: '/admin/users', label: 'Users' },
                  { href: '/admin/services', label: 'Services' },
                  { href: '/admin/pricing', label: 'Pricing' },
                  { href: '/admin/settings', label: 'Settings' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-button ${item.primary ? 'admin-button-primary' : ''}`}
                  >
                    {item.label}
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="flex flex-wrap gap-2 p-3 sm:p-4"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                id={`admin-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                aria-controls={`admin-panel-${item.key}`}
                className="admin-tab"
                onClick={() => setTab(item.key)}
              >
                <span className="mr-1.5" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <section
            className="space-y-3"
            role="alert"
            aria-label="Dashboard loading error"
          >
            <DatabaseErrorBanner message={error} />
            <button
              type="button"
              className="admin-button"
              onClick={() => void fetchAll()}
              disabled={loading}
            >
              Retry loading dashboard
            </button>
          </section>
        )}

        {loading && !dashboard && (
          <section
            className="space-y-4"
            aria-label="Loading dashboard"
            aria-live="polite"
          >
            <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
            <SectionCard className="p-5">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
              <div className="mt-5 space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-4 animate-pulse rounded bg-slate-50"
                  />
                ))}
              </div>
            </SectionCard>
          </section>
        )}

        {!loading && !dashboard && !error && (
          <SectionCard className="px-5 py-14 text-center">
            <p className="text-3xl" aria-hidden="true">📊</p>
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              No dashboard data available
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The dashboard API returned no data. Try reloading.
            </p>
            <button
              type="button"
              className="admin-button admin-button-primary mx-auto mt-5"
              onClick={() => void fetchAll()}
            >
              Try again
            </button>
          </SectionCard>
        )}

        {!loading && dashboard && (
          <div
            id={`admin-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`admin-tab-${tab}`}
            className="space-y-5"
          >
            {dashboard.kpis.attention && (
              <AdminAttentionQueue attention={dashboard.kpis.attention} />
            )}

            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-4">
                  <StatCard
                    label="Total Customers"
                    value={Number(dashboard.kpis.total_customers || 0).toLocaleString('en-IN')}
                    icon="👥"
                    sub="Registered customers"
                  />
                  <StatCard
                    label="Technicians"
                    value={Number(dashboard.kpis.total_technicians || 0).toLocaleString('en-IN')}
                    icon="🔧"
                    sub="Technician accounts"
                  />
                  <StatCard
                    label="Total Orders"
                    value={Number(dashboard.kpis.total_orders || 0).toLocaleString('en-IN')}
                    icon="📦"
                    sub="All-time orders"
                  />
                  <StatCard
                    label="Today's Orders"
                    value={Number(dashboard.kpis.todays_orders || 0).toLocaleString('en-IN')}
                    icon="📅"
                    sub="Today's order count"
                    accent
                  />
                  <StatCard
                    label="Revenue Today"
                    value={inr(dashboard.kpis.revenue_today || 0)}
                    icon="₹"
                    sub="As reported by dashboard API"
                    accent
                  />
                  <StatCard
                    label="Total Revenue"
                    value={inr(dashboard.kpis.total_revenue || 0)}
                    icon="📈"
                    sub="As reported by dashboard API"
                    accent
                  />
                  <StatCard
                    label="Active Jobs"
                    value={Number(dashboard.kpis.active_jobs || 0).toLocaleString('en-IN')}
                    icon="⚡"
                    sub="Active work"
                    pulse={dashboard.kpis.active_jobs > 0}
                  />
                  <StatCard
                    label="Emergency Bookings"
                    value={Number(dashboard.kpis.emergency_bookings || 0).toLocaleString('en-IN')}
                    icon="🚨"
                    sub="Priority requests"
                    pulse={dashboard.kpis.emergency_bookings > 0}
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <SectionCard className="p-4 sm:p-5">
                    <SectionHeading
                      title="Orders · Last 14 Days"
                      action={
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                          {ordersSeries.slice(-14).reduce((sum, point) => sum + point.value, 0)} orders
                        </span>
                      }
                    />
                    <div className="space-y-3 pt-5">
                      {ordersSeries.slice(-14).map((point) => (
                        <BarRow
                          key={point.day}
                          label={point.day}
                          value={point.value}
                          max={maxOrders}
                          format={(value) => String(value)}
                        />
                      ))}
                      {ordersSeries.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">
                          No order chart data available.
                        </p>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard className="p-4 sm:p-5">
                    <SectionHeading
                      title="Revenue · Last 14 Days"
                      action={
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {inr(revenueSeries.slice(-14).reduce((sum, point) => sum + point.value, 0))}
                        </span>
                      }
                    />
                    <div className="space-y-3 pt-5">
                      {revenueSeries.slice(-14).map((point) => (
                        <BarRow
                          key={point.day}
                          label={point.day}
                          value={point.value}
                          max={maxRevenue}
                          format={inr}
                        />
                      ))}
                      {revenueSeries.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">
                          No revenue chart data available.
                        </p>
                      )}
                    </div>
                  </SectionCard>
                </div>

                {byService.length > 0 && (
                  <SectionCard className="p-4 sm:p-5">
                    <SectionHeading title="Revenue by Service" />
                    <div className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                      {byService.map(([service, data]) => (
                        <div
                          key={service}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold capitalize text-slate-800">
                              {service}
                            </p>
                            <span className="text-sm font-bold text-emerald-700">
                              {inr(data.revenue)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{
                                width: `${Math.min(100, (data.revenue / maxServiceRevenue) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {data.count} orders in loaded order records
                          </p>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                <SectionCard className="overflow-hidden">
                  <SectionHeading
                    title="Recent Orders"
                    action={
                      <Link
                        href="/admin/orders"
                        className="text-sm font-semibold text-sky-800 hover:text-sky-950"
                      >
                        View all orders →
                      </Link>
                    }
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          {['Order', 'Customer', 'Service', 'Amount', 'Status', 'When'].map((heading) => (
                            <th key={heading} className="px-5 py-3 font-semibold">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.length === 0 ? (
                          <TableEmpty message="No recent orders found." />
                        ) : (
                          recentOrders.slice(0, 8).map((order) => (
                            <tr key={order.id} className="admin-table-row">
                              <td className="px-5 py-4 font-semibold text-sky-800">
                                #{order.id}
                              </td>
                              <td className="px-5 py-4 font-medium text-slate-800">
                                {order.customer_name || 'Customer'}
                              </td>
                              <td className="px-5 py-4 capitalize text-slate-600">
                                {(order.service_name || 'Service').replace(/_/g, ' ')}
                              </td>
                              <td className="px-5 py-4 font-semibold text-slate-900">
                                {inr(order.total_amount)}
                              </td>
                              <td className="px-5 py-4">
                                <StatusBadge status={order.status} />
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-500">
                                <time dateTime={order.created_at} title={new Date(order.created_at).toLocaleString('en-IN')}>
                                  {relTime(order.created_at)}
                                </time>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </>
            )}

            {tab === 'finance' && (
              <>
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <strong>Financial reporting:</strong> API finance figures are displayed separately from calculations based on the currently loaded order sample. Commission and supplier payouts are not estimated by this page.
                </div>

                <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-3">
                  <StatCard
                    label="Finance API Gross Revenue"
                    value={financeSnapshot ? inr(financeSnapshot.gross_revenue) : '—'}
                    icon="📈"
                    sub="From finance API"
                    accent
                  />
                  <StatCard
                    label="Collected Revenue"
                    value={financeSnapshot ? inr(financeSnapshot.collected_revenue) : '—'}
                    icon="₹"
                    sub="From finance API"
                  />
                  <StatCard
                    label="Pending Payments"
                    value={financeSnapshot ? inr(financeSnapshot.pending_payments) : '—'}
                    icon="⏳"
                    sub="From finance API"
                  />
                  <StatCard
                    label="Loaded Completed Orders"
                    value={finance.completedCount.toLocaleString('en-IN')}
                    icon="✅"
                    sub="Current loaded order sample"
                  />
                  <StatCard
                    label="Loaded Active Orders"
                    value={finance.activeCount.toLocaleString('en-IN')}
                    icon="⚡"
                    sub="Pending, assigned and in progress"
                  />
                  <StatCard
                    label="Average Completed Order"
                    value={inr(finance.averageTicket)}
                    icon="📊"
                    sub="Current loaded order sample"
                  />
                  <StatCard
                    label="Completion Rate"
                    value={pct(finance.completionRate)}
                    icon="✓"
                    sub={`${finance.completedCount} of ${finance.loadedOrderCount} loaded orders`}
                  />
                  <StatCard
                    label="Cancellation Rate"
                    value={pct(finance.cancellationRate)}
                    icon="×"
                    sub={`${finance.cancelledCount} loaded cancelled orders`}
                  />
                  <StatCard
                    label="Pricing Rules"
                    value={finance.activePricingRules.toLocaleString('en-IN')}
                    icon="⚙"
                    sub="Rules returned by pricing API"
                  />
                </div>

                {financeSnapshot && (
                  <SectionCard className="p-4 sm:p-5">
                    <SectionHeading title="Payment Reconciliation" />
                    <div className="pt-4">
                      <PaymentReconciliationCard finance={financeSnapshot} />
                    </div>
                  </SectionCard>
                )}

                <SectionCard className="p-4 sm:p-5">
                  <SectionHeading
                    title="Finance Actions"
                    action={
                      <button
                        type="button"
                        className="admin-button admin-button-primary"
                        onClick={() => {
                          void fetchAll(true);
                        }}
                        disabled={refreshing}
                      >
                        {refreshing ? 'Refreshing…' : '↻ Refresh snapshot'}
                      </button>
                    }
                  />
                  <p className="pt-4 text-sm text-slate-500">
                    Open the relevant management page to review the underlying records and configuration.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { href: '/admin/pricing', label: 'Manage Pricing Rules' },
                      { href: '/admin/orders', label: 'Review Orders' },
                      { href: '/admin/settings', label: 'Commission Settings' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-900"
                      >
                        {item.label} <span aria-hidden="true">→</span>
                      </Link>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {tab === 'ops' && (
              <>
                <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-4">
                  <StatCard
                    label="Active Jobs"
                    value={Number(dashboard.kpis.active_jobs || 0).toLocaleString('en-IN')}
                    icon="⚡"
                    sub="Currently active"
                    pulse={dashboard.kpis.active_jobs > 0}
                  />
                  <StatCard
                    label="Today's Orders"
                    value={Number(dashboard.kpis.todays_orders || 0).toLocaleString('en-IN')}
                    icon="📅"
                    sub="Today"
                    accent
                  />
                  <StatCard
                    label="Emergencies"
                    value={Number(dashboard.kpis.emergency_bookings || 0).toLocaleString('en-IN')}
                    icon="🚨"
                    sub="Priority requests"
                    pulse={dashboard.kpis.emergency_bookings > 0}
                  />
                  <StatCard
                    label="Technicians"
                    value={Number(dashboard.kpis.total_technicians || 0).toLocaleString('en-IN')}
                    icon="🔧"
                    sub="Technician accounts"
                  />
                </div>

                <SectionCard className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="min-w-0 flex-1">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Search recent orders
                      </span>
                      <input
                        type="search"
                        className="admin-input"
                        placeholder="Order ID, customer or service"
                        value={searchQ}
                        onChange={(event) => setSearchQ(event.target.value)}
                      />
                    </label>

                    <label className="sm:w-56">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Filter by status
                      </span>
                      <select
                        className="admin-input"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status === 'ALL' ? 'All statuses' : status.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </label>

                    {(searchQ || statusFilter !== 'ALL') && (
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="admin-button"
                          onClick={() => {
                            setSearchQ('');
                            setStatusFilter('ALL');
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard className="overflow-hidden">
                  <SectionHeading
                    title="Recent Order Feed"
                    action={
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {allOpsOrders.length} matching
                        </span>
                        <Link
                          href="/admin/orders"
                          className="text-sm font-semibold text-sky-800 hover:text-sky-950"
                        >
                          Manage all →
                        </Link>
                      </div>
                    }
                  />

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          {['Order', 'Customer', 'Service', 'Amount', 'Status', 'Created'].map((heading) => (
                            <th key={heading} className="px-5 py-3 font-semibold">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allOpsOrders.length === 0 ? (
                          <TableEmpty
                            message={
                              searchQ || statusFilter !== 'ALL'
                                ? 'No recent orders match these filters.'
                                : 'No recent orders found.'
                            }
                          />
                        ) : (
                          allOpsOrders.map((order) => (
                            <tr key={order.id} className="admin-table-row">
                              <td className="px-5 py-4 font-semibold text-sky-800">
                                #{order.id}
                              </td>
                              <td className="max-w-[200px] truncate px-5 py-4 font-medium text-slate-800">
                                {order.customer_name || 'Customer'}
                              </td>
                              <td className="px-5 py-4 capitalize text-slate-600">
                                {(order.service_name || 'Service').replace(/_/g, ' ')}
                              </td>
                              <td className="px-5 py-4 font-semibold text-slate-900">
                                {inr(order.total_amount)}
                              </td>
                              <td className="px-5 py-4">
                                <StatusBadge status={order.status} />
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-500">
                                <time dateTime={order.created_at} title={new Date(order.created_at).toLocaleString('en-IN')}>
                                  {relTime(order.created_at)}
                                </time>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                    Showing {allOpsOrders.length} of {recentOrders.length} recent orders returned by the dashboard API.
                  </div>
                </SectionCard>

                <SectionCard className="p-4 sm:p-5">
                  <SectionHeading title="Order Status Distribution" />
                  <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-5">
                    {(
                      [
                        'PENDING',
                        'ASSIGNED',
                        'IN_PROGRESS',
                        'COMPLETED',
                        'CANCELLED',
                      ] as OrderStatus[]
                    ).map((status) => {
                      const count = orders.filter(
                        (order) => order.status === status,
                      ).length;
                      const width = orders.length
                        ? (count / orders.length) * 100
                        : 0;
                      const config = statusCfg(status);

                      return (
                        <div
                          key={status}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: config.dot }}
                            />
                            <p className="text-xs font-semibold text-slate-600">
                              {config.label}
                            </p>
                          </div>
                          <p className="mt-3 text-2xl font-bold text-slate-950 tabular-nums">
                            {count.toLocaleString('en-IN')}
                          </p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, width)}%`,
                                backgroundColor: config.dot,
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {pct(width, 0)} of loaded orders
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    Status distribution uses the orders loaded by this dashboard, not the complete database unless the API returns all orders.
                  </p>
                </SectionCard>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}









// 'use client';

// /**
//  * AuroWater — Admin Control Center
//  * File: src/app/admin/dashboard/page.tsx
//  *
//  * Design: Deep ocean command center — dark navy base, electric cyan accents,
//  * frosted-glass cards, animated water-flow backgrounds, Syne + DM Sans fonts.
//  * Dashboard metrics are derived from API responses. Financial payout splits are not estimateds.
//  */

// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { toast } from 'sonner';
// import {
//   getAdminDashboard,
//   getAdminOrders,
//   getAdminUsers,
//   getPricingRules,
//   adminFinance,
// } from '@/lib/api-client';
// import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';
// import AdminAttentionQueue from '@/app/admin/components/AdminAttentionQueue';
// import PaymentReconciliationCard from '@/app/admin/components/PaymentReconciliationCard';

// /* ═══════════════════════════════════════════════════════════════
//    TYPES
// ═══════════════════════════════════════════════════════════════ */

// interface KpiBlock {
//   total_orders: number;
//   todays_orders: number;
//   total_revenue: number;
//   revenue_today: number;
//   active_jobs: number;
//   emergency_bookings: number;
//   total_customers: number;
//   total_technicians: number;
//   attention?: {
//     unaccepted_assignments: number;
//     unpaid_completed_orders: number;
//     unpaid_completed_amount: number;
//     active_emergencies: number;
//     stale_active_orders: number;
//     open_quality_cases: number;
//     unaccepted_technician_offers: number;
//   };
// }

// interface DailyPoint {
//   day: string;
//   count?: number;
//   total?: number;
// }

// interface RecentOrder {
//   id: number;
//   customer_name: string;
//   service_name: string;
//   total_amount: number;
//   status: string;
//   created_at: string;
// }

// interface DashboardData {
//   kpis: KpiBlock;

//   charts: {
//     orders_daily: DailyPoint[];
//     revenue_daily: DailyPoint[];
//   };
//   recent_orders: RecentOrder[];
// }

// interface AdminOrderRow {
//   id: number;
//   customer_name: string;
//   total_amount: number;
//   status: string;
//   created_at: string;
// }

// type TabKey = 'overview' | 'finance' | 'ops';

// type OrderStatus =
//   | 'PENDING'
//   | 'ASSIGNED'
//   | 'IN_PROGRESS'
//   | 'COMPLETED'
//   | 'CANCELLED';

// /* ═══════════════════════════════════════════════════════════════
//    HELPERS
// ═══════════════════════════════════════════════════════════════ */

// function inr(n: number): string {
//   return '₹' + Math.round(n).toLocaleString('en-IN');
// }

// function pct(n: number, digits = 1): string {
//   return n.toFixed(digits) + '%';
// }

// function relTime(iso: string): string {
//   const diff = Date.now() - new Date(iso).getTime();
//   const m = Math.floor(diff / 60_000);
//   if (m < 1)  return 'Just now';
//   if (m < 60) return `${m}m ago`;
//   const h = Math.floor(m / 60);
//   if (h < 24) return `${h}h ago`;
//   return `${Math.floor(h / 24)}d ago`;
// }

// const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
//   PENDING:     { label: 'Pending',     dot: '#f59e0b', pill: 'bg-amber-500/10 text-amber-400 border-amber-500/25' },
//   ASSIGNED:    { label: 'Assigned',    dot: '#38bdf8', pill: 'bg-sky-500/10 text-sky-400 border-sky-500/25' },
//   IN_PROGRESS: { label: 'In Progress', dot: '#818cf8', pill: 'bg-violet-500/10 text-violet-400 border-violet-500/25' },
//   COMPLETED:   { label: 'Completed',   dot: '#34d399', pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' },
//   CANCELLED:   { label: 'Cancelled',   dot: '#f87171', pill: 'bg-red-500/10 text-red-400 border-red-500/25' },
// };

// function statusCfg(s: string) {
//   return STATUS_CFG[s] ?? { label: s, dot: '#94a3b8', pill: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
// }

// /* ═══════════════════════════════════════════════════════════════
//    SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════ */

// /** Animated counter — counts up from 0 to target on mount */
// function AnimCount({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
//   const [v, setV] = useState(0);
//   const raf = useRef<number>(0);
//   useEffect(() => {
//     const t0 = performance.now(), dur = 900;
//     const tick = (now: number) => {
//       const t = Math.min(1, (now - t0) / dur);
//       setV(Math.round(to * (1 - Math.pow(1 - t, 3))));
//       if (t < 1) raf.current = requestAnimationFrame(tick);
//     };
//     setV(0);
//     raf.current = requestAnimationFrame(tick);
//     return () => cancelAnimationFrame(raf.current);
//   }, [to]);
//   return <>{prefix}{v.toLocaleString('en-IN')}{suffix}</>;
// }

// /** KPI metric card */
// function StatCard({
//   label,
//   value,
//   sub,
//   icon,
//   accent = false,
//   pulse = false,
// }: {
//   label: string;
//   value: React.ReactNode;
//   sub?: string;
//   icon: string;
//   accent?: boolean;
//   pulse?: boolean;
// }) {
//   return (
//     <div
//       className={[
//         'relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
//         accent
//           ? 'bg-gradient-to-br from-[#0B2D4E] to-[#0d3f6e] border-[#0ea5e9]/30'
//           : 'bg-[#0d1b2a] border-white/8',
//       ].join(' ')}
//     >
//       {/* Background glow */}
//       {accent && (
//         <div
//           className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 blur-2xl"
//           style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}
//         />
//       )}

//       <div className="relative flex items-start justify-between gap-3">
//         <div className="flex-1 min-w-0">
//           <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
//           <p className={['text-2xl font-black tabular-nums', accent ? 'text-cyan-300' : 'text-white'].join(' ')}>
//             {value}
//           </p>
//           {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
//         </div>
//         <div
//           className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 relative"
//           style={{ background: 'rgba(255,255,255,0.06)' }}
//         >
//           {pulse && (
//             <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-[#0d1b2a]" />
//           )}
//           {icon}
//         </div>
//       </div>
//     </div>
//   );
// }

// /** Horizontal bar chart row */
// function BarRow({ label, value, max, format }: { label: string; value: number; max: number; format: (v: number) => string }) {
//   const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
//   return (
//     <div className="flex items-center gap-3 group">
//       <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{label}</span>
//       <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
//         <div
//           className="h-full rounded-full transition-all duration-700"
//           style={{
//             width: `${w}%`,
//             background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
//           }}
//         />
//       </div>
//       <span className="text-xs text-slate-400 w-16 text-right shrink-0 tabular-nums">{format(value)}</span>
//     </div>
//   );
// }

// /** Status pill badge */
// function StatusBadge({ status }: { status: string }) {
//   const cfg = statusCfg(status);
//   return (
//     <span className={['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide', cfg.pill].join(' ')}>
//       <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
//       {cfg.label}
//     </span>
//   );
// }

// /** Skeleton loader row */
// function SkeletonRow() {
//   return (
//     <div className="flex items-center gap-4 p-4 border-b border-white/5 animate-pulse">
//       <div className="h-3 w-12 rounded bg-white/8" />
//       <div className="h-3 flex-1 rounded bg-white/8" />
//       <div className="h-3 w-20 rounded bg-white/8" />
//       <div className="h-3 w-16 rounded bg-white/8" />
//     </div>
//   );
// }

// /** Animated water wave background (pure CSS/SVG) */
// function WaterBg() {
//   return (
//     <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
//       <svg
//         className="absolute bottom-0 left-0 w-full opacity-[0.04]"
//         viewBox="0 0 1440 200"
//         preserveAspectRatio="none"
//         style={{ height: '30vh' }}
//       >
//         <path fill="#0ea5e9" d="M0,80L48,85.3C96,91,192,101,288,96C384,91,480,69,576,64C672,59,768,69,864,80C960,91,1056,101,1152,96C1248,91,1344,69,1392,59L1440,48L1440,200L0,200Z">
//           <animate
//             attributeName="d"
//             dur="10s"
//             repeatCount="indefinite"
//             values="M0,80L48,85.3C96,91,192,101,288,96C384,91,480,69,576,64C672,59,768,69,864,80C960,91,1056,101,1152,96C1248,91,1344,69,1392,59L1440,48L1440,200L0,200Z;
//                     M0,96L48,90.7C96,85,192,75,288,80C384,85,480,107,576,112C672,117,768,107,864,96C960,85,1056,75,1152,80C1248,85,1344,107,1392,117L1440,128L1440,200L0,200Z;
//                     M0,80L48,85.3C96,91,192,101,288,96C384,91,480,69,576,64C672,59,768,69,864,80C960,91,1056,101,1152,96C1248,91,1344,69,1392,59L1440,48L1440,200L0,200Z"
//           />
//         </path>
//       </svg>
//       {/* Mesh gradient overlay */}
//       <div
//         className="absolute inset-0"
//         style={{
//           backgroundImage:
//             'radial-gradient(ellipse 60% 40% at 20% 20%, rgba(14,165,233,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(6,182,212,0.05) 0%, transparent 70%)',
//         }}
//       />
//     </div>
//   );
// }

// /* ═══════════════════════════════════════════════════════════════
//    MAIN PAGE
// ═══════════════════════════════════════════════════════════════ */

// export default function AdminDashboardPage() {
//   const [tab, setTab]           = useState<TabKey>('overview');
//   const [dashboard, setDashboard] = useState<DashboardData | null>(null);
//   const [orders, setOrders]     = useState<AdminOrderRow[]>([]);
//   const [usersCount, setUsersCount] = useState(0);
//   const [pricingRules, setPricingRules] = useState<unknown[]>([]);
//   const [financeSnapshot, setFinanceSnapshot] = useState<{
//     order_count: number;
//     gross_revenue: number;
//     collected_revenue: number;
//     pending_payments: number;
//   } | null>(null);
//   const [loading, setLoading]   = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError]       = useState<string | null>(null);
//   const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
//   const [clock, setClock]       = useState('');
//   const [searchQ, setSearchQ]   = useState('');
//   const [statusFilter, setStatusFilter] = useState<string>('ALL');

//   /* ── real-time clock ── */
//   useEffect(() => {
//     const tick = () =>
//       setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
//     tick();
//     const id = setInterval(tick, 1000);
//     return () => clearInterval(id);
//   }, []);

//   /* ── data fetch ── */
//   const fetchAll = useCallback(async (silent = false) => {
//     if (!silent) setLoading(true);
//     else setRefreshing(true);
//     setError(null);
//     try {
//       const [d, o, u, p, f] = await Promise.all([
//         getAdminDashboard(),
//         getAdminOrders(undefined, 200, 0),
//         getAdminUsers(undefined, 1000, 0),
//         getPricingRules(),
//         adminFinance('30d'),
//       ]);
//       setDashboard(d as DashboardData);
//       setOrders((o as AdminOrderRow[]) || []);
//       setUsersCount(Array.isArray(u) ? u.length : 0);
//       setPricingRules(Array.isArray(p) ? p : []);
//       setFinanceSnapshot(f);
//       setLastUpdated(new Date());
//     } catch (e: unknown) {
//       const msg = e instanceof Error ? e.message : 'Failed to load dashboard';
//       setError(msg);
//       if (silent) toast.error(msg);
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, []);

//   useEffect(() => { fetchAll(); }, [fetchAll]);

//   /* ── auto-refresh every 60s ── */
//   useEffect(() => {
//     const id = setInterval(() => fetchAll(true), 60_000);
//     return () => clearInterval(id);
//   }, [fetchAll]);

//   /* ── chart series ── */
//   const ordersSeries = useMemo(
//     () => (dashboard?.charts?.orders_daily ?? []).map(x => ({ day: x.day, value: Number(x.count) || 0 })),
//     [dashboard],
//   );
//   const revenueSeries = useMemo(
//     () => (dashboard?.charts?.revenue_daily ?? []).map(x => ({ day: x.day, value: Number(x.total) || 0 })),
//     [dashboard],
//   );
//   const maxOrders  = useMemo(() => Math.max(1, ...ordersSeries.map(s => s.value)), [ordersSeries]);
//   const maxRevenue = useMemo(() => Math.max(1, ...revenueSeries.map(s => s.value)), [revenueSeries]);

//   /* ── finance metrics (derived from real orders) ── */
//   const finance = useMemo(() => {
//     const completed  = orders.filter(o => o.status === 'COMPLETED');
//     const active     = orders.filter(o => ['PENDING','ASSIGNED','IN_PROGRESS'].includes(o.status));
//     const cancelled  = orders.filter(o => o.status === 'CANCELLED');
//     const grossRev   = completed.reduce((s, o) => s + Number(o.total_amount || 0), 0);
//     const pendingRev = active.reduce((s, o) => s + Number(o.total_amount || 0), 0);
//     const avgTicket  = completed.length ? grossRev / completed.length : 0;
//     const cancelRate = orders.length ? (cancelled.length / orders.length) * 100 : 0;
//     const compRate   = orders.length ? (completed.length / orders.length) * 100 : 0;

//     return {
//       grossRev,
//       pendingRev,
//       avgTicket,
//       cancelRate,
//       compRate,
//       completedCount: completed.length,
//       activeCount: active.length,
//       cancelledCount: cancelled.length,
//       activePricingRules: pricingRules.length,
//     };
//   }, [orders, pricingRules]);

//   /* ── ops table filter ── */
//   const allOpsOrders = useMemo(() => {
//     const src = dashboard?.recent_orders ?? [];
//     return src.filter(o => {
//       const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
//       const q = searchQ.toLowerCase();
//       const matchSearch =
//         !q ||
//         String(o.id).includes(q) ||
//         o.customer_name.toLowerCase().includes(q) ||
//         o.service_name.toLowerCase().includes(q);
//       return matchStatus && matchSearch;
//     });
//   }, [dashboard, statusFilter, searchQ]);

//   /* ── by-service breakdown ── */
//   const byService = useMemo(() => {
//     const map: Record<string, { count: number; rev: number }> = {};
//     for (const o of orders) {
//       const key = (o as RecentOrder & { service_name?: string }).service_name?.replace(/_/g, ' ') ?? 'Unknown';
//       if (!map[key]) map[key] = { count: 0, rev: 0 };
//       map[key].count++;
//       if (o.status === 'COMPLETED') map[key].rev += Number(o.total_amount || 0);
//     }
//     return Object.entries(map)
//       .sort((a, b) => b[1].rev - a[1].rev)
//       .slice(0, 6);
//   }, [orders]);
//   const maxSvcRev = useMemo(() => Math.max(1, ...byService.map(([, v]) => v.rev)), [byService]);

//   const TABS: { key: TabKey; label: string; icon: string }[] = [
//     { key: 'overview', label: 'Overview',    icon: '◈' },
//     { key: 'finance',  label: 'Finance',     icon: '₹' },
//     { key: 'ops',      label: 'Operations',  icon: '⚙' },
//   ];

//   const STATUS_OPTIONS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

//   /* ═══════════════════════════════════════════════════════════════
//      RENDER
//   ═══════════════════════════════════════════════════════════════ */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

//         .adm-root  { font-family:'DM Sans',system-ui,sans-serif; }
//         .adm-disp  { font-family:'Syne',sans-serif; }

//         ::-webkit-scrollbar        { width:4px; height:4px; }
//         ::-webkit-scrollbar-track  { background:transparent; }
//         ::-webkit-scrollbar-thumb  { background:rgba(255,255,255,0.12); border-radius:4px; }

//         .glass     { background:rgba(255,255,255,0.04); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.08); }
//         .glass-md  { background:rgba(255,255,255,0.06); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); }

//         .adm-inp   { background:rgba(255,255,255,0.06); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px;
//                      padding:9px 14px; color:#e2e8f0; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500;
//                      outline:none; transition:.2s; width:100%; }
//         .adm-inp:focus { border-color:#0ea5e9; background:rgba(14,165,233,0.08); box-shadow:0 0 0 3px rgba(14,165,233,0.12); }
//         .adm-inp::placeholder { color:rgba(255,255,255,0.28); }
//         .adm-inp option { background:#0d1b2a; }

//         .adm-btn   { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:none; cursor:pointer;
//                      border-radius:10px; font-family:'DM Sans',sans-serif; font-weight:700; transition:all .15s; }
//         .adm-btn-p { background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; padding:9px 18px; font-size:13px;
//                      box-shadow:0 4px 14px rgba(2,132,199,0.3); }
//         .adm-btn-p:hover { filter:brightness(1.08); box-shadow:0 6px 20px rgba(2,132,199,0.4); transform:translateY(-1px); }
//         .adm-btn-g { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.8); padding:9px 16px; font-size:13px;
//                      border:1.5px solid rgba(255,255,255,0.12); }
//         .adm-btn-g:hover { background:rgba(255,255,255,0.14); color:#fff; }
//         .adm-btn-sm { padding:6px 14px; font-size:12px; }

//         .adm-tab   { padding:8px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;
//                      border:none; font-family:'DM Sans',sans-serif; transition:all .2s; }
//         .adm-tab-on  { background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; box-shadow:0 4px 14px rgba(2,132,199,0.35); }
//         .adm-tab-off { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.55); }
//         .adm-tab-off:hover { background:rgba(255,255,255,0.12); color:#fff; }

//         .tbl-row   { border-bottom:1px solid rgba(255,255,255,0.05); transition:background .15s; cursor:pointer; }
//         .tbl-row:hover { background:rgba(255,255,255,0.04); }

//         @keyframes fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
//         @keyframes spin     { to{transform:rotate(360deg)} }

//         .fade-up   { animation:fadeUp .25s ease both; }
//         .shimmer   { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);
//                      background-size:200% 100%; animation:shimmer 1.8s infinite; border-radius:8px; }
//         .spin      { animation:spin .7s linear infinite; }

//         .stagger-1 { animation-delay:.05s; }
//         .stagger-2 { animation-delay:.1s; }
//         .stagger-3 { animation-delay:.15s; }
//         .stagger-4 { animation-delay:.2s; }
//         .stagger-5 { animation-delay:.25s; }
//         .stagger-6 { animation-delay:.3s; }
//         .stagger-7 { animation-delay:.35s; }
//         .stagger-8 { animation-delay:.4s; }
//         /* Mobile admin layout */
// @media (max-width: 639px) {
//   .adm-root {
//     width: 100%;
//     overflow-x: hidden;
//   }

//   .adm-root .adm-btn {
//     min-height: 40px;
//   }

//   .adm-root .adm-tab {
//     flex: 1;
//     min-width: 0;
//     padding: 9px 8px;
//     font-size: 12px;
//   }

//   .adm-root .adm-tab span {
//     display: none;
//   }

//   .adm-root table {
//     min-width: 680px;
//   }
// }
//       `}</style>

//       <WaterBg />

//       <div className="adm-root relative z-10 min-h-screen pb-12" style={{ background: 'linear-gradient(160deg,#050d1a 0%,#0a1628 50%,#061220 100%)' }}>
//        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

//           {/* ─── HEADER ──────────────────────────────────────────────── */}
//           <div
//             className="rounded-2xl p-6 relative overflow-hidden"
//             style={{ background: 'linear-gradient(135deg,#0c2340 0%,#0e3060 60%,#0c4a6e 100%)', border: '1px solid rgba(14,165,233,0.2)' }}
//           >
//             {/* decorative glow */}
//             <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-15"
//               style={{ background: 'radial-gradient(circle,#0ea5e9 0%,transparent 70%)' }} />
//             <div className="absolute right-0 bottom-0 text-[10rem] opacity-[0.04] leading-none select-none pointer-events-none">🌊</div>

//             <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
//               <div>
//                 <div className="flex items-center gap-3 mb-2">
//                   <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
//                     style={{ background: 'linear-gradient(135deg,#0284c7,#0ea5e9)' }}>💧</div>
//                   <span className="adm-disp text-sky-400 text-xs font-semibold uppercase tracking-widest">AuroWater</span>
//                 </div>
//                 <h1 className="adm-disp text-3xl font-extrabold text-white leading-tight">Admin Control Center</h1>
//                 <p className="text-sky-300/70 text-sm mt-1">Real-time operations, finance & analytics</p>

//                 {/* Live status bar */}
//                 <div className="flex items-center gap-4 mt-4 flex-wrap">
//                   <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
//                     <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
//                     Live
//                   </div>
//                   <span className="font-mono text-xs text-sky-300/60 tabular-nums">{clock}</span>
//                   {lastUpdated && (
//                     <span className="text-xs text-sky-400/60">
//                       Updated {relTime(lastUpdated.toISOString())}
//                     </span>
//                   )}
//                   <button
//                     type="button"
//                     onClick={() => fetchAll(true)}
//                     className="adm-btn adm-btn-sm"
//                     style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8' }}
//                   >
//                     <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 ${refreshing ? 'spin' : ''}`}>
//                       <path fillRule="evenodd" d="M3 8a5 5 0 0110 0 1 1 0 102 0A7 7 0 001 8a1 1 0 002 0zM8 3a1 1 0 01.707 1.707L7 6.414V3.586L8.293 4.88A1 1 0 018 3z" clipRule="evenodd"/>
//                     </svg>
//                     Refresh
//                   </button>
//                 </div>
//               </div>

//               {/* Quick nav links */}
//              <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:flex lg:flex-wrap lg:gap-2 shrink-0">
//                 {[
//                   { href: '/admin/orders',     label: 'Orders',    primary: true },
//                   { href: '/admin/users',      label: 'Users',     primary: false },
//                   { href: '/admin/services',   label: 'Services',  primary: false },
//                   { href: '/admin/pricing',    label: 'Pricing',   primary: false },
//                   { href: '/admin/settings',   label: 'Settings',  primary: false },
//                 ].map(l => (
//                   <Link key={l.href} href={l.href}
//                     className={['adm-btn adm-btn-sm', l.primary ? 'adm-btn-p' : 'adm-btn-g'].join(' ')}>
//                     {l.label}
//                   </Link>
//                 ))}
//               </div>
//             </div>

//             {/* Tab bar */}
//             <div className="relative flex gap-2 mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
//               {TABS.map(t => (
//                 <button key={t.key} type="button" onClick={() => setTab(t.key)}
//                   className={['adm-tab', tab === t.key ? 'adm-tab-on' : 'adm-tab-off'].join(' ')}>
//                   <span className="mr-1.5">{t.icon}</span>{t.label}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* ─── ERROR ─────────────────────────────────────────────── */}
//           {error && (
//             <div className="space-y-3">
//               <DatabaseErrorBanner message={error} />
//               <button
//                 type="button"
//                 onClick={() => fetchAll()}
//                 className="adm-btn adm-btn-sm"
//                 style={{
//                   background: 'rgba(245,158,11,0.15)',
//                   color: '#fcd34d',
//                   border: '1px solid rgba(245,158,11,0.35)',
//                 }}
//               >
//                 Retry
//               </button>
//             </div>
//           )}

//           {/* ─── LOADING SKELETONS ──────────────────────────────────── */}
//           {loading && (
//             <div className="space-y-5">
//               <div className="grid grid-cols-1 min-[390px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
//                 {Array.from({ length: 8 }).map((_, i) => (
//                   <div key={i} className="rounded-2xl p-5 h-28" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
//                     <div className="shimmer h-3 w-20 mb-3" />
//                     <div className="shimmer h-7 w-16" />
//                   </div>
//                 ))}
//               </div>
//               <div className="glass rounded-2xl p-5">
//                 {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
//               </div>
//             </div>
//           )}

//           {/* ─── DASHBOARD CONTENT ──────────────────────────────────── */}
//           {!loading && dashboard && (
//             <div className="fade-up space-y-5">

//               {/* ─── ATTENTION REQUIRED ───────────────────────────────── */}
//               {dashboard.kpis.attention && (
//                 <AdminAttentionQueue attention={dashboard.kpis.attention} />
//               )}

//           {/* ══════════ OVERVIEW ══════════ */}
//               {tab === 'overview' && (
//                 <>
//                   {/* 8 KPI cards */}
//                   <div className="grid grid-cols-1 min-[390px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
//                     {[
//                       { label: 'Total Customers',    value: <AnimCount to={dashboard.kpis.total_customers} />,    icon: '👥', sub: 'Registered users',    delay: 'stagger-1' },
//                       { label: 'Technicians',        value: <AnimCount to={dashboard.kpis.total_technicians} />,  icon: '🔧', sub: 'Active workforce',    delay: 'stagger-2' },
//                       { label: 'Total Orders',       value: <AnimCount to={dashboard.kpis.total_orders} />,       icon: '📦', sub: 'All time',            delay: 'stagger-3' },
//                       { label: "Today's Orders",     value: <AnimCount to={dashboard.kpis.todays_orders} />,      icon: '📅', sub: 'Since midnight',      delay: 'stagger-4', accent: true },
//                       { label: 'Revenue Today',      value: <span>₹<AnimCount to={Number(dashboard.kpis.revenue_today || 0)} /></span>, icon: '💰', sub: 'Completed orders', delay: 'stagger-5', accent: true },
//                       { label: 'Total Revenue',      value: <span>₹<AnimCount to={Number(dashboard.kpis.total_revenue || 0)} /></span>, icon: '📈', sub: 'All time gross',   delay: 'stagger-6', accent: true },
//                       { label: 'Active Jobs',        value: <AnimCount to={dashboard.kpis.active_jobs} />,        icon: '⚡', sub: 'In progress now',     delay: 'stagger-7', pulse: dashboard.kpis.active_jobs > 0 },
//                       { label: 'Emergency Bookings', value: <AnimCount to={dashboard.kpis.emergency_bookings} />, icon: '🚨', sub: 'Priority requests',   delay: 'stagger-8', pulse: dashboard.kpis.emergency_bookings > 0 },
//                     ].map((c, i) => (
//                       <div key={i} className={`fade-up ${c.delay}`}>
//                         <StatCard
//                           label={c.label}
//                           value={c.value}
//                           icon={c.icon}
//                           sub={c.sub}
//                           accent={c.accent}
//                           pulse={c.pulse}
//                         />
//                       </div>
//                     ))}
//                   </div>

//                   {/* Bar charts */}
//                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//                     {/* Orders chart */}
//                     <div className="glass rounded-2xl p-6">
//                       <div className="flex items-center justify-between mb-5">
//                         <h2 className="adm-disp text-white font-bold text-base">Orders — Last 14 Days</h2>
//                         <span className="text-xs font-semibold text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2.5 py-1 rounded-full">
//                           {ordersSeries.slice(-14).reduce((s, x) => s + x.value, 0)} total
//                         </span>
//                       </div>
//                       <div className="space-y-2.5">
//                         {ordersSeries.slice(-14).map(p => (
//                           <BarRow key={p.day} label={p.day} value={p.value} max={maxOrders} format={v => String(v)} />
//                         ))}
//                         {ordersSeries.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No data yet.</p>}
//                       </div>
//                     </div>

//                     {/* Revenue chart */}
//                     <div className="glass rounded-2xl p-6">
//                       <div className="flex items-center justify-between mb-5">
//                         <h2 className="adm-disp text-white font-bold text-base">Revenue — Last 14 Days</h2>
//                         <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
//                           {inr(revenueSeries.slice(-14).reduce((s, x) => s + x.value, 0))}
//                         </span>
//                       </div>
//                       <div className="space-y-2.5">
//                         {revenueSeries.slice(-14).map(p => (
//                           <div key={p.day} className="flex items-center gap-3 group">
//                             <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{p.day}</span>
//                             <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
//                               <div className="h-full rounded-full transition-all duration-700"
//                                 style={{ width: `${maxRevenue > 0 ? Math.min(100, (p.value / maxRevenue) * 100) : 0}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
//                             </div>
//                             <span className="text-xs text-slate-400 w-20 text-right shrink-0 tabular-nums">{inr(p.value)}</span>
//                           </div>
//                         ))}
//                         {revenueSeries.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No data yet.</p>}
//                       </div>
//                     </div>
//                   </div>

//                   {/* By-service breakdown */}
//                   {byService.length > 0 && (
//                     <div className="glass rounded-2xl p-6">
//                       <h2 className="adm-disp text-white font-bold text-base mb-5">Revenue by Service</h2>
//                       <div className="grid sm:grid-cols-2 gap-3">
//                         {byService.map(([svc, data]) => (
//                           <div key={svc} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
//                             <div className="flex justify-between items-start mb-2">
//                               <p className="text-sm font-semibold text-white capitalize">{svc}</p>
//                               <span className="text-xs text-emerald-400 font-bold">{inr(data.rev)}</span>
//                             </div>
//                             <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
//                               <div className="h-full rounded-full transition-all duration-700"
//                                 style={{ width: `${(data.rev / maxSvcRev) * 100}%`, background: 'linear-gradient(90deg,#0ea5e9,#34d399)' }} />
//                             </div>
//                             <p className="text-[10px] text-slate-500 mt-1.5">{data.count} orders</p>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   )}

//                   {/* Recent orders quick view */}
//                   <div className="glass rounded-2xl overflow-hidden">
//                     <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
//                       <h2 className="adm-disp text-white font-bold text-base">Recent Orders</h2>
//                       <Link href="/admin/orders" className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
//                         View all →
//                       </Link>
//                     </div>
//                     <div className="overflow-x-auto">
//                       <table className="min-w-full text-sm">
//                         <thead>
//                           <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
//                             {['Order', 'Customer', 'Service', 'Amount', 'Status', 'When'].map(h => (
//                               <th key={h} className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {dashboard.recent_orders.length === 0 ? (
//                             <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">No orders yet.</td></tr>
//                           ) : dashboard.recent_orders.slice(0, 8).map(o => (
//                             <tr key={o.id} className="tbl-row">
//                               <td className="px-6 py-3.5 font-bold text-sky-400">#{o.id}</td>
//                               <td className="px-6 py-3.5 text-slate-300 font-medium">{o.customer_name}</td>
//                               <td className="px-6 py-3.5 text-slate-400 capitalize">{o.service_name?.replace(/_/g, ' ')}</td>
//                               <td className="px-6 py-3.5 font-bold text-emerald-400">{inr(o.total_amount)}</td>
//                               <td className="px-6 py-3.5"><StatusBadge status={o.status} /></td>
//                               <td className="px-6 py-3.5 text-slate-500 text-xs">{relTime(o.created_at)}</td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     </div>
//                   </div>
//                 </>
//               )}

//               {/* ══════════ FINANCE ══════════ */}
//               {tab === 'finance' && (
//                 <>
//                   {/* Finance KPIs */}
//                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
//                     {[
//                       { label: 'Gross Revenue',       value: inr(finance.grossRev),              icon: '📈', accent: true,  sub: `${finance.completedCount} completed orders` },
//                       { label: 'Pending Revenue',     value: inr(finance.pendingRev),            icon: '⏳', sub: `${finance.activeCount} active orders`, pulse: finance.activeCount > 0 },
//                       { label: 'Avg. Order Value',     value: inr(finance.avgTicket),             icon: '📊', sub: 'Per completed order' },
//                       { label: 'Completion Rate',     value: pct(finance.compRate),              icon: '✅', accent: finance.compRate > 70, sub: `${finance.completedCount}/${orders.length} orders` },
//                       { label: 'Cancellation Rate',   value: pct(finance.cancelRate),            icon: '❌', pulse: finance.cancelRate > 20, sub: `${finance.cancelledCount} cancelled` },
//                       { label: 'Total Users Loaded',   value: usersCount.toLocaleString(),        icon: '👥', sub: 'From current admin users query' },
//                       { label: 'Pricing Rules',        value: String(finance.activePricingRules), icon: '⚙', sub: 'Loaded pricing rules' },
//                     ].map((c, i) => (
//                       <div key={i} className={`fade-up stagger-${Math.min(i + 1, 8)}`}>
//                         <StatCard label={c.label} value={c.value} icon={c.icon} sub={c.sub} accent={c.accent} pulse={c.pulse} />
//                       </div>
//                     ))}
//                   </div>

//                   {/* Payment reconciliation */}
//                   {financeSnapshot && (
//                     <PaymentReconciliationCard finance={financeSnapshot} />
//                   )}

//                   {/* Revenue summary */}
//                   <div className="glass rounded-2xl p-6">
//                     <h2 className="adm-disp text-white font-bold text-base mb-4">
//                       Revenue Summary
//                     </h2>

//                     <div className="grid gap-3 sm:grid-cols-3">
//                       <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.14)' }}>
//                         <p className="text-[10px] uppercase tracking-widest text-slate-500">Completed</p>
//                         <p className="mt-1 text-xl font-black text-emerald-300">{inr(finance.grossRev)}</p>
//                       </div>

//                       <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)' }}>
//                         <p className="text-[10px] uppercase tracking-widest text-slate-500">Active / Pending</p>
//                         <p className="mt-1 text-xl font-black text-amber-300">{inr(finance.pendingRev)}</p>
//                       </div>

//                       <div className="rounded-xl p-4" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.14)' }}>
//                         <p className="text-[10px] uppercase tracking-widest text-slate-500">Average Order</p>
//                         <p className="mt-1 text-xl font-black text-sky-300">{inr(finance.avgTicket)}</p>
//                       </div>
//                     </div>

//                     <p className="text-xs text-slate-500 mt-4">
//                       Revenue figures are calculated from the order records loaded for this dashboard.
//                       Commission and payout amounts are not estimated here.
//                     </p>
//                   </div>

//                   {/* Finance actions */}
//                   <div className="glass rounded-2xl p-6">
//                     <div className="flex items-center justify-between mb-4">
//                       <h2 className="adm-disp text-white font-bold text-base">Finance Actions</h2>
//                       <button type="button" onClick={() => { fetchAll(true); toast.success('Finance snapshot refreshed.'); }}
//                         className="adm-btn adm-btn-p adm-btn-sm">
//                         ↻ Refresh Snapshot
//                       </button>
//                     </div>
//                     <p className="text-sm text-slate-400 mb-4">Figures are derived from order data loaded for this session.</p>
//                     <div className="grid sm:grid-cols-3 gap-3">
//                       {[
//                         { href: '/admin/pricing',  label: 'Manage Pricing Rules →' },
//                         { href: '/admin/orders',   label: 'Review Active Orders →' },
//                         { href: '/admin/settings', label: 'Commission Settings →' },
//                       ].map(l => (
//                         <Link key={l.href} href={l.href}
//                           className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:text-white"
//                           style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
//                           {l.label}
//                         </Link>
//                       ))}
//                     </div>
//                   </div>
//                 </>
//               )}

//               {/* ══════════ OPERATIONS ══════════ */}
//               {tab === 'ops' && (
//                 <>
//                   {/* Ops KPI strip */}
//                   <div className="grid grid-cols-1 min-[390px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
//                     {[
//                       { label: 'Active Jobs',    value: <AnimCount to={dashboard.kpis.active_jobs} />,         icon: '⚡', pulse: dashboard.kpis.active_jobs > 0 },
//                       { label: "Today's Orders", value: <AnimCount to={dashboard.kpis.todays_orders} />,        icon: '📅', accent: true },
//                       { label: 'Emergencies',    value: <AnimCount to={dashboard.kpis.emergency_bookings} />,   icon: '🚨', pulse: dashboard.kpis.emergency_bookings > 0 },
//                       { label: 'Technicians',    value: <AnimCount to={dashboard.kpis.total_technicians} />,    icon: '🔧' },
//                     ].map((c, i) => (
//                       <div key={i} className={`fade-up stagger-${i + 1}`}>
//                         <StatCard label={c.label} value={c.value} icon={c.icon} accent={c.accent} pulse={c.pulse} />
//                       </div>
//                     ))}
//                   </div>

//                   {/* Filters */}
//                   <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
//                     <input
//                       type="text"
//                       placeholder="Search by ID, customer, or service…"
//                       value={searchQ}
//                       onChange={e => setSearchQ(e.target.value)}
//                       className="adm-inp flex-1"
//                     />
//                     <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="adm-inp sm:w-48">
//                       {STATUS_OPTIONS.map(s => (
//                         <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
//                       ))}
//                     </select>
//                     {(searchQ || statusFilter !== 'ALL') && (
//                       <button type="button" onClick={() => { setSearchQ(''); setStatusFilter('ALL'); }}
//                         className="adm-btn adm-btn-g adm-btn-sm whitespace-nowrap">
//                         Clear
//                       </button>
//                     )}
//                   </div>

//                   {/* Orders table */}
//                   <div className="glass rounded-2xl overflow-hidden">
//                     <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
//                       <h2 className="adm-disp text-white font-bold text-base">
//                         Live Order Feed
//                         <span className="ml-2 text-xs font-semibold text-slate-500">({allOpsOrders.length} orders)</span>
//                       </h2>
//                       <Link href="/admin/orders" className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
//                         Full management →
//                       </Link>
//                     </div>

//                     <div className="overflow-x-auto">
//                       <table className="min-w-full text-sm">
//                         <thead>
//                           <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
//                             {['#', 'Customer', 'Service', 'Amount', 'Status', 'Created'].map(h => (
//                               <th key={h} className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {allOpsOrders.length === 0 ? (
//                             <tr>
//                               <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
//                                 <div className="text-4xl mb-2">📭</div>
//                                 {searchQ || statusFilter !== 'ALL' ? 'No orders match your filters.' : 'No orders found.'}
//                               </td>
//                             </tr>
//                           ) : allOpsOrders.map(o => (
//                             <tr key={o.id} className="tbl-row">
//                               <td className="px-6 py-3.5 font-bold text-sky-400 tabular-nums">#{o.id}</td>
//                               <td className="px-6 py-3.5 text-slate-200 font-medium max-w-[160px] truncate">{o.customer_name}</td>
//                               <td className="px-6 py-3.5 text-slate-400 capitalize">{o.service_name?.replace(/_/g, ' ')}</td>
//                               <td className="px-6 py-3.5 font-bold text-emerald-400 tabular-nums">{inr(o.total_amount)}</td>
//                               <td className="px-6 py-3.5"><StatusBadge status={o.status} /></td>
//                               <td className="px-6 py-3.5 text-slate-500 text-xs tabular-nums">
//                                 <span title={new Date(o.created_at).toLocaleString()}>
//                                   {relTime(o.created_at)}
//                                 </span>
//                               </td>
//                             </tr>
//                           ))}
//                         </tbody>
//                       </table>
//                     </div>

//                     {/* Table footer */}
//                     {allOpsOrders.length > 0 && (
//                       <div className="px-6 py-3 flex items-center justify-between"
//                         style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
//                         <span className="text-xs text-slate-500">
//                           Showing {allOpsOrders.length} of {dashboard.recent_orders.length} recent orders
//                         </span>
//                         <Link href="/admin/orders"
//                           className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
//                           View all orders →
//                         </Link>
//                       </div>
//                     )}
//                   </div>

//                   {/* Status distribution */}
//                   <div className="glass rounded-2xl p-6">
//                     <h2 className="adm-disp text-white font-bold text-base mb-5">Status Distribution</h2>
//                     <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
//                       {(['PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'] as OrderStatus[]).map(s => {
//                         const count = orders.filter(o => o.status === s).length;
//                         const cfg   = statusCfg(s);
//                         const width = orders.length ? (count / orders.length) * 100 : 0;
//                         return (
//                           <div key={s} className="rounded-xl p-4 text-center"
//                             style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
//                             <div className="w-6 h-6 rounded-full mx-auto mb-2" style={{ background: cfg.dot, opacity: 0.8 }} />
//                             <p className="text-xl font-black text-white tabular-nums">{count}</p>
//                             <p className="text-[10px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{cfg.label}</p>
//                             <div className="mt-2 w-full h-1 rounded-full bg-white/8 overflow-hidden">
//                               <div className="h-full rounded-full" style={{ width: `${width}%`, background: cfg.dot }} />
//                             </div>
//                             <p className="text-[10px] text-slate-600 mt-1">{pct(width, 0)}</p>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   </div>
//                 </>
//               )}
//             </div>
//           )}

//           {/* ─── EMPTY STATE ──────────────────────────────────────────── */}
//           {!loading && !dashboard && !error && (
//             <div className="glass rounded-2xl p-12 text-center">
//               <p className="text-4xl mb-3">🌊</p>
//               <p className="adm-disp text-white font-bold text-lg">No dashboard data</p>
//               <p className="text-slate-400 text-sm mt-1">The API returned no data. Check the backend connection.</p>
//               <button onClick={() => fetchAll()} className="adm-btn adm-btn-p mt-5 mx-auto">Retry</button>
//             </div>
//           )}

//         </div>
//       </div>
//     </>
//   );
// }

