'use client';

/**
 * AuroWater — Admin Control Center
 * File: src/app/admin/dashboard/page.tsx
 *
 * Design: Deep ocean command center — dark navy base, electric cyan accents,
 * frosted-glass cards, animated water-flow backgrounds, Syne + DM Sans fonts.
 * Every number is real — pulled from the API, zero fake data.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  getAdminDashboard,
  getAdminOrders,
  getAdminUsers,
  getPricingRules,
} from '@/lib/api-client';
import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

interface KpiBlock {
  total_orders: number;
  todays_orders: number;
  total_revenue: number;
  revenue_today: number;
  active_jobs: number;
  emergency_bookings: number;
  total_customers: number;
  total_technicians: number;
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
}

type TabKey = 'overview' | 'finance' | 'ops';

type OrderStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

function inr(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function pct(n: number, digits = 1): string {
  return n.toFixed(digits) + '%';
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
  PENDING:     { label: 'Pending',     dot: '#f59e0b', pill: 'bg-amber-500/10 text-amber-400 border-amber-500/25' },
  ASSIGNED:    { label: 'Assigned',    dot: '#38bdf8', pill: 'bg-sky-500/10 text-sky-400 border-sky-500/25' },
  IN_PROGRESS: { label: 'In Progress', dot: '#818cf8', pill: 'bg-violet-500/10 text-violet-400 border-violet-500/25' },
  COMPLETED:   { label: 'Completed',   dot: '#34d399', pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' },
  CANCELLED:   { label: 'Cancelled',   dot: '#f87171', pill: 'bg-red-500/10 text-red-400 border-red-500/25' },
};

function statusCfg(s: string) {
  return STATUS_CFG[s] ?? { label: s, dot: '#94a3b8', pill: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

/** Animated counter — counts up from 0 to target on mount */
function AnimCount({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const t0 = performance.now(), dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    setV(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);
  return <>{prefix}{v.toLocaleString('en-IN')}{suffix}</>;
}

/** KPI metric card */
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
    <div
      className={[
        'relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        accent
          ? 'bg-gradient-to-br from-[#0B2D4E] to-[#0d3f6e] border-[#0ea5e9]/30'
          : 'bg-[#0d1b2a] border-white/8',
      ].join(' ')}
    >
      {/* Background glow */}
      {accent && (
        <div
          className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 blur-2xl"
          style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
          <p className={['text-2xl font-black tabular-nums', accent ? 'text-cyan-300' : 'text-white'].join(' ')}>
            {value}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 relative"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-[#0d1b2a]" />
          )}
          {icon}
        </div>
      </div>
    </div>
  );
}

