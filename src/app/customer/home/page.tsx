'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import BottomNav from '@/components/customer/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';

import {
  customerNotificationsList,
  customerStats,
  getToken,
  type ApiNotification,
} from '@/lib/api-client';

import {
  STEP_LABELS,
  formatWhen,
  inrFmt,
  isActiveStatus,
  liveMessage,
  reorderHref,
  scheduleLabel,
  serviceEmoji,
  statusMeta,
  stepIndex,
  type CustomerOrder,
} from '@/lib/order-status';

const WHATSAPP_SUPPORT = 'https://wa.me/919889305803';

/** Days after the last delivered order before we gently suggest restocking. */
const RESTOCK_AFTER_DAYS = 7;

/** Same quick-book shortcuts as the site header. */
const SERVICES = [
  { key: 'water_can', label: 'Water cans', hint: 'Fresh cans at your door', icon: '💧' },
  { key: 'water_tanker', label: 'Water tanker', hint: 'Bulk water delivery', icon: '🚚' },
  { key: 'ro_service', label: 'RO service', hint: 'Service & filters', icon: '🔧' },
  { key: 'plumbing', label: 'Plumbing', hint: 'Leaks, taps, fittings', icon: '🛠️' },
  { key: 'borewell', label: 'Borewell', hint: 'Repair & maintenance', icon: '⛏️' },
  { key: 'motor_pump', label: 'Motor & pump', hint: 'Repair & install', icon: '⚙️' },
  { key: 'tank_cleaning', label: 'Tank cleaning', hint: 'Safe, hygienic', icon: '✨' },
] as const;

const bookHref = (key: string) => `/book?service=${encodeURIComponent(key)}`;

type Stats = {
  total_orders: number;
  active_orders: number;
  completed: number;
  cancelled: number;
  total_spent: number;
  cans_ordered: number;
  member_since: string | null;
};

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';

  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '';

  const diff = Date.now() - timestamp;

  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function extractServiceOtp(notification: ApiNotification): string | null {
  const title = String(notification.title ?? '').toLowerCase();
  const body = String(notification.body ?? notification.message ?? '');
  if (!title.includes('technician started')) return null;

  const match = body.match(/service code\s+(\d{6})/i);
  return match?.[1] ?? null;
}

function serviceLine(order: CustomerOrder): string {
  return `${order.serviceTitle}${
    order.serviceKey === 'water_can' && order.canCount ? ` × ${order.canCount}` : ''
  }`;
}

/* -------------------------------------------------------------------------- */
/* Small shared UI                                                            */
/* -------------------------------------------------------------------------- */

