'use client';

/**
 * AuroTap admin dashboard (v2)
 *
 * What changed vs v1
 * - Instant reloads: last snapshot is cached in sessionStorage and painted immediately,
 *   then refreshed in the background (stale-while-revalidate).
 * - Progressive loading: KPIs render as soon as the dashboard API answers; orders, pricing
 *   and finance stream in afterwards. One failing endpoint no longer blanks the page.
 * - Removed the 1000-row getAdminUsers call (the count was never displayed; KPIs already
 *   include total_customers).
 * - Smart polling: pauses when the tab is hidden or the device is offline, backs off after
 *   failures, and refreshes when the tab regains focus.
 * - Zero-dependency SVG charts with hover/keyboard tooltips and week-over-week trends.
 * - Command palette (Ctrl/Cmd+K), keyboard shortcuts, URL-hash tab state, sortable and
 *   paginated order table, status filters, CSV export (formula-injection safe),
 *   order quick-view drawer, responsive mobile order list.
 * - Memoised components, deferred search, lazy-loaded finance card, content-visibility
 *   on below-the-fold sections.
 */

import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  getAdminDashboard,
  getAdminOrders,
  getPricingRules,
  adminFinance,
} from '@/lib/api-client';
import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';
import AdminAttentionQueue from '@/app/admin/components/AdminAttentionQueue';

const PaymentReconciliationCard = dynamic(
  () => import('@/app/admin/components/PaymentReconciliationCard'),
  {
    ssr: false,
    loading: () => <div className="h-40 animate-pulse rounded-xl bg-slate-100" />,
  },
);

/* ────────────────────────────── Types ────────────────────────────── */

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

interface OrderRow {
  id: number;
  customer_name: string;
  service_name?: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface DashboardData {
  kpis: KpiBlock;
  charts: { orders_daily: DailyPoint[]; revenue_daily: DailyPoint[] };
  recent_orders: OrderRow[];
}

interface FinanceSnapshot {
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
}

interface Snapshot {
  dashboard: DashboardData | null;
  orders: OrderRow[];
  pricingCount: number;
  finance: FinanceSnapshot | null;
}

type TabKey = 'overview' | 'finance' | 'ops';
type SortKey = 'id' | 'customer' | 'service' | 'amount' | 'status' | 'created';
interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}
interface Point {
  day: string;
  value: number;
}
interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

/* ───────────────────────────── Constants ───────────────────────────── */

const ORDER_LIMIT = 200;
const PAGE_SIZE = 10;
const POLL_BASE_MS = 60_000;
const POLL_MAX_MS = 300_000;
const CACHE_KEY = 'aurotap:admin-dashboard:v2';
const CACHE_MAX_AGE_MS = 15 * 60_000;

const EMPTY_SNAPSHOT: Snapshot = {
  dashboard: null,
  orders: [],
  pricingCount: 0,
  finance: null,
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'finance', label: 'Finance' },
  { key: 'ops', label: 'Operations' },
];
const TAB_KEYS = TABS.map((t) => t.key);

const NAV_LINKS = [
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/services', label: 'Services' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/settings', label: 'Settings' },
];

const STATUS_ORDER = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

const STATUS_CFG: Record<string, { label: string; dot: string; pill: string }> = {
  PENDING: { label: 'Pending', dot: '#d97706', pill: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ASSIGNED: { label: 'Assigned', dot: '#0284c7', pill: 'bg-sky-50 text-sky-800 ring-sky-200' },
  IN_PROGRESS: { label: 'In progress', dot: '#7c3aed', pill: 'bg-violet-50 text-violet-800 ring-violet-200' },
  COMPLETED: { label: 'Completed', dot: '#059669', pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  CANCELLED: { label: 'Cancelled', dot: '#dc2626', pill: 'bg-red-50 text-red-800 ring-red-200' },
};

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: 'id', label: 'Order' },
  { key: 'customer', label: 'Customer' },
  { key: 'service', label: 'Service' },
  { key: 'amount', label: 'Amount', right: true },
  { key: 'status', label: 'Status' },
  { key: 'created', label: 'Placed' },
];

/* ───────────────────────────── Helpers ───────────────────────────── */

const numberFmt = new Intl.NumberFormat('en-IN');

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function count(value: unknown): string {
  return numberFmt.format(num(value));
}
function inr(value: unknown): string {
  return `₹${numberFmt.format(Math.round(num(value)))}`;
}
function inrCompact(value: unknown): string {
  const n = num(value);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return inr(n);
}
function pct(value: number, digits = 1): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function cleanName(value?: string, fallback = 'Service'): string {
  return (value || fallback).replace(/_/g, ' ');
}

function relTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '—';
  const minutes = Math.floor(Math.max(0, Date.now() - ts) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('en-IN') : '—';
}

function fmtDay(day: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(day)) {
    const d = new Date(`${day.slice(0, 10)}T00:00:00`);
    if (Number.isFinite(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
  }
  return day;
}

function statusCfg(status: string) {
  return (
    STATUS_CFG[status] ?? {
      label: status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      dot: '#64748b',
      pill: 'bg-slate-100 text-slate-700 ring-slate-200',
    }
  );
}

/** Last 7 points vs the 7 before them, as a percentage. null when there is nothing to compare. */
function weekTrend(series: Point[]): number | null {
  const last = series.slice(-7).reduce((s, p) => s + p.value, 0);
  const prevPoints = series.slice(-14, -7);
  if (!prevPoints.length) return null;
  const prev = prevPoints.reduce((s, p) => s + p.value, 0);
  if (prev === 0) return last === 0 ? 0 : null;
  return ((last - prev) / prev) * 100;
}

function sortRows(rows: OrderRow[], sort: SortState): OrderRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const get = (o: OrderRow): number | string => {
    switch (sort.key) {
      case 'id': return num(o.id);
      case 'customer': return (o.customer_name ?? '').toLowerCase();
      case 'service': return cleanName(o.service_name).toLowerCase();
      case 'amount': return num(o.total_amount);
      case 'status': return o.status;
      default: return Date.parse(o.created_at) || 0;
    }
  };
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x).localeCompare(String(y), 'en-IN') * dir;
  });
}