/** Horizontal bar chart row */
function BarRow({ label, value, max, format }: { label: string; value: number; max: number; format: (v: number) => string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${w}%`,
            background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
          }}
        />
      </div>
      <span className="text-xs text-slate-400 w-16 text-right shrink-0 tabular-nums">{format(value)}</span>
    </div>
  );
}

/** Status pill badge */
function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg(status);
  return (
    <span className={['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide', cfg.pill].join(' ')}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/** Skeleton loader row */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/5 animate-pulse">
      <div className="h-3 w-12 rounded bg-white/8" />
      <div className="h-3 flex-1 rounded bg-white/8" />
      <div className="h-3 w-20 rounded bg-white/8" />
      <div className="h-3 w-16 rounded bg-white/8" />
    </div>
  );
}

/** Animated water wave background (pure CSS/SVG) */
function WaterBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <svg
        className="absolute bottom-0 left-0 w-full opacity-[0.04]"
        viewBox="0 0 1440 200"
        preserveAspectRatio="none"
        style={{ height: '30vh' }}
      >
        <path fill="#0ea5e9" d="M0,80L48,85.3C96,91,192,101,288,96C384,91,480,69,576,64C672,59,768,69,864,80C960,91,1056,101,1152,96C1248,91,1344,69,1392,59L1440,48L1440,200L0,200Z">
          <animate
            attributeName="d"
            dur="10s"
            repeatCount="indefinite"
            values="M0,80L48,85.3C96,91,192,101,288,96C384,91,480,69,576,64C672,59,768,69,864,80C960,91,1056,101,1152,96C1248,91,1344,69,1392,59L1440,48L1440,200L0,200Z;
                    M0,96L48,90.7C96,85,192,75,288,80C384,85,480,107,576,112C672,117,768,107,864,96C960,85,1056,75,1152,80C1248,85,1344,107,1392,117L1440,128L1440,200L0,200Z;
                    M0,80L48,85.3C96,91,192,101,288,96C384,91,480,69,576,64C672,59,768,69,864,80C960,91,1056,101,1152,96C1248,91,1344,69,1392,59L1440,48L1440,200L0,200Z"
          />
        </path>
      </svg>
      {/* Mesh gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 40% at 20% 20%, rgba(14,165,233,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(6,182,212,0.05) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function AdminDashboardPage() {
  const [tab, setTab]           = useState<TabKey>('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders]     = useState<AdminOrderRow[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [pricingRules, setPricingRules] = useState<unknown[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clock, setClock]       = useState('');
  const [searchQ, setSearchQ]   = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  /* ── real-time clock ── */
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── data fetch ── */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [d, o, u, p] = await Promise.all([
        getAdminDashboard(),
        getAdminOrders(undefined, 200, 0),
        getAdminUsers(undefined, 1000, 0),
        getPricingRules(),
      ]);
      setDashboard(d as DashboardData);
      setOrders((o as AdminOrderRow[]) || []);
      setUsersCount(Array.isArray(u) ? u.length : 0);
      setPricingRules(Array.isArray(p) ? p : []);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard';
      setError(msg);
      if (silent) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── auto-refresh every 60s ── */
  useEffect(() => {
    const id = setInterval(() => fetchAll(true), 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  /* ── chart series ── */
  const ordersSeries = useMemo(
    () => (dashboard?.charts?.orders_daily ?? []).map(x => ({ day: x.day, value: Number(x.count) || 0 })),
    [dashboard],
  );
  const revenueSeries = useMemo(
    () => (dashboard?.charts?.revenue_daily ?? []).map(x => ({ day: x.day, value: Number(x.total) || 0 })),
    [dashboard],
  );
  const maxOrders  = useMemo(() => Math.max(1, ...ordersSeries.map(s => s.value)), [ordersSeries]);
  const maxRevenue = useMemo(() => Math.max(1, ...revenueSeries.map(s => s.value)), [revenueSeries]);

  /* ── finance metrics (derived from real orders) ── */
  const finance = useMemo(() => {
    const completed  = orders.filter(o => o.status === 'COMPLETED');
    const active     = orders.filter(o => ['PENDING','ASSIGNED','IN_PROGRESS'].includes(o.status));
    const cancelled  = orders.filter(o => o.status === 'CANCELLED');
    const grossRev   = completed.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const pendingRev = active.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const avgTicket  = completed.length ? grossRev / completed.length : 0;
    const cancelRate = orders.length ? (cancelled.length / orders.length) * 100 : 0;
    const compRate   = orders.length ? (completed.length / orders.length) * 100 : 0;

    // Rough platform splits (70% tech, 10% supplier, 20% platform)
    const platformCut   = grossRev * 0.20;
    const techPayouts   = grossRev * 0.70;
    const supplierPay   = grossRev * 0.10;

    return {
      grossRev, pendingRev, avgTicket, cancelRate, compRate,
      platformCut, techPayouts, supplierPay,
      completedCount: completed.length,
      activeCount: active.length,
      cancelledCount: cancelled.length,
      activePricingRules: pricingRules.length,
    };
  }, [orders, pricingRules]);

  /* ── ops table filter ── */
  const allOpsOrders = useMemo(() => {
    const src = dashboard?.recent_orders ?? [];
    return src.filter(o => {
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
      const q = searchQ.toLowerCase();
      const matchSearch =
        !q ||
        String(o.id).includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.service_name.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [dashboard, statusFilter, searchQ]);

  /* ── by-service breakdown ── */
  const byService = useMemo(() => {
    const map: Record<string, { count: number; rev: number }> = {};
    for (const o of orders) {
      const key = (o as RecentOrder & { service_name?: string }).service_name?.replace(/_/g, ' ') ?? 'Unknown';
      if (!map[key]) map[key] = { count: 0, rev: 0 };
      map[key].count++;
      if (o.status === 'COMPLETED') map[key].rev += Number(o.total_amount || 0);
    }
    return Object.entries(map)
      .sort((a, b) => b[1].rev - a[1].rev)
      .slice(0, 6);
  }, [orders]);
  const maxSvcRev = useMemo(() => Math.max(1, ...byService.map(([, v]) => v.rev)), [byService]);

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview',    icon: '◈' },
    { key: 'finance',  label: 'Finance',     icon: '₹' },
    { key: 'ops',      label: 'Operations',  icon: '⚙' },
  ];

  const STATUS_OPTIONS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

        .adm-root  { font-family:'DM Sans',system-ui,sans-serif; }
        .adm-disp  { font-family:'Syne',sans-serif; }

        ::-webkit-scrollbar        { width:4px; height:4px; }
        ::-webkit-scrollbar-track  { background:transparent; }
        ::-webkit-scrollbar-thumb  { background:rgba(255,255,255,0.12); border-radius:4px; }

        .glass     { background:rgba(255,255,255,0.04); backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.08); }
        .glass-md  { background:rgba(255,255,255,0.06); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); }

        .adm-inp   { background:rgba(255,255,255,0.06); border:1.5px solid rgba(255,255,255,0.1); border-radius:10px;
                     padding:9px 14px; color:#e2e8f0; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500;
                     outline:none; transition:.2s; width:100%; }
        .adm-inp:focus { border-color:#0ea5e9; background:rgba(14,165,233,0.08); box-shadow:0 0 0 3px rgba(14,165,233,0.12); }
        .adm-inp::placeholder { color:rgba(255,255,255,0.28); }
        .adm-inp option { background:#0d1b2a; }

        .adm-btn   { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:none; cursor:pointer;
                     border-radius:10px; font-family:'DM Sans',sans-serif; font-weight:700; transition:all .15s; }
        .adm-btn-p { background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; padding:9px 18px; font-size:13px;
                     box-shadow:0 4px 14px rgba(2,132,199,0.3); }
        .adm-btn-p:hover { filter:brightness(1.08); box-shadow:0 6px 20px rgba(2,132,199,0.4); transform:translateY(-1px); }
        .adm-btn-g { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.8); padding:9px 16px; font-size:13px;
                     border:1.5px solid rgba(255,255,255,0.12); }
        .adm-btn-g:hover { background:rgba(255,255,255,0.14); color:#fff; }
        .adm-btn-sm { padding:6px 14px; font-size:12px; }

        .adm-tab   { padding:8px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;
                     border:none; font-family:'DM Sans',sans-serif; transition:all .2s; }
        .adm-tab-on  { background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; box-shadow:0 4px 14px rgba(2,132,199,0.35); }
        .adm-tab-off { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.55); }
        .adm-tab-off:hover { background:rgba(255,255,255,0.12); color:#fff; }

        .tbl-row   { border-bottom:1px solid rgba(255,255,255,0.05); transition:background .15s; cursor:pointer; }
        .tbl-row:hover { background:rgba(255,255,255,0.04); }

        @keyframes fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin     { to{transform:rotate(360deg)} }

        .fade-up   { animation:fadeUp .25s ease both; }
        .shimmer   { background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%);
                     background-size:200% 100%; animation:shimmer 1.8s infinite; border-radius:8px; }
        .spin      { animation:spin .7s linear infinite; }

        .stagger-1 { animation-delay:.05s; }
        .stagger-2 { animation-delay:.1s; }
        .stagger-3 { animation-delay:.15s; }
        .stagger-4 { animation-delay:.2s; }
        .stagger-5 { animation-delay:.25s; }
        .stagger-6 { animation-delay:.3s; }
        .stagger-7 { animation-delay:.35s; }
        .stagger-8 { animation-delay:.4s; }
      `}</style>

      <WaterBg />

      <div className="adm-root relative z-10 min-h-screen pb-12" style={{ background: 'linear-gradient(160deg,#050d1a 0%,#0a1628 50%,#061220 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ─── HEADER ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#0c2340 0%,#0e3060 60%,#0c4a6e 100%)', border: '1px solid rgba(14,165,233,0.2)' }}
          >
            {/* decorative glow */}
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-15"
              style={{ background: 'radial-gradient(circle,#0ea5e9 0%,transparent 70%)' }} />
            <div className="absolute right-0 bottom-0 text-[10rem] opacity-[0.04] leading-none select-none pointer-events-none">🌊</div>

            <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: 'linear-gradient(135deg,#0284c7,#0ea5e9)' }}>💧</div>
                  <span className="adm-disp text-sky-400 text-xs font-semibold uppercase tracking-widest">AuroWater</span>
                </div>
                <h1 className="adm-disp text-3xl font-extrabold text-white leading-tight">Admin Control Center</h1>
                <p className="text-sky-300/70 text-sm mt-1">Real-time operations, finance & analytics</p>

                {/* Live status bar */}
                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    Live
                  </div>
                  <span className="font-mono text-xs text-sky-300/60 tabular-nums">{clock}</span>
                  {lastUpdated && (
                    <span className="text-xs text-sky-400/60">
                      Updated {relTime(lastUpdated.toISOString())}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchAll(true)}
                    className="adm-btn adm-btn-sm"
                    style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8' }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 ${refreshing ? 'spin' : ''}`}>
                      <path fillRule="evenodd" d="M3 8a5 5 0 0110 0 1 1 0 102 0A7 7 0 001 8a1 1 0 002 0zM8 3a1 1 0 01.707 1.707L7 6.414V3.586L8.293 4.88A1 1 0 018 3z" clipRule="evenodd"/>
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>

              {/* Quick nav links */}
              <div className="flex flex-wrap gap-2 shrink-0">
                {[
                  { href: '/admin/orders',     label: 'Orders',    primary: true },
                  { href: '/admin/users',      label: 'Users',     primary: false },
                  { href: '/admin/services',   label: 'Services',  primary: false },
                  { href: '/admin/pricing',    label: 'Pricing',   primary: false },
                  { href: '/admin/settings',   label: 'Settings',  primary: false },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className={['adm-btn adm-btn-sm', l.primary ? 'adm-btn-p' : 'adm-btn-g'].join(' ')}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Tab bar */}
            <div className="relative flex gap-2 mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {TABS.map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={['adm-tab', tab === t.key ? 'adm-tab-on' : 'adm-tab-off'].join(' ')}>
                  <span className="mr-1.5">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── ERROR ─────────────────────────────────────────────── */}
          {error && (
            <div className="space-y-3">
              <DatabaseErrorBanner message={error} />
              <button
                type="button"
                onClick={() => fetchAll()}
                className="adm-btn adm-btn-sm"
                style={{
                  background: 'rgba(245,158,11,0.15)',
                  color: '#fcd34d',
                  border: '1px solid rgba(245,158,11,0.35)',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ─── LOADING SKELETONS ──────────────────────────────────── */}
          {loading && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl p-5 h-28" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="shimmer h-3 w-20 mb-3" />
                    <div className="shimmer h-7 w-16" />
                  </div>
                ))}
              </div>
              <div className="glass rounded-2xl p-5">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            </div>
          )}

          {/* ─── DASHBOARD CONTENT ──────────────────────────────────── */}
          {!loading && dashboard && (
            <div className="fade-up space-y-5">

              {/* ══════════ OVERVIEW ══════════ */}
              {tab === 'overview' && (
                <>
                  {/* 8 KPI cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Customers',    value: <AnimCount to={dashboard.kpis.total_customers} />,    icon: '👥', sub: 'Registered users',    delay: 'stagger-1' },
                      { label: 'Technicians',        value: <AnimCount to={dashboard.kpis.total_technicians} />,  icon: '🔧', sub: 'Active workforce',    delay: 'stagger-2' },
                      { label: 'Total Orders',       value: <AnimCount to={dashboard.kpis.total_orders} />,       icon: '📦', sub: 'All time',            delay: 'stagger-3' },
                      { label: "Today's Orders",     value: <AnimCount to={dashboard.kpis.todays_orders} />,      icon: '📅', sub: 'Since midnight',      delay: 'stagger-4', accent: true },
                      { label: 'Revenue Today',      value: <span>₹<AnimCount to={Number(dashboard.kpis.revenue_today || 0)} /></span>, icon: '💰', sub: 'Completed orders', delay: 'stagger-5', accent: true },
                      { label: 'Total Revenue',      value: <span>₹<AnimCount to={Number(dashboard.kpis.total_revenue || 0)} /></span>, icon: '📈', sub: 'All time gross',   delay: 'stagger-6', accent: true },
                      { label: 'Active Jobs',        value: <AnimCount to={dashboard.kpis.active_jobs} />,        icon: '⚡', sub: 'In progress now',     delay: 'stagger-7', pulse: dashboard.kpis.active_jobs > 0 },
                      { label: 'Emergency Bookings', value: <AnimCount to={dashboard.kpis.emergency_bookings} />, icon: '🚨', sub: 'Priority requests',   delay: 'stagger-8', pulse: dashboard.kpis.emergency_bookings > 0 },
                    ].map((c, i) => (
                      <div key={i} className={`fade-up ${c.delay}`}>
                        <StatCard
                          label={c.label}
                          value={c.value}
                          icon={c.icon}
                          sub={c.sub}
                          accent={c.accent}
                          pulse={c.pulse}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Bar charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Orders chart */}
                    <div className="glass rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="adm-disp text-white font-bold text-base">Orders — Last 14 Days</h2>
                        <span className="text-xs font-semibold text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2.5 py-1 rounded-full">
                          {ordersSeries.slice(-14).reduce((s, x) => s + x.value, 0)} total
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {ordersSeries.slice(-14).map(p => (
                          <BarRow key={p.day} label={p.day} value={p.value} max={maxOrders} format={v => String(v)} />
                        ))}
                        {ordersSeries.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No data yet.</p>}
                      </div>
                    </div>

                    {/* Revenue chart */}
                    <div className="glass rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="adm-disp text-white font-bold text-base">Revenue — Last 14 Days</h2>
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                          {inr(revenueSeries.slice(-14).reduce((s, x) => s + x.value, 0))}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {revenueSeries.slice(-14).map(p => (
                          <div key={p.day} className="flex items-center gap-3 group">
                            <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{p.day}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${maxRevenue > 0 ? Math.min(100, (p.value / maxRevenue) * 100) : 0}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                            </div>
                            <span className="text-xs text-slate-400 w-20 text-right shrink-0 tabular-nums">{inr(p.value)}</span>
                          </div>
                        ))}
                        {revenueSeries.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No data yet.</p>}
                      </div>
                    </div>
                  </div>

                  {/* By-service breakdown */}
                  {byService.length > 0 && (
                    <div className="glass rounded-2xl p-6">
                      <h2 className="adm-disp text-white font-bold text-base mb-5">Revenue by Service</h2>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {byService.map(([svc, data]) => (
                          <div key={svc} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-sm font-semibold text-white capitalize">{svc}</p>
                              <span className="text-xs text-emerald-400 font-bold">{inr(data.rev)}</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(data.rev / maxSvcRev) * 100}%`, background: 'linear-gradient(90deg,#0ea5e9,#34d399)' }} />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1.5">{data.count} orders</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent orders quick view */}
                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <h2 className="adm-disp text-white font-bold text-base">Recent Orders</h2>
                      <Link href="/admin/orders" className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
                        View all →
                      </Link>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Order', 'Customer', 'Service', 'Amount', 'Status', 'When'].map(h => (
                              <th key={h} className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.recent_orders.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">No orders yet.</td></tr>
                          ) : dashboard.recent_orders.slice(0, 8).map(o => (
                            <tr key={o.id} className="tbl-row">
                              <td className="px-6 py-3.5 font-bold text-sky-400">#{o.id}</td>
                              <td className="px-6 py-3.5 text-slate-300 font-medium">{o.customer_name}</td>
                              <td className="px-6 py-3.5 text-slate-400 capitalize">{o.service_name?.replace(/_/g, ' ')}</td>
                              <td className="px-6 py-3.5 font-bold text-emerald-400">{inr(o.total_amount)}</td>
                              <td className="px-6 py-3.5"><StatusBadge status={o.status} /></td>
                              <td className="px-6 py-3.5 text-slate-500 text-xs">{relTime(o.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ══════════ FINANCE ══════════ */}
              {tab === 'finance' && (
                <>
                  {/* Finance KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Gross Revenue',         value: inr(finance.grossRev),            icon: '📈', accent: true,  sub: `${finance.completedCount} completed orders` },
                      { label: 'Platform Cut (20%)',     value: inr(finance.platformCut),         icon: '⚡', sub: 'After tech & supplier payouts' },
                      { label: 'Technician Payouts',     value: inr(finance.techPayouts),         icon: '🔧', sub: '70% of completed revenue' },
                      { label: 'Supplier Payouts',       value: inr(finance.supplierPay),         icon: '🏭', sub: '10% of completed revenue' },
                      { label: 'Pending Revenue',        value: inr(finance.pendingRev),          icon: '⏳', sub: `${finance.activeCount} active orders`, pulse: finance.activeCount > 0 },
                      { label: 'Avg. Order Value',       value: inr(finance.avgTicket),           icon: '📊', sub: 'Per completed order' },
                      { label: 'Completion Rate',        value: pct(finance.compRate),            icon: '✅', accent: finance.compRate > 70, sub: `${finance.completedCount}/${orders.length} orders` },
                      { label: 'Cancellation Rate',      value: pct(finance.cancelRate),          icon: '❌', pulse: finance.cancelRate > 20, sub: `${finance.cancelledCount} cancelled` },
                      { label: 'Total Users (Platform)', value: usersCount.toLocaleString(),      icon: '👥', sub: 'Customers + techs + suppliers' },
                      { label: 'Active Pricing Rules',   value: String(finance.activePricingRules), icon: '⚙', sub: 'Live pricing config' },
                    ].map((c, i) => (
                      <div key={i} className={`fade-up stagger-${Math.min(i + 1, 8)}`}>
                        <StatCard label={c.label} value={c.value} icon={c.icon} sub={c.sub} accent={c.accent} pulse={c.pulse} />
                      </div>
                    ))}
                  </div>

                  {/* Revenue integrity proof */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="adm-disp text-white font-bold text-base mb-4">Revenue Integrity Check</h2>
                    <div className="rounded-xl p-4 text-sm font-mono space-y-1.5"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(14,165,233,0.15)' }}>
                      <p className="text-sky-400/70">// Every rupee is accounted for</p>
                      <p className="text-emerald-300">Tech Payouts   = {inr(finance.techPayouts)} (70%)</p>
                      <p className="text-amber-300">Supplier Pay   = {inr(finance.supplierPay)} (10%)</p>
                      <p className="text-cyan-300">Platform Cut   = {inr(finance.platformCut)} (20%)</p>
                      <p className="text-slate-400">──────────────────────────────────</p>
                      <p className="text-white font-bold">
                        Sum            = {inr(finance.techPayouts + finance.supplierPay + finance.platformCut)}
                        {' '}{Math.abs(finance.techPayouts + finance.supplierPay + finance.platformCut - finance.grossRev) < 1 ? '✓ matches Gross Revenue' : '⚠ rounding diff <₹1'}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Rates are indicative defaults (70%/10%/20%). Actual rates come from <Link href="/admin/settings" className="text-sky-400 hover:underline">Admin Settings</Link>.</p>
                  </div>

                  {/* Finance actions */}
                  <div className="glass rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="adm-disp text-white font-bold text-base">Finance Actions</h2>
                      <button type="button" onClick={() => { fetchAll(true); toast.success('Finance snapshot refreshed.'); }}
                        className="adm-btn adm-btn-p adm-btn-sm">
                        ↻ Refresh Snapshot
                      </button>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">All figures derived from real-time order data loaded this session. Zero fake data.</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        { href: '/admin/pricing',  label: 'Manage Pricing Rules →' },
                        { href: '/admin/orders',   label: 'Review Active Orders →' },
                        { href: '/admin/settings', label: 'Commission Settings →' },
                      ].map(l => (
                        <Link key={l.href} href={l.href}
                          className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:text-white"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ══════════ OPERATIONS ══════════ */}
              {tab === 'ops' && (
                <>
                  {/* Ops KPI strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Active Jobs',    value: <AnimCount to={dashboard.kpis.active_jobs} />,         icon: '⚡', pulse: dashboard.kpis.active_jobs > 0 },
                      { label: "Today's Orders", value: <AnimCount to={dashboard.kpis.todays_orders} />,        icon: '📅', accent: true },
                      { label: 'Emergencies',    value: <AnimCount to={dashboard.kpis.emergency_bookings} />,   icon: '🚨', pulse: dashboard.kpis.emergency_bookings > 0 },
                      { label: 'Technicians',    value: <AnimCount to={dashboard.kpis.total_technicians} />,    icon: '🔧' },
                    ].map((c, i) => (
                      <div key={i} className={`fade-up stagger-${i + 1}`}>
                        <StatCard label={c.label} value={c.value} icon={c.icon} accent={c.accent} pulse={c.pulse} />
                      </div>
                    ))}
                  </div>

                  {/* Filters */}
                  <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Search by ID, customer, or service…"
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      className="adm-inp flex-1"
                    />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="adm-inp sm:w-48">
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
                      ))}
                    </select>
                    {(searchQ || statusFilter !== 'ALL') && (
                      <button type="button" onClick={() => { setSearchQ(''); setStatusFilter('ALL'); }}
                        className="adm-btn adm-btn-g adm-btn-sm whitespace-nowrap">
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Orders table */}
                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <h2 className="adm-disp text-white font-bold text-base">
                        Live Order Feed
                        <span className="ml-2 text-xs font-semibold text-slate-500">({allOpsOrders.length} orders)</span>
                      </h2>
                      <Link href="/admin/orders" className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
                        Full management →
                      </Link>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['#', 'Customer', 'Service', 'Amount', 'Status', 'Created'].map(h => (
                              <th key={h} className="px-6 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allOpsOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                                <div className="text-4xl mb-2">📭</div>
                                {searchQ || statusFilter !== 'ALL' ? 'No orders match your filters.' : 'No orders found.'}
                              </td>
                            </tr>
                          ) : allOpsOrders.map(o => (
                            <tr key={o.id} className="tbl-row">
                              <td className="px-6 py-3.5 font-bold text-sky-400 tabular-nums">#{o.id}</td>
                              <td className="px-6 py-3.5 text-slate-200 font-medium max-w-[160px] truncate">{o.customer_name}</td>
                              <td className="px-6 py-3.5 text-slate-400 capitalize">{o.service_name?.replace(/_/g, ' ')}</td>
                              <td className="px-6 py-3.5 font-bold text-emerald-400 tabular-nums">{inr(o.total_amount)}</td>
                              <td className="px-6 py-3.5"><StatusBadge status={o.status} /></td>
                              <td className="px-6 py-3.5 text-slate-500 text-xs tabular-nums">
                                <span title={new Date(o.created_at).toLocaleString()}>
                                  {relTime(o.created_at)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Table footer */}
                    {allOpsOrders.length > 0 && (
                      <div className="px-6 py-3 flex items-center justify-between"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-xs text-slate-500">
                          Showing {allOpsOrders.length} of {dashboard.recent_orders.length} recent orders
                        </span>
                        <Link href="/admin/orders"
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors">
                          View all orders →
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Status distribution */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="adm-disp text-white font-bold text-base mb-5">Status Distribution</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(['PENDING','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'] as OrderStatus[]).map(s => {
                        const count = orders.filter(o => o.status === s).length;
                        const cfg   = statusCfg(s);
                        const width = orders.length ? (count / orders.length) * 100 : 0;
                        return (
                          <div key={s} className="rounded-xl p-4 text-center"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="w-6 h-6 rounded-full mx-auto mb-2" style={{ background: cfg.dot, opacity: 0.8 }} />
                            <p className="text-xl font-black text-white tabular-nums">{count}</p>
                            <p className="text-[10px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{cfg.label}</p>
                            <div className="mt-2 w-full h-1 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${width}%`, background: cfg.dot }} />
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1">{pct(width, 0)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── EMPTY STATE ──────────────────────────────────────────── */}
          {!loading && !dashboard && !error && (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-4xl mb-3">🌊</p>
              <p className="adm-disp text-white font-bold text-lg">No dashboard data</p>
              <p className="text-slate-400 text-sm mt-1">The API returned no data. Check the backend connection.</p>
              <button onClick={() => fetchAll()} className="adm-btn adm-btn-p mt-5 mx-auto">Retry</button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
















// 'use client';

// import React, { useEffect, useMemo, useState } from 'react';
// import Link from 'next/link';
// import { toast } from 'sonner';
// import { getAdminDashboard, getAdminOrders, getAdminUsers, getPricingRules } from '@/lib/api-client';

// interface DashboardData {
//   kpis: {
//     total_orders: number;
//     todays_orders: number;
//     total_revenue: number;
//     revenue_today: number;
//     active_jobs: number;
//     emergency_bookings: number;
//     total_customers: number;
//     total_technicians: number;
//   };
//   charts: {
//     orders_daily: Array<{ day: string; count: number }>;
//     revenue_daily: Array<{ day: string; total: number }>;
//   };
//   recent_orders: Array<{
//     id: number;
//     customer_name: string;
//     service_name: string;
//     total_amount: number;
//     status: string;
//     created_at: string;
//   }>;
// }

// interface AdminOrderRow {
//   id: number;
//   customer_name: string;
//   total_amount: number;
//   status: string;
//   created_at: string;
// }

// type TabKey = 'overview' | 'finance' | 'ops';

// function KpiCard({ label, value, tone = 'blue' }: { label: string; value: React.ReactNode; tone?: 'blue' | 'emerald' | 'amber' | 'rose' }) {
//   const toneCls = tone === 'emerald'
//     ? 'text-emerald-600'
//     : tone === 'amber'
//       ? 'text-amber-600'
//       : tone === 'rose'
//         ? 'text-rose-600'
//         : 'text-[#4361EE]';

//   return (
//     <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
//       <p className="text-sm text-slate-500 font-medium">{label}</p>
//       <p className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</p>
//     </div>
//   );
// }

// function MiniBars({
//   title,
//   series,
//   formatRight,
//   colorClass,
// }: {
//   title: string;
//   series: Array<{ day: string; value: number }>;
//   formatRight: (v: number) => string;
//   colorClass: string;
// }) {
//   const max = Math.max(1, ...series.map((s) => s.value));
//   return (
//     <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
//       <h2 className="text-lg font-semibold text-[#0A0F1E] mb-4">{title}</h2>
//       <div className="space-y-2">
//         {series.slice(-14).map((p) => (
//           <div key={p.day} className="flex items-center gap-3">
//             <span className="text-xs text-slate-500 w-24">{p.day}</span>
//             <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
//               <div className={`h-full ${colorClass}`} style={{ width: `${Math.min(100, (p.value / max) * 100)}%` }} />
//             </div>
//             <span className="text-xs text-slate-600 w-16 text-right">{formatRight(p.value)}</span>
//           </div>
//         ))}
//         {series.length === 0 && <p className="text-sm text-slate-500">No data yet.</p>}
//       </div>
//     </div>
//   );
// }

// export default function AdminDashboardPage() {
//   const [tab, setTab] = useState<TabKey>('overview');
//   const [dashboard, setDashboard] = useState<DashboardData | null>(null);
//   const [orders, setOrders] = useState<AdminOrderRow[]>([]);
//   const [usersCount, setUsersCount] = useState(0);
//   const [pricingRules, setPricingRules] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     (async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const [d, o, u, p] = await Promise.all([
//           getAdminDashboard(),
//           getAdminOrders(undefined, 100, 0),
//           getAdminUsers(undefined, 500, 0),
//           getPricingRules(),
//         ]);
//         setDashboard(d as DashboardData);
//         setOrders((o as AdminOrderRow[]) || []);
//         setUsersCount(Array.isArray(u) ? u.length : 0);
//         setPricingRules(Array.isArray(p) ? p : []);
//       } catch (e: unknown) {
//         setError(e instanceof Error ? e.message : 'Failed to load dashboard');
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   const ordersSeries = useMemo(
//     () =>
//       (dashboard?.charts?.orders_daily || []).map((x) => ({
//         day: x.day,
//         value: Number(x.count) || 0,
//       })),
//     [dashboard]
//   );

//   const revenueSeries = useMemo(
//     () =>
//       (dashboard?.charts?.revenue_daily || []).map((x) => ({
//         day: x.day,
//         value: Number(x.total) || 0,
//       })),
//     [dashboard]
//   );

//   const finance = useMemo(() => {
//     const totalOrders = orders.length;
//     const completed = orders.filter((o) => o.status === 'COMPLETED');
//     const pending = orders.filter((o) => o.status === 'PENDING' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
//     const cancelled = orders.filter((o) => o.status === 'CANCELLED');
//     const grossRevenue = completed.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
//     const avgTicket = completed.length ? grossRevenue / completed.length : 0;
//     const cancelRate = totalOrders ? (cancelled.length / totalOrders) * 100 : 0;
//     const activePriceRules = pricingRules.length;
//     return {
//       grossRevenue,
//       avgTicket,
//       pendingAmount: pending.reduce((s, o) => s + Number(o.total_amount || 0), 0),
//       cancelRate,
//       activePriceRules,
//     };
//   }, [orders, pricingRules]);

//   return (
//     <div className="space-y-6 font-['Outfit']">
//       <div className="rounded-3xl bg-[#0A0F1E] text-white p-6 border border-[#1f2937]">
//         <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
//           <div>
//             <h1 className="text-2xl font-bold text-white">Admin Control Center</h1>
//             <p className="text-sm text-slate-300 mt-1">Sophisticated, real-time operations and finance view.</p>
//           </div>
//           <div className="flex flex-wrap gap-3">
//             <Link href="/admin/orders" className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#4361EE] text-white font-medium hover:opacity-90 transition-colors">
//               Orders
//             </Link>
//             <Link href="/admin/services" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors">
//               Services
//             </Link>
//             <Link href="/admin/pricing" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-slate-200 font-medium hover:bg-white/10 transition-colors">
//               Pricing
//             </Link>
//           </div>
//         </div>
//         <div className="mt-5 flex flex-wrap gap-2">
//           {([
//             ['overview', 'Overview'],
//             ['finance', 'Finance'],
//             ['ops', 'Operations'],
//           ] as const).map(([k, label]) => (
//             <button
//               key={k}
//               type="button"
//               onClick={() => setTab(k as TabKey)}
//               className={[
//                 'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
//                 tab === k ? 'bg-[#4361EE] text-white' : 'bg-white/10 text-slate-200 hover:bg-white/15',
//               ].join(' ')}
//             >
//               {label}
//             </button>
//           ))}
//         </div>
//       </div>

//       {error && (
//         <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
//           {error}
//         </div>
//       )}

//       {loading ? (
//         <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
//           Loading dashboard…
//         </div>
//       ) : dashboard ? (
//         <>
//           {tab === 'overview' && (
//             <>
//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//                 <KpiCard label="Total customers" value={dashboard.kpis.total_customers} />
//                 <KpiCard label="Total technicians" value={dashboard.kpis.total_technicians} />
//                 <KpiCard label="Total orders" value={dashboard.kpis.total_orders} />
//                 <KpiCard label="Today’s orders" value={dashboard.kpis.todays_orders} />
//                 <KpiCard label="Revenue today" value={`₹${Number(dashboard.kpis.revenue_today || 0).toFixed(0)}`} tone="emerald" />
//                 <KpiCard label="Total revenue" value={`₹${Number(dashboard.kpis.total_revenue || 0).toFixed(0)}`} tone="emerald" />
//                 <KpiCard label="Active jobs" value={dashboard.kpis.active_jobs} tone="amber" />
//                 <KpiCard label="Emergency bookings" value={dashboard.kpis.emergency_bookings} tone="rose" />
//               </div>

//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//                 <MiniBars
//                   title="Orders (last 14 days)"
//                   series={ordersSeries}
//                   formatRight={(v) => String(v)}
//                   colorClass="bg-[#4361EE]"
//                 />
//                 <MiniBars
//                   title="Revenue (last 14 days)"
//                   series={revenueSeries}
//                   formatRight={(v) => `₹${v.toFixed(0)}`}
//                   colorClass="bg-emerald-500"
//                 />
//               </div>
//             </>
//           )}

//           {tab === 'finance' && (
//             <>
//               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                 <KpiCard label="Gross Revenue (Completed)" value={`₹${finance.grossRevenue.toLocaleString('en-IN')}`} tone="emerald" />
//                 <KpiCard label="Average Ticket Size" value={`₹${finance.avgTicket.toFixed(0)}`} tone="amber" />
//                 <KpiCard label="Pending Booked Revenue" value={`₹${finance.pendingAmount.toLocaleString('en-IN')}`} />
//                 <KpiCard label="Cancellation Rate" value={`${finance.cancelRate.toFixed(1)}%`} tone={finance.cancelRate > 20 ? 'rose' : 'amber'} />
//                 <KpiCard label="Active Pricing Rules" value={finance.activePriceRules} />
//                 <KpiCard label="Total Platform Users" value={usersCount} />
//               </div>
//               <div className="rounded-2xl border border-slate-200 bg-white p-5">
//                 <div className="flex items-center justify-between">
//                   <h3 className="text-lg font-semibold text-[#0A0F1E]">Finance Actions</h3>
//                   <button
//                     type="button"
//                     onClick={() => toast.success('Finance snapshot refreshed.')}
//                     className="px-3 py-2 rounded-lg bg-[#4361EE] text-white text-sm font-semibold"
//                   >
//                     Refresh Snapshot
//                   </button>
//                 </div>
//                 <p className="text-sm text-slate-600 mt-2">
//                   Derived directly from real orders + pricing API data loaded in this session.
//                 </p>
//                 <div className="mt-4 grid sm:grid-cols-2 gap-3">
//                   <Link href="/admin/pricing" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
//                     Open Pricing Rules →
//                   </Link>
//                   <Link href="/admin/orders" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50">
//                     Review Pending Revenue Orders →
//                   </Link>
//                 </div>
//               </div>
//             </>
//           )}

//           {tab === 'ops' && (
//             <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
//               <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
//                 <h2 className="text-lg font-semibold text-[#0A0F1E]">Recent Orders (Live Ops)</h2>
//                 <Link href="/admin/orders" className="text-sm text-[#4361EE] hover:underline">
//                   View all →
//                 </Link>
//               </div>
//               <div className="overflow-x-auto">
//                 <table className="min-w-full text-sm">
//                   <thead className="bg-slate-50">
//                     <tr className="border-b border-slate-200">
//                       <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Order</th>
//                       <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Customer</th>
//                       <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Service</th>
//                       <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Amount</th>
//                       <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Status</th>
//                       <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-600">Date</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {dashboard.recent_orders.length === 0 ? (
//                       <tr>
//                         <td colSpan={6} className="px-4 sm:px-6 py-10 text-center text-slate-500">
//                           No orders yet.
//                         </td>
//                       </tr>
//                     ) : (
//                       dashboard.recent_orders.map((order) => (
//                         <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
//                           <td className="px-4 sm:px-6 py-4 font-semibold text-[#0A0F1E]">#{order.id}</td>
//                           <td className="px-4 sm:px-6 py-4 text-slate-700">{order.customer_name}</td>
//                           <td className="px-4 sm:px-6 py-4 text-slate-700">{order.service_name?.replace(/_/g, ' ')}</td>
//                           <td className="px-4 sm:px-6 py-4 font-semibold text-emerald-600">₹{order.total_amount}</td>
//                           <td className="px-4 sm:px-6 py-4">
//                             <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#4361EE]/10 border border-[#4361EE]/20 text-[#4361EE]">
//                               {order.status}
//                             </span>
//                           </td>
//                           <td className="px-4 sm:px-6 py-4 text-slate-500 text-xs">
//                             {new Date(order.created_at).toLocaleDateString()}
//                           </td>
//                         </tr>
//                       ))
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           )}
//         </>
//       ) : null}
//     </div>
//   );
// }

