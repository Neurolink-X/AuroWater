// src/app/admin/local-intelligence/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

/* =============================================================
   TYPES (same data your API already returns)
   ============================================================= */
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

type StockSummary = {
  dataAvailable: boolean;
  eligibleSuppliers: number;
  suppliersWithStockRecord: number;
  suppliersWithUsableStock: number;
  lowStockSuppliers: number;
  totalCansAvailable: number | null;
  totalReservedCans: number | null;
  totalBufferCans: number | null;
};

type SupplierOutcome = {
  supplierId: string;
  supplierName: string;
  city: string;
  assignedOrders: number;
  completedOrders: number;
  cancelledOrFailedOrders: number;
  completionRate: number;
  averageRating: number | null;
  ratedOrders: number;
};

type SupplierStock = {
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
  stockSummary: StockSummary;
  supplierOutcomes: SupplierOutcome[];
  stockBySupplier: SupplierStock[];
  timezone: string;
  warnings: string[];
  generatedAt: string;
  /** Optional: sent by the upgraded API route. Old route works too. */
  meta?: {
    queryMs?: number;
    partial?: boolean;
  };
};

type ApiResponse = {
  ok?: boolean;
  data?: Summary;
  error?: string;
  message?: string;
};

/* =============================================================
   SETTINGS
   ============================================================= */
const REFRESH_MS = 30_000;
// When you come back to the tab, skip the refresh if data is fresher than this.
const MIN_GAP_MS = 10_000;
const ROW_LIMIT = 30;
const DAY_OPTIONS = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;

/* =============================================================
   HELPERS
   ============================================================= */
// Created once, reused (faster than building a formatter every render).
const INR = new Intl.NumberFormat('en-IN');
const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const count = (n: number) => INR.format(n);

const clock = (n: number) => `${n % 12 || 12}:00 ${n % 24 >= 12 ? 'PM' : 'AM'}`;

const hourLabel = (hour: number | null) =>
  hour === null
    ? 'Not enough timestamp data'
    : `${clock(hour)}–${clock(hour + 1)}`;

function timeAgo(from: number, now: number) {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** Safe CSV cell. Also blocks Excel formula tricks like "=SUM(...)". */
function csvCell(value: string | number | boolean) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/* =============================================================
   COLORS WITH MEANING
   cyan = information, green = healthy, amber = review, rose = act now
   ============================================================= */
const TONE = {
  cyan: {
    card: 'border-cyan-400/20 bg-cyan-400/[0.05]',
    text: 'text-cyan-200',
    dot: 'bg-cyan-400',
    badge: 'bg-cyan-300/10 text-cyan-200',
  },
  emerald: {
    card: 'border-emerald-400/20 bg-emerald-400/[0.05]',
    text: 'text-emerald-200',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-300/10 text-emerald-200',
  },
  amber: {
    card: 'border-amber-400/25 bg-amber-400/[0.06]',
    text: 'text-amber-200',
    dot: 'bg-amber-400',
    badge: 'bg-amber-300/10 text-amber-200',
  },
  rose: {
    card: 'border-rose-400/25 bg-rose-400/[0.06]',
    text: 'text-rose-200',
    dot: 'bg-rose-400',
    badge: 'bg-rose-300/10 text-rose-200',
  },
} as const;

type Tone = keyof typeof TONE;

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[tone].badge}`}
    >
      {children}
    </span>
  );
}

/* =============================================================
   WATER LOADING SKELETON (CSS only, same feel as admin loading)
   ============================================================= */
const PAGE_CSS = `
  @keyframes li-flow  { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @keyframes li-drop  { 0%,100% { transform: translate3d(0,-2px,0); } 50% { transform: translate3d(0,3px,0) scale(1.06,.94); } }
  @keyframes li-ring  { 0% { transform: scale(.6); opacity: .7; } 100% { transform: scale(1.8); opacity: 0; } }
  @keyframes li-spin  { to { transform: rotate(360deg); } }

  .li-skel {
    background-color: rgba(255,255,255,.06);
    background-image: linear-gradient(110deg, rgba(255,255,255,0) 30%, rgba(34,211,238,.16) 48%, rgba(96,165,250,.16) 52%, rgba(255,255,255,0) 70%);
    background-size: 200% 100%;
    animation: li-flow 1.8s linear infinite;
    border-radius: .75rem;
  }
  .li-drop { animation: li-drop 1.8s ease-in-out infinite; }
  .li-ring { animation: li-ring 2.4s ease-out infinite; }
  .li-spin { animation: li-spin .9s linear infinite; }

  @media (prefers-reduced-motion: reduce) {
    .li-skel, .li-drop, .li-ring, .li-spin { animation: none !important; }
  }
`;

function Skel({ className = '' }: { className?: string }) {
  return <div className={`li-skel ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div
      className="mt-6 space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Loading operational signals"
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center" aria-hidden="true">
          <span className="li-ring absolute inset-0 rounded-full border border-cyan-400/50" />
          <span
            className="li-ring absolute inset-0 rounded-full border border-cyan-400/30"
            style={{ animationDelay: '1s' }}
          />
          <svg viewBox="0 0 24 24" className="li-drop relative h-7 w-7">
            <path
              d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5Z"
              fill="#22d3ee"
            />
          </svg>
        </div>
        <p className="text-sm text-slate-300">Reading live order and coverage signals…</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skel key={i} className="h-28 border border-white/10" />
        ))}
      </div>
      <Skel className="h-64 border border-white/10" />
      <Skel className="h-64 border border-white/10" />
    </div>
  );
}

/* =============================================================
   SMALL BUILDING BLOCKS
   ============================================================= */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="sticky top-0 z-10 bg-slate-900 px-3 py-3 font-semibold sm:px-4"
    >
      {children}
    </th>
  );
}

