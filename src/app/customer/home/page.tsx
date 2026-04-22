'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import BottomNav from '@/components/customer/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
import { clearSession } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

type CustomerStatsApi = {
  total_spent: number;
  cans_ordered: number;
  member_since: string | null;
};

type OrderRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  can_quantity: number | null;
  supplier_id: string | null;
};

type SupplierLite = {
  id: string;
  full_name: string | null;
  milestone_tier: string | null;
};

type NotificationRow = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  is_read: boolean;
  order_id: string | null;
  type: string | null;
};

const WHATSAPP_SUPPORT = 'https://wa.me/919889305803';

function inr(n: number): string {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

function relTime(iso: string): string {
  try {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return 'Just now';
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function SkeletonLine({ w, h = 12 }: { w: number | string; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: 'linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)',
        backgroundSize: '600px 100%',
        animation: 'awShimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

function statusStepIndex(status: string): number {
  const s = status.toUpperCase();
  if (s === 'PENDING') return 0;
  if (s === 'ASSIGNED') return 1;
  if (s === 'IN_PROGRESS') return 2;
  if (s === 'COMPLETED') return 3;
  return 0;
}

function StatusStepper({ status }: { status: string }) {
  const idx = statusStepIndex(status);
  const steps = ['Order Placed', 'Supplier Assigned', 'On the Way', 'Delivered'];
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        {steps.map((label, i) => {
          const done = i <= idx;
          const active = i === idx;
          return (
            <div key={label} className="flex-1">
              <div className="flex items-center">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-extrabold"
                  style={{
                    background: done ? '#2563EB' : '#E5E7EB',
                    color: done ? '#fff' : '#64748B',
                    boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.12)' : 'none',
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                {i < steps.length - 1 ? (
                  <div className="h-[3px] flex-1 mx-2 rounded-full" style={{ background: i < idx ? '#2563EB' : '#E5E7EB' }} />
                ) : null}
              </div>
              <div className="mt-2 text-[11px] font-semibold" style={{ color: done ? '#1D4ED8' : '#6B7280' }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerHomePage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/home';
  const { hydrated, isLoggedIn, isCustomer, name, fullName, session } = useAuth();

  const [stats, setStats] = useState<CustomerStatsApi | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [supplier, setSupplier] = useState<SupplierLite | null>(null);

  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);

  const [founding, setFounding] = useState<boolean>(false);

  const bellRef = useRef<HTMLButtonElement | null>(null);

  const activeOrder = useMemo(() => {
    const active = orders.find((o) => ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(o.status.toUpperCase()));
    return active ?? null;
  }, [orders]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const firstName = name ?? (fullName?.split(/\s+/)[0] ?? 'there');

  const ensureAuthed = useCallback(() => {
    if (!hydrated) return false;
    if (!isLoggedIn || !isCustomer) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
      return false;
    }
    return true;
  }, [hydrated, isLoggedIn, isCustomer, router, pathname]);

  const authHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    if (!ensureAuthed()) return null;
    const token = await getToken();
    if (!token) {
      clearSession();
      router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, [ensureAuthed, router, pathname]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/stats', { credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: CustomerStatsApi; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load stats');
      setStats(json.data ?? { total_spent: 0, cans_ordered: 0, member_since: null });
    } catch (e: unknown) {
      setStats({ total_spent: 0, cans_ordered: 0, member_since: null });
    } finally {
      setStatsLoading(false);
    }
  }, [authHeaders, router, pathname]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/orders?limit=20&offset=0', { credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load orders');
      const rows = Array.isArray(json.data) ? json.data : [];
      setOrders(
        rows.map((r): OrderRow => {
          const rr = r as Record<string, unknown>;
          return {
            id: String(rr.id ?? ''),
            status: String(rr.status ?? ''),
            total_amount: Number(rr.total_amount ?? 0),
            created_at: String(rr.created_at ?? new Date().toISOString()),
            can_quantity: rr.can_quantity == null ? null : Number(rr.can_quantity),
            supplier_id: rr.supplier_id == null ? null : String(rr.supplier_id),
          };
        })
      );
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [authHeaders, router, pathname]);

  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/notifications?limit=5', { credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load notifications');
      const rows = Array.isArray(json.data) ? json.data : [];
      setNotifs(
        rows.map((r): NotificationRow => {
          const rr = r as Record<string, unknown>;
          return {
            id: String(rr.id ?? ''),
            title: rr.title == null ? null : String(rr.title),
            body: rr.body == null ? (rr.message == null ? null : String(rr.message)) : String(rr.body),
            created_at: String(rr.created_at ?? new Date().toISOString()),
            is_read: Boolean(rr.is_read),
            order_id: rr.order_id == null ? null : String(rr.order_id),
            type: rr.type == null ? null : String(rr.type),
          };
        })
      );
    } catch {
      setNotifs([]);
    } finally {
      setNotifsLoading(false);
    }
  }, [authHeaders, router, pathname]);

  const markAllRead = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch('/api/customer/notifications/read-all', { method: 'PUT', credentials: 'include', headers });
      if (res.status === 401) {
        clearSession();
        router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* best-effort */
    }
  }, [authHeaders, router, pathname]);

  useEffect(() => {
    void loadStats();
    void loadOrders();
    void loadNotifs();
    // Intentionally run once on mount to avoid dependency loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime notifications subscription
  useEffect(() => {
    if (!session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    const channel = sb
      .channel(`notifs_${session.userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.userId}` },
        () => {
          void loadNotifs();
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [session?.accessToken, session?.userId, loadNotifs]);

  // Founding member flag (first 100 customers)
  useEffect(() => {
    if (!session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const { data: me } = await sb.from('profiles').select('created_at, role').eq('id', session.userId).maybeSingle();
      if (!me?.created_at || String(me.role ?? '') !== 'customer') return;
      const createdAt = String(me.created_at);
      const { count } = await sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .lte('created_at', createdAt);
      if (!cancelled) setFounding((count ?? 0) <= 100);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, session?.userId]);

  // Active order supplier badge (name + tier, no phone/address)
  useEffect(() => {
    const sid = activeOrder?.supplier_id ?? null;
    if (!sid || !session?.accessToken) {
      setSupplier(null);
      return;
    }
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void sb
      .from('profiles')
      .select('id, full_name, milestone_tier')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setSupplier({
            id: String((data as { id?: string }).id ?? sid),
            full_name: (data as { full_name?: string | null }).full_name ?? null,
            milestone_tier: (data as { milestone_tier?: string | null }).milestone_tier ?? null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrder?.supplier_id, session?.accessToken]);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const recentOrders = useMemo(() => {
    return orders.filter((o) => o.status.toUpperCase() === 'COMPLETED').slice(0, 3);
  }, [orders]);

  const daysWith = useMemo(() => {
    if (!stats?.member_since) return 0;
    const ms = Date.now() - new Date(stats.member_since).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }, [stats?.member_since]);

  if (!hydrated) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <style>{`
        @keyframes awShimmer { 0%{background-position:-300px 0} 100%{background-position:300px 0} }
      `}</style>

      <div className="mx-auto w-full" style={{ maxWidth: 430 }}>
        {/* [A] Greeting header */}
        <div style={{ padding: '20px 16px 16px', background: '#fff' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="aw-heading" style={{ fontSize: 26, fontWeight: 800, color: '#0A1628', lineHeight: 1.15 }}>
                {greeting}, {firstName} 👋
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#6B7280' }}>
                Gorakhpur&apos;s trusted water delivery
              </div>
            </div>

            <div className="relative">
              <button
                ref={bellRef}
                type="button"
                className="aw-touch"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) {
                    void markAllRead();
                  }
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: '1px solid #E5E7EB',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
                aria-label="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#0A1628" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#EF4444',
                      boxShadow: '0 0 0 2px #fff',
                    }}
                  />
                ) : null}
              </button>

              {notifOpen ? (
                <div
                  className="aw-card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 52,
                    width: 320,
                    maxWidth: 'calc(100vw - 24px)',
                    padding: 14,
                    zIndex: 30,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-extrabold" style={{ color: '#0A1628' }}>
                      Notifications
                    </div>
                    <button
                      type="button"
                      className="text-sm font-bold"
                      onClick={() => void markAllRead()}
                      style={{ color: '#2563EB', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="mt-3">
                    {notifsLoading ? (
                      <div className="space-y-3">
                        <SkeletonLine w="70%" />
                        <SkeletonLine w="90%" />
                        <SkeletonLine w="60%" />
                      </div>
                    ) : notifs.length === 0 ? (
                      <div className="text-sm" style={{ color: '#6B7280' }}>
                        No notifications yet — place an order to get updates
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {notifs.slice(0, 5).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setNotifOpen(false);
                              if (n.order_id) router.push(`/customer/track/${n.order_id}`);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              border: '1px solid #E5E7EB',
                              borderRadius: 14,
                              padding: 12,
                              background: '#fff',
                              cursor: n.order_id ? 'pointer' : 'default',
                            }}
                          >
                            <div className="flex items-start gap-10 justify-between">
                              <div className="min-w-0">
                                <div className="font-bold" style={{ color: '#0A1628' }}>
                                  {n.title ?? 'Update'}
                                </div>
                                <div className="text-sm mt-1" style={{ color: '#6B7280' }}>
                                  {n.body ?? ''}
                                </div>
                              </div>
                              <div className="text-xs font-semibold" style={{ color: '#94A3B8', flexShrink: 0 }}>
                                {relTime(n.created_at)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* [B] Active order card */}
        {!ordersLoading && activeOrder ? (
          <div
            className="aw-card"
            style={{
              margin: '0 16px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
              border: '1px solid #BFDBFE',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0A1628' }}>
              Your order is on the way 🚚
            </div>
            <StatusStepper status={activeOrder.status} />
            {supplier?.full_name ? (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <div className="text-sm font-bold" style={{ color: '#0A1628' }}>
                  {supplier.full_name}
                </div>
                {supplier.milestone_tier ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: '#FFFFFF',
                      border: '1px solid #BFDBFE',
                      color: '#1D4ED8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {supplier.milestone_tier}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>
                Expected in ~25 mins
              </div>
              <button
                type="button"
                className="aw-touch"
                onClick={() => router.push(`/customer/track/${activeOrder.id}`)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: '#2563EB',
                  color: '#fff',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Track Live →
              </button>
            </div>
          </div>
        ) : null}

        {/* [C] Quick order CTA */}
        {!ordersLoading && !activeOrder ? (
          <button
            type="button"
            onClick={() => router.push('/book')}
            className="aw-touch"
            style={{
              margin: '12px 16px 0',
              width: 'calc(100% - 32px)',
              height: 60,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #2563EB, #0EA5E9)',
              boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
              border: 'none',
              color: '#fff',
              textAlign: 'left',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>🚚 Order Water Now</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>₹12/can • Free delivery • 45 min</div>
          </button>
        ) : null}

        {/* [G] Founding member banner */}
        {founding ? (
          <div
            className="aw-card"
            style={{
              margin: '12px 16px 0',
              borderRadius: 16,
              background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)',
              border: '1px solid #F59E0B',
            }}
          >
            <div className="font-extrabold" style={{ color: '#92400E' }}>
              ⭐ Founding Member — 10% off every order
            </div>
          </div>
        ) : null}

        {/* [D] Stats row */}
        <div className="grid grid-cols-3 gap-3" style={{ padding: '12px 16px 0' }}>
          {statsLoading ? (
            <>
              <div className="aw-card" style={{ borderRadius: 12, padding: 12 }}>
                <SkeletonLine w="60%" h={18} />
                <div style={{ height: 6 }} />
                <SkeletonLine w="80%" />
              </div>
              <div className="aw-card" style={{ borderRadius: 12, padding: 12 }}>
                <SkeletonLine w="70%" h={18} />
                <div style={{ height: 6 }} />
                <SkeletonLine w="60%" />
              </div>
              <div className="aw-card" style={{ borderRadius: 12, padding: 12 }}>
                <SkeletonLine w="55%" h={18} />
                <div style={{ height: 6 }} />
                <SkeletonLine w="70%" />
              </div>
            </>
          ) : (
            <>
              <div className="aw-card" style={{ borderRadius: 12, padding: 12, border: '1px solid #F3F4F6' }}>
                <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: '#0A1628' }}>
                  {Math.max(0, stats?.cans_ordered ?? 0)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 2 }}>Cans Ordered</div>
              </div>
              <div className="aw-card" style={{ borderRadius: 12, padding: 12, border: '1px solid #F3F4F6' }}>
                <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: '#0A1628' }}>
                  {inr(stats?.total_spent ?? 0)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 2 }}>Total Spent</div>
              </div>
              <div className="aw-card" style={{ borderRadius: 12, padding: 12, border: '1px solid #F3F4F6' }}>
                <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: '#0A1628' }}>
                  {daysWith} days
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 2 }}>With AuroWater</div>
              </div>
            </>
          )}
        </div>

        {/* [E] Recent orders */}
        <div style={{ padding: '14px 16px 0' }}>
          <div className="flex items-center justify-between">
            <div className="font-extrabold" style={{ color: '#0A1628' }}>
              Recent Orders
            </div>
            <Link href="/customer/history" className="text-sm font-bold" style={{ color: '#2563EB', textDecoration: 'none' }}>
              See all →
            </Link>
          </div>

          <div className="mt-3 space-y-10">
            {ordersLoading ? (
              <div className="aw-card">
                <SkeletonLine w="65%" />
                <div style={{ height: 8 }} />
                <SkeletonLine w="45%" />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="aw-card text-center" style={{ padding: 18 }}>
                <div style={{ fontSize: 36 }}>💧</div>
                <div className="mt-2 font-extrabold" style={{ color: '#0A1628' }}>
                  No orders yet
                </div>
                <div className="mt-1 text-sm" style={{ color: '#6B7280' }}>
                  Place your first order to see updates here.
                </div>
                <button
                  type="button"
                  className="aw-touch"
                  onClick={() => router.push('/book')}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    borderRadius: 16,
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #2563EB, #0EA5E9)',
                    color: '#fff',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Place your first order →
                </button>
              </div>
            ) : (
              recentOrders.map((o) => {
                const cans = Math.max(1, Number(o.can_quantity ?? 1));
                const date = new Date(o.created_at);
                const status = o.status.toUpperCase();
                const pill =
                  status === 'COMPLETED'
                    ? { bg: '#ECFDF5', text: '#065F46' }
                    : status === 'CANCELLED'
                      ? { bg: '#FEF2F2', text: '#B91C1C' }
                      : { bg: '#EFF6FF', text: '#1D4ED8' };
                return (
                  <div key={o.id} className="aw-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 22 }}>💧</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="aw-heading" style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>
                        {cans} cans
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <div className="text-sm" style={{ color: '#6B7280' }}>
                          {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        <span style={{ width: 4, height: 4, borderRadius: 999, background: '#CBD5E1' }} />
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: pill.bg, color: pill.text }}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="aw-heading price-display" style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>
                        {inr(o.total_amount)}
                      </div>
                      <button
                        type="button"
                        className="aw-touch"
                        onClick={() => router.push(`/book?cans=${encodeURIComponent(String(cans))}`)}
                        style={{
                          marginTop: 6,
                          borderRadius: 12,
                          padding: '8px 10px',
                          border: '1px solid #BFDBFE',
                          background: '#fff',
                          color: '#2563EB',
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Reorder
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* [F] Quick actions */}
        <div style={{ padding: '14px 16px 14px' }}>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/customer/addresses" icon="📍" label="My Addresses" />
            <QuickAction href="/customer/history" icon="📋" label="Order History" />
            <QuickAction href="/pricing" icon="💧" label="View Pricing" />
            <QuickAction href={WHATSAPP_SUPPORT} icon="💬" label="Get Support" external />
          </div>
        </div>
      </div>

      <BottomNav activeOrderId={activeOrder?.id ?? null} />
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
  const body = (
    <div className="aw-card" style={{ borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div className="flex items-center gap-10" style={{ gap: 10 }}>
        <div style={{ fontSize: 18 }}>{icon}</div>
        <div className="font-extrabold" style={{ color: '#0A1628' }}>
          {label}
        </div>
      </div>
      <div style={{ color: '#94A3B8', fontWeight: 900 }}>›</div>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {body}
    </Link>
  );
}