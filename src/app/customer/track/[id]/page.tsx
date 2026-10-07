'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ApiError, customerOrderCancel, customerOrderGet, type ApiOrder } from '@/lib/api-client';
import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
import { ReviewModal } from './_components/ReviewModal';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { inr } from '@/hooks/useSettings';
import BottomNav from '@/components/customer/BottomNav';
import { safeGet } from '@/lib/storage';

/* ───────────── Edit these if your routes differ ───────────── */
const ROUTES = {
  home: '/customer/home',
  book: '/book',
  orders: '/customer/history',
} as const;

type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  milestone_tier?: string | null;
  last_seen_at?: string | null;
};

type OrderRow = ApiOrder & Record<string, unknown>;

const STATUS_FLOW = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;
const ACTIVE = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'];

const LABELS: Record<string, string> = {
  PENDING: 'Placed',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

const HERO: Record<string, { emoji: string; title: string; sub: string; tone: string }> = {
  PENDING: {
    emoji: '📦',
    title: 'Order received',
    sub: 'We are lining up the best supplier for you.',
    tone: 'border-slate-200 bg-slate-50 text-slate-800',
  },
  ASSIGNED: {
    emoji: '✅',
    title: 'Supplier assigned',
    sub: 'Your supplier is getting ready for your delivery.',
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  IN_PROGRESS: {
    emoji: '🚚',
    title: 'On the way',
    sub: 'Your order is in progress. Keep your phone nearby.',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  COMPLETED: {
    emoji: '🎉',
    title: 'Delivered',
    sub: 'Thanks for choosing AuroWater. Hope you loved it!',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  CANCELLED: {
    emoji: '🚫',
    title: 'Order cancelled',
    sub: 'No charge was made. You can book again anytime.',
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
  },
};

const CANCEL_REASONS = [
  'Booked by mistake',
  'Need a different time',
  'Found another option',
  'Other',
] as const;

function titleForServiceKey(key: string | null | undefined): string {
  if (!key) return 'Service';
  const map: Record<string, string> = {
    water_can: 'Water cans',
    water_tanker: 'Water tanker',
    ro_service: 'RO service',
    plumbing: 'Plumbing',
    borewell: 'Borewell',
    motor_pump: 'Motor & pump',
    tank_cleaning: 'Tank cleaning',
  };
  return map[key] ?? key.replace(/_/g, ' ');
}

function formatSnapshot(a: Record<string, unknown> | null | undefined): string {
  if (!a) return '—';
  const parts = [a.house_flat, a.area, a.landmark, a.city, a.pincode].filter(
    (x) => typeof x === 'string' && x.trim()
  ) as string[];
  return parts.length ? parts.join(', ') : '—';
}

function mapsHref(addr: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

function fmt(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtDay(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function stepTime(step: string, o: Record<string, unknown>): string {
  switch (step) {
    case 'PENDING':
      return fmt(o.created_at);
    case 'ASSIGNED':
      return fmt(o.assigned_at);
    case 'IN_PROGRESS':
      return fmt(o.accepted_at ?? o.dispatched_at);
    case 'COMPLETED':
      return fmt(o.completed_at);
    default:
      return '';
  }
}

export default function TrackOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || '';
  const { session } = useAuth();
  const { whatsappHref } = useSettings();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelLive, setChannelLive] = useState(false);
  const [tech, setTech] = useState<ProfileLite | null>(null);
  const [supplier, setSupplier] = useState<ProfileLite | null>(null);
  const [supplierRating, setSupplierRating] = useState<number | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelling, setCancelling] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [copied, setCopied] = useState(false);

  /** silent=true refreshes in the background without blanking the page. */
  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const o = (await customerOrderGet(id)) as OrderRow;
        setOrder(o);
        setError(null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.push(`/auth/login?returnTo=${encodeURIComponent(`/customer/track/${id}`)}`);
          return;
        }
        if (!silent) {
          setError(e instanceof ApiError ? e.message : 'Could not load order.');
          setOrder(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, router]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the first paint useful even when the API/network is slow.
  useEffect(() => {
    if (!loading) {
      setLoadingSlow(false);
      return;
    }

    const timer = window.setTimeout(() => setLoadingSlow(true), 3500);
    return () => window.clearTimeout(timer);
  }, [loading]);

  /* Realtime updates */
  useEffect(() => {
    if (!session?.accessToken || !id) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;

    const channel = sb
      .channel(`order_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setOrder((prev) => ({ ...(prev ?? {}), ...row }) as OrderRow);
        }
      )
      .subscribe((s) => setChannelLive(s === 'SUBSCRIBED'));

    return () => {
      void sb.removeChannel(channel);
    };
  }, [session?.accessToken, id]);

  const status = String(order?.status ?? '');
  const supplierId = String((order as Record<string, unknown> | null)?.supplier_id ?? '').trim();
  const technicianId = String((order as Record<string, unknown> | null)?.technician_id ?? '').trim();
  const isActive = ACTIVE.includes(status);

  /* Auto-refresh for every active status (fast when realtime is down, slow safety net when live) */
  useEffect(() => {
    if (!id || !isActive) return;
    const ms = channelLive ? 60_000 : 12_000;
    const tick = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const t = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [id, isActive, channelLive, load]);

  /* Review prompt on completion */
  useEffect(() => {
    if (status !== 'COMPLETED' || typeof window === 'undefined') return;
    if (safeGet(`reviewed_${id}`)) return;
    const t = window.setTimeout(() => setShowReview(true), 1200);
    return () => window.clearTimeout(t);
  }, [status, id]);

  /* Escape closes cancel dialog */
  useEffect(() => {
    if (!showCancel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCancel(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCancel]);

  /* Technician profile */
  useEffect(() => {
    if (!technicianId || !session?.accessToken) {
      setTech(null);
      return;
    }
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void sb
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', technicianId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setTech(data as ProfileLite);
      });
    return () => {
      cancelled = true;
    };
  }, [technicianId, session?.accessToken]);

  /* Supplier profile + rating (re-runs only when the supplier changes) */
  useEffect(() => {
    if (!supplierId || !session?.accessToken) {
      setSupplier(null);
      setSupplierRating(null);
      return;
    }
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;

    void sb
      .from('profiles')
      .select('id, full_name, avatar_url, milestone_tier, last_seen_at')
      .eq('id', supplierId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setSupplier(data as ProfileLite);
      });

    void (async () => {
      const { data: orders } = await sb
        .from('orders')
        .select('id')
        .eq('supplier_id', supplierId)
        .limit(300);
      const ids = (orders ?? [])
        .map((o) => String((o as { id?: string }).id ?? ''))
        .filter(Boolean);
      if (!ids.length) return;
      const { data: revs } = await sb.from('reviews').select('rating').in('order_id', ids);
      const nums = (revs ?? [])
        .map((r) => Number((r as { rating?: number }).rating ?? 0))
        .filter((n) => n > 0);
      if (!cancelled) {
        setSupplierRating(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supplierId, session?.accessToken]);

  const serviceKey = (order?.service_type_key as string | undefined) ?? '';
  const addrStr = formatSnapshot(order?.address_snapshot as Record<string, unknown> | null);

  const timelineSteps = useMemo(() => {
    const idx = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
    return STATUS_FLOW.map((s, i) => ({
      key: s,
      label: LABELS[s] ?? s,
      done: idx >= 0 && idx >= i,
      current: idx === i,
    }));
  }, [status]);

  const supportWa =
    whatsappHref ??
    `https://wa.me/91${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '9889305803').replace(/\D/g, '')}`;

  const supportNeedsSupplierHref = `https://wa.me/919889305803?text=${encodeURIComponent(
    `My order ${id} needs a supplier`
  )}`;

  const unassignedPending = status === 'PENDING' && !supplierId;

  const pendingTooLong =
    unassignedPending &&
    Boolean(order?.created_at) &&
    Date.now() - new Date(String(order?.created_at ?? '')).getTime() > 5 * 60_000;

  function minsAgo(iso: string | null | undefined): string {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.max(0, Math.floor(ms / 60_000));
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)} h ago`;
  }

  const onCancel = async () => {
    if (!id || cancelling) return;
    setCancelling(true);
    try {
      const updated = await customerOrderCancel(id, cancelReason);
      setOrder((prev) => ({ ...(prev ?? {}), ...updated }) as OrderRow);
      toast.success('Order cancelled.');
      setShowCancel(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Cancel failed.');
      void load(true);
    } finally {
      setCancelling(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy.');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f9fb] text-slate-900">
        <div className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="h-10 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="h-10 w-32 animate-pulse rounded-full bg-slate-200" />
          </div>

          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-[#071a2f] via-[#0a2740] to-[#075e70] px-5 py-7 sm:px-8 sm:py-9">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-white/10" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
                  <div className="h-7 w-56 max-w-full animate-pulse rounded bg-white/10" />
                  <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/10" />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              <div className="mb-7 h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="grid gap-5 sm:grid-cols-4">
                {STATUS_FLOW.map((step) => (
                  <div key={step} className="space-y-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                    <div className="h-2 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
            <div className="h-44 animate-pulse rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200" />
            <div className="h-44 animate-pulse rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200" />
          </div>

          <div className="mt-5 text-center" aria-live="polite">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
              {loadingSlow
                ? 'Still connecting securely — this can take a moment.'
                : 'Loading your live order details…'}
            </div>
            {loadingSlow ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-sm font-bold text-cyan-700 underline-offset-4 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-slate-800 font-semibold">{error ?? 'Order not found.'}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 font-semibold"
          >
            Retry
          </button>
          <Link
            href={ROUTES.home}
            className="rounded-xl border border-emerald-600 text-emerald-700 px-5 py-2.5 font-semibold"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const o = order as Record<string, unknown>;
  const total = Number(order.total_amount ?? 0);
  const base = Number(o.base_amount ?? 0);
  const conv = Number(o.convenience_fee ?? 0);
  const gst = Number(o.gst_amount ?? 0);
  const emerg = Number(o.emergency_charge ?? 0);
  const canCancel = status === 'PENDING' || status === 'ASSIGNED';
  const hero = HERO[status];
  const shortId = String(o.order_number ?? id.slice(0, 8));

  const slotMatch = /Slot:\s*([^|]+)/.exec(String(o.note ?? ''));
  const slot = slotMatch ? slotMatch[1].trim() : '';
  const scheduledText = o.scheduled_at
    ? `${fmtDay(o.scheduled_at)}${slot ? ` · ${slot}` : ''}`
    : slot;

  const finished = status === 'COMPLETED' || status === 'CANCELLED';

  return (
    <main className="min-h-screen bg-[#f6f9fb] text-slate-900">
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:px-6 sm:pt-7">
        {/* Compact navigation */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href={ROUTES.orders}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
          >
            <span aria-hidden>←</span>
            <span className="hidden xs:inline">My orders</span>
            <span className="xs:hidden">Back</span>
          </Link>

          <Link
            href={ROUTES.book}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#071a2f] px-4 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-[#0b2946] active:scale-[0.98]"
          >
            <span aria-hidden>+</span>
            Book a service
          </Link>
        </div>

        {/* Primary status hero */}
        <section
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#06172a] via-[#0a2942] to-[#087184] text-white shadow-xl shadow-cyan-950/10"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-2xl shadow-inner shadow-white/5">
                  {hero?.emoji ?? '💧'}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">
                      Order {shortId}
                    </span>
                    {channelLive && isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                        Live
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                    {hero?.title ?? status.replace(/_/g, ' ')}
                  </h1>

                  <p className="mt-1 max-w-xl text-sm leading-6 text-white/65">
                    {hero?.sub ?? 'We are keeping your order updated.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void copyId()}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/15"
                title="Copy order ID"
              >
                {copied ? 'Copied ✓' : 'Copy ID'}
              </button>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Service</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{titleForServiceKey(serviceKey)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Scheduled</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{scheduledText || 'As soon as possible'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Total</p>
                <p className="mt-1 text-sm font-bold text-white">{inr(total)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Supplier matching state */}
        {unassignedPending ? (
          <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-cyan-100 bg-white shadow-sm">
            <div className="flex items-start gap-4 p-5 sm:p-6">
              <div className="relative mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-xl">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan-100/50 motion-reduce:animate-none" />
                <span className="relative">🔎</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold text-slate-900">Finding your supplier</h2>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      We&apos;re checking nearby availability. You can leave this page safely.
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">Auto-updating</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-1/2 animate-[pulse_1.8s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
                </div>
                {pendingTooLong ? (
                  <a
                    href={supportNeedsSupplierHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white transition hover:bg-cyan-700"
                  >
                    Need help finding a supplier?
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Progress */}
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">Live journey</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Order progress</h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {status === 'CANCELLED' ? 'Closed' : channelLive ? 'Live updates' : 'Auto refresh'}
            </span>
          </div>

          {status === 'CANCELLED' ? (
            <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              This order was cancelled{fmt(o.cancelled_at) ? ` on ${fmt(o.cancelled_at)}` : ''}.
            </div>
          ) : (
            <ol className="mt-7 grid gap-5 sm:grid-cols-4">
              {timelineSteps.map((step, i) => (
                <li key={step.key} className="relative min-w-0">
                  {i < timelineSteps.length - 1 ? (
                    <div
                      className={`absolute left-10 right-[-1.25rem] top-5 hidden h-0.5 sm:block ${
                        timelineSteps[i + 1].done ? 'bg-cyan-500' : 'bg-slate-200'
                      }`}
                      aria-hidden
                    />
                  ) : null}

                  <div className="relative flex items-center gap-3 sm:block">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black transition ${
                        step.done
                          ? 'border-cyan-500 bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                          : 'border-slate-200 bg-white text-slate-400'
                      } ${step.current && isActive ? 'ring-4 ring-cyan-100' : ''}`}
                    >
                      {step.done ? '✓' : i + 1}
                    </div>
                    <div className="min-w-0 sm:mt-3">
                      <p className={`text-sm font-extrabold ${step.current ? 'text-cyan-700' : 'text-slate-700'}`}>
                        {step.label}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {step.done ? stepTime(step.key, o) || 'Completed' : 'Pending'}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Operational details */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          {supplier && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">Your service partner</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Supplier</h2>
                </div>
                {supplierRating != null ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                    ★ {supplierRating.toFixed(1)}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-100 text-lg font-black text-cyan-800">
                  {(supplier.full_name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-slate-900">{supplier.full_name ?? 'Assigned supplier'}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    {supplier.milestone_tier && supplier.milestone_tier !== 'starter' ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">
                        {String(supplier.milestone_tier).toUpperCase()}
                      </span>
                    ) : null}
                    <span>Active {minsAgo(supplier.last_seen_at ?? null)}</span>
                  </div>
                </div>
              </div>

              <a
                href={`${supportWa}?text=${encodeURIComponent(
                  `Hi — I'm customer for order ${shortId}. Please connect me with the supplier.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 text-sm font-extrabold text-white shadow-sm transition hover:brightness-95"
              >
                💬 Contact via WhatsApp
              </a>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                Supplier phone is shared only after the delivery starts.
              </p>
            </section>
          ) : null}

          {tech && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Assigned professional</p>
              <h2 className="mt-1 text-lg font-black text-slate-900">Technician</h2>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-black text-emerald-800">
                  {(tech.full_name ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-slate-900">{tech.full_name ?? 'Assigned pro'}</p>
                  <p className="mt-1 text-xs text-slate-500">Verified service professional</p>
                </div>
              </div>
              <a
                href={`${supportWa}?text=${encodeURIComponent(`Hi — I'm customer for order ${shortId}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                💬 Contact support
              </a>
            </section>
          ) : null}
        </div>

        {/* Order details */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Payment</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Order total</h2>
              </div>
              <p className="text-xl font-black text-slate-900">{inr(total)}</p>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Base</span>
                <span className="font-semibold text-slate-800">{inr(base)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Convenience</span>
                <span className="font-semibold text-slate-800">{inr(conv)}</span>
              </div>
              {gst > 0 ? (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">GST</span>
                  <span className="font-semibold text-slate-800">{inr(gst)}</span>
                </div>
              ) : null}
              {emerg > 0 ? (
                <div className="flex justify-between gap-4 text-amber-700">
                  <span>Emergency</span>
                  <span className="font-semibold">{inr(emerg)}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {String(o.payment_method ?? 'cash').toUpperCase()}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                  String(o.payment_status ?? 'unpaid').toLowerCase() === 'paid'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {String(o.payment_status ?? 'unpaid').toLowerCase() === 'paid' ? 'Paid' : 'Payment pending'}
              </span>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Delivery</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Service address</h2>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold leading-6 text-slate-700">{addrStr}</p>
            </div>
            {addrStr !== '—' ? (
              <a
                href={mapsHref(addrStr)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-extrabold text-cyan-800 transition hover:bg-cyan-100"
              >
                Open in Maps →
              </a>
            ) : null}
          </section>
        </div>

        {/* Actions */}
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {canCancel ? (
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-5 text-sm font-extrabold text-rose-700 transition hover:bg-rose-100"
              >
                Cancel order
              </button>
            ) : null}

            {status === 'COMPLETED' && !safeGet(`reviewed_${id}`) ? (
              <button
                type="button"
                onClick={() => setShowReview(true)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-amber-600"
              >
                ★ Rate your experience
              </button>
            ) : null}

            <a
              href={`${supportWa}?text=${encodeURIComponent(`Need help with order ${shortId}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071a2f] px-5 text-sm font-extrabold text-white transition hover:bg-[#0b2946]"
            >
              Need help?
            </a>
          </div>
        </section>

        {/* Next action */}
        <section className="mt-5 overflow-hidden rounded-[2rem] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-5 shadow-sm sm:p-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">
            {finished ? 'Next step' : 'While you wait'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
            {finished ? 'Ready for your next service?' : 'You can safely leave this page.'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {finished
              ? 'Your order is complete. Book again or explore another AuroWater service whenever you need it.'
              : 'AuroTap keeps your order updated in the background. We will continue tracking the journey for you.'}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Link
              href={ROUTES.home}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              Home
            </Link>
            <Link
              href={ROUTES.book}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-extrabold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-105"
            >
              Explore services
            </Link>
            <Link
              href={ROUTES.orders}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              My orders
            </Link>
          </div>

          {finished && serviceKey ? (
            <Link
              href={`${ROUTES.book}?service=${encodeURIComponent(serviceKey)}`}
              className="mt-3 inline-flex text-sm font-extrabold text-cyan-700 underline-offset-4 hover:underline"
            >
              ↻ Book {titleForServiceKey(serviceKey)} again
            </Link>
          ) : null}
        </section>

        {showReview ? <ReviewModal orderId={id} onClose={() => setShowReview(false)} /> : null}

        {showCancel && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCancel(false);
            }}
          >
            <div className="w-full max-w-md space-y-4 rounded-[2rem] bg-white p-6 shadow-2xl sm:p-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600">Order action</p>
                <h3 id="cancel-title" className="mt-1 text-xl font-black text-slate-900">
                  Cancel this order?
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  #{shortId} · {titleForServiceKey(serviceKey)}
                  {scheduledText ? ` · ${scheduledText}` : ''}
                </p>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-extrabold text-slate-700">Reason</legend>
                {CANCEL_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition ${
                      cancelReason === r
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      checked={cancelReason === r}
                      onChange={() => setCancelReason(r)}
                      className="accent-rose-600"
                    />
                    {r}
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowCancel(false)}
                >
                  Keep order
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-extrabold text-white disabled:opacity-50"
                  onClick={() => void onCancel()}
                >
                  {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          AuroTap keeps your order status protected and continuously updated.
        </p>
      </div>
      <BottomNav />
    </main>
  );
}















// 'use client';

// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import Link from 'next/link';
// import { useParams, useRouter } from 'next/navigation';
// import { toast } from 'sonner';

// import { ApiError, customerOrderCancel, customerOrderGet, type ApiOrder } from '@/lib/api-client';
// import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
// import { ReviewModal } from './_components/ReviewModal';
// import { useAuth } from '@/hooks/useAuth';
// import { useSettings } from '@/hooks/useSettings';
// import { inr } from '@/hooks/useSettings';
// import BottomNav from '@/components/customer/BottomNav';
// import { safeGet } from '@/lib/storage';

// /* ───────────── Edit these if your routes differ ───────────── */
// const ROUTES = {
//   home: '/customer/home',
//   book: '/book',
//   orders: '/customer/history',
// } as const;

// type ProfileLite = {
//   id: string;
//   full_name: string | null;
//   avatar_url: string | null;
//   milestone_tier?: string | null;
//   last_seen_at?: string | null;
// };

// type OrderRow = ApiOrder & Record<string, unknown>;

// const STATUS_FLOW = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;
// const ACTIVE = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'];

// const LABELS: Record<string, string> = {
//   PENDING: 'Placed',
//   ASSIGNED: 'Assigned',
//   IN_PROGRESS: 'In progress',
//   COMPLETED: 'Completed',
// };

// const HERO: Record<string, { emoji: string; title: string; sub: string; tone: string }> = {
//   PENDING: {
//     emoji: '📦',
//     title: 'Order received',
//     sub: 'We are lining up the best supplier for you.',
//     tone: 'border-slate-200 bg-slate-50 text-slate-800',
//   },
//   ASSIGNED: {
//     emoji: '✅',
//     title: 'Supplier assigned',
//     sub: 'Your supplier is getting ready for your delivery.',
//     tone: 'border-sky-200 bg-sky-50 text-sky-900',
//   },
//   IN_PROGRESS: {
//     emoji: '🚚',
//     title: 'On the way',
//     sub: 'Your order is in progress. Keep your phone nearby.',
//     tone: 'border-amber-200 bg-amber-50 text-amber-900',
//   },
//   COMPLETED: {
//     emoji: '🎉',
//     title: 'Delivered',
//     sub: 'Thanks for choosing AuroWater. Hope you loved it!',
//     tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
//   },
//   CANCELLED: {
//     emoji: '🚫',
//     title: 'Order cancelled',
//     sub: 'No charge was made. You can book again anytime.',
//     tone: 'border-rose-200 bg-rose-50 text-rose-900',
//   },
// };

// const CANCEL_REASONS = [
//   'Booked by mistake',
//   'Need a different time',
//   'Found another option',
//   'Other',
// ] as const;

// function titleForServiceKey(key: string | null | undefined): string {
//   if (!key) return 'Service';
//   const map: Record<string, string> = {
//     water_can: 'Water cans',
//     water_tanker: 'Water tanker',
//     ro_service: 'RO service',
//     plumbing: 'Plumbing',
//     borewell: 'Borewell',
//     motor_pump: 'Motor & pump',
//     tank_cleaning: 'Tank cleaning',
//   };
//   return map[key] ?? key.replace(/_/g, ' ');
// }

// function formatSnapshot(a: Record<string, unknown> | null | undefined): string {
//   if (!a) return '—';
//   const parts = [a.house_flat, a.area, a.landmark, a.city, a.pincode].filter(
//     (x) => typeof x === 'string' && x.trim()
//   ) as string[];
//   return parts.length ? parts.join(', ') : '—';
// }

// function mapsHref(addr: string): string {
//   return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
// }

// function fmt(iso: unknown): string {
//   if (typeof iso !== 'string' || !iso) return '';
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return '';
//   return d.toLocaleString('en-IN', {
//     day: 'numeric',
//     month: 'short',
//     hour: 'numeric',
//     minute: '2-digit',
//   });
// }

// function fmtDay(iso: unknown): string {
//   if (typeof iso !== 'string' || !iso) return '';
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return '';
//   return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
// }

// function stepTime(step: string, o: Record<string, unknown>): string {
//   switch (step) {
//     case 'PENDING':
//       return fmt(o.created_at);
//     case 'ASSIGNED':
//       return fmt(o.assigned_at);
//     case 'IN_PROGRESS':
//       return fmt(o.accepted_at ?? o.dispatched_at);
//     case 'COMPLETED':
//       return fmt(o.completed_at);
//     default:
//       return '';
//   }
// }

// export default function TrackOrderPage() {
//   const params = useParams();
//   const router = useRouter();
//   const id = (params?.id as string) || '';
//   const { session } = useAuth();
//   const { whatsappHref } = useSettings();

//   const [order, setOrder] = useState<OrderRow | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [channelLive, setChannelLive] = useState(false);
//   const [tech, setTech] = useState<ProfileLite | null>(null);
//   const [supplier, setSupplier] = useState<ProfileLite | null>(null);
//   const [supplierRating, setSupplierRating] = useState<number | null>(null);
//   const [showCancel, setShowCancel] = useState(false);
//   const [cancelReason, setCancelReason] = useState<string>(CANCEL_REASONS[0]);
//   const [cancelling, setCancelling] = useState(false);
//   const [showReview, setShowReview] = useState(false);
//   const [copied, setCopied] = useState(false);

//   /** silent=true refreshes in the background without blanking the page. */
//   const load = useCallback(
//     async (silent = false) => {
//       if (!id) return;
//       if (!silent) {
//         setLoading(true);
//         setError(null);
//       }
//       try {
//         const o = (await customerOrderGet(id)) as OrderRow;
//         setOrder(o);
//         setError(null);
//       } catch (e) {
//         if (e instanceof ApiError && e.status === 401) {
//           router.push(`/auth/login?returnTo=${encodeURIComponent(`/customer/track/${id}`)}`);
//           return;
//         }
//         if (!silent) {
//           setError(e instanceof ApiError ? e.message : 'Could not load order.');
//           setOrder(null);
//         }
//       } finally {
//         if (!silent) setLoading(false);
//       }
//     },
//     [id, router]
//   );

//   useEffect(() => {
//     void load();
//   }, [load]);

//   /* Realtime updates */
//   useEffect(() => {
//     if (!session?.accessToken || !id) return;
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;

//     const channel = sb
//       .channel(`order_${id}`)
//       .on(
//         'postgres_changes',
//         { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
//         (payload) => {
//           const row = payload.new as Record<string, unknown>;
//           setOrder((prev) => ({ ...(prev ?? {}), ...row }) as OrderRow);
//         }
//       )
//       .subscribe((s) => setChannelLive(s === 'SUBSCRIBED'));

//     return () => {
//       void sb.removeChannel(channel);
//     };
//   }, [session?.accessToken, id]);

//   const status = String(order?.status ?? '');
//   const supplierId = String((order as Record<string, unknown> | null)?.supplier_id ?? '').trim();
//   const technicianId = String((order as Record<string, unknown> | null)?.technician_id ?? '').trim();
//   const isActive = ACTIVE.includes(status);

//   /* Auto-refresh for every active status (fast when realtime is down, slow safety net when live) */
//   useEffect(() => {
//     if (!id || !isActive) return;
//     const ms = channelLive ? 60_000 : 12_000;
//     const tick = () => {
//       if (document.visibilityState === 'visible') void load(true);
//     };
//     const t = window.setInterval(tick, ms);
//     document.addEventListener('visibilitychange', tick);
//     return () => {
//       window.clearInterval(t);
//       document.removeEventListener('visibilitychange', tick);
//     };
//   }, [id, isActive, channelLive, load]);

//   /* Review prompt on completion */
//   useEffect(() => {
//     if (status !== 'COMPLETED' || typeof window === 'undefined') return;
//     if (safeGet(`reviewed_${id}`)) return;
//     const t = window.setTimeout(() => setShowReview(true), 1200);
//     return () => window.clearTimeout(t);
//   }, [status, id]);

//   /* Escape closes cancel dialog */
//   useEffect(() => {
//     if (!showCancel) return;
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === 'Escape') setShowCancel(false);
//     };
//     window.addEventListener('keydown', onKey);
//     return () => window.removeEventListener('keydown', onKey);
//   }, [showCancel]);

//   /* Technician profile */
//   useEffect(() => {
//     if (!technicianId || !session?.accessToken) {
//       setTech(null);
//       return;
//     }
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     let cancelled = false;
//     void sb
//       .from('profiles')
//       .select('id, full_name, avatar_url')
//       .eq('id', technicianId)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (!cancelled && data) setTech(data as ProfileLite);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [technicianId, session?.accessToken]);

//   /* Supplier profile + rating (re-runs only when the supplier changes) */
//   useEffect(() => {
//     if (!supplierId || !session?.accessToken) {
//       setSupplier(null);
//       setSupplierRating(null);
//       return;
//     }
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     let cancelled = false;

//     void sb
//       .from('profiles')
//       .select('id, full_name, avatar_url, milestone_tier, last_seen_at')
//       .eq('id', supplierId)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (!cancelled && data) setSupplier(data as ProfileLite);
//       });

//     void (async () => {
//       const { data: orders } = await sb
//         .from('orders')
//         .select('id')
//         .eq('supplier_id', supplierId)
//         .limit(300);
//       const ids = (orders ?? [])
//         .map((o) => String((o as { id?: string }).id ?? ''))
//         .filter(Boolean);
//       if (!ids.length) return;
//       const { data: revs } = await sb.from('reviews').select('rating').in('order_id', ids);
//       const nums = (revs ?? [])
//         .map((r) => Number((r as { rating?: number }).rating ?? 0))
//         .filter((n) => n > 0);
//       if (!cancelled) {
//         setSupplierRating(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
//       }
//     })();

//     return () => {
//       cancelled = true;
//     };
//   }, [supplierId, session?.accessToken]);

//   const serviceKey = (order?.service_type_key as string | undefined) ?? '';
//   const addrStr = formatSnapshot(order?.address_snapshot as Record<string, unknown> | null);

//   const timelineSteps = useMemo(() => {
//     const idx = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
//     return STATUS_FLOW.map((s, i) => ({
//       key: s,
//       label: LABELS[s] ?? s,
//       done: idx >= 0 && idx >= i,
//       current: idx === i,
//     }));
//   }, [status]);

//   const supportWa =
//     whatsappHref ??
//     `https://wa.me/91${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '9889305803').replace(/\D/g, '')}`;

//   const supportNeedsSupplierHref = `https://wa.me/919889305803?text=${encodeURIComponent(
//     `My order ${id} needs a supplier`
//   )}`;

//   const unassignedPending = status === 'PENDING' && !supplierId;

//   const pendingTooLong =
//     unassignedPending &&
//     Boolean(order?.created_at) &&
//     Date.now() - new Date(String(order?.created_at ?? '')).getTime() > 5 * 60_000;

//   function minsAgo(iso: string | null | undefined): string {
//     if (!iso) return '—';
//     const ms = Date.now() - new Date(iso).getTime();
//     const m = Math.max(0, Math.floor(ms / 60_000));
//     if (m < 1) return 'just now';
//     if (m < 60) return `${m} min ago`;
//     return `${Math.floor(m / 60)} h ago`;
//   }

//   const onCancel = async () => {
//     if (!id || cancelling) return;
//     setCancelling(true);
//     try {
//       const updated = await customerOrderCancel(id, cancelReason);
//       setOrder((prev) => ({ ...(prev ?? {}), ...updated }) as OrderRow);
//       toast.success('Order cancelled.');
//       setShowCancel(false);
//     } catch (e) {
//       toast.error(e instanceof ApiError ? e.message : 'Cancel failed.');
//       void load(true);
//     } finally {
//       setCancelling(false);
//     }
//   };

//   const copyId = async () => {
//     try {
//       await navigator.clipboard.writeText(id);
//       setCopied(true);
//       window.setTimeout(() => setCopied(false), 1800);
//     } catch {
//       toast.error('Could not copy.');
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-600 text-sm font-medium">
//         <span className="h-8 w-8 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />
//         Loading your order…
//       </div>
//     );
//   }

//   if (error || !order) {
//     return (
//       <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
//         <p className="text-slate-800 font-semibold">{error ?? 'Order not found.'}</p>
//         <div className="flex flex-col sm:flex-row gap-3 justify-center">
//           <button
//             type="button"
//             onClick={() => void load()}
//             className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 font-semibold"
//           >
//             Retry
//           </button>
//           <Link
//             href={ROUTES.home}
//             className="rounded-xl border border-emerald-600 text-emerald-700 px-5 py-2.5 font-semibold"
//           >
//             Back to home
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   const o = order as Record<string, unknown>;
//   const total = Number(order.total_amount ?? 0);
//   const base = Number(o.base_amount ?? 0);
//   const conv = Number(o.convenience_fee ?? 0);
//   const gst = Number(o.gst_amount ?? 0);
//   const emerg = Number(o.emergency_charge ?? 0);
//   const canCancel = status === 'PENDING' || status === 'ASSIGNED';
//   const hero = HERO[status];
//   const shortId = String(o.order_number ?? id.slice(0, 8));

//   const slotMatch = /Slot:\s*([^|]+)/.exec(String(o.note ?? ''));
//   const slot = slotMatch ? slotMatch[1].trim() : '';
//   const scheduledText = o.scheduled_at
//     ? `${fmtDay(o.scheduled_at)}${slot ? ` · ${slot}` : ''}`
//     : slot;

//   const finished = status === 'COMPLETED' || status === 'CANCELLED';

//   return (
//     <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28">
//       {/* Top bar: always a way out */}
//       <div className="flex items-center justify-between gap-3">
//         <Link
//           href={ROUTES.home}
//           className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
//         >
//           <span aria-hidden>←</span> Home
//         </Link>
//         <Link
//           href={ROUTES.book}
//           className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
//         >
//           + Book a service
//         </Link>
//       </div>

//       {hero ? (
//         <div className={`rounded-2xl border px-5 py-4 ${hero.tone}`} role="status" aria-live="polite">
//           <div className="flex items-center gap-3">
//             <span className="text-3xl" aria-hidden>
//               {hero.emoji}
//             </span>
//             <div>
//               <div className="font-extrabold">{hero.title}</div>
//               <div className="text-sm opacity-90">{hero.sub}</div>
//             </div>
//           </div>
//         </div>
//       ) : null}

//       {unassignedPending ? (
//         <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
//           <div className="flex items-center justify-between gap-3 flex-wrap">
//             <div>
//               <div className="font-extrabold text-sky-900">🔍 Finding your supplier…</div>
//               <div className="text-sm text-sky-800 mt-1">Checking nearby suppliers. This page updates by itself.</div>
//             </div>
//             <div className="h-2 w-24 rounded-full bg-sky-200 overflow-hidden">
//               <div className="h-full w-1/2 bg-sky-500 animate-pulse" />
//             </div>
//           </div>
//           {pendingTooLong ? (
//             <div className="mt-3">
//               <a
//                 href={supportNeedsSupplierHref}
//                 target="_blank"
//                 rel="noreferrer"
//                 className="inline-flex items-center justify-center rounded-xl bg-sky-600 text-white px-4 py-2.5 font-semibold"
//               >
//                 Contact support — we&apos;ll find one for you
//               </a>
//             </div>
//           ) : null}
//         </div>
//       ) : null}

//       <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 relative overflow-hidden">
//         <div className="flex flex-wrap items-start justify-between gap-4">
//           <div>
//             <button
//               type="button"
//               onClick={() => void copyId()}
//               className="text-xs font-semibold uppercase text-emerald-700 tracking-wide hover:underline"
//               title="Copy order ID"
//             >
//               #{shortId} {copied ? '· copied ✓' : '· copy ID'}
//             </button>
//             <h1
//               className="mt-1 text-2xl font-extrabold text-[#0F172A]"
//               style={{ fontFamily: 'var(--font-syne), Syne, sans-serif' }}
//             >
//               {titleForServiceKey(serviceKey)}
//             </h1>
//             {scheduledText ? (
//               <p className="mt-1 text-sm text-slate-600">Scheduled: {scheduledText}</p>
//             ) : null}
//           </div>
//           <div className="flex flex-wrap items-center justify-end gap-2">
//             {channelLive && isActive ? (
//               <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
//                 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
//                 Live
//               </span>
//             ) : null}
//             <span
//               className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold border ${
//                 status === 'COMPLETED'
//                   ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
//                   : status === 'CANCELLED'
//                     ? 'bg-rose-50 border-rose-200 text-rose-800'
//                     : 'bg-slate-50 border-slate-200 text-slate-800'
//               }`}
//             >
//               {status.replace(/_/g, ' ')}
//             </span>
//           </div>
//         </div>

//         <div className="mt-8">
//           <p className="text-sm font-semibold text-slate-700 mb-4">Order progress</p>
//           {status === 'CANCELLED' ? (
//             <p className="text-sm text-rose-700 font-medium">
//               This order was cancelled{fmt(o.cancelled_at) ? ` on ${fmt(o.cancelled_at)}` : ''}.
//             </p>
//           ) : (
//             <ol className="flex flex-col gap-4 sm:flex-row sm:justify-between">
//               {timelineSteps.map((step, i, arr) => (
//                 <li
//                   key={step.key}
//                   className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2 min-w-0"
//                   aria-current={step.current ? 'step' : undefined}
//                 >
//                   <div className="flex items-center sm:flex-col sm:w-full gap-2">
//                     <div
//                       className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
//                         step.done
//                           ? 'border-emerald-500 bg-emerald-500 text-white'
//                           : 'border-slate-200 text-slate-400 bg-white'
//                       } ${step.current && isActive ? 'ring-4 ring-emerald-100' : ''}`}
//                     >
//                       {step.done ? '✓' : i + 1}
//                     </div>
//                     {i < arr.length - 1 ? (
//                       <div
//                         className={`hidden sm:block flex-1 h-1 rounded-full min-w-[12px] ${
//                           step.done && !step.current ? 'bg-emerald-400' : 'bg-slate-200'
//                         }`}
//                         aria-hidden
//                       />
//                     ) : null}
//                   </div>
//                   <div className="sm:text-center min-w-0">
//                     <p
//                       className={`text-sm font-semibold truncate ${
//                         step.current ? 'text-emerald-700' : 'text-slate-700'
//                       }`}
//                     >
//                       {step.label}
//                     </p>
//                     <p className="text-xs text-slate-500 truncate">
//                       {step.done ? stepTime(step.key, o) : ''}
//                     </p>
//                   </div>
//                 </li>
//               ))}
//             </ol>
//           )}
//         </div>
//       </div>

//       {supplier && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && (
//         <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
//           <h2 className="font-bold text-slate-900">Supplier</h2>
//           <div className="flex items-center gap-4">
//             <div className="h-14 w-14 rounded-full bg-sky-100 flex items-center justify-center text-xl font-extrabold text-sky-800">
//               {(supplier.full_name ?? '?').slice(0, 1)}
//             </div>
//             <div className="flex-1">
//               <p className="font-semibold text-slate-900">{supplier.full_name ?? 'Assigned supplier'}</p>
//               <div className="flex flex-wrap gap-2 mt-1 items-center">
//                 {supplier.milestone_tier && supplier.milestone_tier !== 'starter' ? (
//                   <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800">
//                     {String(supplier.milestone_tier).toUpperCase()}
//                   </span>
//                 ) : null}
//                 <span className="text-xs text-slate-500">
//                   Last active: {minsAgo(supplier.last_seen_at ?? null)}
//                 </span>
//                 {supplierRating != null ? (
//                   <span className="text-xs font-semibold text-amber-700">
//                     ★ {supplierRating.toFixed(1)} avg rating
//                   </span>
//                 ) : null}
//               </div>
//             </div>
//           </div>
//           <div className="flex gap-3 flex-wrap">
//             <a
//               href={`${supportWa}?text=${encodeURIComponent(
//                 `Hi — I'm customer for order ${shortId}. Please connect me with the supplier.`
//               )}`}
//               target="_blank"
//               rel="noreferrer"
//               className="rounded-xl bg-slate-900 text-white px-4 py-2 font-semibold"
//             >
//               💬 WhatsApp
//             </a>
//           </div>
//           <p className="text-xs text-slate-500">Supplier phone is shared only after the delivery starts.</p>
//         </div>
//       )}

//       {tech && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && (
//         <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
//           <h2 className="font-bold text-slate-900">Technician</h2>
//           <div className="flex items-center gap-4">
//             <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-extrabold text-emerald-800">
//               {(tech.full_name ?? '?').slice(0, 1)}
//             </div>
//             <div className="flex-1">
//               <p className="font-semibold text-slate-900">{tech.full_name ?? 'Assigned pro'}</p>
//             </div>
//           </div>
//           <div className="flex gap-3 flex-wrap">
//             <a
//               href={`${supportWa}?text=${encodeURIComponent(`Hi — I'm customer for order ${shortId}.`)}`}
//               target="_blank"
//               rel="noreferrer"
//               className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
//             >
//               💬 WhatsApp
//             </a>
//           </div>
//         </div>
//       )}

//       <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-3 text-sm">
//         <h2 className="font-bold text-slate-900 mb-2">Price breakdown</h2>
//         <div className="flex justify-between">
//           <span className="text-slate-600">Base</span>
//           <span>{inr(base)}</span>
//         </div>
//         <div className="flex justify-between">
//           <span className="text-slate-600">Convenience</span>
//           <span>{inr(conv)}</span>
//         </div>
//         {gst > 0 ? (
//           <div className="flex justify-between">
//             <span className="text-slate-600">GST</span>
//             <span>{inr(gst)}</span>
//           </div>
//         ) : null}
//         {emerg > 0 ? (
//           <div className="flex justify-between text-amber-800">
//             <span>Emergency</span>
//             <span>{inr(emerg)}</span>
//           </div>
//         ) : null}
//         <hr />
//         <div className="flex justify-between font-extrabold text-emerald-800 text-base">
//           <span>Total</span>
//           <span>{inr(total)}</span>
//         </div>
//         <p className="text-xs text-slate-500">
//           Payment: {String(o.payment_method ?? 'cash').toUpperCase()} ·{' '}
//           {String(o.payment_status ?? 'pending')}
//         </p>
//       </div>

//       <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-3">
//         <h2 className="font-bold text-slate-900">Delivery address</h2>
//         <p className="text-slate-700">{addrStr}</p>
//         {addrStr !== '—' ? (
//           <a
//             href={mapsHref(addrStr)}
//             target="_blank"
//             rel="noreferrer"
//             className="text-emerald-700 font-semibold text-sm"
//           >
//             Open in Maps
//           </a>
//         ) : null}
//       </div>

//       <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
//         {canCancel && (
//           <button
//             type="button"
//             onClick={() => setShowCancel(true)}
//             className="rounded-xl border border-rose-200 text-rose-800 px-5 py-3 font-semibold bg-rose-50"
//           >
//             Cancel order
//           </button>
//         )}
//         {status === 'COMPLETED' && !safeGet(`reviewed_${id}`) ? (
//           <button
//             type="button"
//             onClick={() => setShowReview(true)}
//             className="rounded-xl bg-amber-500 text-white px-5 py-3 font-semibold"
//           >
//             ★ Rate this order
//           </button>
//         ) : null}
//         <a
//           href={`${supportWa}?text=${encodeURIComponent(`Need help with order ${shortId}`)}`}
//           target="_blank"
//           rel="noreferrer"
//           className="rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold text-center"
//         >
//           Need help?
//         </a>
//       </div>

//       {/* What next */}
//       <section
//         aria-label="What next"
//         className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 space-y-4"
//       >
//         <div>
//           <h2 className="font-extrabold text-slate-900">
//             {finished ? 'What would you like to do next?' : 'While you wait'}
//           </h2>
//           <p className="text-sm text-slate-600">
//             {finished
//               ? 'Order again in seconds or explore more services.'
//               : 'You can safely leave this page. We will keep tracking your order.'}
//           </p>
//         </div>
//         <div className="grid gap-3 sm:grid-cols-3">
//           <Link
//             href={ROUTES.home}
//             className="rounded-2xl bg-white border border-slate-200 px-4 py-4 text-center font-semibold text-slate-800 hover:border-emerald-300"
//           >
//             🏠 Home
//           </Link>
//           <Link
//             href={ROUTES.book}
//             className="rounded-2xl bg-emerald-600 px-4 py-4 text-center font-semibold text-white hover:bg-emerald-700"
//           >
//             ✨ Explore services
//           </Link>
//           <Link
//             href={ROUTES.orders}
//             className="rounded-2xl bg-white border border-slate-200 px-4 py-4 text-center font-semibold text-slate-800 hover:border-emerald-300"
//           >
//             📋 My orders
//           </Link>
//         </div>
//         {finished && serviceKey ? (
//           <Link
//             href={`${ROUTES.book}?service=${encodeURIComponent(serviceKey)}`}
//             className="inline-flex rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
//           >
//             ↻ Book {titleForServiceKey(serviceKey)} again
//           </Link>
//         ) : null}
//       </section>

//       {showReview ? <ReviewModal orderId={id} onClose={() => setShowReview(false)} /> : null}

//       {showCancel && (
//         <div
//           className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
//           role="dialog"
//           aria-modal="true"
//           aria-labelledby="cancel-title"
//           onClick={(e) => {
//             if (e.target === e.currentTarget) setShowCancel(false);
//           }}
//         >
//           <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
//             <h3 id="cancel-title" className="text-lg font-bold text-slate-900">
//               Cancel this order?
//             </h3>
//             <p className="text-sm text-slate-600">
//               #{shortId} · {titleForServiceKey(serviceKey)}
//               {scheduledText ? ` · ${scheduledText}` : ''}
//             </p>
//             <fieldset className="space-y-2">
//               <legend className="text-sm font-semibold text-slate-700 mb-1">Reason</legend>
//               {CANCEL_REASONS.map((r) => (
//                 <label key={r} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
//                   <input
//                     type="radio"
//                     name="cancel-reason"
//                     checked={cancelReason === r}
//                     onChange={() => setCancelReason(r)}
//                   />
//                   {r}
//                 </label>
//               ))}
//             </fieldset>
//             <div className="flex gap-3 justify-end flex-wrap">
//               <button
//                 type="button"
//                 className="rounded-xl border px-4 py-2 font-semibold"
//                 onClick={() => setShowCancel(false)}
//               >
//                 Keep order
//               </button>
//               <button
//                 type="button"
//                 disabled={cancelling}
//                 className="rounded-xl bg-rose-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
//                 onClick={() => void onCancel()}
//               >
//                 {cancelling ? 'Cancelling…' : 'Yes, cancel'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//       <BottomNav />
//     </div>
//   );
// }