function Stepper({ status }: { status: string }) {
  const idx = stepIndex(status);

  return (
    <ol className="mt-4 flex items-start" aria-label="Order progress">
      {STEP_LABELS.map((label, i) => {
        const done = i <= idx;
        const current = i === idx;

        return (
          <li
            key={label}
            className="flex min-w-0 flex-1 flex-col items-center"
            aria-current={current ? 'step' : undefined}
          >
            <div className="flex w-full items-center">
              <div
                className={[
                  'h-1 flex-1 rounded-full',
                  i === 0 ? 'opacity-0' : i <= idx ? 'bg-emerald-500' : 'bg-slate-200',
                ].join(' ')}
              />

              <div
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
                  done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400',
                  current ? 'ring-4 ring-emerald-100' : '',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </div>

              <div
                className={[
                  'h-1 flex-1 rounded-full',
                  i === STEP_LABELS.length - 1
                    ? 'opacity-0'
                    : i < idx
                      ? 'bg-emerald-500'
                      : 'bg-slate-200',
                ].join(' ')}
              />
            </div>

            <span
              className={[
                'mt-1.5 text-center text-[10px] font-bold sm:text-[11px]',
                done ? 'text-emerald-700' : 'text-slate-400',
              ].join(' ')}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-lg"
        aria-hidden="true"
      >
        {icon}
      </span>

      <div className="mt-3 truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
        {value}
      </div>

      <div className="text-[11px] font-semibold text-slate-500 sm:text-xs">{label}</div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-hidden="true">
      <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
      <div className="mt-3 h-6 w-16 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  description,
  external,
  prominent,
}: {
  href: string;
  icon: string;
  label: string;
  description?: string;
  external?: boolean;
  prominent?: boolean;
}) {
  const className = [
    'group flex min-h-[68px] items-center gap-3 rounded-2xl border p-3.5 transition',
    'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100',
    prominent
      ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50'
      : 'border-slate-100 bg-white hover:border-sky-200 hover:shadow-md',
  ].join(' ');

  const body = (
    <>
      <span
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
          prominent ? 'bg-white' : 'bg-sky-50',
        ].join(' ')}
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-slate-900">{label}</span>

        {description ? (
          <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
            {description}
          </span>
        ) : null}
      </span>

      <span
        className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500"
        aria-hidden="true"
      >
        ›
      </span>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function TrustStrip() {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-r border-slate-100 px-3 py-3 text-center">
        <div className="text-sm font-black text-slate-900">Local</div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">Service-focused</div>
      </div>

      <div className="border-r border-slate-100 px-3 py-3 text-center">
        <div className="text-sm font-black text-slate-900">Live</div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">Order updates</div>
      </div>

      <div className="px-3 py-3 text-center">
        <div className="text-sm font-black text-slate-900">Support</div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-500">Help when needed</div>
      </div>
    </div>
  );
}

function ActiveOrderCard({ order, extra }: { order: CustomerOrder; extra: number }) {
  const message = liveMessage(order);
  const schedule = scheduleLabel(order);

  return (
    <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-xl shadow-sky-900/10">
      <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              Active order
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
              {serviceEmoji(order.serviceKey)} {serviceLine(order)}
            </h2>

            <p className="mt-0.5 text-xs font-semibold text-slate-500">Order #{order.shortId}</p>
          </div>

          <p className="shrink-0 text-lg font-black text-slate-900 sm:text-xl">
            {inrFmt(order.totalAmount)}
          </p>
        </div>

        <div
          className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sky-100"
          role="status"
          aria-live="polite"
        >
          <p className="font-extrabold text-slate-900">{message.title}</p>

          {message.sub ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">{message.sub}</p>
          ) : null}
        </div>

        <Stepper status={order.status} />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {schedule ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Scheduled
                </p>

                <p className="mt-1 text-sm font-extrabold text-slate-800">{schedule}</p>
              </>
            ) : (
              <p className="text-xs font-semibold text-slate-500">
                We&apos;ll keep the order status updated here.
              </p>
            )}
          </div>

          <Link
            href={`/customer/track/${order.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            Track order
            <span className="ml-1.5" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </div>

      {extra > 0 ? (
        <Link
          href="/customer/history"
          className="block border-t border-slate-100 bg-white px-5 py-3.5 text-center text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-50"
        >
          + {extra} more active {extra === 1 ? 'order' : 'orders'}
        </Link>
      ) : null}
    </div>
  );
}

function EmptyOrderCard() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-sky-900/10 sm:p-8">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sky-50 text-3xl"
          aria-hidden="true"
        >
          💧
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Ready when you are
          </p>

          <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
            Need water or a home water service?
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Choose a service, add your address, select a convenient time, and review the price
            before placing your order.
          </p>
        </div>

        <Link
          href="/book"
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 sm:w-auto"
        >
          Book now
          <span className="ml-1.5" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

function RecentOrderRow({ order }: { order: CustomerOrder }) {
  const meta = statusMeta(order.status);

  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:border-slate-200 hover:shadow-md">
        <Link
          href={`/customer/track/${order.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          aria-label={`View order ${order.shortId}`}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl"
            aria-hidden="true"
          >
            {serviceEmoji(order.serviceKey)}
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-slate-900 sm:text-base">
              {serviceLine(order)}
            </span>

            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {formatWhen(order.createdAt)}

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                {meta.label}
              </span>
            </span>
          </span>
        </Link>

        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-slate-900 sm:text-base">
            {inrFmt(order.totalAmount)}
          </p>

          <Link
            href={reorderHref(order)}
            className="mt-0.5 inline-block text-[11px] font-extrabold text-sky-700 hover:underline sm:text-xs"
          >
            Reorder
          </Link>
        </div>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CustomerHomePage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/home';

  const { hydrated, isLoggedIn, isCustomer, name, fullName, session } = useAuth();

  // Kept so site settings stay warm for the pages this dashboard links to.
  useSettings();

  const { orders, loading, error, live, version, refresh, reload } = useCustomerOrders({
    filter: 'all',
    pageSize: 20,
  });

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsFailed, setStatsFailed] = useState(false);

  const [notifs, setNotifs] = useState<ApiNotification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);

  const [founding, setFounding] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');
  const [refreshing, setRefreshing] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const bellWrapRef = useRef<HTMLDivElement | null>(null);
  const shareTimerRef = useRef<number | null>(null);

  const ready = hydrated && isLoggedIn && isCustomer;

  /* ── Stable greeting after hydration: avoids SSR/client time mismatch ── */
  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  /* ── Auth redirect ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, router, pathname]);

  /* ── Stats ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready || version === 0) return;

    let cancelled = false;

    void (async () => {
      try {
        const result = (await customerStats()) as unknown as Partial<Stats>;

        if (cancelled) return;

        setStats({
          total_orders: Number(result.total_orders ?? 0),
          active_orders: Number(result.active_orders ?? 0),
          completed: Number(result.completed ?? 0),
          cancelled: Number(result.cancelled ?? 0),
          total_spent: Number(result.total_spent ?? 0),
          cans_ordered: Number(result.cans_ordered ?? 0),
          member_since: result.member_since ?? null,
        });

        setStatsFailed(false);
      } catch {
        if (!cancelled) setStatsFailed(true);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, version]);

  /* ── Notifications ──────────────────────────────────────────────────── */
  const loadNotifs = useCallback(async () => {
    try {
      const rows = await customerNotificationsList(6);
      setNotifs(Array.isArray(rows) ? rows : []);
    } catch {
      setNotifs([]);
    } finally {
      setNotifsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void loadNotifs();
  }, [ready, loadNotifs]);

  /* ── Realtime notification updates ──────────────────────────────────── */
  useEffect(() => {
    if (!ready || !session?.accessToken || !session.userId) return;

    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;

    const channel = sb
      .channel(`home_notifs_${session.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.userId}`,
        },
        () => {
          void loadNotifs();
        }
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [ready, session?.accessToken, session?.userId, loadNotifs]);

  const unread = useMemo(() => notifs.filter((item) => !item.is_read).length, [notifs]);

  const markAllRead = useCallback(async () => {
    if (!notifs.some((item) => !item.is_read)) return;

    setNotifs((previous) => previous.map((item) => ({ ...item, is_read: true })));

    try {
      const token = await getToken();

      if (!token) return;

      await fetch('/api/customer/notifications/read-all', {
        method: 'PUT',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Notification state is non-critical.
    }
  }, [notifs]);

  /* ── Notification popover interactions ──────────────────────────────── */
  useEffect(() => {
    if (!notifOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      if (bellWrapRef.current && !bellWrapRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notifOpen]);

  /* ── Founding member ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!ready || !session?.accessToken || !session.userId) return;

    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;

    let cancelled = false;

    void (async () => {
      try {
        const { data: me } = await sb
          .from('profiles')
          .select('created_at, role')
          .eq('id', session.userId)
          .maybeSingle();

        if (!me?.created_at || String(me.role ?? '') !== 'customer') return;

        const { count } = await sb
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'customer')
          .lte('created_at', String(me.created_at));

        if (!cancelled) setFounding((count ?? 0) <= 100);
      } catch {
        // Decorative only.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, session?.accessToken, session?.userId]);

  /* ── Refresh quietly when the customer returns to the tab ───────────── */
  useEffect(() => {
    if (!ready) return;

    let last = Date.now();

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      void refresh();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ready, refresh]);

  /* ── Clear the share-note timer on unmount ───────────────────────────── */
  useEffect(
    () => () => {
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current);
    },
    []
  );

  /* ── Derived data ────────────────────────────────────────────────────── */
  const activeOrders = useMemo(
    () => orders.filter((order) => isActiveStatus(order.status)),
    [orders]
  );

  const primary = activeOrders[0] ?? null;

  const recent = useMemo(
    () => orders.filter((order) => !isActiveStatus(order.status)).slice(0, 4),
    [orders]
  );

  const lastDelivered = useMemo(
    () => orders.find((order) => order.status === 'COMPLETED') ?? null,
    [orders]
  );

  const daysSinceLast = useMemo(() => {
    if (!lastDelivered?.createdAt) return null;
    const timestamp = new Date(lastDelivered.createdAt).getTime();
    if (Number.isNaN(timestamp)) return null;
    return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  }, [lastDelivered]);

  const showRestock =
    !primary && lastDelivered !== null && daysSinceLast !== null && daysSinceLast >= RESTOCK_AFTER_DAYS;

  const firstName = name ?? fullName?.split(/\s+/)[0] ?? 'there';

  const memberDays = useMemo(() => {
    if (!stats?.member_since) return 0;

    const timestamp = new Date(stats.member_since).getTime();

    if (Number.isNaN(timestamp)) return 0;

    return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  }, [stats?.member_since, version]);

  const supportHref = `${WHATSAPP_SUPPORT}?text=${encodeURIComponent(
    primary ? `Hi AuroTap, I need help with order #${primary.shortId}` : 'Hi AuroTap, I need help'
  )}`;

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);

    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

  const handleShare = useCallback(async () => {
    const url = window.location.origin;

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'AuroTap',
          text: 'Water delivery and home water services, right at your door.',
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      setShareNote('Link copied');

      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current);
      shareTimerRef.current = window.setTimeout(() => setShareNote(''), 2500);
    } catch {
      // Share sheet cancelled or clipboard blocked: nothing to do.
    }
  }, []);

  /* ── Loading / auth states ───────────────────────────────────────────── */
  if (!hydrated || (hydrated && !isLoggedIn)) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 motion-reduce:animate-none"
            aria-hidden="true"
          />

          <p className="mt-4 text-sm font-semibold text-slate-500" role="status">
            Loading your AuroTap account…
          </p>
        </div>
      </main>
    );
  }

  if (!isCustomer) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl"
            aria-hidden="true"
          >
            !
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-900">Customer accounts only</h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            This page is available for customer accounts.
          </p>

          <Link
            href="/auth/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-sky-50 via-white to-white pb-[calc(7rem+env(safe-area-inset-bottom))] text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <header className="relative rounded-3xl bg-gradient-to-br from-[#0A1628] via-[#0F2038] to-[#0B3A5C] px-5 pb-14 pt-5 text-white shadow-xl shadow-sky-900/20 sm:px-8 sm:pb-16 sm:pt-7">
          {/* Decorative glow, clipped on its own so the notification popover is not */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
            aria-hidden="true"
          >
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg text-xs font-black uppercase tracking-[0.16em] text-cyan-300 transition hover:text-cyan-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/30"
                aria-label="Go to AuroTap home"
              >
                AuroTap
                <span aria-hidden="true">↗</span>
              </Link>

              <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {greeting}, {firstName} 👋
              </h1>

              <p className="mt-1 text-sm text-slate-300">
                Water and home water services, in one place.
                {live ? (
                  <span className="ml-2 inline-flex items-center gap-1 font-bold text-emerald-300">
                    <span aria-hidden="true">●</span> Live
                  </span>
                ) : null}
              </p>
            </div>

            {/* Notifications */}
            <div className="relative shrink-0" ref={bellWrapRef}>
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;

                  setNotifOpen(next);

                  if (next && unread > 0) void markAllRead();
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-cyan-200 backdrop-blur transition hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/30"
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M13.73 21a2 2 0 01-3.46 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                {unread > 0 ? (
                  <span
                    className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-[#0F2038] bg-rose-500"
                    aria-hidden="true"
                  />
                ) : null}
              </button>

              {notifOpen ? (
                <div
                  className="absolute right-0 top-14 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-sky-50/70 px-4 py-3">
                    <div>
                      <p className="font-black text-slate-900">Notifications</p>
                      <p className="text-[11px] font-medium text-slate-500">
                        Important updates about your orders
                      </p>
                    </div>

                    {unread > 0 ? (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="text-xs font-black text-sky-700 hover:underline"
                      >
                        Mark all read
                      </button>
                    ) : null}
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifsLoading ? (
                      <div className="space-y-2 p-2" aria-hidden="true">
                        <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                        <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                      </div>
                    ) : notifs.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-3xl" aria-hidden="true">
                          🔕
                        </div>

                        <p className="mt-2 text-sm font-bold text-slate-700">
                          No notifications yet
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          We&apos;ll show important order updates here.
                        </p>
                      </div>
                    ) : (
                      notifs.slice(0, 6).map((notification) => {
                      const serviceOtp = extractServiceOtp(notification);

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);

                            if (notification.order_id) {
                              router.push(`/customer/track/${notification.order_id}`);
                            }
                          }}
                          className={[
                            'mb-1 w-full rounded-xl p-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200',
                            notification.is_read ? '' : 'bg-sky-50',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {notification.title}
                              </p>

                              {serviceOtp ? (
                                <div className="mt-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5">
                                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
                                    Service verification code
                                  </p>
                                  <p className="mt-1 font-mono text-2xl font-black tracking-[0.22em] text-slate-950 tabular-nums">
                                    {serviceOtp}
                                  </p>
                                  <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
                                    Share this code only after the technician has finished the work.
                                  </p>
                                </div>
                              ) : (
                                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600">
                                  {notification.body ?? notification.message ?? ''}
                                </p>
                              )}
                            </div>

                            <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                              {relTime(notification.created_at)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Context-aware primary action */}
          <div className="relative mt-6 flex flex-col gap-2.5 sm:flex-row">
            {primary ? (
              <Link
                href={`/customer/track/${primary.id}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-cyan-500/25 transition hover:opacity-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/40"
              >
                Track active order
                <span className="ml-1.5" aria-hidden="true">
                  →
                </span>
              </Link>
            ) : lastDelivered ? (
              <Link
                href={reorderHref(lastDelivered)}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-cyan-500/25 transition hover:opacity-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/40"
              >
                <span className="truncate">Reorder {serviceLine(lastDelivered)}</span>
                <span className="ml-1.5" aria-hidden="true">
                  ↻
                </span>
              </Link>
            ) : (
              <Link
                href="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-cyan-500/25 transition hover:opacity-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/40"
              >
                Book now
                <span className="ml-1.5" aria-hidden="true">
                  →
                </span>
              </Link>
            )}

            {primary || lastDelivered ? (
              <Link
                href="/book"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/30"
              >
                Book something else
              </Link>
            ) : null}
          </div>
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Current order (overlaps the hero) + load error                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="relative z-10 -mt-10 space-y-5 px-2 sm:px-4">
          {error && orders.length === 0 ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm" role="alert">
              <div className="flex items-start gap-3">
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
                  aria-hidden="true"
                >
                  !
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-black text-rose-900">We couldn&apos;t load your orders</p>

                  <p className="mt-1 text-sm leading-6 text-rose-700">{error}</p>

                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <section aria-label="Current order">
            {loading ? (
              <div
                className="h-[280px] animate-pulse rounded-3xl bg-sky-100/80 motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : primary ? (
              <ActiveOrderCard order={primary} extra={Math.max(0, activeOrders.length - 1)} />
            ) : (
              <EmptyOrderCard />
            )}
          </section>
        </div>

        <div className="mt-6 space-y-6">
          {/* Restock nudge, based on the last delivered order */}
          {showRestock && lastDelivered ? (
            <section
              aria-label="Restock reminder"
              className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">
                  ⏰
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-black text-amber-900">Time to restock?</p>
                  <p className="text-xs leading-5 text-amber-800">
                    Your last {lastDelivered.serviceTitle.toLowerCase()} order was {daysSinceLast}{' '}
                    days ago.
                  </p>
                </div>
              </div>

              <Link
                href={reorderHref(lastDelivered)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 px-5 text-sm font-black text-white transition hover:bg-amber-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
              >
                Reorder in one tap
              </Link>
            </section>
          ) : null}

          {/* Quick-book services */}
          <section aria-labelledby="home-services">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="home-services" className="text-lg font-black text-slate-900">
                  Book a service
                </h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Pick a service and we&apos;ll preselect it for you
                </p>
              </div>

              <Link
                href="/services"
                className="shrink-0 text-sm font-black text-sky-700 hover:underline"
              >
                All services →
              </Link>
            </div>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {SERVICES.map((service) => (
                <li key={service.key}>
                  <Link
                    href={bookHref(service.key)}
                    prefetch={false}
                    className="group flex h-full min-h-[84px] items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl"
                      aria-hidden="true"
                    >
                      {service.icon}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-slate-900">
                        {service.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium leading-4 text-slate-500">
                        {service.hint}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Stats */}
          <section aria-label="Your AuroTap stats">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {statsLoading && !statsFailed ? (
                [1, 2, 3, 4].map((key) => <StatSkeleton key={key} />)
              ) : (
                <>
                  <StatCard
                    icon="📦"
                    value={statsFailed ? '—' : String(stats?.total_orders ?? 0)}
                    label="Orders"
                  />

                  <StatCard
                    icon="💧"
                    value={statsFailed ? '—' : String(stats?.cans_ordered ?? 0)}
                    label="Cans ordered"
                  />

                  <StatCard
                    icon="💳"
                    value={statsFailed ? '—' : inrFmt(stats?.total_spent ?? 0)}
                    label="Total spent"
                  />

                  <StatCard
                    icon="📅"
                    value={statsFailed ? '—' : `${memberDays}d`}
                    label="With AuroTap"
                  />
                </>
              )}
            </div>

            {founding ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                <span className="text-2xl" aria-hidden="true">
                  ⭐
                </span>

                <div>
                  <p className="text-sm font-black text-amber-900">Founding member</p>

                  <p className="text-xs leading-5 text-amber-800">
                    Thank you for being one of our first 100 customers.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent orders */}
            <section className="lg:col-span-2" aria-labelledby="home-recent">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 id="home-recent" className="text-lg font-black text-slate-900">
                    Recent orders
                  </h2>

                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    Your latest order activity
                  </p>
                </div>

                <Link
                  href="/customer/history"
                  className="shrink-0 text-sm font-black text-sky-700 hover:underline"
                >
                  See all →
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3" aria-hidden="true">
                  <div className="h-20 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
                  <div className="h-20 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
                </div>
              ) : recent.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                  <div className="text-4xl" aria-hidden="true">
                    💧
                  </div>

                  <p className="mt-2 font-black text-slate-900">
                    {orders.length === 0 ? 'Your first order starts here' : 'No past orders yet'}
                  </p>

                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                    {orders.length === 0
                      ? 'Place a water or home water service order and your activity will appear here.'
                      : 'Completed and cancelled orders will appear here.'}
                  </p>

                  {orders.length === 0 ? (
                    <Link
                      href="/book"
                      className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      Place your first order
                      <span className="ml-1.5" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ) : null}
                </div>
              ) : (
                <ul className="space-y-3">
                  {recent.map((order) => (
                    <RecentOrderRow key={order.id} order={order} />
                  ))}
                </ul>
              )}
            </section>

            {/* Quick actions */}
            <section aria-labelledby="home-actions">
              <div className="mb-3">
                <h2 id="home-actions" className="text-lg font-black text-slate-900">
                  Quick actions
                </h2>

                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Everything important, one tap away
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <QuickAction
                  href="/customer/history"
                  icon="📋"
                  label="Order history"
                  description="View all your orders"
                />

                <QuickAction
                  href="/customer/addresses"
                  icon="📍"
                  label="My addresses"
                  description="Manage saved delivery locations"
                />

                <QuickAction
                  href="/pricing"
                  icon="🏷️"
                  label="Pricing"
                  description="Review current service pricing"
                />

                <QuickAction
                  href={supportHref}
                  icon="💬"
                  label="Get support"
                  description={
                    primary ? `Ask about order #${primary.shortId}` : 'Talk to the AuroTap support team'
                  }
                  external
                  prominent
                />
              </div>
            </section>
          </div>

          {/* Promise + share */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                  A simple promise
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
                  Clear pricing. Clear status. Easy support.
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Review your order details before confirming, track active orders from your
                  dashboard, and reach support when you need help.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <Link
                  href="/book"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                >
                  Start a booking
                  <span className="ml-1.5" aria-hidden="true">
                    →
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
                >
                  {shareNote || 'Share AuroTap with a friend'}
                </button>
              </div>
            </div>
          </section>

          <TrustStrip />

          {/* Refresh */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Refresh dashboard"
            >
              <span
                className={refreshing ? 'mr-1.5 animate-spin motion-reduce:animate-none' : 'mr-1.5'}
                aria-hidden="true"
              >
                ↻
              </span>

              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <BottomNav activeOrderId={primary?.id ?? null} />
    </main>
  );
}












// 'use client';

// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';

// import BottomNav from '@/components/customer/BottomNav';
// import { useAuth } from '@/hooks/useAuth';
// import { useSettings, inr } from '@/hooks/useSettings';
// import { useCustomerOrders } from '@/hooks/useCustomerOrders';
// import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';

// import {
//   customerNotificationsList,
//   customerStats,
//   getToken,
//   type ApiNotification,
// } from '@/lib/api-client';

// import {
//   STEP_LABELS,
//   formatWhen,
//   inrFmt,
//   isActiveStatus,
//   liveMessage,
//   reorderHref,
//   scheduleLabel,
//   serviceEmoji,
//   statusMeta,
//   stepIndex,
//   type CustomerOrder,
// } from '@/lib/order-status';

// const WHATSAPP_SUPPORT = 'https://wa.me/919889305803';

// type Stats = {
//   total_orders: number;
//   active_orders: number;
//   completed: number;
//   cancelled: number;
//   total_spent: number;
//   cans_ordered: number;
//   member_since: string | null;
// };

// function getGreeting(hour: number): string {
//   if (hour < 12) return 'Good morning';
//   if (hour < 17) return 'Good afternoon';
//   return 'Good evening';
// }

// function relTime(iso: string | null | undefined): string {
//   if (!iso) return '';

//   const timestamp = new Date(iso).getTime();
//   if (Number.isNaN(timestamp)) return '';

//   const diff = Date.now() - timestamp;

//   if (diff < 60_000) return 'Just now';
//   if (diff < 3_600_000) {
//     return `${Math.floor(diff / 60_000)}m ago`;
//   }
//   if (diff < 86_400_000) {
//     return `${Math.floor(diff / 3_600_000)}h ago`;
//   }

//   return new Date(iso).toLocaleDateString('en-IN', {
//     day: '2-digit',
//     month: 'short',
//   });
// }

// /* -------------------------------------------------------------------------- */
// /* Small shared UI                                                            */
// /* -------------------------------------------------------------------------- */

// function Stepper({ status }: { status: string }) {
//   const idx = stepIndex(status);

//   return (
//     <ol
//       className="mt-4 flex items-start"
//       aria-label="Order progress"
//     >
//       {STEP_LABELS.map((label, i) => {
//         const done = i <= idx;
//         const current = i === idx;

//         return (
//           <li
//             key={label}
//             className="flex min-w-0 flex-1 flex-col items-center"
//             aria-current={current ? 'step' : undefined}
//           >
//             <div className="flex w-full items-center">
//               <div
//                 className={[
//                   'h-1 flex-1 rounded-full',
//                   i === 0
//                     ? 'opacity-0'
//                     : i <= idx
//                       ? 'bg-emerald-500'
//                       : 'bg-slate-200',
//                 ].join(' ')}
//               />

//               <div
//                 className={[
//                   'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold',
//                   done
//                     ? 'bg-emerald-500 text-white'
//                     : 'bg-slate-100 text-slate-400',
//                   current ? 'ring-4 ring-emerald-100' : '',
//                 ].join(' ')}
//               >
//                 {done ? '✓' : i + 1}
//               </div>

//               <div
//                 className={[
//                   'h-1 flex-1 rounded-full',
//                   i === STEP_LABELS.length - 1
//                     ? 'opacity-0'
//                     : i < idx
//                       ? 'bg-emerald-500'
//                       : 'bg-slate-200',
//                 ].join(' ')}
//               />
//             </div>

//             <span
//               className={[
//                 'mt-1.5 text-center text-[10px] font-bold sm:text-[11px]',
//                 done ? 'text-emerald-700' : 'text-slate-400',
//               ].join(' ')}
//             >
//               {label}
//             </span>
//           </li>
//         );
//       })}
//     </ol>
//   );
// }

// function StatCard({
//   icon,
//   value,
//   label,
// }: {
//   icon: string;
//   value: string;
//   label: string;
// }) {
//   return (
//     <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
//       <div className="text-lg sm:text-xl" aria-hidden="true">
//         {icon}
//       </div>

//       <div className="mt-2 text-lg font-black text-slate-900 sm:text-2xl">
//         {value}
//       </div>

//       <div className="text-[11px] font-semibold text-slate-500 sm:text-xs">
//         {label}
//       </div>
//     </div>
//   );
// }

// function StatSkeleton() {
//   return (
//     <div
//       className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
//       aria-hidden="true"
//     >
//       <div className="h-6 w-6 animate-pulse rounded bg-slate-100" />
//       <div className="mt-3 h-6 w-16 animate-pulse rounded bg-slate-100" />
//       <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
//     </div>
//   );
// }

// function QuickAction({
//   href,
//   icon,
//   label,
//   description,
//   external,
//   prominent,
// }: {
//   href: string;
//   icon: string;
//   label: string;
//   description?: string;
//   external?: boolean;
//   prominent?: boolean;
// }) {
//   const className = [
//     'group flex min-h-[68px] items-center gap-3 rounded-2xl border p-3.5 transition',
//     'focus:outline-none focus:ring-4 focus:ring-emerald-100',
//     prominent
//       ? 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50'
//       : 'border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md',
//   ].join(' ');

//   const body = (
//     <>
//       <span
//         className={[
//           'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg',
//           prominent ? 'bg-white' : 'bg-sky-50',
//         ].join(' ')}
//         aria-hidden="true"
//       >
//         {icon}
//       </span>

//       <span className="min-w-0 flex-1">
//         <span className="block text-sm font-extrabold text-slate-900">
//           {label}
//         </span>

//         {description ? (
//           <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
//             {description}
//           </span>
//         ) : null}
//       </span>

//       <span
//         className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500"
//         aria-hidden="true"
//       >
//         ›
//       </span>
//     </>
//   );

//   return external ? (
//     <a
//       href={href}
//       target="_blank"
//       rel="noreferrer"
//       className={className}
//     >
//       {body}
//     </a>
//   ) : (
//     <Link href={href} className={className}>
//       {body}
//     </Link>
//   );
// }

// function TrustStrip() {
//   return (
//     <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
//       <div className="border-r border-slate-100 px-3 py-3 text-center">
//         <div className="text-sm font-black text-slate-900">Local</div>
//         <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
//           Service-focused
//         </div>
//       </div>

//       <div className="border-r border-slate-100 px-3 py-3 text-center">
//         <div className="text-sm font-black text-slate-900">Live</div>
//         <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
//           Order updates
//         </div>
//       </div>

//       <div className="px-3 py-3 text-center">
//         <div className="text-sm font-black text-slate-900">Support</div>
//         <div className="mt-0.5 text-[10px] font-semibold text-slate-500">
//           Help when needed
//         </div>
//       </div>
//     </div>
//   );
// }

// function ActiveOrderCard({
//   order,
//   extra,
// }: {
//   order: CustomerOrder;
//   extra: number;
// }) {
//   const message = liveMessage(order);
//   const schedule = scheduleLabel(order);

//   return (
//     <div className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm">
//       <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-5 sm:p-6">
//         <div className="flex items-start justify-between gap-3">
//           <div className="min-w-0">
//             <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
//               <span className="relative flex h-2.5 w-2.5">
//                 <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
//                 <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
//               </span>
//               Active order
//             </p>

//             <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
//               {serviceEmoji(order.serviceKey)} {order.serviceTitle}
//               {order.serviceKey === 'water_can' && order.canCount
//                 ? ` × ${order.canCount}`
//                 : ''}
//             </h2>

//             <p className="mt-0.5 text-xs font-semibold text-slate-500">
//               Order #{order.shortId}
//             </p>
//           </div>

//           <p className="shrink-0 text-lg font-black text-slate-900 sm:text-xl">
//             {inrFmt(order.totalAmount)}
//           </p>
//         </div>

//         <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
//           <p className="font-extrabold text-slate-900">
//             {message.title}
//           </p>

//           {message.sub ? (
//             <p className="mt-1 text-sm leading-6 text-slate-600">
//               {message.sub}
//             </p>
//           ) : null}
//         </div>

//         <Stepper status={order.status} />

//         <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//           <div className="min-w-0">
//             {schedule ? (
//               <>
//                 <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
//                   Scheduled
//                 </p>

//                 <p className="mt-1 text-sm font-extrabold text-slate-800">
//                   {schedule}
//                 </p>
//               </>
//             ) : (
//               <p className="text-xs font-semibold text-slate-500">
//                 We&apos;ll keep the order status updated here.
//               </p>
//             )}
//           </div>

//           <Link
//             href={`/customer/track/${order.id}`}
//             className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
//           >
//             Track order
//             <span className="ml-1.5" aria-hidden="true">
//               →
//             </span>
//           </Link>
//         </div>
//       </div>

//       {extra > 0 ? (
//         <Link
//           href="/customer/history"
//           className="block border-t border-slate-100 bg-white px-5 py-3.5 text-center text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-50"
//         >
//           + {extra} more active {extra === 1 ? 'order' : 'orders'}
//         </Link>
//       ) : null}
//     </div>
//   );
// }

// function EmptyOrderCard() {
//   return (
//     <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
//       <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
//         <div
//           className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sky-50 text-3xl"
//           aria-hidden="true"
//         >
//           💧
//         </div>

//         <div className="min-w-0 flex-1">
//           <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
//             Ready when you are
//           </p>

//           <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
//             Need water or a home water service?
//           </h2>

//           <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
//             Choose a service, add your address, select a convenient time,
//             and review the price before placing your order.
//           </p>
//         </div>

//         <Link
//           href="/book"
//           className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-auto"
//         >
//           Book now
//           <span className="ml-1.5" aria-hidden="true">
//             →
//           </span>
//         </Link>
//       </div>
//     </div>
//   );
// }

// function RecentOrderRow({ order }: { order: CustomerOrder }) {
//   const meta = statusMeta(order.status);

//   return (
//     <li>
//       <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:border-slate-200 hover:shadow-md">
//         <Link
//           href={`/customer/track/${order.id}`}
//           className="flex min-w-0 flex-1 items-center gap-3 focus:outline-none"
//           aria-label={`View order ${order.shortId}`}
//         >
//           <span
//             className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl"
//             aria-hidden="true"
//           >
//             {serviceEmoji(order.serviceKey)}
//           </span>

//           <span className="min-w-0">
//             <span className="block truncate text-sm font-extrabold text-slate-900 sm:text-base">
//               {order.serviceTitle}
//               {order.serviceKey === 'water_can' && order.canCount
//                 ? ` × ${order.canCount}`
//                 : ''}
//             </span>

//             <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
//               {formatWhen(order.createdAt)}

//               <span
//                 className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.badge}`}
//               >
//                 <span
//                   className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
//                   aria-hidden="true"
//                 />
//                 {meta.label}
//               </span>
//             </span>
//           </span>
//         </Link>

//         <div className="shrink-0 text-right">
//           <p className="text-sm font-black text-slate-900 sm:text-base">
//             {inrFmt(order.totalAmount)}
//           </p>

//           <Link
//             href={reorderHref(order)}
//             className="mt-0.5 inline-block text-[11px] font-extrabold text-sky-700 hover:underline sm:text-xs"
//           >
//             Reorder
//           </Link>
//         </div>
//       </div>
//     </li>
//   );
// }

// /* -------------------------------------------------------------------------- */
// /* Page                                                                       */
// /* -------------------------------------------------------------------------- */

// export default function CustomerHomePage() {
//   const router = useRouter();
//   const pathname = usePathname() ?? '/customer/home';

//   const {
//     hydrated,
//     isLoggedIn,
//     isCustomer,
//     name,
//     fullName,
//     session,
//   } = useAuth();

//   const { settings } = useSettings();

//   const {
//     orders,
//     loading,
//     error,
//     live,
//     version,
//     refresh,
//     reload,
//   } = useCustomerOrders({
//     filter: 'all',
//     pageSize: 20,
//   });

//   const [stats, setStats] = useState<Stats | null>(null);
//   const [statsLoading, setStatsLoading] = useState(true);
//   const [statsFailed, setStatsFailed] = useState(false);

//   const [notifs, setNotifs] = useState<ApiNotification[]>([]);
//   const [notifsLoading, setNotifsLoading] = useState(true);
//   const [notifOpen, setNotifOpen] = useState(false);

//   const [founding, setFounding] = useState(false);
//   const [greeting, setGreeting] = useState('Welcome');
//   const [refreshing, setRefreshing] = useState(false);

//   const bellWrapRef = useRef<HTMLDivElement | null>(null);

//   const ready = hydrated && isLoggedIn && isCustomer;

//   /* ── Stable greeting after hydration: avoids SSR/client time mismatch ── */
//   useEffect(() => {
//     setGreeting(getGreeting(new Date().getHours()));
//   }, []);

//   /* ── Auth redirect ───────────────────────────────────────────────────── */
//   useEffect(() => {
//     if (hydrated && !isLoggedIn) {
//       router.replace(
//         `/auth/login?returnTo=${encodeURIComponent(pathname)}`
//       );
//     }
//   }, [hydrated, isLoggedIn, router, pathname]);

//   /* ── Stats ────────────────────────────────────────────────────────────── */
//   useEffect(() => {
//     if (!ready || version === 0) return;

//     let cancelled = false;

//     void (async () => {
//       try {
//         const result = (await customerStats()) as unknown as Partial<Stats>;

//         if (cancelled) return;

//         setStats({
//           total_orders: Number(result.total_orders ?? 0),
//           active_orders: Number(result.active_orders ?? 0),
//           completed: Number(result.completed ?? 0),
//           cancelled: Number(result.cancelled ?? 0),
//           total_spent: Number(result.total_spent ?? 0),
//           cans_ordered: Number(result.cans_ordered ?? 0),
//           member_since: result.member_since ?? null,
//         });

//         setStatsFailed(false);
//       } catch {
//         if (!cancelled) setStatsFailed(true);
//       } finally {
//         if (!cancelled) setStatsLoading(false);
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [ready, version]);

//   /* ── Notifications ──────────────────────────────────────────────────── */
//   const loadNotifs = useCallback(async () => {
//     try {
//       const rows = await customerNotificationsList(6);
//       setNotifs(Array.isArray(rows) ? rows : []);
//     } catch {
//       setNotifs([]);
//     } finally {
//       setNotifsLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (ready) void loadNotifs();
//   }, [ready, loadNotifs]);

//   /* ── Realtime notification updates ──────────────────────────────────── */
//   useEffect(() => {
//     if (!ready || !session?.accessToken || !session.userId) return;

//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;

//     const channel = sb
//       .channel(`home_notifs_${session.userId}`)
//       .on(
//         'postgres_changes',
//         {
//           event: '*',
//           schema: 'public',
//           table: 'notifications',
//           filter: `user_id=eq.${session.userId}`,
//         },
//         () => {
//           void loadNotifs();
//         }
//       )
//       .subscribe();

//     return () => {
//       void sb.removeChannel(channel);
//     };
//   }, [
//     ready,
//     session?.accessToken,
//     session?.userId,
//     loadNotifs,
//   ]);

//   const unread = useMemo(
//     () => notifs.filter((item) => !item.is_read).length,
//     [notifs]
//   );

//   const markAllRead = useCallback(async () => {
//     if (!notifs.some((item) => !item.is_read)) return;

//     setNotifs((previous) =>
//       previous.map((item) => ({
//         ...item,
//         is_read: true,
//       }))
//     );

//     try {
//       const token = await getToken();

//       if (!token) return;

//       await fetch('/api/customer/notifications/read-all', {
//         method: 'PUT',
//         credentials: 'include',
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });
//     } catch {
//       // Notification state is non-critical.
//     }
//   }, [notifs]);

//   /* ── Notification popover interactions ──────────────────────────────── */
//   useEffect(() => {
//     if (!notifOpen) return;

//     const handlePointerDown = (event: MouseEvent | TouchEvent) => {
//       const target = event.target as Node;

//       if (
//         bellWrapRef.current &&
//         !bellWrapRef.current.contains(target)
//       ) {
//         setNotifOpen(false);
//       }
//     };

//     const handleKeyDown = (event: KeyboardEvent) => {
//       if (event.key === 'Escape') {
//         setNotifOpen(false);
//       }
//     };

//     document.addEventListener('mousedown', handlePointerDown);
//     document.addEventListener('touchstart', handlePointerDown);
//     document.addEventListener('keydown', handleKeyDown);

//     return () => {
//       document.removeEventListener('mousedown', handlePointerDown);
//       document.removeEventListener('touchstart', handlePointerDown);
//       document.removeEventListener('keydown', handleKeyDown);
//     };
//   }, [notifOpen]);

//   /* ── Founding member ─────────────────────────────────────────────────── */
//   useEffect(() => {
//     if (!ready || !session?.accessToken || !session.userId) return;

//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;

//     let cancelled = false;

//     void (async () => {
//       try {
//         const { data: me } = await sb
//           .from('profiles')
//           .select('created_at, role')
//           .eq('id', session.userId)
//           .maybeSingle();

//         if (
//           !me?.created_at ||
//           String(me.role ?? '') !== 'customer'
//         ) {
//           return;
//         }

//         const { count } = await sb
//           .from('profiles')
//           .select('id', {
//             count: 'exact',
//             head: true,
//           })
//           .eq('role', 'customer')
//           .lte('created_at', String(me.created_at));

//         if (!cancelled) {
//           setFounding((count ?? 0) <= 100);
//         }
//       } catch {
//         // Decorative only.
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [ready, session?.accessToken, session?.userId]);

//   /* ── Derived data ────────────────────────────────────────────────────── */
//   const activeOrders = useMemo(
//     () => orders.filter((order) => isActiveStatus(order.status)),
//     [orders]
//   );

//   const primary = activeOrders[0] ?? null;

//   const recent = useMemo(
//     () =>
//       orders
//         .filter((order) => !isActiveStatus(order.status))
//         .slice(0, 4),
//     [orders]
//   );

//   const lastDelivered = useMemo(
//     () =>
//       orders.find((order) => order.status === 'COMPLETED') ?? null,
//     [orders]
//   );

//   const firstName =
//     name ??
//     fullName?.split(/\s+/)[0] ??
//     'there';

//   const memberDays = useMemo(() => {
//     if (!stats?.member_since) return 0;

//     const timestamp = new Date(stats.member_since).getTime();

//     if (Number.isNaN(timestamp)) return 0;

//     return Math.max(
//       0,
//       Math.floor((Date.now() - timestamp) / 86_400_000)
//     );
//   }, [stats?.member_since, version]);

//   const handleRefresh = useCallback(async () => {
//     if (refreshing) return;

//     setRefreshing(true);

//     try {
//       await refresh();
//     } finally {
//       setRefreshing(false);
//     }
//   }, [refresh, refreshing]);

//   /* ── Loading / auth states ───────────────────────────────────────────── */
//   if (!hydrated || (hydrated && !isLoggedIn)) {
//     return (
//       <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
//         <div className="text-center">
//           <div
//             className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
//             aria-hidden="true"
//           />

//           <p className="mt-4 text-sm font-semibold text-slate-500">
//             Loading your AuroTap account…
//           </p>
//         </div>
//       </main>
//     );
//   }

//   if (!isCustomer) {
//     return (
//       <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
//         <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
//           <div
//             className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl"
//             aria-hidden="true"
//           >
//             !
//           </div>

//           <h1 className="mt-5 text-xl font-black text-slate-900">
//             Customer accounts only
//           </h1>

//           <p className="mt-2 text-sm leading-6 text-slate-600">
//             This page is available for customer accounts.
//           </p>

//           <Link
//             href="/auth/login"
//             className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
//           >
//             Sign in
//           </Link>
//         </div>
//       </main>
//     );
//   }

//   return (
//     <main className="min-h-[100dvh] bg-gradient-to-b from-sky-50 via-white to-white pb-[calc(7rem+env(safe-area-inset-bottom))] text-slate-900">
//       <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
//         {/* ---------------------------------------------------------------- */}
//         {/* Header                                                           */}
//         {/* ---------------------------------------------------------------- */}
//         <header className="flex items-start justify-between gap-4">
//           <div className="min-w-0">
//             <Link
//               href="/"
//               className="inline-flex items-center gap-1.5 rounded-lg text-xs font-black uppercase tracking-[0.16em] text-sky-700 transition hover:text-sky-900 focus:outline-none focus:ring-4 focus:ring-sky-100"
//               aria-label="Go to AuroTap home"
//             >
//               AuroTap
//               <span aria-hidden="true">↗</span>
//             </Link>

//             <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
//               {greeting}, {firstName} 👋
//             </h1>

//             <p className="mt-1 text-sm text-slate-500">
//               Water and home water services, in one place.
//               {live ? (
//                 <span className="ml-2 font-bold text-emerald-600">
//                   <span aria-hidden="true">●</span> Live
//                 </span>
//               ) : null}
//             </p>
//           </div>

//           {/* Notifications */}
//           <div className="relative shrink-0" ref={bellWrapRef}>
//             <button
//               type="button"
//               onClick={() => {
//                 const next = !notifOpen;

//                 setNotifOpen(next);

//                 if (next && unread > 0) {
//                   void markAllRead();
//                 }
//               }}
//               className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
//               aria-label={`Notifications${
//                 unread > 0 ? `, ${unread} unread` : ''
//               }`}
//               aria-expanded={notifOpen}
//               aria-haspopup="dialog"
//             >
//               <svg
//                 width="20"
//                 height="20"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 aria-hidden="true"
//               >
//                 <path
//                   d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
//                   stroke="currentColor"
//                   className="text-sky-700"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                 />
//                 <path
//                   d="M13.73 21a2 2 0 01-3.46 0"
//                   stroke="currentColor"
//                   className="text-sky-700"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                 />
//               </svg>

//               {unread > 0 ? (
//                 <span
//                   className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500"
//                   aria-hidden="true"
//                 />
//               ) : null}
//             </button>

//             {notifOpen ? (
//               <div
//                 className="absolute right-0 top-14 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
//                 role="dialog"
//                 aria-label="Notifications"
//               >
//                 <div className="flex items-center justify-between border-b border-slate-100 bg-sky-50/70 px-4 py-3">
//                   <div>
//                     <p className="font-black text-slate-900">
//                       Notifications
//                     </p>
//                     <p className="text-[11px] font-medium text-slate-500">
//                       Important updates about your orders
//                     </p>
//                   </div>

//                   {unread > 0 ? (
//                     <button
//                       type="button"
//                       onClick={() => void markAllRead()}
//                       className="text-xs font-black text-sky-700 hover:underline"
//                     >
//                       Mark all read
//                     </button>
//                   ) : null}
//                 </div>

//                 <div className="max-h-80 overflow-y-auto p-2">
//                   {notifsLoading ? (
//                     <div
//                       className="space-y-2 p-2"
//                       aria-hidden="true"
//                     >
//                       <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
//                       <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
//                     </div>
//                   ) : notifs.length === 0 ? (
//                     <div className="p-6 text-center">
//                       <div className="text-3xl" aria-hidden="true">
//                         🔕
//                       </div>

//                       <p className="mt-2 text-sm font-bold text-slate-700">
//                         No notifications yet
//                       </p>

//                       <p className="mt-1 text-xs text-slate-500">
//                         We&apos;ll show important order updates here.
//                       </p>
//                     </div>
//                   ) : (
//                     notifs.slice(0, 6).map((notification) => (
//                       <button
//                         key={notification.id}
//                         type="button"
//                         onClick={() => {
//                           setNotifOpen(false);

//                           if (notification.order_id) {
//                             router.push(
//                               `/customer/track/${notification.order_id}`
//                             );
//                           }
//                         }}
//                         className={[
//                           'mb-1 w-full rounded-xl p-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-100',
//                           notification.is_read
//                             ? ''
//                             : 'bg-sky-50',
//                         ].join(' ')}
//                       >
//                         <div className="flex items-start justify-between gap-3">
//                           <div className="min-w-0">
//                             <p className="truncate text-sm font-bold text-slate-900">
//                               {notification.title}
//                             </p>

//                             <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600">
//                               {notification.body ??
//                                 notification.message ??
//                                 ''}
//                             </p>
//                           </div>

//                           <span className="shrink-0 text-[11px] font-semibold text-slate-400">
//                             {relTime(notification.created_at)}
//                           </span>
//                         </div>
//                       </button>
//                     ))
//                   )}
//                 </div>
//               </div>
//             ) : null}
//           </div>
//         </header>

//         {/* ---------------------------------------------------------------- */}
//         {/* Trust / convenience strip                                        */}
//         {/* ---------------------------------------------------------------- */}
//         <div className="mt-5">
//           <TrustStrip />
//         </div>

//         {/* ---------------------------------------------------------------- */}
//         {/* Load error                                                       */}
//         {/* ---------------------------------------------------------------- */}
//         {error && orders.length === 0 ? (
//           <div
//             className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-5"
//             role="alert"
//           >
//             <div className="flex items-start gap-3">
//               <div
//                 className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
//                 aria-hidden="true"
//               >
//                 !
//               </div>

//               <div className="min-w-0 flex-1">
//                 <p className="font-black text-rose-900">
//                   We couldn&apos;t load your orders
//                 </p>

//                 <p className="mt-1 text-sm leading-6 text-rose-700">
//                   {error}
//                 </p>

//                 <button
//                   type="button"
//                   onClick={() => void reload()}
//                   className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800"
//                 >
//                   Try again
//                 </button>
//               </div>
//             </div>
//           </div>
//         ) : null}

//         {/* ---------------------------------------------------------------- */}
//         {/* Main content                                                     */}
//         {/* ---------------------------------------------------------------- */}
//         <div className="mt-5 grid gap-5 lg:grid-cols-3">
//           {/* Current order */}
//           <section
//             className="lg:col-span-2"
//             aria-label="Current order"
//           >
//             {loading ? (
//               <div
//                 className="h-[280px] animate-pulse rounded-3xl bg-sky-100/70"
//                 aria-hidden="true"
//               />
//             ) : primary ? (
//               <ActiveOrderCard
//                 order={primary}
//                 extra={Math.max(0, activeOrders.length - 1)}
//               />
//             ) : (
//               <EmptyOrderCard />
//             )}
//           </section>

//           {/* Stats */}
//           <section aria-label="Your AuroTap stats">
//             <div className="grid grid-cols-2 gap-3">
//               {statsLoading && !statsFailed ? (
//                 [1, 2, 3, 4].map((key) => (
//                   <StatSkeleton key={key} />
//                 ))
//               ) : (
//                 <>
//                   <StatCard
//                     icon="📦"
//                     value={
//                       statsFailed
//                         ? '—'
//                         : String(stats?.total_orders ?? 0)
//                     }
//                     label="Orders"
//                   />

//                   <StatCard
//                     icon="💧"
//                     value={
//                       statsFailed
//                         ? '—'
//                         : String(stats?.cans_ordered ?? 0)
//                     }
//                     label="Cans ordered"
//                   />

//                   <StatCard
//                     icon="💳"
//                     value={
//                       statsFailed
//                         ? '—'
//                         : inrFmt(stats?.total_spent ?? 0)
//                     }
//                     label="Total spent"
//                   />

//                   <StatCard
//                     icon="📅"
//                     value={
//                       statsFailed ? '—' : `${memberDays}d`
//                     }
//                     label="With AuroTap"
//                   />
//                 </>
//               )}
//             </div>

//             {founding ? (
//               <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
//                 <span
//                   className="text-2xl"
//                   aria-hidden="true"
//                 >
//                   ⭐
//                 </span>

//                 <div>
//                   <p className="text-sm font-black text-amber-900">
//                     Founding member
//                   </p>

//                   <p className="text-xs leading-5 text-amber-800">
//                     Thank you for being one of our first 100
//                     customers.
//                   </p>
//                 </div>
//               </div>
//             ) : null}
//           </section>

//           {/* Recent orders */}
//           <section
//             className="lg:col-span-2"
//             aria-label="Recent orders"
//           >
//             <div className="mb-3 flex items-center justify-between gap-3">
//               <div>
//                 <h2 className="text-lg font-black text-slate-900">
//                   Recent orders
//                 </h2>

//                 <p className="mt-0.5 text-xs font-medium text-slate-500">
//                   Your latest order activity
//                 </p>
//               </div>

//               <Link
//                 href="/customer/history"
//                 className="shrink-0 text-sm font-black text-sky-700 hover:underline"
//               >
//                 See all →
//               </Link>
//             </div>

//             {loading ? (
//               <div
//                 className="space-y-3"
//                 aria-hidden="true"
//               >
//                 <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
//                 <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
//               </div>
//             ) : recent.length === 0 ? (
//               <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
//                 <div
//                   className="text-4xl"
//                   aria-hidden="true"
//                 >
//                   💧
//                 </div>

//                 <p className="mt-2 font-black text-slate-900">
//                   {orders.length === 0
//                     ? 'Your first order starts here'
//                     : 'No past orders yet'}
//                 </p>

//                 <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
//                   {orders.length === 0
//                     ? 'Place a water or home water service order and your activity will appear here.'
//                     : 'Completed and cancelled orders will appear here.'}
//                 </p>

//                 {orders.length === 0 ? (
//                   <Link
//                     href="/book"
//                     className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
//                   >
//                     Place your first order
//                     <span className="ml-1.5" aria-hidden="true">
//                       →
//                     </span>
//                   </Link>
//                 ) : null}
//               </div>
//             ) : (
//               <ul className="space-y-3">
//                 {recent.map((order) => (
//                   <RecentOrderRow
//                     key={order.id}
//                     order={order}
//                   />
//                 ))}
//               </ul>
//             )}
//           </section>

//           {/* Quick actions */}
//           <section aria-label="Quick actions">
//             <div className="mb-3">
//               <h2 className="text-lg font-black text-slate-900">
//                 Quick actions
//               </h2>

//               <p className="mt-0.5 text-xs font-medium text-slate-500">
//                 Everything important, one tap away
//               </p>
//             </div>

//             <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
//               <QuickAction
//                 href="/"
//                 icon="🏠"
//                 label="AuroTap home"
//                 description="Browse the public home page"
//                 prominent
//               />

//               <QuickAction
//                 href="/book"
//                 icon="💧"
//                 label="Book a service"
//                 description="Water delivery or home service"
//               />

//               <QuickAction
//                 href="/customer/history"
//                 icon="📋"
//                 label="Order history"
//                 description="View all your orders"
//               />

//               <QuickAction
//                 href="/customer/addresses"
//                 icon="📍"
//                 label="My addresses"
//                 description="Manage saved delivery locations"
//               />

//               <QuickAction
//                 href="/pricing"
//                 icon="🏷️"
//                 label="Pricing"
//                 description="Review current service pricing"
//               />

//               <QuickAction
//                 href={WHATSAPP_SUPPORT}
//                 icon="💬"
//                 label="Get support"
//                 description="Talk to the AuroTap support team"
//                 external
//               />
//             </div>
//           </section>
//         </div>

//         {/* ---------------------------------------------------------------- */}
//         {/* Reliability / next step                                          */}
//         {/* ---------------------------------------------------------------- */}
//         <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
//           <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
//             <div className="min-w-0">
//               <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
//                 A simple promise
//               </p>

//               <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
//                 Clear pricing. Clear status. Easy support.
//               </h2>

//               <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
//                 Review your order details before confirming, track
//                 active orders from your dashboard, and reach support
//                 when you need help.
//               </p>
//             </div>

//             <Link
//               href="/book"
//               className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
//             >
//               Start a booking
//               <span className="ml-1.5" aria-hidden="true">
//                 →
//               </span>
//             </Link>
//           </div>
//         </section>

//         {/* Refresh */}
//         <div className="mt-5 flex justify-center">
//           <button
//             type="button"
//             onClick={() => void handleRefresh()}
//             disabled={refreshing}
//             className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-slate-400 transition hover:bg-white hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
//             aria-label="Refresh dashboard"
//           >
//             <span
//               className={
//                 refreshing ? 'mr-1.5 animate-spin' : 'mr-1.5'
//               }
//               aria-hidden="true"
//             >
//               ↻
//             </span>

//             {refreshing ? 'Refreshing…' : 'Refresh'}
//           </button>
//         </div>
//       </div>

//       <BottomNav activeOrderId={primary?.id ?? null} />
//     </main>
//   );
// }








// 'use client';

// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';

// import BottomNav from '@/components/customer/BottomNav';
// import { useAuth } from '@/hooks/useAuth';
// import { useSettings, inr } from '@/hooks/useSettings';
// import { useCustomerOrders } from '@/hooks/useCustomerOrders';
// import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
// import {
//   customerNotificationsList,
//   customerStats,
//   getToken,
//   type ApiNotification,
// } from '@/lib/api-client';
// import {
//   STEP_LABELS,
//   formatWhen,
//   inrFmt,
//   isActiveStatus,
//   liveMessage,
//   reorderHref,
//   scheduleLabel,
//   serviceEmoji,
//   statusMeta,
//   stepIndex,
//   type CustomerOrder,
// } from '@/lib/order-status';

// const WHATSAPP_SUPPORT = 'https://wa.me/919889305803';

// type Stats = {
//   total_orders: number;
//   active_orders: number;
//   completed: number;
//   cancelled: number;
//   total_spent: number;
//   cans_ordered: number;
//   member_since: string | null;
// };

// function greetingNow(): string {
//   const h = new Date().getHours();
//   return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
// }

// function relTime(iso: string | null | undefined): string {
//   if (!iso) return '';
//   const diff = Date.now() - new Date(iso).getTime();
//   if (Number.isNaN(diff)) return '';
//   if (diff < 60_000) return 'Just now';
//   if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
//   if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
//   return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
// }

// /* ───────────────────────── small components ───────────────────────── */

// function Stepper({ status }: { status: string }) {
//   const idx = stepIndex(status);
//   return (
//     <ol className="mt-4 flex items-start" aria-label="Order progress">
//       {STEP_LABELS.map((label, i) => {
//         const done = i <= idx;
//         const current = i === idx;
//         return (
//           <li key={label} className="flex min-w-0 flex-1 flex-col items-center" aria-current={current ? 'step' : undefined}>
//             <div className="flex w-full items-center">
//               <div className={`h-1 flex-1 rounded-full ${i === 0 ? 'opacity-0' : i <= idx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
//               <div
//                 className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
//                   done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
//                 } ${current ? 'ring-4 ring-emerald-100' : ''}`}
//               >
//                 {done ? '✓' : i + 1}
//               </div>
//               <div
//                 className={`h-1 flex-1 rounded-full ${
//                   i === STEP_LABELS.length - 1 ? 'opacity-0' : i < idx ? 'bg-emerald-500' : 'bg-slate-200'
//                 }`}
//               />
//             </div>
//             <span className={`mt-1.5 text-center text-[11px] font-semibold ${done ? 'text-emerald-700' : 'text-slate-400'}`}>
//               {label}
//             </span>
//           </li>
//         );
//       })}
//     </ol>
//   );
// }

// function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
//   return (
//     <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
//       <div className="text-xl" aria-hidden>
//         {icon}
//       </div>
//       <div className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">{value}</div>
//       <div className="text-xs font-semibold text-slate-500">{label}</div>
//     </div>
//   );
// }

// function StatSkeleton() {
//   return (
//     <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-hidden>
//       <div className="h-6 w-6 animate-pulse rounded bg-slate-100" />
//       <div className="mt-3 h-6 w-16 animate-pulse rounded bg-slate-100" />
//       <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
//     </div>
//   );
// }

// function QuickAction({
//   href,
//   icon,
//   label,
//   external,
// }: {
//   href: string;
//   icon: string;
//   label: string;
//   external?: boolean;
// }) {
//   const cls =
//     'flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:border-emerald-200 hover:shadow-md active:scale-[0.98]';
//   const body = (
//     <>
//       <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-lg" aria-hidden>
//         {icon}
//       </span>
//       <span className="flex-1 text-sm font-bold text-slate-900">{label}</span>
//       <span className="text-slate-300" aria-hidden>
//         ›
//       </span>
//     </>
//   );
//   return external ? (
//     <a href={href} target="_blank" rel="noreferrer" className={cls}>
//       {body}
//     </a>
//   ) : (
//     <Link href={href} className={cls}>
//       {body}
//     </Link>
//   );
// }

// function ActiveOrderCard({ order, extra }: { order: CustomerOrder; extra: number }) {
//   const msg = liveMessage(order);
//   const schedule = scheduleLabel(order);
//   return (
//     <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
//       <div className="flex items-start justify-between gap-3">
//         <div className="min-w-0">
//           <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
//             <span className="relative flex h-2.5 w-2.5">
//               <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
//               <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
//             </span>
//             Active order
//           </p>
//           <h2 className="mt-1 text-lg font-extrabold text-slate-900">
//             {serviceEmoji(order.serviceKey)} {order.serviceTitle}
//             {order.serviceKey === 'water_can' && order.canCount ? ` × ${order.canCount}` : ''}
//           </h2>
//           <p className="text-xs font-semibold text-slate-500">#{order.shortId}</p>
//         </div>
//         <p className="text-lg font-extrabold text-slate-900">{inrFmt(order.totalAmount)}</p>
//       </div>

//       <div className="mt-3 rounded-xl bg-white/80 p-3 ring-1 ring-sky-100">
//         <p className="font-bold text-slate-900">{msg.title}</p>
//         {msg.sub ? <p className="text-sm text-slate-600">{msg.sub}</p> : null}
//       </div>

//       <Stepper status={order.status} />

//       <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
//         <div>
//           {schedule ? (
//             <>
//               <p className="text-[11px] font-semibold uppercase text-slate-400">Scheduled</p>
//               <p className="text-sm font-bold text-slate-800">{schedule}</p>
//             </>
//           ) : null}
//         </div>
//         <Link
//           href={`/customer/track/${order.id}`}
//           className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
//         >
//           Track order →
//         </Link>
//       </div>

//       {extra > 0 ? (
//         <Link
//           href="/customer/history"
//           className="mt-3 block text-center text-sm font-semibold text-emerald-700 hover:underline"
//         >
//           + {extra} more active {extra === 1 ? 'order' : 'orders'}
//         </Link>
//       ) : null}
//     </div>
//   );
// }

// /* ───────────────────────── page ───────────────────────── */

// export default function CustomerHomePage() {
//   const router = useRouter();
//   const pathname = usePathname() ?? '/customer/home';
//   const { hydrated, isLoggedIn, isCustomer, name, fullName, session } = useAuth();
//   const { settings } = useSettings();
//   const { orders, loading, error, live, version, refresh, reload } = useCustomerOrders({
//     filter: 'all',
//     pageSize: 20,
//   });

//   const [stats, setStats] = useState<Stats | null>(null);
//   const [statsLoading, setStatsLoading] = useState(true);
//   const [statsFailed, setStatsFailed] = useState(false);

//   const [notifs, setNotifs] = useState<ApiNotification[]>([]);
//   const [notifsLoading, setNotifsLoading] = useState(true);
//   const [notifOpen, setNotifOpen] = useState(false);
//   const [founding, setFounding] = useState(false);

//   const bellWrapRef = useRef<HTMLDivElement | null>(null);

//   const ready = hydrated && isLoggedIn && isCustomer;

//   useEffect(() => {
//     if (hydrated && !isLoggedIn) {
//       router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//     }
//   }, [hydrated, isLoggedIn, router, pathname]);

//   /* ── Stats: refetch whenever orders change ── */
//   useEffect(() => {
//     if (!ready || version === 0) return;
//     let cancelled = false;
//     void (async () => {
//       try {
//         const s = (await customerStats()) as unknown as Partial<Stats>;
//         if (cancelled) return;
//         setStats({
//           total_orders: Number(s.total_orders ?? 0),
//           active_orders: Number(s.active_orders ?? 0),
//           completed: Number(s.completed ?? 0),
//           cancelled: Number(s.cancelled ?? 0),
//           total_spent: Number(s.total_spent ?? 0),
//           cans_ordered: Number(s.cans_ordered ?? 0),
//           member_since: s.member_since ?? null,
//         });
//         setStatsFailed(false);
//       } catch {
//         if (!cancelled) setStatsFailed(true);
//       } finally {
//         if (!cancelled) setStatsLoading(false);
//       }
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [ready, version]);

//   /* ── Notifications ── */
//   const loadNotifs = useCallback(async () => {
//     try {
//       const rows = await customerNotificationsList(6);
//       setNotifs(Array.isArray(rows) ? rows : []);
//     } catch {
//       setNotifs([]);
//     } finally {
//       setNotifsLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (ready) void loadNotifs();
//   }, [ready, loadNotifs]);

//   useEffect(() => {
//     if (!ready || !session?.accessToken || !session.userId) return;
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     const channel = sb
//       .channel(`home_notifs_${session.userId}`)
//       .on(
//         'postgres_changes',
//         { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.userId}` },
//         () => void loadNotifs()
//       )
//       .subscribe();
//     return () => {
//       void sb.removeChannel(channel);
//     };
//   }, [ready, session?.accessToken, session?.userId, loadNotifs]);

//   const unread = useMemo(() => notifs.filter((n) => !n.is_read).length, [notifs]);

//   const markAllRead = useCallback(async () => {
//     setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
//     try {
//       const token = await getToken();
//       if (!token) return;
//       await fetch('/api/customer/notifications/read-all', {
//         method: 'PUT',
//         credentials: 'include',
//         headers: { Authorization: `Bearer ${token}` },
//       });
//     } catch {
//       /* non-critical */
//     }
//   }, []);

//   /* Close bell on outside click / Escape */
//   useEffect(() => {
//     if (!notifOpen) return;
//     const onDown = (e: MouseEvent | TouchEvent) => {
//       if (bellWrapRef.current && !bellWrapRef.current.contains(e.target as Node)) setNotifOpen(false);
//     };
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === 'Escape') setNotifOpen(false);
//     };
//     document.addEventListener('mousedown', onDown);
//     document.addEventListener('touchstart', onDown);
//     document.addEventListener('keydown', onKey);
//     return () => {
//       document.removeEventListener('mousedown', onDown);
//       document.removeEventListener('touchstart', onDown);
//       document.removeEventListener('keydown', onKey);
//     };
//   }, [notifOpen]);