function exportCsv(rows: OrderRow[]) {
  if (!rows.length) {
    toast.info('There are no orders to export yet.');
    return;
  }
  // Prefix risky leading characters so spreadsheets never run cell content as a formula.
  const esc = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [
    ['Order', 'Customer', 'Service', 'Amount (INR)', 'Status', 'Placed at'].join(','),
    ...rows.map((o) =>
      [
        o.id,
        esc(o.customer_name),
        esc(cleanName(o.service_name)),
        num(o.total_amount),
        esc(o.status),
        esc(o.created_at),
      ].join(','),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aurotap-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`Exported ${rows.length} orders`);
}

/* ── Session cache (cleared when the browser tab closes) ── */

function readCache(): { snap: Snapshot; savedAt: number } | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; snap: Snapshot };
    if (!parsed?.snap?.dashboard || Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(snap: Snapshot, savedAt: number) {
  try {
    if (!snap.dashboard) return;
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt, snap }));
  } catch {
    /* storage full or unavailable: caching is optional */
  }
}

/* ───────────────────────────── Styles ───────────────────────────── */

const STYLES = `
.aurotap-admin { color-scheme: light; font-feature-settings: "tnum" 1, "cv11" 1; }
.aurotap-admin :focus-visible { outline: 2px solid #0e7490; outline-offset: 2px; border-radius: 6px; }
.aurotap-admin .ad-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  min-height: 38px; padding: .5rem .85rem; border: 1px solid #dbe3ed; border-radius: .7rem;
  background: #fff; color: #334155; font-size: .8125rem; font-weight: 600; cursor: pointer;
  transition: background-color .14s ease, border-color .14s ease, box-shadow .14s ease;
}
.aurotap-admin .ad-btn:hover { background: #f8fafc; border-color: #b8c7d9; }
.aurotap-admin .ad-btn:active { background: #f1f5f9; }
.aurotap-admin .ad-btn:disabled { cursor: not-allowed; opacity: .6; }
.aurotap-admin .ad-btn-primary { background: #0e7490; border-color: #0e7490; color: #fff; }
.aurotap-admin .ad-btn-primary:hover { background: #155e75; border-color: #155e75; }
.aurotap-admin .ad-input {
  width: 100%; min-height: 42px; border: 1px solid #cbd5e1; border-radius: .7rem;
  padding: .55rem .8rem; background: #fff; color: #0f172a; font-size: .875rem;
}
.aurotap-admin .ad-input:focus-visible { outline: none; border-color: #0e7490; box-shadow: 0 0 0 3px rgba(14,116,144,.15); }
.aurotap-admin .ad-defer { content-visibility: auto; contain-intrinsic-size: auto 460px; }
.aurotap-admin .ad-spinner {
  width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: ad-spin .65s linear infinite;
}
.aurotap-admin .ad-pulse::after {
  content: ""; position: absolute; inset: 0; border-radius: 9999px; background: inherit;
  animation: ad-ping 1.8s cubic-bezier(0,0,.2,1) infinite;
}
.aurotap-admin .ad-drawer { animation: ad-slide .22s cubic-bezier(.2,.8,.2,1); }
.aurotap-admin .ad-fade { animation: ad-fade .15s ease-out; }
@keyframes ad-spin { to { transform: rotate(360deg); } }
@keyframes ad-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
@keyframes ad-slide { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ad-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .aurotap-admin *, .aurotap-admin *::before, .aurotap-admin *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}
`;

/* ───────────────────────── Small building blocks ───────────────────────── */

function DropIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5c3.6 4.3 6.5 7.6 6.5 11.1a6.5 6.5 0 1 1-13 0C5.5 10.1 8.4 6.8 12 2.5Z"
        fill="currentColor"
        opacity=".95"
      />
      <path d="M9 14.2a3 3 0 0 0 2.6 2.9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500">
    {children}
  </kbd>
);

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${cfg.pill}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} aria-hidden="true" />
      {cfg.label}
    </span>
  );
});