function Toolbar({
  search,
  onSearch,
  placeholder,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/40 sm:max-w-xs"
      />
      {children}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-lg border px-3 text-xs font-semibold transition ${
        active
          ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function ShowMore({
  total,
  shown,
  expanded,
  onToggle,
}: {
  total: number;
  shown: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (total <= ROW_LIMIT) {
    return (
      <p className="px-4 py-3 text-xs text-slate-500 sm:px-5">
        Showing {count(shown)} of {count(total)}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <p className="text-xs text-slate-500">
        Showing {count(shown)} of {count(total)}
      </p>
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
      >
        {expanded ? 'Show fewer' : `Show all ${count(total)}`}
      </button>
    </div>
  );
}

/* =============================================================
   PAGE
   ============================================================= */
export default function LocalIntelligencePage() {
  const [days, setDays] = useState<number>(DEFAULT_DAYS);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);

  // Table controls
  const [pinSearch, setPinSearch] = useState('');
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [outcomeSearch, setOutcomeSearch] = useState('');
  const [showAllPins, setShowAllPins] = useState(false);
  const [showAllStock, setShowAllStock] = useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchRef = useRef(0);
  const hasLoadedRef = useRef(false);

  /* ---------------------------------------------------------
     LOAD DATA
     - Only the newest request is allowed to update the screen
       (an old slow answer can never overwrite a new one).
     - If a refresh fails, the last good data stays visible.
     --------------------------------------------------------- */
  const load = useCallback(async (mode: 'initial' | 'refresh', windowDays: number) => {
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    const requestId = ++requestIdRef.current;

    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Your admin session is unavailable. Sign in again.');

      const response = await fetch(`/api/admin/local-intelligence?days=${windowDays}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });

      const json = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? json?.message ?? 'Could not load local intelligence.');
      }

      if (requestId !== requestIdRef.current) return;

      hasLoadedRef.current = true;
      lastFetchRef.current = Date.now();
      setSummary(json.data);
      setLastUpdated(Date.parse(json.data.generatedAt) || Date.now());
      setError('');
    } catch (e) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load local intelligence.');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /*
   * First load + live updates.
   * - Every 30 seconds, only while the tab is visible and online.
   * - When you come back to the tab (if data is older than 10 seconds).
   * - When the internet comes back.
   */
  useEffect(() => {
    void load(hasLoadedRef.current ? 'refresh' : 'initial', days);

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (!navigator.onLine) return;
      void load('refresh', days);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchRef.current < MIN_GAP_MS) return;
      tick();
    };

    const onOnline = () => {
      setOnline(true);
      tick();
    };
    const onOffline = () => setOnline(false);

    setOnline(navigator.onLine);

    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [days, load]);

  // Stop any request still running when leaving the page.
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  // Keeps "Updated 12s ago" alive.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  /* ---------------------------------------------------------
     SIGNALS: plain facts picked out of the data.
     (No ranking, no automatic action. Same read-only promise.)
     --------------------------------------------------------- */
  const insights = useMemo(() => {
    if (!summary) return [];

    const list: Array<{ tone: Tone; title: string; text: string }> = [];

    const gapPins = summary.demandByPincode.filter((row) => row.coverageGap);
    if (gapPins.length > 0) {
      const top = gapPins
        .slice(0, 3)
        .map((row) => row.pincode)
        .join(', ');
      list.push({
        tone: 'amber',
        title: `${count(gapPins.length)} PIN code${gapPins.length === 1 ? '' : 's'} to review`,
        text: `Orders are coming in, but approved coverage looks thin. Start with ${top}.`,
      });
    }

    if (summary.unassignedOrders > 0) {
      list.push({
        tone: summary.unassignedOrders >= 5 ? 'rose' : 'amber',
        title: `${count(summary.unassignedOrders)} pending without a supplier`,
        text: 'Check these in Dispatch. A waiting customer is the fastest way to lose trust.',
      });
    }

    if (summary.cancellationRate >= 10) {
      list.push({
        tone: summary.cancellationRate >= 20 ? 'rose' : 'amber',
        title: `Cancel / failure rate is ${summary.cancellationRate}%`,
        text: 'Open the PIN table and look for areas where cancellations repeat.',
      });
    }

    const stock = summary.stockSummary;
    if (stock.dataAvailable) {
      if (stock.lowStockSuppliers > 0) {
        list.push({
          tone: 'amber',
          title: `${count(stock.lowStockSuppliers)} supplier${stock.lowStockSuppliers === 1 ? '' : 's'} low on cans`,
          text: 'Confirm refills before the busiest hour.',
        });
      }

      const missingRecord = stock.eligibleSuppliers - stock.suppliersWithStockRecord;
      if (missingRecord > 0) {
        list.push({
          tone: 'cyan',
          title: `${count(missingRecord)} eligible supplier${missingRecord === 1 ? ' has' : 's have'} no stock row`,
          text: 'Their stock is not tracked, so totals here may look smaller than reality.',
        });
      }
    }

    if (list.length === 0) {
      list.push({
        tone: 'emerald',
        title: 'No immediate signals',
        text: 'Coverage, stock and assignments look steady for this window.',
      });
    }

    return list;
  }, [summary]);

  /* ---------------------------------------------------------
     TABLE DATA (filtered)
     --------------------------------------------------------- */
  const pinRows = useMemo(() => {
    if (!summary) return [];
    const q = pinSearch.trim().toLowerCase();

    return summary.demandByPincode.filter(
      (row) =>
        (!onlyGaps || row.coverageGap) &&
        (!q || row.pincode.includes(q) || row.city.toLowerCase().includes(q)),
    );
  }, [summary, pinSearch, onlyGaps]);

  const stockRows = useMemo(() => {
    if (!summary) return [];
    const q = stockSearch.trim().toLowerCase();

    return summary.stockBySupplier.filter((row) => {
      const needsAttention =
        !row.stockConfigured || row.lowStock === true || (row.dispatchableCans ?? 0) === 0;

      return (
        (!onlyAttention || needsAttention) &&
        (!q ||
          row.supplierName.toLowerCase().includes(q) ||
          row.city.toLowerCase().includes(q) ||
          row.pincodes.some((pin) => pin.includes(q)))
      );
    });
  }, [summary, stockSearch, onlyAttention]);

  const outcomeRows = useMemo(() => {
    if (!summary) return [];
    const q = outcomeSearch.trim().toLowerCase();

    return summary.supplierOutcomes.filter(
      (row) =>
        !q || row.supplierName.toLowerCase().includes(q) || row.city.toLowerCase().includes(q),
    );
  }, [summary, outcomeSearch]);

  /* ---------------------------------------------------------
     EXPORT: the PIN table you are looking at, as a CSV file
     --------------------------------------------------------- */
  const exportPins = useCallback(() => {
    if (!summary) return;

    const head = [
      'PIN code',
      'City / area',
      'Orders',
      'Cancelled',
      'Cancel rate %',
      'Mapped suppliers',
      'Pending without supplier',
      'Coverage signal',
    ];

    const lines = pinRows.map((row) =>
      [
        row.pincode,
        row.city,
        row.orders,
        row.cancelled,
        row.cancellationRate,
        row.mappedSuppliers,
        row.unassignedOrders,
        row.coverageGap ? 'Review coverage' : 'No immediate signal',
      ]
        .map(csvCell)
        .join(','),
    );

    const csv = '\uFEFF' + [head.map(csvCell).join(','), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = `pincode-demand-${summary.windowDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [summary, pinRows]);

  /* ---------------------------------------------------------
     KPI CARDS
     --------------------------------------------------------- */
  const kpis = useMemo(() => {
    if (!summary) return [];

    const cancelTone: Tone =
      summary.cancellationRate >= 20 ? 'rose' : summary.cancellationRate >= 10 ? 'amber' : 'emerald';
    const unassignedTone: Tone =
      summary.unassignedOrders >= 5 ? 'rose' : summary.unassignedOrders > 0 ? 'amber' : 'emerald';

    return [
      {
        label: 'Orders reviewed',
        value: count(summary.ordersReviewed),
        note: `Latest ${summary.windowDays}-day records`,
        tone: 'cyan' as Tone,
        small: false,
      },
      {
        label: 'Cancel / failure rate',
        value: `${summary.cancellationRate}%`,
        note: `${count(summary.cancelledOrders)} cancelled or failed`,
        tone: cancelTone,
        small: false,
      },
      {
        label: 'Unassigned pending',
        value: count(summary.unassignedOrders),
        note: 'Pending orders without supplier',
        tone: unassignedTone,
        small: false,
      },
      {
        label: 'Peak order hour',
        value: hourLabel(summary.peakHour),
        note: `${count(summary.peakHourOrders)} orders in busiest hour`,
        tone: 'cyan' as Tone,
        small: true,
      },
      {
        label: 'Repeat customers',
        value: count(summary.repeatCustomers),
        note: `${summary.repeatCustomerRate}% of customers ordered 2+ times in this window`,
        tone: 'cyan' as Tone,
        small: false,
      },
    ];
  }, [summary]);

  const live = online && !error;
  const windowLabel = summary?.windowDays ?? days;
  const stale = refreshing && summary !== null;

  /* =========================================================
     RENDER
     (The admin shell already provides <main>, background and
     padding, so this page uses a plain <div>.)
     ========================================================= */
  return (
    <div className="mx-auto max-w-7xl" aria-busy={loading || refreshing}>
      <style>{PAGE_CSS}</style>

      {/* ---------- Top bar ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/dashboard"
          className="text-sm text-cyan-300 transition hover:text-cyan-200"
        >
          ← Admin dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live status */}
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              live
                ? 'border-emerald-400/15 bg-emerald-400/5 text-emerald-300'
                : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
            }`}
            role="status"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {!online
              ? 'Offline'
              : error
                ? 'Update failed'
                : lastUpdated
                  ? `Live · updated ${timeAgo(lastUpdated, now)}`
                  : 'Live'}
          </div>

          <button
            type="button"
            onClick={() => void load('refresh', days)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/5 disabled:opacity-50"
          >
            {refreshing && (
              <span
                aria-hidden="true"
                className="li-spin h-3.5 w-3.5 rounded-full border-2 border-cyan-300 border-t-transparent"
              />
            )}
            {refreshing ? 'Refreshing…' : 'Refresh insights'}
          </button>
        </div>
      </div>

      {/* ---------- Header ---------- */}
      <header className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
          AuroTap Operations · Read-only intelligence
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Local Intelligence Engine
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Use actual order and approved coverage data to spot demand hotspots, cancellation
          patterns, unassigned orders, and PIN codes that may need more supplier capacity.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
            role="group"
            aria-label="Reporting window"
          >
            {DAY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                aria-pressed={days === option}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  days === option
                    ? 'bg-cyan-400/20 text-cyan-100'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {option} days
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400">
            Last {windowLabel} days · India Standard Time · No automatic supplier ranking or
            dispatch changes.
          </p>
        </div>
      </header>

      {/* ---------- Errors ---------- */}
      {error && (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100"
        >
          <div>
            <p>{error}</p>
            {summary && lastUpdated && (
              <p className="mt-1 text-xs text-rose-200/80">
                Showing the last good data from {timeAgo(lastUpdated, now)}.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load(summary ? 'refresh' : 'initial', days)}
            className="rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs font-semibold transition hover:bg-rose-300/10"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !summary && <LoadingSkeleton />}

      {summary && (
        <div
          className={`transition-opacity duration-300 ${stale ? 'opacity-70' : 'opacity-100'}`}
        >
          {/* ---------- Warnings ---------- */}
          {summary.warnings.length > 0 && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
            >
              <strong>Partial data:</strong>
              <ul className="mt-2 list-disc pl-5">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.dataLimited && (
            <div
              role="status"
              className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"
            >
              The report reached its 1,000-order cap. Counts describe the latest records returned,
              not necessarily every order in the full {summary.windowDays}-day window.
            </div>
          )}

          {/* ---------- Signals ---------- */}
          <section aria-label="Signals to review" className="mt-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              What needs your eyes today
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((item) => (
                <article
                  key={item.title}
                  className={`rounded-2xl border p-4 ${TONE[item.tone].card}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${TONE[item.tone].dot}`} />
                    <p className={`text-sm font-bold ${TONE[item.tone].text}`}>{item.title}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{item.text}</p>
                </article>
              ))}
            </div>
          </section>

          {/* ---------- KPI cards ---------- */}
          <section
            aria-label="Demand overview"
            className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            {kpis.map((card) => (
              <article
                key={card.label}
                className={`rounded-2xl border p-5 ${TONE[card.tone].card}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[card.tone].dot}`} />
                </div>
                <p
                  className={`mt-2 font-bold tracking-tight text-white tabular-nums ${
                    card.small ? 'text-lg leading-7' : 'text-2xl'
                  }`}
                >
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-slate-400">{card.note}</p>
              </article>
            ))}
          </section>

          {/* ---------- Supplier stock ---------- */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div>
                <h2 className="text-lg font-bold">Supplier stock visibility</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-400">
                  Available after reservations and buffer = cans available − reserved cans −
                  reservation buffer. This is a stock snapshot, not a promise that a supplier is
                  online or eligible for every service.
                </p>
              </div>
              {!summary.stockSummary.dataAvailable && (
                <Badge tone="rose">Stock data unavailable</Badge>
              )}
            </div>

            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Eligible suppliers',
                  value: count(summary.stockSummary.eligibleSuppliers),
                  tone: 'cyan' as Tone,
                },
                {
                  label: 'With usable stock',
                  value: count(summary.stockSummary.suppliersWithUsableStock),
                  tone: 'emerald' as Tone,
                },
                {
                  label: 'Low stock',
                  value: count(summary.stockSummary.lowStockSuppliers),
                  tone: (summary.stockSummary.lowStockSuppliers > 0 ? 'amber' : 'emerald') as Tone,
                },
                {
                  label: 'Available cans',
                  value:
                    summary.stockSummary.totalCansAvailable === null
                      ? '—'
                      : count(
                          Math.max(
                            0,
                            summary.stockSummary.totalCansAvailable -
                              (summary.stockSummary.totalReservedCans ?? 0) -
                              (summary.stockSummary.totalBufferCans ?? 0),
                          ),
                        ),
                  tone: 'cyan' as Tone,
                },
              ].map((card) => (
                <article
                  key={card.label}
                  className="rounded-xl border border-white/10 bg-black/10 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">{card.label}</p>
                    <span className={`h-1.5 w-1.5 rounded-full ${TONE[card.tone].dot}`} />
                  </div>
                  <p className="mt-1 text-xl font-bold tabular-nums">{card.value}</p>
                </article>
              ))}
            </div>

            <div className="border-t border-white/10">
              <Toolbar
                search={stockSearch}
                onSearch={(value) => {
                  setStockSearch(value);
                  setShowAllStock(false);
                }}
                placeholder="Search supplier, city or PIN"
              >
                <ChipButton
                  active={onlyAttention}
                  onClick={() => {
                    setOnlyAttention((value) => !value);
                    setShowAllStock(false);
                  }}
                >
                  Needs attention
                </ChipButton>
              </Toolbar>

              {stockRows.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">
                  {summary.stockBySupplier.length === 0
                    ? 'No dispatch-eligible supplier profiles were returned.'
                    : 'No suppliers match this filter.'}
                </p>
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <caption className="sr-only">Supplier stock</caption>
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        {[
                          'Supplier',
                          'City',
                          'Approved coverage PINs',
                          'Available cans',
                          'Reserved',
                          'Buffer',
                          'Usable stock',
                          'Stock status',
                        ].map((label) => (
                          <Th key={label}>{label}</Th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(showAllStock ? stockRows : stockRows.slice(0, ROW_LIMIT)).map((row) => (
                        <tr key={row.supplierId} className="transition hover:bg-white/[0.03]">
                          <td className="px-3 py-3 font-semibold sm:px-4">{row.supplierName}</td>
                          <td className="px-3 py-3 sm:px-4">{row.city || '—'}</td>
                          <td className="px-3 py-3 font-mono text-xs sm:px-4">
                            {row.pincodes.join(', ') || 'No active zone mapping'}
                          </td>
                          <td className="px-3 py-3 tabular-nums sm:px-4">
                            {row.stockConfigured ? count(row.cansAvailable ?? 0) : 'Not configured'}
                          </td>
                          <td className="px-3 py-3 tabular-nums sm:px-4">
                            {row.stockConfigured ? count(row.reservedCans ?? 0) : '—'}
                          </td>
                          <td className="px-3 py-3 tabular-nums sm:px-4">
                            {row.stockConfigured ? count(row.bufferCans ?? 0) : '—'}
                          </td>
                          <td className="px-3 py-3 font-semibold tabular-nums sm:px-4">
                            {row.dispatchableCans === null ? '—' : count(row.dispatchableCans)}
                          </td>
                          <td className="px-3 py-3 sm:px-4">
                            {!row.stockConfigured ? (
                              <span className="text-xs text-slate-400">No stock row</span>
                            ) : row.lowStock ? (
                              <Badge tone="amber">Low stock</Badge>
                            ) : (row.dispatchableCans ?? 0) > 0 ? (
                              <Badge tone="emerald">Stock available</Badge>
                            ) : (
                              <Badge tone="rose">No usable stock</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {stockRows.length > 0 && (
                <ShowMore
                  total={stockRows.length}
                  shown={showAllStock ? stockRows.length : Math.min(ROW_LIMIT, stockRows.length)}
                  expanded={showAllStock}
                  onToggle={() => setShowAllStock((value) => !value)}
                />
              )}
            </div>
          </section>

          {/* ---------- Supplier outcomes ---------- */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="p-5">
              <h2 className="text-lg font-bold">Supplier outcomes — assigned orders only</h2>
              <p className="mt-1 max-w-4xl text-sm text-slate-400">
                Shows completed work and customer ratings for orders actually assigned in the
                reporting window. Suppliers being offline or unavailable is not counted as poor
                performance. Cancellation/failure is a review signal only because customer-initiated
                cancellations may also be included. Do not use this table as an automatic penalty or
                ranking rule.
              </p>
            </div>

            {summary.supplierOutcomes.length === 0 ? (
              <p className="border-t border-white/10 p-5 text-sm text-slate-400">
                No assigned supplier orders were found in this window.
              </p>
            ) : (
              <div className="border-t border-white/10">
                <Toolbar
                  search={outcomeSearch}
                  onSearch={(value) => {
                    setOutcomeSearch(value);
                    setShowAllOutcomes(false);
                  }}
                  placeholder="Search supplier or city"
                />

                {outcomeRows.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400">No suppliers match this search.</p>
                ) : (
                  <div className="max-h-[28rem] overflow-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <caption className="sr-only">Supplier outcomes</caption>
                      <thead className="text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          {[
                            'Supplier',
                            'City',
                            'Assigned',
                            'Completed',
                            'Completion rate',
                            'Cancelled / failed',
                            'Average rating',
                          ].map((label) => (
                            <Th key={label}>{label}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(showAllOutcomes ? outcomeRows : outcomeRows.slice(0, ROW_LIMIT)).map(
                          (row) => (
                            <tr key={row.supplierId} className="transition hover:bg-white/[0.03]">
                              <td className="px-3 py-3 font-semibold sm:px-4">{row.supplierName}</td>
                              <td className="px-3 py-3 sm:px-4">{row.city || '—'}</td>
                              <td className="px-3 py-3 tabular-nums sm:px-4">
                                {count(row.assignedOrders)}
                              </td>
                              <td className="px-3 py-3 tabular-nums sm:px-4">
                                {count(row.completedOrders)}
                              </td>
                              <td className="px-3 py-3 tabular-nums sm:px-4">
                                {row.completionRate}%
                              </td>
                              <td className="px-3 py-3 tabular-nums sm:px-4">
                                {count(row.cancelledOrFailedOrders)}
                              </td>
                              <td className="px-3 py-3 sm:px-4">
                                {row.averageRating === null
                                  ? 'Not rated'
                                  : `${row.averageRating.toFixed(2)} / 5 (${count(row.ratedOrders)})`}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {outcomeRows.length > 0 && (
                  <ShowMore
                    total={outcomeRows.length}
                    shown={
                      showAllOutcomes ? outcomeRows.length : Math.min(ROW_LIMIT, outcomeRows.length)
                    }
                    expanded={showAllOutcomes}
                    onToggle={() => setShowAllOutcomes((value) => !value)}
                  />
                )}
              </div>
            )}
          </section>

          {/* ---------- PIN demand ---------- */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="p-5">
              <h2 className="text-lg font-bold">PIN-code demand and coverage signals</h2>
              <p className="mt-1 max-w-4xl text-sm text-slate-400">
                Coverage counts include active/approved supplier profiles mapped to zones marked
                Available or Limited. They are signals, not a guarantee of live stock or a bookable
                slot.
              </p>
            </div>

            {summary.demandByPincode.length === 0 ? (
              <p className="border-t border-white/10 p-6 text-sm text-slate-400">
                No valid PIN-code data was found in the reviewed orders.
              </p>
            ) : (
              <div className="border-t border-white/10">
                <Toolbar
                  search={pinSearch}
                  onSearch={(value) => {
                    setPinSearch(value);
                    setShowAllPins(false);
                  }}
                  placeholder="Search PIN code or city"
                >
                  <ChipButton
                    active={onlyGaps}
                    onClick={() => {
                      setOnlyGaps((value) => !value);
                      setShowAllPins(false);
                    }}
                  >
                    Coverage review only
                  </ChipButton>
                  <button
                    type="button"
                    onClick={exportPins}
                    disabled={pinRows.length === 0}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50 sm:ml-auto"
                  >
                    Export CSV
                  </button>
                </Toolbar>

                {pinRows.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400">No PIN codes match this filter.</p>
                ) : (
                  <div className="max-h-[28rem] overflow-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <caption className="sr-only">PIN-code demand and coverage</caption>
                      <thead className="text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          {[
                            'PIN code',
                            'City / area',
                            'Orders',
                            'Cancelled',
                            'Cancel rate',
                            'Mapped suppliers',
                            'Pending without supplier',
                            'Signal',
                          ].map((label) => (
                            <Th key={label}>{label}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(showAllPins ? pinRows : pinRows.slice(0, ROW_LIMIT)).map((row) => (
                          <tr
                            key={row.pincode}
                            className={`transition hover:bg-white/[0.03] ${
                              row.coverageGap ? 'bg-amber-400/[0.04]' : ''
                            }`}
                          >
                            <td className="px-3 py-3 font-mono font-semibold sm:px-4">
                              {row.pincode}
                            </td>
                            <td className="px-3 py-3 sm:px-4">{row.city}</td>
                            <td className="px-3 py-3 tabular-nums sm:px-4">{count(row.orders)}</td>
                            <td className="px-3 py-3 tabular-nums sm:px-4">
                              {count(row.cancelled)}
                            </td>
                            <td className="px-3 py-3 tabular-nums sm:px-4">
                              {row.cancellationRate}%
                            </td>
                            <td className="px-3 py-3 tabular-nums sm:px-4">
                              {count(row.mappedSuppliers)}
                            </td>
                            <td className="px-3 py-3 tabular-nums sm:px-4">
                              {count(row.unassignedOrders)}
                            </td>
                            <td className="px-3 py-3 sm:px-4">
                              {row.coverageGap ? (
                                <Badge tone="amber">Review coverage</Badge>
                              ) : (
                                <span className="text-xs text-emerald-200">
                                  No immediate signal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pinRows.length > 0 && (
                  <ShowMore
                    total={pinRows.length}
                    shown={showAllPins ? pinRows.length : Math.min(ROW_LIMIT, pinRows.length)}
                    expanded={showAllPins}
                    onToggle={() => setShowAllPins((value) => !value)}
                  />
                )}
              </div>
            )}
          </section>

          {/* ---------- Service mix + data quality ---------- */}
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-bold">Service mix</h2>
              <p className="mt-1 text-sm text-slate-400">
                Most frequently booked service types in the reviewed records.
              </p>

              <div className="mt-4 space-y-3">
                {summary.serviceMix.slice(0, 8).map((item) => {
                  const share = summary.ordersReviewed
                    ? (item.orders / summary.ordersReviewed) * 100
                    : 0;
                  const width = summary.ordersReviewed ? Math.max(3, share) : 0;

                  return (
                    <div key={item.service}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="break-all">{item.service}</span>
                        <span className="shrink-0 text-slate-300 tabular-nums">
                          {count(item.orders)}
                          <span className="ml-1 text-xs text-slate-500">
                            ({Math.round(share)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {summary.serviceMix.length === 0 && (
                  <p className="text-sm text-slate-400">No service data available.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="text-lg font-bold">Data quality and next actions</h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Orders with valid PIN</dt>
                  <dd className="font-semibold tabular-nums">{count(summary.ordersWithPincode)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Orders without valid PIN</dt>
                  <dd
                    className={`font-semibold tabular-nums ${
                      summary.ordersWithoutPincode > 0 ? 'text-amber-200' : ''
                    }`}
                  >
                    {count(summary.ordersWithoutPincode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Report timezone</dt>
                  <dd className="font-semibold">{summary.timezone}</dd>
                </div>
              </dl>

              <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300">
                <strong className="text-cyan-200">How to use this safely:</strong> investigate
                repeated cancellations and coverage gaps, verify current stock and supplier
                availability, then decide whether to recruit suppliers. This report never changes
                assignment, payout, eligibility, or serviceability.
              </div>
            </article>
          </section>

          <p className="mt-4 text-xs text-slate-500">
            Generated {dateTimeFmt.format(new Date(summary.generatedAt))} IST (
            {timeFmt.format(new Date(summary.generatedAt))})
            {summary.meta?.queryMs !== undefined && ` · built in ${count(summary.meta.queryMs)} ms`}
            . Operational signals can be incomplete if address snapshots or coverage mappings are
            missing.
          </p>
        </div>
      )}
    </div>
  );
}











// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import Link from 'next/link';
// import { getToken } from '@/lib/api-client';

// type DemandRow = {
//   pincode: string;
//   city: string;
//   orders: number;
//   cancelled: number;
//   cancellationRate: number;
//   assignedOrders: number;
//   unassignedOrders: number;
//   mappedSuppliers: number;
//   coverageGap: boolean;
// };
// type Summary = {
//   windowDays: number;
//   ordersReviewed: number;
//   uniqueCustomers: number;
//   repeatCustomers: number;
//   repeatCustomerRate: number;
//   ordersWithPincode: number;
//   ordersWithoutPincode: number;
//   cancelledOrders: number;
//   cancellationRate: number;
//   unassignedOrders: number;
//   peakHour: number | null;
//   peakHourOrders: number;
//   demandByPincode: DemandRow[];
//   serviceMix: Array<{ service: string; orders: number }>;
//   dataLimited: boolean;
//   stockSummary: {
//     dataAvailable: boolean;
//     eligibleSuppliers: number;
//     suppliersWithStockRecord: number;
//     suppliersWithUsableStock: number;
//     lowStockSuppliers: number;
//     totalCansAvailable: number | null;
//     totalReservedCans: number | null;
//     totalBufferCans: number | null;
//   };
//   supplierOutcomes: Array<{
//     supplierId: string;
//     supplierName: string;
//     city: string;
//     assignedOrders: number;
//     completedOrders: number;
//     cancelledOrFailedOrders: number;
//     completionRate: number;
//     averageRating: number | null;
//     ratedOrders: number;
//   }>;
//   stockBySupplier: Array<{
//     supplierId: string;
//     supplierName: string;
//     city: string;
//     pincodes: string[];
//     cansAvailable: number | null;
//     reservedCans: number | null;
//     bufferCans: number | null;
//     dispatchableCans: number | null;
//     lowStock: boolean | null;
//     stockConfigured: boolean;
//   }>;
//   timezone: string;
//   warnings: string[];
//   generatedAt: string;
// };

// const number = new Intl.NumberFormat('en-IN');
// const count = (n: number) => number.format(n);
// const hourLabel = (hour: number | null) => hour === null
//   ? 'Not enough timestamp data'
//   : `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}–${(hour + 1) % 12 || 12}:00 ${(hour + 1) % 24 >= 12 ? 'PM' : 'AM'}`;

// export default function LocalIntelligencePage() {
//   const [summary, setSummary] = useState<Summary | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState('');
//   const [lastUpdated, setLastUpdated] = useState<string | null>(null);

//   const load = useCallback(async (refresh = false) => {
//     setError('');
//     refresh ? setRefreshing(true) : setLoading(true);
//     try {
//       const token = await getToken();
//       if (!token) throw new Error('Your admin session is unavailable. Sign in again.');
//       const response = await fetch('/api/admin/local-intelligence?days=30', {
//         headers: { Authorization: `Bearer ${token}` },
//         cache: 'no-store',
//       });
//       const json = await response.json() as { ok?: boolean; data?: Summary; error?: string; message?: string };
//       if (!response.ok || !json.data) {
//         throw new Error(json.error ?? json.message ?? 'Could not load local intelligence.');
//       }
//       setSummary(json.data);
//       setLastUpdated(json.data.generatedAt);
//     } catch (e) {
//       setError(e instanceof Error ? e.message : 'Could not load local intelligence.');
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, []);

//   useEffect(() => {
//     void load();
//     // Keep operational signals fresh without a full-page reload or loading-screen flicker.
//     const refreshTimer = window.setInterval(() => {
//       if (document.visibilityState === 'visible') void load(true);
//     }, 30_000);
//     const refreshOnReturn = () => {
//       if (document.visibilityState === 'visible') void load(true);
//     };
//     document.addEventListener('visibilitychange', refreshOnReturn);
//     return () => {
//       window.clearInterval(refreshTimer);
//       document.removeEventListener('visibilitychange', refreshOnReturn);
//     };
//   }, [load]);

//   return (
//     <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
//       <div className="mx-auto max-w-7xl">
//         <div className="flex flex-wrap items-center justify-between gap-3">
//           <Link href="/admin/dashboard" className="text-sm text-cyan-300 hover:text-cyan-200">← Admin dashboard</Link>
//           <div className="flex items-center gap-3">
//             {lastUpdated && <span className="hidden text-xs text-slate-400 sm:inline">Updated {new Date(lastUpdated).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>}
//             <button type="button" onClick={() => void load(true)} disabled={loading || refreshing}
//             className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
//             {refreshing ? 'Refreshing…' : 'Refresh insights'}
//             </button>
//           </div>
//         </div>

//         <header className="mt-6">
//           <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">AuroTap Operations · Read-only intelligence</p>
//           <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Local Intelligence Engine</h1>
//           <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
//             Use actual order and approved coverage data to spot demand hotspots, cancellation patterns,
//             unassigned orders, and PIN codes that may need more supplier capacity.
//           </p>
//           <p className="mt-2 text-xs text-slate-400">Last 30 days · India Standard Time · No automatic supplier ranking or dispatch changes.</p>
//         </header>

//         {error && <div role="alert" className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div>}
//         {loading && !summary && <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-300">Loading operational signals…</div>}

//         {summary && <>
//           {summary.warnings.length > 0 && <div role="status" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
//             <strong>Partial data:</strong><ul className="mt-2 list-disc pl-5">{summary.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
//           </div>}
//           {summary.dataLimited && <div role="status" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
//             The report reached its 1,000-order cap. Counts describe the latest records returned, not necessarily every order in the full 30-day window.
//           </div>}

//           <section aria-label="Demand overview" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
//             {[
//               { label: 'Orders reviewed', value: count(summary.ordersReviewed), note: 'Latest 30-day records' },
//               { label: 'Cancel / failure rate', value: `${summary.cancellationRate}%`, note: `${count(summary.cancelledOrders)} cancelled or failed` },
//               { label: 'Unassigned pending', value: count(summary.unassignedOrders), note: 'Pending orders without supplier' },
//               { label: 'Peak order hour', value: hourLabel(summary.peakHour), note: `${count(summary.peakHourOrders)} orders in busiest hour` },
//               { label: 'Repeat customers', value: count(summary.repeatCustomers), note: `${summary.repeatCustomerRate}% of customers ordered 2+ times in this window` },
//             ].map((card) => <article key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
//               <p className="text-sm text-slate-400">{card.label}</p>
//               <p className="mt-2 text-2xl font-bold tracking-tight text-white">{card.value}</p>
//               <p className="mt-2 text-xs text-slate-400">{card.note}</p>
//             </article>)}
//           </section>

//           <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
//             <div className="flex flex-wrap items-start justify-between gap-3">
//               <div>
//                 <h2 className="text-lg font-bold">Supplier stock visibility</h2>
//                 <p className="mt-1 text-sm text-slate-400">Available after reservations and buffer = cans available − reserved cans − reservation buffer. This is a stock snapshot, not a promise that a supplier is online or eligible for every service.</p>
//               </div>
//               {!summary.stockSummary.dataAvailable && <span className="rounded-full bg-rose-300/10 px-3 py-1 text-xs font-semibold text-rose-200">Stock data unavailable</span>}
//             </div>
//             <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
//               {[
//                 { label: 'Eligible suppliers', value: count(summary.stockSummary.eligibleSuppliers) },
//                 { label: 'With usable stock', value: count(summary.stockSummary.suppliersWithUsableStock) },
//                 { label: 'Low stock', value: count(summary.stockSummary.lowStockSuppliers) },
//                 { label: 'Available cans', value: summary.stockSummary.totalCansAvailable === null ? '—' : count(Math.max(0, summary.stockSummary.totalCansAvailable - (summary.stockSummary.totalReservedCans ?? 0) - (summary.stockSummary.totalBufferCans ?? 0))) },
//               ].map((card) => <article key={card.label} className="rounded-xl border border-white/10 bg-black/10 p-4">
//                 <p className="text-xs text-slate-400">{card.label}</p>
//                 <p className="mt-1 text-xl font-bold">{card.value}</p>
//               </article>)}
//             </div>
//             <div className="mt-5 overflow-x-auto">
//               <table className="w-full min-w-[900px] text-left text-sm">
//                 <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
//                   <tr>{['Supplier','City','Approved coverage PINs','Available cans','Reserved','Buffer','Usable stock','Stock status'].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
//                 </thead>
//                 <tbody className="divide-y divide-white/5">
//                   {summary.stockBySupplier.slice(0, 30).map((row) => <tr key={row.supplierId} className="hover:bg-white/[0.03]">
//                     <td className="px-3 py-3 font-semibold">{row.supplierName}</td>
//                     <td className="px-3 py-3">{row.city || '—'}</td>
//                     <td className="px-3 py-3 font-mono text-xs">{row.pincodes.join(', ') || 'No active zone mapping'}</td>
//                     <td className="px-3 py-3">{row.stockConfigured ? count(row.cansAvailable ?? 0) : 'Not configured'}</td>
//                     <td className="px-3 py-3">{row.stockConfigured ? count(row.reservedCans ?? 0) : '—'}</td>
//                     <td className="px-3 py-3">{row.stockConfigured ? count(row.bufferCans ?? 0) : '—'}</td>
//                     <td className="px-3 py-3 font-semibold">{row.dispatchableCans === null ? '—' : count(row.dispatchableCans)}</td>
//                     <td className="px-3 py-3">{!row.stockConfigured
//                       ? <span className="text-xs text-slate-400">No stock row</span>
//                       : row.lowStock
//                         ? <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">Low stock</span>
//                         : (row.dispatchableCans ?? 0) > 0
//                           ? <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">Stock available</span>
//                           : <span className="rounded-full bg-rose-300/10 px-2.5 py-1 text-xs font-semibold text-rose-200">No usable stock</span>}</td>
//                   </tr>)}
//                 </tbody>
//               </table>
//               {!summary.stockBySupplier.length && <p className="p-4 text-sm text-slate-400">No dispatch-eligible supplier profiles were returned.</p>}
//             </div>
//           </section>

//           <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
//             <div className="border-b border-white/10 p-5">
//               <h2 className="text-lg font-bold">Supplier outcomes — assigned orders only</h2>
//               <p className="mt-1 text-sm text-slate-400">Shows completed work and customer ratings for orders actually assigned in the reporting window. Suppliers being offline or unavailable is not counted as poor performance. Cancellation/failure is a review signal only because customer-initiated cancellations may also be included. Do not use this table as an automatic penalty or ranking rule.</p>
//             </div>
//             {summary.supplierOutcomes.length ? <div className="overflow-x-auto">
//               <table className="w-full min-w-[760px] text-left text-sm">
//                 <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
//                   <tr>{['Supplier','City','Assigned','Completed','Completion rate','Cancelled / failed','Average rating'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
//                 </thead>
//                 <tbody className="divide-y divide-white/5">
//                   {summary.supplierOutcomes.slice(0, 30).map((row) => <tr key={row.supplierId} className="hover:bg-white/[0.03]">
//                     <td className="px-4 py-3 font-semibold">{row.supplierName}</td>
//                     <td className="px-4 py-3">{row.city || '—'}</td>
//                     <td className="px-4 py-3">{count(row.assignedOrders)}</td>
//                     <td className="px-4 py-3">{count(row.completedOrders)}</td>
//                     <td className="px-4 py-3">{row.completionRate}%</td>
//                     <td className="px-4 py-3">{count(row.cancelledOrFailedOrders)}</td>
//                     <td className="px-4 py-3">{row.averageRating === null ? 'Not rated' : `${row.averageRating.toFixed(2)} / 5 (${count(row.ratedOrders)})`}</td>
//                   </tr>)}
//                 </tbody>
//               </table>
//             </div> : <p className="p-5 text-sm text-slate-400">No assigned supplier orders were found in this window.</p>}
//           </section>

//           <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
//             <div className="border-b border-white/10 p-5">
//               <h2 className="text-lg font-bold">PIN-code demand and coverage signals</h2>
//               <p className="mt-1 text-sm text-slate-400">Coverage counts include active/approved supplier profiles mapped to zones marked Available or Limited. They are signals, not a guarantee of live stock or a bookable slot.</p>
//             </div>
//             {summary.demandByPincode.length === 0 ? <p className="p-6 text-sm text-slate-400">No valid PIN-code data was found in the reviewed orders.</p> : <div className="overflow-x-auto">
//               <table className="w-full min-w-[850px] text-left text-sm">
//                 <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
//                   <tr>{['PIN code','City / area','Orders','Cancelled','Cancel rate','Mapped suppliers','Pending without supplier','Signal'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
//                 </thead>
//                 <tbody className="divide-y divide-white/5">
//                   {summary.demandByPincode.slice(0, 30).map((row) => <tr key={row.pincode} className="hover:bg-white/[0.03]">
//                     <td className="px-4 py-3 font-mono font-semibold">{row.pincode}</td>
//                     <td className="px-4 py-3">{row.city}</td>
//                     <td className="px-4 py-3">{count(row.orders)}</td>
//                     <td className="px-4 py-3">{count(row.cancelled)}</td>
//                     <td className="px-4 py-3">{row.cancellationRate}%</td>
//                     <td className="px-4 py-3">{count(row.mappedSuppliers)}</td>
//                     <td className="px-4 py-3">{count(row.unassignedOrders)}</td>
//                     <td className="px-4 py-3">{row.coverageGap
//                       ? <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">Review coverage</span>
//                       : <span className="text-xs text-emerald-200">No immediate signal</span>}</td>
//                   </tr>)}
//                 </tbody>
//               </table>
//             </div>}
//           </section>

//           <section className="mt-6 grid gap-4 lg:grid-cols-2">
//             <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
//               <h2 className="text-lg font-bold">Service mix</h2>
//               <p className="mt-1 text-sm text-slate-400">Most frequently booked service types in the reviewed records.</p>
//               <div className="mt-4 space-y-3">
//                 {summary.serviceMix.slice(0, 8).map((item) => {
//                   const width = summary.ordersReviewed ? Math.max(3, item.orders / summary.ordersReviewed * 100) : 0;
//                   return <div key={item.service}>
//                     <div className="mb-1 flex justify-between gap-3 text-sm"><span className="break-all">{item.service}</span><span className="text-slate-300">{count(item.orders)}</span></div>
//                     <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${width}%` }} /></div>
//                   </div>;
//                 })}
//                 {summary.serviceMix.length === 0 && <p className="text-sm text-slate-400">No service data available.</p>}
//               </div>
//             </article>
//             <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
//               <h2 className="text-lg font-bold">Data quality and next actions</h2>
//               <dl className="mt-4 space-y-3 text-sm">
//                 <div className="flex justify-between gap-4"><dt className="text-slate-400">Orders with valid PIN</dt><dd className="font-semibold">{count(summary.ordersWithPincode)}</dd></div>
//                 <div className="flex justify-between gap-4"><dt className="text-slate-400">Orders without valid PIN</dt><dd className="font-semibold">{count(summary.ordersWithoutPincode)}</dd></div>
//                 <div className="flex justify-between gap-4"><dt className="text-slate-400">Report timezone</dt><dd className="font-semibold">{summary.timezone}</dd></div>
//               </dl>
//               <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-slate-300">
//                 <strong className="text-cyan-200">How to use this safely:</strong> investigate repeated cancellations and coverage gaps, verify current stock and supplier availability, then decide whether to recruit suppliers. This report never changes assignment, payout, eligibility, or serviceability.
//               </div>
//             </article>
//           </section>
//           <p className="mt-4 text-xs text-slate-500">Generated {new Date(summary.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. Operational signals can be incomplete if address snapshots or coverage mappings are missing.</p>
//         </>}
//       </div>
//     </main>
//   );
// }