//   /* Founding member badge (first 100 customers) */
//   useEffect(() => {
//     if (!ready || !session?.accessToken || !session.userId) return;
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     let cancelled = false;
//     void (async () => {
//       try {
//         const { data: me } = await sb.from('profiles').select('created_at, role').eq('id', session.userId).maybeSingle();
//         if (!me?.created_at || String(me.role ?? '') !== 'customer') return;
//         const { count } = await sb
//           .from('profiles')
//           .select('id', { count: 'exact', head: true })
//           .eq('role', 'customer')
//           .lte('created_at', String(me.created_at));
//         if (!cancelled) setFounding((count ?? 0) <= 100);
//       } catch {
//         /* decorative */
//       }
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [ready, session?.accessToken, session?.userId]);

//   /* ── Derived ── */
//   const activeOrders = useMemo(() => orders.filter((o) => isActiveStatus(o.status)), [orders]);
//   const primary = activeOrders[0] ?? null;
//   const recent = useMemo(() => orders.filter((o) => !isActiveStatus(o.status)).slice(0, 4), [orders]);
//   const lastDelivered = useMemo(() => orders.find((o) => o.status === 'COMPLETED') ?? null, [orders]);

//   const firstName = name ?? fullName?.split(/\s+/)[0] ?? 'there';
//   const greeting = greetingNow();
//   const memberDays = stats?.member_since
//     ? Math.max(0, Math.floor((Date.now() - new Date(stats.member_since).getTime()) / 86_400_000))
//     : 0;

