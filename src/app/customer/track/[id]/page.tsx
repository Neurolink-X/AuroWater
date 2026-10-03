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
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-600 text-sm font-medium">
        <span className="h-8 w-8 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />
        Loading your order…
      </div>
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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28">
      {/* Top bar: always a way out */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={ROUTES.home}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span aria-hidden>←</span> Home
        </Link>
        <Link
          href={ROUTES.book}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Book a service
        </Link>
      </div>

      {hero ? (
        <div className={`rounded-2xl border px-5 py-4 ${hero.tone}`} role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>
              {hero.emoji}
            </span>
            <div>
              <div className="font-extrabold">{hero.title}</div>
              <div className="text-sm opacity-90">{hero.sub}</div>
            </div>
          </div>
        </div>
      ) : null}

      {unassignedPending ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-extrabold text-sky-900">🔍 Finding your supplier…</div>
              <div className="text-sm text-sky-800 mt-1">Checking nearby suppliers. This page updates by itself.</div>
            </div>
            <div className="h-2 w-24 rounded-full bg-sky-200 overflow-hidden">
              <div className="h-full w-1/2 bg-sky-500 animate-pulse" />
            </div>
          </div>
          {pendingTooLong ? (
            <div className="mt-3">
              <a
                href={supportNeedsSupplierHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 text-white px-4 py-2.5 font-semibold"
              >
                Contact support — we&apos;ll find one for you
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => void copyId()}
              className="text-xs font-semibold uppercase text-emerald-700 tracking-wide hover:underline"
              title="Copy order ID"
            >
              #{shortId} {copied ? '· copied ✓' : '· copy ID'}
            </button>
            <h1
              className="mt-1 text-2xl font-extrabold text-[#0F172A]"
              style={{ fontFamily: 'var(--font-syne), Syne, sans-serif' }}
            >
              {titleForServiceKey(serviceKey)}
            </h1>
            {scheduledText ? (
              <p className="mt-1 text-sm text-slate-600">Scheduled: {scheduledText}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {channelLive && isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : null}
            <span
              className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold border ${
                status === 'COMPLETED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : status === 'CANCELLED'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-slate-700 mb-4">Order progress</p>
          {status === 'CANCELLED' ? (
            <p className="text-sm text-rose-700 font-medium">
              This order was cancelled{fmt(o.cancelled_at) ? ` on ${fmt(o.cancelled_at)}` : ''}.
            </p>
          ) : (
            <ol className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              {timelineSteps.map((step, i, arr) => (
                <li
                  key={step.key}
                  className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2 min-w-0"
                  aria-current={step.current ? 'step' : undefined}
                >
                  <div className="flex items-center sm:flex-col sm:w-full gap-2">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        step.done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-200 text-slate-400 bg-white'
                      } ${step.current && isActive ? 'ring-4 ring-emerald-100' : ''}`}
                    >
                      {step.done ? '✓' : i + 1}
                    </div>
                    {i < arr.length - 1 ? (
                      <div
                        className={`hidden sm:block flex-1 h-1 rounded-full min-w-[12px] ${
                          step.done && !step.current ? 'bg-emerald-400' : 'bg-slate-200'
                        }`}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="sm:text-center min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        step.current ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {step.done ? stepTime(step.key, o) : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {supplier && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Supplier</h2>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-sky-100 flex items-center justify-center text-xl font-extrabold text-sky-800">
              {(supplier.full_name ?? '?').slice(0, 1)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{supplier.full_name ?? 'Assigned supplier'}</p>
              <div className="flex flex-wrap gap-2 mt-1 items-center">
                {supplier.milestone_tier && supplier.milestone_tier !== 'starter' ? (
                  <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800">
                    {String(supplier.milestone_tier).toUpperCase()}
                  </span>
                ) : null}
                <span className="text-xs text-slate-500">
                  Last active: {minsAgo(supplier.last_seen_at ?? null)}
                </span>
                {supplierRating != null ? (
                  <span className="text-xs font-semibold text-amber-700">
                    ★ {supplierRating.toFixed(1)} avg rating
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href={`${supportWa}?text=${encodeURIComponent(
                `Hi — I'm customer for order ${shortId}. Please connect me with the supplier.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-900 text-white px-4 py-2 font-semibold"
            >
              💬 WhatsApp
            </a>
          </div>
          <p className="text-xs text-slate-500">Supplier phone is shared only after the delivery starts.</p>
        </div>
      )}

      {tech && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Technician</h2>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-extrabold text-emerald-800">
              {(tech.full_name ?? '?').slice(0, 1)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{tech.full_name ?? 'Assigned pro'}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href={`${supportWa}?text=${encodeURIComponent(`Hi — I'm customer for order ${shortId}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-3 text-sm">
        <h2 className="font-bold text-slate-900 mb-2">Price breakdown</h2>
        <div className="flex justify-between">
          <span className="text-slate-600">Base</span>
          <span>{inr(base)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Convenience</span>
          <span>{inr(conv)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">GST</span>
          <span>{inr(gst)}</span>
        </div>
        {emerg > 0 ? (
          <div className="flex justify-between text-amber-800">
            <span>Emergency</span>
            <span>{inr(emerg)}</span>
          </div>
        ) : null}
        <hr />
        <div className="flex justify-between font-extrabold text-emerald-800 text-base">
          <span>Total</span>
          <span>{inr(total)}</span>
        </div>
        <p className="text-xs text-slate-500">
          Payment: {String(o.payment_method ?? 'cash').toUpperCase()} ·{' '}
          {String(o.payment_status ?? 'pending')}
        </p>
      </div>

      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Delivery address</h2>
        <p className="text-slate-700">{addrStr}</p>
        {addrStr !== '—' ? (
          <a
            href={mapsHref(addrStr)}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 font-semibold text-sm"
          >
            Open in Maps
          </a>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {canCancel && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="rounded-xl border border-rose-200 text-rose-800 px-5 py-3 font-semibold bg-rose-50"
          >
            Cancel order
          </button>
        )}
        {status === 'COMPLETED' && !safeGet(`reviewed_${id}`) ? (
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="rounded-xl bg-amber-500 text-white px-5 py-3 font-semibold"
          >
            ★ Rate this order
          </button>
        ) : null}
        <a
          href={`${supportWa}?text=${encodeURIComponent(`Need help with order ${shortId}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold text-center"
        >
          Need help?
        </a>
      </div>

      {/* What next */}
      <section
        aria-label="What next"
        className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 space-y-4"
      >
        <div>
          <h2 className="font-extrabold text-slate-900">
            {finished ? 'What would you like to do next?' : 'While you wait'}
          </h2>
          <p className="text-sm text-slate-600">
            {finished
              ? 'Order again in seconds or explore more services.'
              : 'You can safely leave this page. We will keep tracking your order.'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href={ROUTES.home}
            className="rounded-2xl bg-white border border-slate-200 px-4 py-4 text-center font-semibold text-slate-800 hover:border-emerald-300"
          >
            🏠 Home
          </Link>
          <Link
            href={ROUTES.book}
            className="rounded-2xl bg-emerald-600 px-4 py-4 text-center font-semibold text-white hover:bg-emerald-700"
          >
            ✨ Explore services
          </Link>
          <Link
            href={ROUTES.orders}
            className="rounded-2xl bg-white border border-slate-200 px-4 py-4 text-center font-semibold text-slate-800 hover:border-emerald-300"
          >
            📋 My orders
          </Link>
        </div>
        {finished && serviceKey ? (
          <Link
            href={`${ROUTES.book}?service=${encodeURIComponent(serviceKey)}`}
            className="inline-flex rounded-xl border border-emerald-600 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            ↻ Book {titleForServiceKey(serviceKey)} again
          </Link>
        ) : null}
      </section>

      {showReview ? <ReviewModal orderId={id} onClose={() => setShowReview(false)} /> : null}

      {showCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCancel(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 id="cancel-title" className="text-lg font-bold text-slate-900">
              Cancel this order?
            </h3>
            <p className="text-sm text-slate-600">
              #{shortId} · {titleForServiceKey(serviceKey)}
              {scheduledText ? ` · ${scheduledText}` : ''}
            </p>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-700 mb-1">Reason</legend>
              {CANCEL_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="cancel-reason"
                    checked={cancelReason === r}
                    onChange={() => setCancelReason(r)}
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-3 justify-end flex-wrap">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 font-semibold"
                onClick={() => setShowCancel(false)}
              >
                Keep order
              </button>
              <button
                type="button"
                disabled={cancelling}
                className="rounded-xl bg-rose-600 text-white px-4 py-2 font-semibold disabled:opacity-50"
                onClick={() => void onCancel()}
              >
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
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

// type ProfileLite = {
//   id: string;
//   full_name: string | null;
//   avatar_url: string | null;
//   milestone_tier?: string | null;
//   last_seen_at?: string | null;
// };

// const STATUS_FLOW = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;

// const LABELS: Record<string, string> = {
//   PENDING: 'Placed',
//   ASSIGNED: 'Assigned',
//   IN_PROGRESS: 'In progress',
//   COMPLETED: 'Completed',
// };

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
//   const parts = [a.house_flat, a.area, a.city, a.pincode].filter(Boolean) as string[];
//   return parts.length ? parts.join(', ') : '—';
// }

// function mapsHref(addr: string): string {
//   return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
// }

// export default function TrackOrderPage() {
//   const params = useParams();
//   const router = useRouter();
//   const id = (params?.id as string) || '';
//   const { session } = useAuth();
//   const { whatsappHref } = useSettings();

//   const [order, setOrder] = useState<(ApiOrder & Record<string, unknown>) | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [channelLive, setChannelLive] = useState(false);
//   const [tech, setTech] = useState<ProfileLite | null>(null);
//   const [supplier, setSupplier] = useState<ProfileLite | null>(null);
//   const [supplierRating, setSupplierRating] = useState<number | null>(null);
//   const [showCancel, setShowCancel] = useState(false);
//   const [cancelling, setCancelling] = useState(false);
//   const [showReview, setShowReview] = useState(false);

//   const load = useCallback(async () => {
//     if (!id) return;
//     setLoading(true);
//     setError(null);
//     try {
//       const o = (await customerOrderGet(id)) as ApiOrder & Record<string, unknown>;
//       setOrder(o);
//     } catch (e) {
//       if (e instanceof ApiError && e.status === 401) {
//         router.push(`/auth/login?returnTo=${encodeURIComponent(`/customer/track/${id}`)}`);
//         return;
//       }
//       setError(e instanceof ApiError ? e.message : 'Could not load order.');
//       setOrder(null);
//     } finally {
//       setLoading(false);
//     }
//   }, [id, router]);

//   useEffect(() => {
//     void load();
//   }, [load]);

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
//           setOrder((prev) => ({ ...(prev ?? {}), ...row } as ApiOrder & Record<string, unknown>));
//         }
//       )
//       .subscribe((status) => setChannelLive(status === 'SUBSCRIBED'));

//     return () => {
//       void sb.removeChannel(channel);
//     };
//   }, [session?.accessToken, id]);

//   // Poll when order is pending + unassigned (auto-fallback UI)
//   useEffect(() => {
//     if (!id) return;
//     const status = String(order?.status ?? '');
//     const supplierId = (order as Record<string, unknown> | null)?.supplier_id as
//       | string
//       | null
//       | undefined;
//     if (!(status === 'PENDING' && !supplierId)) return;

//     const startedAt = Date.now();
//     const t = window.setInterval(() => {
//       void load();
//       // Stop polling after 5 minutes; UI shows support option then.
//       if (Date.now() - startedAt > 5 * 60_000) {
//         window.clearInterval(t);
//       }
//     }, 15_000);

//     return () => window.clearInterval(t);
//   }, [id, order?.status, load]);

//   useEffect(() => {
//     if (order?.status !== 'COMPLETED' || typeof window === 'undefined') return;
//     if (safeGet(`reviewed_${id}`)) return;
//     const t = window.setTimeout(() => setShowReview(true), 1200);
//     return () => window.clearTimeout(t);
//   }, [order?.status, id]);

//   useEffect(() => {
//     const tid = order?.technician_id as string | undefined | null;
//     if (!tid || !session?.accessToken) {
//       setTech(null);
//       return;
//     }
//     const sb = createSupabaseBrowserAuthed(session.accessToken);
//     if (!sb) return;
//     let cancelled = false;
//     void sb
//       .from('profiles')
//       .select('id, full_name, avatar_url')
//       .eq('id', tid)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (!cancelled && data) setTech(data as ProfileLite);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [order?.technician_id, session?.accessToken]);

//   useEffect(() => {
//     const sid = (order as Record<string, unknown> | null)?.supplier_id as
//       | string
//       | null
//       | undefined;
//     if (!sid || !session?.accessToken) {
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
//       .eq('id', sid)
//       .maybeSingle()
//       .then(({ data }) => {
//         if (!cancelled && data) setSupplier(data as ProfileLite);
//       });

//     void (async () => {
//       // Avg rating: reviews table is keyed by order_id, so we aggregate across supplier orders.
//       const { data: orders } = await sb
//         .from('orders')
//         .select('id')
//         .eq('supplier_id', sid)
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
//   }, [order, session?.accessToken]);

//   const status = String(order?.status ?? '');
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

//   const unassignedPending =
//     status === 'PENDING' &&
//     !String((order as Record<string, unknown>)?.supplier_id ?? '').trim();

//   const pendingTooLong =
//     unassignedPending &&
//     Boolean(order?.created_at) &&
//     Date.now() - new Date(String(order?.created_at ?? '')).getTime() > 5 * 60_000;

//   function minsAgo(iso: string | null | undefined): string {
//     if (!iso) return '—';
//     const ms = Date.now() - new Date(iso).getTime();
//     const m = Math.max(0, Math.floor(ms / 60_000));
//     return `${m} mins ago`;
//   }

//   const onCancel = async () => {
//     if (!id) return;
//     setCancelling(true);
//     try {
//       const updated = await customerOrderCancel(id, 'customer_request');
//       setOrder((prev) => ({ ...(prev ?? {}), ...updated } as ApiOrder & Record<string, unknown>));
//       toast.success('Order cancelled.');
//       setShowCancel(false);
//     } catch (e) {
//       toast.error(e instanceof ApiError ? e.message : 'Cancel failed.');
//     } finally {
//       setCancelling(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-[40vh] flex items-center justify-center text-slate-600 text-sm font-medium">
//         Loading order…
//       </div>
//     );
//   }

//   if (error || !order) {
//     return (
//       <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
//         <p className="text-slate-800 font-semibold">{error ?? 'Order not found.'}</p>
//         <button
//           type="button"
//           onClick={() => void load()}
//           className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 font-semibold"
//         >
//           Retry
//         </button>
//         <Link href="/customer/home" className="block text-emerald-700 font-semibold">
//           Back to home
//         </Link>
//       </div>
//     );
//   }

//   const total = Number(order.total_amount ?? 0);
//   const base = Number(order.base_amount ?? 0);
//   const conv = Number(order.convenience_fee ?? 0);
//   const gst = Number(order.gst_amount ?? 0);
//   const emerg = Number(order.emergency_charge ?? 0);

//   const canCancel = status === 'PENDING' || status === 'ASSIGNED';

//   return (
//     <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 pb-20">
//       {unassignedPending ? (
//         <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4">
//           <div className="flex items-center justify-between gap-3 flex-wrap">
//             <div>
//               <div className="font-extrabold text-sky-900">🔍 Finding your supplier…</div>
//               <div className="text-sm text-sky-800 mt-1">
//                 checking nearby suppliers
//               </div>
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
//             <p className="text-xs font-semibold uppercase text-emerald-700 tracking-wide">
//               #{order.order_number ?? order.id.slice(0, 8)}
//             </p>
//             <h1
//               className="mt-1 text-2xl font-extrabold text-[#0F172A]"
//               style={{ fontFamily: 'var(--font-syne), Syne, sans-serif' }}
//             >
//               {titleForServiceKey(serviceKey)}
//             </h1>
//           </div>
//           <div className="flex flex-wrap items-center justify-end gap-2">
//             {channelLive ? (
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

//         {/* Timeline */}
//         <div className="mt-8">
//           <p className="text-sm font-semibold text-slate-700 mb-4">Order progress</p>
//           {status === 'CANCELLED' ? (
//             <p className="text-sm text-rose-700 font-medium">This order has been cancelled.</p>
//           ) : (
//             <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
//               {timelineSteps.map((step, i, arr) => (
//                 <div key={step.key} className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2 min-w-0">
//                   <div className="flex items-center sm:flex-col sm:w-full gap-2">
//                     <div
//                       className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
//                         step.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-400 bg-white'
//                       }`}
//                     >
//                       {step.done ? '✓' : i + 1}
//                     </div>
//                     {i < arr.length - 1 ? (
//                       <div className="hidden sm:block flex-1 h-1 rounded-full bg-slate-200 min-w-[12px]" aria-hidden />
//                     ) : null}
//                   </div>
//                   <div className="sm:text-center min-w-0">
//                     <p className={`text-sm font-semibold truncate ${step.current ? 'text-emerald-700' : 'text-slate-700'}`}>
//                       {step.label}
//                     </p>
//                     <p className="text-xs text-slate-500 truncate">{order.updated_at?.slice?.(0, 10) ?? ''}</p>
//                   </div>
//                 </div>
//               ))}
//             </div>
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
//                 `Hi — I'm customer for order ${order.order_number ?? order.id.slice(0, 8)}. Please connect me with the supplier.`
//               )}`}
//               target="_blank"
//               rel="noreferrer"
//               className="rounded-xl bg-slate-900 text-white px-4 py-2 font-semibold"
//             >
//               💬 WhatsApp
//             </a>
//           </div>
//           <p className="text-xs text-slate-500">
//             Supplier phone is shared only after the delivery starts.
//           </p>
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
//               href={`${supportWa}?text=${encodeURIComponent(`Hi — I'm customer for order ${order.order_number ?? order.id.slice(0, 8)}.`)}`}
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
//         <div className="flex justify-between"><span className="text-slate-600">Base</span><span>{inr(base)}</span></div>
//         <div className="flex justify-between"><span className="text-slate-600">Convenience</span><span>{inr(conv)}</span></div>
//         <div className="flex justify-between"><span className="text-slate-600">GST</span><span>{inr(gst)}</span></div>
//         {emerg > 0 ? (
//           <div className="flex justify-between text-amber-800"><span>Emergency</span><span>{inr(emerg)}</span></div>
//         ) : null}
//         <hr />
//         <div className="flex justify-between font-extrabold text-emerald-800 text-base">
//           <span>Total</span><span>{inr(total)}</span>
//         </div>
//       </div>

//       <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-3">
//         <h2 className="font-bold text-slate-900">Delivery address</h2>
//         <p className="text-slate-700">{addrStr}</p>
//         <a href={mapsHref(addrStr)} target="_blank" rel="noreferrer" className="text-emerald-700 font-semibold text-sm">
//           Open in Maps
//         </a>
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
//         <a
//           href={`${supportWa}?text=${encodeURIComponent(`Need help with order ${order.order_number ?? order.id}`)}`}
//           target="_blank"
//           rel="noreferrer"
//           className="rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold text-center"
//         >
//           Need help?
//         </a>
//       </div>

//       {showReview ? (
//         <ReviewModal orderId={id} onClose={() => setShowReview(false)} />
//       ) : null}

//       {showCancel && (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//           <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
//             <h3 className="text-lg font-bold text-slate-900">Cancel this order?</h3>
//             <p className="text-sm text-slate-600">
//               Order #{order.order_number ?? order.id.slice(0, 8)} · {titleForServiceKey(serviceKey)} ·{' '}
//               {order.scheduled_date ?? '—'}
//             </p>
//             <div className="flex gap-3 justify-end flex-wrap">
//               <button type="button" className="rounded-xl border px-4 py-2 font-semibold" onClick={() => setShowCancel(false)}>
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