function SectionCard({
  children,
  className = '',
  defer = false,
}: {
  children: React.ReactNode;
  className?: string;
  defer?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm ${defer ? 'ad-defer' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function DeltaChip({ delta, label = 'vs previous 7 days' }: { delta: number | null; label?: string }) {
  if (delta === null) return null;
  const up = delta > 0.05;
  const down = delta < -0.05;
  const tone = up
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : down
      ? 'bg-red-50 text-red-800 ring-red-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${tone}`}>
        <span aria-hidden="true">{up ? '▲' : down ? '▼' : '–'}</span>
        {up ? '+' : ''}
        {delta.toFixed(1)}%
      </span>
      {label}
    </span>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 7h18M5 7l1.2 12a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.8L19 7M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-100 ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite" aria-label="Loading dashboard">
      <SectionCard className="p-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-12 w-56" />
        <Skeleton className="mt-6 h-40 w-full" />
      </SectionCard>
      <div className="grid gap-5 lg:grid-cols-5">
        <SectionCard className="p-6 lg:col-span-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 h-32 w-full" />
        </SectionCard>
        <SectionCard className="space-y-4 p-6 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </SectionCard>
      </div>
    </div>
  );
}

function UpdatedAgo({ date }: { date: Date | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);
  if (!date) return null;
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  const text = s < 10 ? 'just now' : s < 60 ? `${s}s ago` : relTime(date.toISOString());
  return <span className="text-xs text-slate-500">Updated {text}</span>;
}

/* ───────────────────────────── Charts ───────────────────────────── */

const AreaChart = memo(function AreaChart({
  data,
  format,
  label,
  color = '#0e7490',
  height = 176,
}: {
  data: Point[];
  format: (v: number) => string;
  label: string;
  color?: string;
  height?: number;
}) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const PX = 6;
  const PT = 14;
  const PB = 6;

  const geom = useMemo(() => {
    const n = data.length;
    if (n === 0) return null;
    const max = Math.max(1, ...data.map((d) => d.value));
    const x = (i: number) => (n === 1 ? W / 2 : PX + (i * (W - PX * 2)) / (n - 1));
    const y = (v: number) => PT + (1 - v / max) * (H - PT - PB);
    const pts = data.map((d, i) => [x(i), y(d.value)] as const);
    const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[n - 1][0].toFixed(1)},${H - PB} L${pts[0][0].toFixed(1)},${H - PB} Z`;
    const total = data.reduce((s, d) => s + d.value, 0);
    return { pts, line, area, max, total };
  }, [data, H]);

  if (!geom) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No data for this period yet. It will appear after the first order.
      </p>
    );
  }

  const n = data.length;
  const move = (clientX: number, rect: DOMRect) => {
    const rel = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    setHover(Math.round(rel * (n - 1)));
  };
  const hx = hover !== null ? (geom.pts[hover][0] / W) * 100 : 0;
  const hy = hover !== null ? (geom.pts[hover][1] / H) * 100 : 0;
  const mid = data[Math.floor((n - 1) / 2)];

  return (
    <div>
      <div
        className="relative mt-9 touch-pan-y select-none"
        style={{ height: H }}
        role="img"
        tabIndex={0}
        aria-label={`${label}. Total ${format(geom.total)}. Highest day ${format(geom.max)}. Use left and right arrow keys to inspect each day.`}
        onPointerMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setHover((h) => (h === null ? n - 1 : Math.min(n - 1, h + 1)));
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setHover((h) => (h === null ? n - 1 : Math.max(0, h - 1)));
          } else if (e.key === 'Escape') {
            setHover(null);
          }
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity=".22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={W}
              y1={PT + f * (H - PT - PB)}
              y2={PT + f * (H - PT - PB)}
              stroke="#e2e8f0"
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line x1="0" x2={W} y1={H - PB} y2={H - PB} stroke="#cbd5e1" vectorEffect="non-scaling-stroke" />
          <path d={geom.area} fill={`url(#g${gid})`} />
          <path
            d={geom.line}
            fill="none"
            stroke={color}
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {hover !== null && (
          <>
            <div className="pointer-events-none absolute top-0 h-full w-px bg-slate-300/80" style={{ left: `${hx}%` }} />
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${hx}%`, top: `${hy}%`, backgroundColor: color }}
            />
            <div
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${clamp(hx, 14, 86)}%`, top: -8, transform: 'translate(-50%, -100%)' }}
            >
              <span className="block text-[11px] text-slate-300">{fmtDay(data[hover].day)}</span>
              <span className="font-semibold tabular-nums">{format(data[hover].value)}</span>
            </div>
          </>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
        <span>{fmtDay(data[0].day)}</span>
        {n > 2 && <span>{fmtDay(mid.day)}</span>}
        <span>{fmtDay(data[n - 1].day)}</span>
      </div>
    </div>
  );
});

const RingGauge = memo(function RingGauge({ value, label }: { value: number; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = clamp(value, 0, 100);
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${label}: ${pct(v)}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#059669"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xl font-semibold tabular-nums text-slate-900">{pct(v, 0)}</p>
          <p className="text-[10px] text-slate-500">collected</p>
        </div>
      </div>
    </div>
  );
});

/* ───────────────────────────── Orders table ───────────────────────────── */

const OrdersTable = memo(function OrdersTable({
  rows,
  onSelect,
  sort,
  onSort,
  emptyTitle,
  emptyMessage,
}: {
  rows: OrderRow[];
  onSelect: (order: OrderRow) => void;
  sort?: SortState;
  onSort?: (key: SortKey) => void;
  emptyTitle: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;

  return (
    <>
      {/* Mobile list */}
      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 sm:hidden">
        {rows.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onSelect(o)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  #{o.id} {o.customer_name || 'Customer'}
                </span>
                <span className="block truncate text-xs capitalize text-slate-500">
                  {cleanName(o.service_name)} · {relTime(o.created_at)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-slate-900">{inr(o.total_amount)}</span>
                <StatusBadge status={o.status} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="mt-3 hidden overflow-x-auto border-t border-slate-100 sm:block">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50/80 text-xs text-slate-500">
            <tr>
              {COLUMNS.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-5 py-3 font-semibold ${col.right ? 'text-right' : ''}`}
                  >
                    {onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
                      >
                        {col.label}
                        <span aria-hidden="true" className="text-[10px]">
                          {active ? (sort!.dir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                onClick={() => onSelect(o)}
                className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50"
              >
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(o);
                    }}
                    className="font-semibold text-cyan-800 hover:underline"
                  >
                    #{o.id}
                  </button>
                </td>
                <td className="max-w-[220px] truncate px-5 py-3.5 font-medium text-slate-800">
                  {o.customer_name || 'Customer'}
                </td>
                <td className="px-5 py-3.5 capitalize text-slate-600">{cleanName(o.service_name)}</td>
                <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                  {inr(o.total_amount)}
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={o.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">
                  <time dateTime={o.created_at} title={fullDate(o.created_at)}>
                    {relTime(o.created_at)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
});

/* ───────────────────────────── Overlays ───────────────────────────── */

function OrderDrawer({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(order.id));
      toast.success(`Copied order #${order.id}`);
    } catch {
      toast.error('Could not copy. Select the number and copy it manually.');
    }
  };

  const rows: [string, React.ReactNode][] = [
    ['Customer', order.customer_name || 'Customer'],
    ['Service', <span key="s" className="capitalize">{cleanName(order.service_name)}</span>],
    ['Amount', <span key="a" className="font-semibold tabular-nums">{inr(order.total_amount)}</span>],
    ['Status', <StatusBadge key="st" status={order.status} />],
    ['Placed', `${fullDate(order.created_at)} (${relTime(order.created_at)})`],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close order details"
        className="ad-fade absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.id} details`}
        className="ad-drawer relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">Order</p>
            <h2 className="text-lg font-semibold text-slate-900">#{order.id}</h2>
          </div>
          <button ref={closeRef} type="button" className="ad-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3.5 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <Link href="/admin/orders" className="ad-btn ad-btn-primary flex-1">
            Open orders page
          </Link>
          <button type="button" className="ad-btn" onClick={copyId}>
            Copy number
          </button>
        </div>
      </aside>
    </div>
  );
}

function CommandPalette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => `${i.label} ${i.group} ${i.keywords ?? ''}`.toLowerCase().includes(s));
  }, [items, q]);

  useEffect(() => setActive(0), [q]);

  const choose = (item?: PaletteItem) => {
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[12vh]"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActive((a) => Math.min(results.length - 1, a + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive((a) => Math.max(0, a - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          choose(results[active]);
        }
      }}
    >
      <button
        type="button"
        aria-label="Close command menu"
        className="ad-fade absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="ad-fade relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to a page or run an action"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          className="w-full border-b border-slate-100 px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-500">
              Nothing matches “{q}”. Try a page name like orders or pricing.
            </li>
          )}
          {results.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(item)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                i === active ? 'bg-cyan-50 text-cyan-950' : 'text-slate-700'
              }`}
            >
              <span>
                {item.label}
                <span className="ml-2 text-xs text-slate-400">{item.group}</span>
              </span>
              {item.hint && <Kbd>{item.hint}</Kbd>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────────── Tab panels ───────────────────────────── */

const OverviewPanel = memo(function OverviewPanel({
  kpis,
  ordersSeries,
  revenueSeries,
  services,
  recentOrders,
  pricingCount,
  onSelect,
}: {
  kpis: KpiBlock;
  ordersSeries: Point[];
  revenueSeries: Point[];
  services: { name: string; count: number; revenue: number }[];
  recentOrders: OrderRow[];
  pricingCount: number;
  onSelect: (o: OrderRow) => void;
}) {
  const revenue14 = useMemo(() => revenueSeries.slice(-14), [revenueSeries]);
  const orders14 = useMemo(() => ordersSeries.slice(-14), [ordersSeries]);
  const revenueDelta = useMemo(() => weekTrend(revenueSeries), [revenueSeries]);
  const ordersDelta = useMemo(() => weekTrend(ordersSeries), [ordersSeries]);
  const ordersTotal = orders14.reduce((s, p) => s + p.value, 0);
  const maxService = Math.max(1, ...services.map((s) => s.revenue));
  const serviceTotal = services.reduce((s, x) => s + x.revenue, 0);

  const ledger: { label: string; value: string; alert?: boolean; note?: string }[] = [
    { label: 'Customers', value: count(kpis.total_customers), note: 'Registered accounts' },
    { label: 'Technicians', value: count(kpis.total_technicians), note: 'Technician accounts' },
    { label: 'Lifetime orders', value: count(kpis.total_orders) },
    { label: 'Lifetime revenue', value: inrCompact(kpis.total_revenue), note: inr(kpis.total_revenue) },
    { label: 'Emergency bookings', value: count(kpis.emergency_bookings), alert: num(kpis.emergency_bookings) > 0 },
    { label: 'Active pricing rules', value: count(pricingCount) },
  ];

  return (
    <>
      <SectionCard className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-slate-500">Revenue today</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-slate-950 sm:text-5xl">
              {inr(kpis.revenue_today)}
            </p>
            <div className="mt-2">
              <DeltaChip delta={revenueDelta} />
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Orders today</dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{count(kpis.todays_orders)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Active jobs</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tabular-nums text-slate-900">
                {count(kpis.active_jobs)}
                {num(kpis.active_jobs) > 0 && (
                  <span className="relative h-2 w-2 rounded-full bg-cyan-600 ad-pulse" aria-hidden="true" />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Emergencies</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tabular-nums text-slate-900">
                {count(kpis.emergency_bookings)}
                {num(kpis.emergency_bookings) > 0 && (
                  <span className="relative h-2 w-2 rounded-full bg-red-500 ad-pulse" aria-hidden="true" />
                )}
              </dd>
            </div>
          </dl>
        </div>
        <AreaChart data={revenue14} format={inr} label="Revenue over the last 14 days" color="#0e7490" />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-5">
        <SectionCard className="pb-4 lg:col-span-3" defer>
          <SectionHeading
            title="Orders, last 14 days"
            description={`${count(ordersTotal)} orders in this period`}
            action={<DeltaChip delta={ordersDelta} label="vs previous 7 days" />}
          />
          <div className="px-4 sm:px-5">
            <AreaChart data={orders14} format={(v) => `${count(v)} orders`} label="Orders over the last 14 days" color="#4f46e5" height={150} />
          </div>
        </SectionCard>

        <SectionCard className="lg:col-span-2" defer>
          <SectionHeading title="Business snapshot" />
          <dl className="mt-3 divide-y divide-slate-100 px-4 pb-2 sm:px-5">
            {ledger.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <dt className="text-sm text-slate-600">{row.label}</dt>
                  {row.note && <p className="text-xs text-slate-400">{row.note}</p>}
                </div>
                <dd
                  className={`flex items-center gap-2 text-base font-semibold tabular-nums ${
                    row.alert ? 'text-red-700' : 'text-slate-900'
                  }`}
                >
                  {row.alert && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Needs attention" />}
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>

      {services.length > 0 && (
        <SectionCard className="pb-5" defer>
          <SectionHeading
            title="Revenue by service"
            description={`Completed orders among the latest ${ORDER_LIMIT} loaded, not lifetime totals`}
          />
          <ul className="mt-4 space-y-3.5 px-4 sm:px-5">
            {services.map((s) => (
              <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5">
                <span className="truncate text-sm font-medium capitalize text-slate-800">{s.name}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {inr(s.revenue)}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {serviceTotal ? pct((s.revenue / serviceTotal) * 100, 0) : '0%'}
                  </span>
                </span>
                <div className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-cyan-600"
                    style={{ width: `${clamp((s.revenue / maxService) * 100, 0, 100)}%` }}
                  />
                </div>
                <span className="col-span-2 text-xs text-slate-400">{count(s.count)} orders loaded</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard className="overflow-hidden pb-0" defer>
        <SectionHeading
          title="Recent orders"
          action={
            <Link href="/admin/orders" className="text-sm font-semibold text-cyan-800 hover:text-cyan-950">
              View all orders
            </Link>
          }
        />
        <OrdersTable
          rows={recentOrders.slice(0, 8)}
          onSelect={onSelect}
          emptyTitle="No orders yet"
          emptyMessage="New orders will show up here as soon as customers book a service."
        />
      </SectionCard>
    </>
  );
});

const FinancePanel = memo(function FinancePanel({
  finance,
  sample,
  pricingCount,
  refreshing,
  onRefresh,
}: {
  finance: FinanceSnapshot | null;
  sample: SampleStats;
  pricingCount: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const collectionRate =
    finance && num(finance.gross_revenue) > 0
      ? (num(finance.collected_revenue) / num(finance.gross_revenue)) * 100
      : 0;

  const sampleStats: { label: string; value: string; note: string }[] = [
    { label: 'Completed orders', value: count(sample.completedCount), note: 'In the loaded orders' },
    { label: 'Active orders', value: count(sample.activeCount), note: 'Pending, assigned or in progress' },
    { label: 'Average order value', value: inr(sample.averageTicket), note: 'Completed orders only' },
    {
      label: 'Completion rate',
      value: pct(sample.completionRate),
      note: `${sample.completedCount} of ${sample.loadedOrderCount} loaded orders`,
    },
    {
      label: 'Cancellation rate',
      value: pct(sample.cancellationRate),
      note: `${sample.cancelledCount} cancelled in loaded orders`,
    },
    { label: 'Pricing rules', value: count(pricingCount), note: 'Returned by the pricing API' },
  ];

  return (
    <>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
        The top section uses finance API figures for the last 30 days. Figures under “Loaded orders” are calculated
        from the latest {ORDER_LIMIT} orders only, so treat them as a sample. Commission and supplier payouts are not
        estimated here.
      </div>

      <SectionCard className="p-4 sm:p-6">
        <SectionHeading
          title="Last 30 days"
          description="From the finance API"
          action={
            <button type="button" className="ad-btn" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? <span className="ad-spinner" aria-hidden="true" /> : <span aria-hidden="true">↻</span>}
              {refreshing ? 'Refreshing' : 'Refresh figures'}
            </button>
          }
        />
        {finance ? (
          <div className="mt-6 flex flex-wrap items-center gap-8 px-4 sm:px-5">
            <RingGauge value={collectionRate} label="Share of gross revenue collected" />
            <dl className="grid flex-1 grid-cols-1 gap-5 min-[480px]:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-500">Gross revenue</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{inr(finance.gross_revenue)}</dd>
                <p className="text-xs text-slate-400">{count(finance.order_count)} orders</p>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Collected</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">{inr(finance.collected_revenue)}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Pending payments</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{inr(finance.pending_payments)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <EmptyState
            title="Finance figures are unavailable"
            message="The finance API didn't respond. Refresh to try again; your other data is unaffected."
          />
        )}
      </SectionCard>

      <SectionCard className="pb-3" defer>
        <SectionHeading title="Loaded orders" description={`Calculated from the latest ${sample.loadedOrderCount} orders`} />
        <dl className="mt-3 grid grid-cols-1 divide-y divide-slate-100 px-4 sm:grid-cols-2 sm:gap-x-10 sm:divide-y-0 sm:px-5">
          {sampleStats.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-4 border-slate-100 py-3 sm:border-b">
              <div className="min-w-0">
                <dt className="text-sm text-slate-700">{s.label}</dt>
                <p className="truncate text-xs text-slate-400">{s.note}</p>
              </div>
              <dd className="text-base font-semibold tabular-nums text-slate-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      {finance && (
        <SectionCard className="pb-5" defer>
          <SectionHeading title="Payment reconciliation" />
          <div className="px-4 pt-4 sm:px-5">
            <PaymentReconciliationCard finance={finance} />
          </div>
        </SectionCard>
      )}

      <SectionCard className="pb-5" defer>
        <SectionHeading title="Finance tools" description="Open the records behind these numbers" />
        <div className="mt-4 grid gap-3 px-4 sm:grid-cols-3 sm:px-5">
          {[
            { href: '/admin/pricing', label: 'Manage pricing rules' },
            { href: '/admin/orders', label: 'Review orders' },
            { href: '/admin/settings', label: 'Commission settings' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
});

const OpsPanel = memo(function OpsPanel({
  kpis,
  rows,
  recentCount,
  onSelect,
  onExport,
}: {
  kpis: KpiBlock;
  rows: OrderRow[];
  recentCount: number;
  onSelect: (o: OrderRow) => void;
  onExport: (rows: OrderRow[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState<SortState>({ key: 'created', dir: 'desc' });
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(search);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of rows) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLocaleLowerCase('en-IN');
    const base = rows.filter((o) => {
      if (status !== 'ALL' && o.status !== status) return false;
      if (!q) return true;
      return (
        String(o.id).includes(q) ||
        (o.customer_name ?? '').toLocaleLowerCase('en-IN').includes(q) ||
        cleanName(o.service_name, '').toLocaleLowerCase('en-IN').includes(q)
      );
    });
    return sortRows(base, sort);
  }, [rows, deferred, status, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(filtered.length, safePage * PAGE_SIZE);
  const filtersActive = Boolean(search) || status !== 'ALL';

  const toggleSort = useCallback((key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'customer' || key === 'service' ? 'asc' : 'desc' }));
    setPage(1);
  }, []);

  const total = rows.length;

  return (
    <>
      <SectionCard className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            { label: 'Active jobs', value: count(kpis.active_jobs), alert: false },
            { label: 'Orders today', value: count(kpis.todays_orders), alert: false },
            { label: 'Emergencies', value: count(kpis.emergency_bookings), alert: num(kpis.emergency_bookings) > 0 },
            { label: 'Technicians', value: count(kpis.total_technicians), alert: false },
          ].map((s) => (
            <div key={s.label}>
              <dt className="text-sm text-slate-500">{s.label}</dt>
              <dd className={`mt-0.5 flex items-center gap-2 text-2xl font-semibold tabular-nums ${s.alert ? 'text-red-700' : 'text-slate-900'}`}>
                {s.value}
                {s.alert && <span className="relative h-2 w-2 rounded-full bg-red-500 ad-pulse" aria-hidden="true" />}
              </dd>
            </div>
          ))}
        </dl>

        {total > 0 && (
          <div className="mt-5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Order status mix">
              {STATUS_ORDER.map((s) => {
                const c = counts[s] ?? 0;
                return c ? (
                  <div key={s} style={{ width: `${(c / total) * 100}%`, backgroundColor: statusCfg(s).dot }} title={`${statusCfg(s).label}: ${c}`} />
                ) : null;
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Status mix of the {count(total)} orders loaded here, not the full database.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard className="overflow-hidden pb-0">
        <div className="space-y-4 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Orders</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="ad-btn" onClick={() => onExport(filtered)} disabled={!filtered.length}>
                Export CSV
              </button>
              <Link href="/admin/orders" className="ad-btn ad-btn-primary">
                Manage all
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Search</span>
              <input
                id="ops-search"
                type="search"
                className="ad-input"
                placeholder="Order number, customer or service"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            {filtersActive && (
              <button
                type="button"
                className="ad-btn"
                onClick={() => {
                  setSearch('');
                  setStatus('ALL');
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {['ALL', ...STATUS_ORDER].map((s) => {
              const selected = status === s;
              const c = s === 'ALL' ? total : (counts[s] ?? 0);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-cyan-700 bg-cyan-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {s === 'ALL' ? 'All' : statusCfg(s).label}
                  <span className={`tabular-nums ${selected ? 'text-cyan-100' : 'text-slate-400'}`}>{count(c)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <OrdersTable
          rows={pageRows}
          onSelect={onSelect}
          sort={sort}
          onSort={toggleSort}
          emptyTitle={filtersActive ? 'No orders match these filters' : 'No orders found'}
          emptyMessage={
            filtersActive
              ? 'Try a different search term or clear the filters to see every loaded order.'
              : 'Orders will appear here as soon as customers book a service.'
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
          <span aria-live="polite">
            {filtered.length
              ? `Showing ${from}–${to} of ${count(filtered.length)} orders (${count(recentCount)} most recent from the dashboard API are included)`
              : 'No orders to show'}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="ad-btn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            <span className="tabular-nums">
              Page {safePage} of {pageCount}
            </span>
            <button type="button" className="ad-btn" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </>
  );
});

/* ───────────────────────────── Derived sample ───────────────────────────── */

interface SampleStats {
  completedCount: number;
  activeCount: number;
  cancelledCount: number;
  loadedOrderCount: number;
  averageTicket: number;
  completionRate: number;
  cancellationRate: number;
  services: { name: string; count: number; revenue: number }[];
}

function computeSample(orders: OrderRow[]): SampleStats {
  let completed = 0;
  let active = 0;
  let cancelled = 0;
  let gross = 0;
  const svc = new Map<string, { count: number; revenue: number }>();

  for (const o of orders) {
    const name = cleanName(o.service_name, 'Unknown service');
    const entry = svc.get(name) ?? { count: 0, revenue: 0 };
    entry.count += 1;
    if (o.status === 'COMPLETED') {
      completed += 1;
      const amount = num(o.total_amount);
      gross += amount;
      entry.revenue += amount;
    } else if (o.status === 'CANCELLED') {
      cancelled += 1;
    } else if (o.status === 'PENDING' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS') {
      active += 1;
    }
    svc.set(name, entry);
  }

  const total = orders.length;
  return {
    completedCount: completed,
    activeCount: active,
    cancelledCount: cancelled,
    loadedOrderCount: total,
    averageTicket: completed ? gross / completed : 0,
    completionRate: total ? (completed / total) * 100 : 0,
    cancellationRate: total ? (cancelled / total) * 100 : 0,
    services: [...svc.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6),
  };
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('overview');
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [online, setOnline] = useState(true);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [, startTransition] = useTransition();

  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const failuresRef = useRef(0);
  const snapRef = useRef<Snapshot>(EMPTY_SNAPSHOT);
  const lastFetchRef = useRef(0);

  /* Data loading: progressive, resilient, cache-backed */
  const run = useCallback(async (mode: 'initial' | 'silent' | 'manual') => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mode !== 'initial' && mountedRef.current) setRefreshing(true);

    const commit = (patch: Partial<Snapshot>) => {
      if (!mountedRef.current) return;
      snapRef.current = { ...snapRef.current, ...patch };
      setSnap(snapRef.current);
    };

    try {
      // Paint KPIs the moment the dashboard endpoint answers; the rest streams in after.
      const dashboardPromise = getAdminDashboard().then((value) => {
        commit({ dashboard: value ? (value as DashboardData) : null });
        if (mountedRef.current) setLoading(false);
        return value;
      });

      const [d, o, p, f] = await Promise.allSettled([
        dashboardPromise,
        getAdminOrders(undefined, ORDER_LIMIT, 0),
        getPricingRules(),
        adminFinance('30d'),
      ]);

      if (!mountedRef.current) return;

      const failed: string[] = [];
      const patch: Partial<Snapshot> = {};

      if (o.status === 'fulfilled') patch.orders = Array.isArray(o.value) ? (o.value as OrderRow[]) : [];
      else failed.push('orders');

      if (p.status === 'fulfilled') patch.pricingCount = Array.isArray(p.value) ? p.value.length : 0;
      else failed.push('pricing rules');

      if (f.status === 'fulfilled') patch.finance = f.value ? (f.value as FinanceSnapshot) : null;
      else failed.push('finance');

      commit(patch);

      if (d.status === 'rejected') {
        failuresRef.current += 1;
        const message =
          d.reason instanceof Error ? d.reason.message : 'Unable to load the admin dashboard. Please try again.';
        setError(message);
        if (mode === 'manual') toast.error(message);
        return;
      }

      failuresRef.current = failed.length ? failuresRef.current + 1 : 0;
      const stamp = Date.now();
      lastFetchRef.current = stamp;
      setError(null);
      setPartial(failed);
      setFromCache(false);
      setLastUpdated(new Date(stamp));
      writeCache(snapRef.current, stamp);

      if (mode === 'manual') {
        if (failed.length) toast.warning(`Updated, but ${failed.join(' and ')} could not be refreshed.`);
        else toast.success('Dashboard updated');
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const changeTab = useCallback((key: TabKey) => {
    startTransition(() => setTab(key));
    try {
      window.history.replaceState(null, '', `#${key}`);
    } catch {
      /* non-critical */
    }
  }, []);

  /* Mount: hydrate from cache, fetch, poll */
  useEffect(() => {
    mountedRef.current = true;
    setOnline(navigator.onLine);

    const hash = window.location.hash.slice(1) as TabKey;
    if (TAB_KEYS.includes(hash)) setTab(hash);

    const cached = readCache();
    if (cached) {
      snapRef.current = cached.snap;
      setSnap(cached.snap);
      setLastUpdated(new Date(cached.savedAt));
      setFromCache(true);
      setLoading(false);
    }
    void run(cached ? 'silent' : 'initial');

    let timer = 0;
    const schedule = () => {
      const delay = Math.min(POLL_MAX_MS, POLL_BASE_MS * 2 ** Math.min(failuresRef.current, 3));
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible' && navigator.onLine) await run('silent');
        if (mountedRef.current) schedule();
      }, delay);
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > 20_000) {
        void run('silent');
      }
    };
    const onOnline = () => {
      setOnline(true);
      void run('silent');
    };
    const onOffline = () => setOnline(false);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [run]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'r') void run('manual');
      else if (e.key === '1') changeTab('overview');
      else if (e.key === '2') changeTab('finance');
      else if (e.key === '3') changeTab('ops');
      else if (e.key === '/') {
        e.preventDefault();
        changeTab('ops');
        window.setTimeout(() => document.getElementById('ops-search')?.focus(), 60);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, changeTab]);

  /* Derived data */
  const dashboard = snap.dashboard;
  const orders = snap.orders;

  const ordersSeries = useMemo<Point[]>(
    () => (dashboard?.charts?.orders_daily ?? []).map((p) => ({ day: p.day, value: num(p.count) })),
    [dashboard],
  );
  const revenueSeries = useMemo<Point[]>(
    () => (dashboard?.charts?.revenue_daily ?? []).map((p) => ({ day: p.day, value: num(p.total) })),
    [dashboard],
  );
  const sample = useMemo(() => computeSample(orders), [orders]);

  const opsRows = useMemo(() => {
    const map = new Map<number, OrderRow>();
    for (const o of orders) map.set(o.id, o);
    for (const o of dashboard?.recent_orders ?? []) map.set(o.id, { ...map.get(o.id), ...o });
    return [...map.values()];
  }, [orders, dashboard]);

  const recentOrders = dashboard?.recent_orders ?? [];

  const handleSelect = useCallback((o: OrderRow) => setSelected(o), []);
  const closeDrawer = useCallback(() => setSelected(null), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const handleRefresh = useCallback(() => void run('manual'), [run]);

  const paletteItems = useMemo<PaletteItem[]>(
    () => [
      { id: 'tab-overview', group: 'View', label: 'Overview', hint: '1', run: () => changeTab('overview') },
      { id: 'tab-finance', group: 'View', label: 'Finance', hint: '2', run: () => changeTab('finance') },
      { id: 'tab-ops', group: 'View', label: 'Operations', hint: '3', run: () => changeTab('ops') },
      { id: 'refresh', group: 'Action', label: 'Refresh data', hint: 'R', keywords: 'reload update sync', run: () => void run('manual') },
      { id: 'export', group: 'Action', label: 'Export loaded orders to CSV', keywords: 'download spreadsheet', run: () => exportCsv(opsRows) },
      ...NAV_LINKS.map((l) => ({
        id: `go-${l.label.toLowerCase()}`,
        group: 'Go to',
        label: l.label,
        run: () => router.push(l.href),
      })),
    ],
    [changeTab, run, opsRows, router],
  );

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TAB_KEYS.indexOf(tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TAB_KEYS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TAB_KEYS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      changeTab(TAB_KEYS[next]);
      document.getElementById(`admin-tab-${TAB_KEYS[next]}`)?.focus();
    }
  };

  const hasData = dashboard !== null;
  const showEmpty = !loading && !hasData && !error;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <style>{STYLES}</style>

      <div className="aurotap-admin mx-auto w-full max-w-[1600px] space-y-5 px-3 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-700 text-white">
                <DropIcon />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">AuroTap admin</h1>
                <p className="mt-0.5 text-sm text-slate-500">Orders, revenue and field operations in one place.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="ad-btn min-w-[200px] justify-between text-slate-500"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command menu"
              >
                <span>Search or jump to</span>
                <Kbd>Ctrl K</Kbd>
              </button>

              <span
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2"
                role="status"
              >
                <span
                  className={`relative h-2 w-2 rounded-full ${online ? 'bg-emerald-500 ad-pulse' : 'bg-red-500'}`}
                  aria-hidden="true"
                />
                <span className={`text-xs font-semibold ${online ? 'text-emerald-800' : 'text-red-700'}`}>
                  {online ? (refreshing ? 'Syncing' : 'Live') : 'Offline'}
                </span>
                <UpdatedAgo date={lastUpdated} />
              </span>

              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh dashboard data"
              >
                {refreshing ? <span className="ad-spinner" aria-hidden="true" /> : <span aria-hidden="true">↻</span>}
                {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>

          <nav aria-label="Admin sections" className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {NAV_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="ad-btn">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="sticky top-0 z-30 -mx-3 border-b border-slate-200/80 bg-slate-50/85 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="flex gap-1 overflow-x-auto"
            onKeyDown={onTabKeyDown}
          >
            {TABS.map((item) => {
              const selectedTab = tab === item.key;
              const badge = item.key === 'ops' ? num(dashboard?.kpis.active_jobs) : 0;
              return (
                <button
                  key={item.key}
                  id={`admin-tab-${item.key}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab}
                  aria-controls={`admin-panel-${item.key}`}
                  tabIndex={selectedTab ? 0 : -1}
                  onClick={() => changeTab(item.key)}
                  className={`inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                    selectedTab ? 'bg-cyan-100 text-cyan-900' : 'text-slate-500 hover:bg-white hover:text-slate-800'
                  }`}
                >
                  {item.label}
                  {badge > 0 && (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-cyan-800 ring-1 ring-inset ring-cyan-200">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {!online && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You're offline. Showing the last data we have; the dashboard will refresh automatically when you reconnect.
          </div>
        )}

        {error && hasData && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
              We couldn't refresh the dashboard, so you're seeing older data. We'll keep retrying automatically.
            </span>
            <button type="button" className="ad-btn" onClick={handleRefresh} disabled={refreshing}>
              Retry now
            </button>
          </div>
        )}

        {error && !hasData && (
          <section className="space-y-3" role="alert" aria-label="Dashboard loading error">
            <DatabaseErrorBanner message={error} />
            <button type="button" className="ad-btn" onClick={() => void run('manual')} disabled={refreshing}>
              Retry loading dashboard
            </button>
          </section>
        )}

        {!error && partial.length > 0 && hasData && (
          <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Some data didn't load: {partial.join(', ')}. Other sections are up to date.
          </div>
        )}

        {fromCache && hasData && !error && refreshing && (
          <p className="text-xs text-slate-400" role="status">
            Showing your last session while fresh data loads.
          </p>
        )}

        {loading && !hasData && <LoadingSkeleton />}

        {showEmpty && (
          <SectionCard>
            <EmptyState
              title="No dashboard data yet"
              message="The dashboard API returned nothing. Check that the service is running, then reload."
              action={
                <button type="button" className="ad-btn ad-btn-primary" onClick={() => void run('manual')}>
                  Reload dashboard
                </button>
              }
            />
          </SectionCard>
        )}

        {hasData && dashboard && (
          <div
            id={`admin-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`admin-tab-${tab}`}
            tabIndex={-1}
            className="space-y-5 outline-none"
          >
            {dashboard.kpis.attention && <AdminAttentionQueue attention={dashboard.kpis.attention} />}

            {tab === 'overview' && (
              <OverviewPanel
                kpis={dashboard.kpis}
                ordersSeries={ordersSeries}
                revenueSeries={revenueSeries}
                services={sample.services}
                recentOrders={recentOrders}
                pricingCount={snap.pricingCount}
                onSelect={handleSelect}
              />
            )}

            {tab === 'finance' && (
              <FinancePanel
                finance={snap.finance}
                sample={sample}
                pricingCount={snap.pricingCount}
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            )}

            {tab === 'ops' && (
              <OpsPanel
                kpis={dashboard.kpis}
                rows={opsRows}
                recentCount={recentOrders.length}
                onSelect={handleSelect}
                onExport={exportCsv}
              />
            )}
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Kbd>Ctrl K</Kbd> command menu</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>R</Kbd> refresh</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd> switch tab</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>/</Kbd> search orders</span>
        </footer>
      </div>

      {selected && <OrderDrawer order={selected} onClose={closeDrawer} />}
      {paletteOpen && <CommandPalette items={paletteItems} onClose={closePalette} />}
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