//   if (!hydrated || (hydrated && !isLoggedIn)) {
//     return (
//       <div className="flex min-h-screen items-center justify-center bg-sky-50">
//         <span className="h-9 w-9 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
//       </div>
//     );
//   }

//   if (!isCustomer) {
//     return (
//       <div className="mx-auto max-w-md px-4 py-20 text-center">
//         <h1 className="text-xl font-extrabold text-slate-900">Customer accounts only</h1>
//         <p className="mt-2 text-slate-600">This page is for customer accounts.</p>
//         <Link href="/auth/login" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">
//           Sign in
//         </Link>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-32">
//       <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
//         {/* Header */}
//         <header className="flex items-start justify-between gap-4">
//           <div className="min-w-0">
//             <p className="text-xs font-bold uppercase tracking-widest text-sky-700">AuroWater</p>
//             <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">
//               {greeting}, {firstName} 👋
//             </h1>
//             <p className="mt-1 text-sm text-slate-500">
//               Your water, delivered.
//               {live ? <span className="ml-2 text-emerald-600">● Live</span> : null}
//             </p>
//           </div>

//           <div className="relative shrink-0" ref={bellWrapRef}>
//             <button
//               type="button"
//               onClick={() => {
//                 const next = !notifOpen;
//                 setNotifOpen(next);
//                 if (next && unread > 0) void markAllRead();
//               }}
//               className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
//               aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
//               aria-expanded={notifOpen}
//             >
//               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                 <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
//                 <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
//               </svg>
//               {unread > 0 ? (
//                 <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
//               ) : null}
//             </button>

