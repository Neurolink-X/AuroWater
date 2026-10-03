'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import BottomNav from '@/components/customer/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useSettings, inr } from '@/hooks/useSettings';
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

type Stats = {
  total_orders: number;
  active_orders: number;
  completed: number;
  cancelled: number;
  total_spent: number;
  cans_ordered: number;
  member_since: string | null;
};

function greetingNow(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/* ───────────────────────── small components ───────────────────────── */

function Stepper({ status }: { status: string }) {
  const idx = stepIndex(status);
  return (
    <ol className="mt-4 flex items-start" aria-label="Order progress">
      {STEP_LABELS.map((label, i) => {
        const done = i <= idx;
        const current = i === idx;
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center" aria-current={current ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 rounded-full ${i === 0 ? 'opacity-0' : i <= idx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                  done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                } ${current ? 'ring-4 ring-emerald-100' : ''}`}
              >
                {done ? '✓' : i + 1}
              </div>
              <div
                className={`h-1 flex-1 rounded-full ${
                  i === STEP_LABELS.length - 1 ? 'opacity-0' : i < idx ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            </div>
            <span className={`mt-1.5 text-center text-[11px] font-semibold ${done ? 'text-emerald-700' : 'text-slate-400'}`}>
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
      <div className="text-xl" aria-hidden>
        {icon}
      </div>
      <div className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">{value}</div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-hidden>
      <div className="h-6 w-6 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-6 w-16 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: string;
  label: string;
  external?: boolean;
}) {
  const cls =
    'flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:border-emerald-200 hover:shadow-md active:scale-[0.98]';
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-lg" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 text-sm font-bold text-slate-900">{label}</span>
      <span className="text-slate-300" aria-hidden>
        ›
      </span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

function ActiveOrderCard({ order, extra }: { order: CustomerOrder; extra: number }) {
  const msg = liveMessage(order);
  const schedule = scheduleLabel(order);
  return (
    <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Active order
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">
            {serviceEmoji(order.serviceKey)} {order.serviceTitle}
            {order.serviceKey === 'water_can' && order.canCount ? ` × ${order.canCount}` : ''}
          </h2>
          <p className="text-xs font-semibold text-slate-500">#{order.shortId}</p>
        </div>
        <p className="text-lg font-extrabold text-slate-900">{inrFmt(order.totalAmount)}</p>
      </div>

      <div className="mt-3 rounded-xl bg-white/80 p-3 ring-1 ring-sky-100">
        <p className="font-bold text-slate-900">{msg.title}</p>
        {msg.sub ? <p className="text-sm text-slate-600">{msg.sub}</p> : null}
      </div>

      <Stepper status={order.status} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          {schedule ? (
            <>
              <p className="text-[11px] font-semibold uppercase text-slate-400">Scheduled</p>
              <p className="text-sm font-bold text-slate-800">{schedule}</p>
            </>
          ) : null}
        </div>
        <Link
          href={`/customer/track/${order.id}`}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          Track order →
        </Link>
      </div>

      {extra > 0 ? (
        <Link
          href="/customer/history"
          className="mt-3 block text-center text-sm font-semibold text-emerald-700 hover:underline"
        >
          + {extra} more active {extra === 1 ? 'order' : 'orders'}
        </Link>
      ) : null}
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function CustomerHomePage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/home';
  const { hydrated, isLoggedIn, isCustomer, name, fullName, session } = useAuth();
  const { settings } = useSettings();
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

  const bellWrapRef = useRef<HTMLDivElement | null>(null);

  const ready = hydrated && isLoggedIn && isCustomer;

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, router, pathname]);

  /* ── Stats: refetch whenever orders change ── */
  useEffect(() => {
    if (!ready || version === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = (await customerStats()) as unknown as Partial<Stats>;
        if (cancelled) return;
        setStats({
          total_orders: Number(s.total_orders ?? 0),
          active_orders: Number(s.active_orders ?? 0),
          completed: Number(s.completed ?? 0),
          cancelled: Number(s.cancelled ?? 0),
          total_spent: Number(s.total_spent ?? 0),
          cans_ordered: Number(s.cans_ordered ?? 0),
          member_since: s.member_since ?? null,
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

  /* ── Notifications ── */
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

  useEffect(() => {
    if (!ready || !session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    const channel = sb
      .channel(`home_notifs_${session.userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.userId}` },
        () => void loadNotifs()
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [ready, session?.accessToken, session?.userId, loadNotifs]);

  const unread = useMemo(() => notifs.filter((n) => !n.is_read).length, [notifs]);

  const markAllRead = useCallback(async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      const token = await getToken();
      if (!token) return;
      await fetch('/api/customer/notifications/read-all', {
        method: 'PUT',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* non-critical */
    }
  }, []);

  /* Close bell on outside click / Escape */
  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (bellWrapRef.current && !bellWrapRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  /* Founding member badge (first 100 customers) */
  useEffect(() => {
    if (!ready || !session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: me } = await sb.from('profiles').select('created_at, role').eq('id', session.userId).maybeSingle();
        if (!me?.created_at || String(me.role ?? '') !== 'customer') return;
        const { count } = await sb
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'customer')
          .lte('created_at', String(me.created_at));
        if (!cancelled) setFounding((count ?? 0) <= 100);
      } catch {
        /* decorative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session?.accessToken, session?.userId]);

  /* ── Derived ── */
  const activeOrders = useMemo(() => orders.filter((o) => isActiveStatus(o.status)), [orders]);
  const primary = activeOrders[0] ?? null;
  const recent = useMemo(() => orders.filter((o) => !isActiveStatus(o.status)).slice(0, 4), [orders]);
  const lastDelivered = useMemo(() => orders.find((o) => o.status === 'COMPLETED') ?? null, [orders]);

  const firstName = name ?? fullName?.split(/\s+/)[0] ?? 'there';
  const greeting = greetingNow();
  const memberDays = stats?.member_since
    ? Math.max(0, Math.floor((Date.now() - new Date(stats.member_since).getTime()) / 86_400_000))
    : 0;

  if (!hydrated || (hydrated && !isLoggedIn)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sky-50">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
      </div>
    );
  }

  if (!isCustomer) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-extrabold text-slate-900">Customer accounts only</h1>
        <p className="mt-2 text-slate-600">This page is for customer accounts.</p>
        <Link href="/auth/login" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-32">
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-700">AuroWater</p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Your water, delivered.
              {live ? <span className="ml-2 text-emerald-600">● Live</span> : null}
            </p>
          </div>

          <div className="relative shrink-0" ref={bellWrapRef}>
            <button
              type="button"
              onClick={() => {
                const next = !notifOpen;
                setNotifOpen(next);
                if (next && unread > 0) void markAllRead();
              }}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
              aria-expanded={notifOpen}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
                <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {unread > 0 ? (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
              ) : null}
            </button>

            {notifOpen ? (
              <div className="absolute right-0 top-14 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 bg-sky-50/60 px-4 py-3">
                  <p className="font-extrabold text-slate-900">Notifications</p>
                  <button type="button" onClick={() => void markAllRead()} className="text-xs font-bold text-sky-700 hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {notifsLoading ? (
                    <div className="space-y-2 p-2" aria-hidden>
                      <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                      <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                    </div>
                  ) : notifs.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="text-3xl" aria-hidden>
                        🔕
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">No notifications yet</p>
                    </div>
                  ) : (
                    notifs.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          if (n.order_id) router.push(`/customer/track/${n.order_id}`);
                        }}
                        className={`mb-1 w-full rounded-xl p-3 text-left transition hover:bg-slate-50 ${
                          n.is_read ? '' : 'bg-sky-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body ?? n.message ?? ''}</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-400">{relTime(n.created_at)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {error && orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-center">
            <p className="font-semibold text-rose-800">We could not load your orders.</p>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-3 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {/* Active order or Book CTA */}
          <section className="lg:col-span-2 lg:row-start-1" aria-label="Current order">
            {loading ? (
              <div className="h-56 animate-pulse rounded-3xl bg-sky-100/60" aria-hidden />
            ) : primary ? (
              <ActiveOrderCard order={primary} extra={activeOrders.length - 1} />
            ) : (
              <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-sky-500 to-emerald-500 p-6 text-white shadow-lg shadow-sky-200">
                <p className="text-sm font-semibold opacity-90">Need water?</p>
                <h2 className="mt-1 text-2xl font-extrabold">Book your next delivery</h2>
                <p className="mt-1 text-sm opacity-90">
                  From {inr(settings.default_can_price)} per can · pick your own time slot
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/book"
                    className="rounded-xl bg-white px-5 py-3 font-extrabold text-sky-700 shadow-sm hover:bg-sky-50"
                  >
                    Book water →
                  </Link>
                  {lastDelivered ? (
                    <Link
                      href={reorderHref(lastDelivered)}
                      className="rounded-xl border border-white/60 px-5 py-3 font-bold text-white hover:bg-white/10"
                    >
                      ↻ Reorder {lastDelivered.canCount ? `${lastDelivered.canCount} cans` : 'last order'}
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          {/* Stats */}
          <section className="lg:col-start-3 lg:row-start-1" aria-label="Your stats">
            <div className="grid grid-cols-2 gap-3">
              {statsLoading && !statsFailed ? (
                [1, 2, 3, 4].map((k) => <StatSkeleton key={k} />)
              ) : (
                <>
                  <StatCard icon="📦" value={statsFailed ? '—' : String(stats?.total_orders ?? 0)} label="Orders" />
                  <StatCard icon="💧" value={statsFailed ? '—' : String(stats?.cans_ordered ?? 0)} label="Cans ordered" />
                  <StatCard icon="💳" value={statsFailed ? '—' : inrFmt(stats?.total_spent ?? 0)} label="Total spent" />
                  <StatCard icon="📅" value={statsFailed ? '—' : `${memberDays}d`} label="With AuroWater" />
                </>
              )}
            </div>
            {founding ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                <span className="text-2xl" aria-hidden>
                  ⭐
                </span>
                <div>
                  <p className="text-sm font-extrabold text-amber-900">Founding member</p>
                  <p className="text-xs text-amber-800">Thank you for being one of our first 100 customers.</p>
                </div>
              </div>
            ) : null}
          </section>

          {/* Recent */}
          <section className="lg:col-span-2 lg:row-start-2" aria-label="Recent orders">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">Recent orders</h2>
              <Link href="/customer/history" className="text-sm font-bold text-sky-700 hover:underline">
                See all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3" aria-hidden>
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : recent.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div className="text-4xl" aria-hidden>
                  💧
                </div>
                <p className="mt-2 font-extrabold text-slate-900">
                  {orders.length === 0 ? 'No orders yet' : 'No past orders yet'}
                </p>
                <p className="mt-1 text-sm text-slate-500">Completed and cancelled orders show up here.</p>
                {orders.length === 0 ? (
                  <Link
                    href="/book"
                    className="mt-4 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700"
                  >
                    Place your first order →
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-3">
                {recent.map((o) => {
                  const meta = statusMeta(o.status);
                  return (
                    <li key={o.id}>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                        <Link
                          href={`/customer/track/${o.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                          aria-label={`View order ${o.shortId}`}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl" aria-hidden>
                            {serviceEmoji(o.serviceKey)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-extrabold text-slate-900">
                              {o.serviceTitle}
                              {o.serviceKey === 'water_can' && o.canCount ? ` × ${o.canCount}` : ''}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {formatWhen(o.createdAt)}
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${meta.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </span>
                          </span>
                        </Link>
                        <div className="shrink-0 text-right">
                          <p className="font-extrabold text-slate-900">{inrFmt(o.totalAmount)}</p>
                          <Link href={reorderHref(o)} className="text-xs font-bold text-sky-700 hover:underline">
                            ↻ Reorder
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Quick actions */}
          <section className="lg:col-start-3 lg:row-start-2" aria-label="Quick actions">
            <h2 className="mb-3 text-lg font-extrabold text-slate-900">Quick actions</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <QuickAction href="/book" icon="💧" label="Book a service" />
              <QuickAction href="/customer/history" icon="📋" label="Order history" />
              <QuickAction href="/customer/addresses" icon="📍" label="My addresses" />
              <QuickAction href="/pricing" icon="🏷️" label="Pricing" />
              <QuickAction href={WHATSAPP_SUPPORT} icon="💬" label="Get support" external />
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <BottomNav activeOrderId={primary?.id ?? null} />
    </div>
  );
}