//             {notifOpen ? (
//               <div className="absolute right-0 top-14 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
//                 <div className="flex items-center justify-between border-b border-slate-100 bg-sky-50/60 px-4 py-3">
//                   <p className="font-extrabold text-slate-900">Notifications</p>
//                   <button type="button" onClick={() => void markAllRead()} className="text-xs font-bold text-sky-700 hover:underline">
//                     Mark all read
//                   </button>
//                 </div>
//                 <div className="max-h-80 overflow-y-auto p-2">
//                   {notifsLoading ? (
//                     <div className="space-y-2 p-2" aria-hidden>
//                       <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
//                       <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
//                     </div>
//                   ) : notifs.length === 0 ? (
//                     <div className="p-6 text-center">
//                       <div className="text-3xl" aria-hidden>
//                         🔕
//                       </div>
//                       <p className="mt-2 text-sm font-semibold text-slate-600">No notifications yet</p>
//                     </div>
//                   ) : (
//                     notifs.slice(0, 6).map((n) => (
//                       <button
//                         key={n.id}
//                         type="button"
//                         onClick={() => {
//                           setNotifOpen(false);
//                           if (n.order_id) router.push(`/customer/track/${n.order_id}`);
//                         }}
//                         className={`mb-1 w-full rounded-xl p-3 text-left transition hover:bg-slate-50 ${
//                           n.is_read ? '' : 'bg-sky-50'
//                         }`}
//                       >
//                         <div className="flex items-start justify-between gap-3">
//                           <div className="min-w-0">
//                             <p className="truncate text-sm font-bold text-slate-900">{n.title}</p>
//                             <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body ?? n.message ?? ''}</p>
//                           </div>
//                           <span className="shrink-0 text-[11px] font-semibold text-slate-400">{relTime(n.created_at)}</span>
//                         </div>
//                       </button>
//                     ))
//                   )}
//                 </div>
//               </div>
//             ) : null}
//           </div>
//         </header>

//         {error && orders.length === 0 ? (
//           <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-center">
//             <p className="font-semibold text-rose-800">We could not load your orders.</p>
//             <p className="mt-1 text-sm text-rose-700">{error}</p>
//             <button
//               type="button"
//               onClick={() => void reload()}
//               className="mt-3 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700"
//             >
//               Try again
//             </button>
//           </div>
//         ) : null}

//         <div className="mt-6 grid gap-5 lg:grid-cols-3">
//           {/* Active order or Book CTA */}
//           <section className="lg:col-span-2 lg:row-start-1" aria-label="Current order">
//             {loading ? (
//               <div className="h-56 animate-pulse rounded-3xl bg-sky-100/60" aria-hidden />
//             ) : primary ? (
//               <ActiveOrderCard order={primary} extra={activeOrders.length - 1} />
//             ) : (
//               <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-emerald-500 p-6 text-white shadow-lg shadow-sky-200">
//                 <p className="text-sm font-semibold opacity-90">Need water?</p>
//                 <h2 className="mt-1 text-2xl font-extrabold">Book your next delivery</h2>
//                 <p className="mt-1 text-sm opacity-90">
//                   From {inr(settings.default_can_price)} per can · pick your own time slot
//                 </p>
//                 <div className="mt-5 flex flex-wrap gap-3">
//                   <Link
//                     href="/book"
//                     className="rounded-xl bg-white px-5 py-3 font-extrabold text-sky-700 shadow-sm hover:bg-sky-50"
//                   >
//                     Book water →
//                   </Link>
//                   {lastDelivered ? (
//                     <Link
//                       href={reorderHref(lastDelivered)}
//                       className="rounded-xl border border-white/60 px-5 py-3 font-bold text-white hover:bg-white/10"
//                     >
//                       ↻ Reorder {lastDelivered.canCount ? `${lastDelivered.canCount} cans` : 'last order'}
//                     </Link>
//                   ) : null}
//                 </div>
//               </div>
//             )}
//           </section>

//           {/* Stats */}
//           <section className="lg:col-start-3 lg:row-start-1" aria-label="Your stats">
//             <div className="grid grid-cols-2 gap-3">
//               {statsLoading && !statsFailed ? (
//                 [1, 2, 3, 4].map((k) => <StatSkeleton key={k} />)
//               ) : (
//                 <>
//                   <StatCard icon="📦" value={statsFailed ? '—' : String(stats?.total_orders ?? 0)} label="Orders" />
//                   <StatCard icon="💧" value={statsFailed ? '—' : String(stats?.cans_ordered ?? 0)} label="Cans ordered" />
//                   <StatCard icon="💳" value={statsFailed ? '—' : inrFmt(stats?.total_spent ?? 0)} label="Total spent" />
//                   <StatCard icon="📅" value={statsFailed ? '—' : `${memberDays}d`} label="With AuroWater" />
//                 </>
//               )}
//             </div>
//             {founding ? (
//               <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
//                 <span className="text-2xl" aria-hidden>
//                   ⭐
//                 </span>
//                 <div>
//                   <p className="text-sm font-extrabold text-amber-900">Founding member</p>
//                   <p className="text-xs text-amber-800">Thank you for being one of our first 100 customers.</p>
//                 </div>
//               </div>
//             ) : null}
//           </section>

//           {/* Recent */}
//           <section className="lg:col-span-2 lg:row-start-2" aria-label="Recent orders">
//             <div className="mb-3 flex items-center justify-between">
//               <h2 className="text-lg font-extrabold text-slate-900">Recent orders</h2>
//               <Link href="/customer/history" className="text-sm font-bold text-sky-700 hover:underline">
//                 See all →
//               </Link>
//             </div>

//             {loading ? (
//               <div className="space-y-3" aria-hidden>
//                 <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
//                 <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
//               </div>
//             ) : recent.length === 0 ? (
//               <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
//                 <div className="text-4xl" aria-hidden>
//                   💧
//                 </div>
//                 <p className="mt-2 font-extrabold text-slate-900">
//                   {orders.length === 0 ? 'No orders yet' : 'No past orders yet'}
//                 </p>
//                 <p className="mt-1 text-sm text-slate-500">Completed and cancelled orders show up here.</p>
//                 {orders.length === 0 ? (
//                   <Link
//                     href="/book"
//                     className="mt-4 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700"
//                   >
//                     Place your first order →
//                   </Link>
//                 ) : null}
//               </div>
//             ) : (
//               <ul className="space-y-3">
//                 {recent.map((o) => {
//                   const meta = statusMeta(o.status);
//                   return (
//                     <li key={o.id}>
//                       <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
//                         <Link
//                           href={`/customer/track/${o.id}`}
//                           className="flex min-w-0 flex-1 items-center gap-3"
//                           aria-label={`View order ${o.shortId}`}
//                         >
//                           <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl" aria-hidden>
//                             {serviceEmoji(o.serviceKey)}
//                           </span>
//                           <span className="min-w-0">
//                             <span className="block truncate font-extrabold text-slate-900">
//                               {o.serviceTitle}
//                               {o.serviceKey === 'water_can' && o.canCount ? ` × ${o.canCount}` : ''}
//                             </span>
//                             <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
//                               {formatWhen(o.createdAt)}
//                               <span
//                                 className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.badge}`}
//                               >
//                                 <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
//                                 {meta.label}
//                               </span>
//                             </span>
//                           </span>
//                         </Link>
//                         <div className="shrink-0 text-right">
//                           <p className="font-extrabold text-slate-900">{inrFmt(o.totalAmount)}</p>
//                           <Link href={reorderHref(o)} className="text-xs font-bold text-sky-700 hover:underline">
//                             ↻ Reorder
//                           </Link>
//                         </div>
//                       </div>
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </section>

//           {/* Quick actions */}
//           <section className="lg:col-start-3 lg:row-start-2" aria-label="Quick actions">
//             <h2 className="mb-3 text-lg font-extrabold text-slate-900">Quick actions</h2>
//             <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
//               <QuickAction href="/book" icon="💧" label="Book a service" />
//               <QuickAction href="/customer/history" icon="📋" label="Order history" />
//               <QuickAction href="/customer/addresses" icon="📍" label="My addresses" />
//               <QuickAction href="/pricing" icon="🏷️" label="Pricing" />
//               <QuickAction href={WHATSAPP_SUPPORT} icon="💬" label="Get support" external />
//             </div>
//           </section>
//         </div>

//         <div className="mt-6 flex justify-center">
//           <button
//             type="button"
//             onClick={() => void refresh()}
//             className="text-xs font-semibold text-slate-400 hover:text-slate-600"
//           >
//             ↻ Refresh
//           </button>
//         </div>
//       </div>

//       <BottomNav activeOrderId={primary?.id ?? null} />
//     </div>
//   );
// }
