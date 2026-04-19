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

type ProfileLite = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

const STATUS_FLOW = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;

const LABELS: Record<string, string> = {
  PENDING: 'Placed',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

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
  const parts = [a.house_flat, a.area, a.city, a.pincode].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : '—';
}

function mapsHref(addr: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

export default function TrackOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || '';
  const { session } = useAuth();
  const { whatsappHref } = useSettings();

  const [order, setOrder] = useState<(ApiOrder & Record<string, unknown>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelLive, setChannelLive] = useState(false);
  const [tech, setTech] = useState<ProfileLite | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const o = (await customerOrderGet(id)) as ApiOrder & Record<string, unknown>;
      setOrder(o);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.push(`/auth/login?returnTo=${encodeURIComponent(`/customer/track/${id}`)}`);
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not load order.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

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
          setOrder((prev) => ({ ...(prev ?? {}), ...row } as ApiOrder & Record<string, unknown>));
        }
      )
      .subscribe((status) => setChannelLive(status === 'SUBSCRIBED'));

    return () => {
      void sb.removeChannel(channel);
    };
  }, [session?.accessToken, id]);

  useEffect(() => {
    if (order?.status !== 'COMPLETED' || typeof window === 'undefined') return;
    if (localStorage.getItem(`reviewed_${id}`)) return;
    const t = window.setTimeout(() => setShowReview(true), 1200);
    return () => window.clearTimeout(t);
  }, [order?.status, id]);

  useEffect(() => {
    const tid = order?.technician_id as string | undefined | null;
    if (!tid || !session?.accessToken) {
      setTech(null);
      return;
    }
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let cancelled = false;
    void sb
      .from('profiles')
      .select('id, full_name, phone, avatar_url')
      .eq('id', tid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setTech(data as ProfileLite);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.technician_id, session?.accessToken]);

  const status = String(order?.status ?? '');
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

  const onCancel = async () => {
    if (!id) return;
    setCancelling(true);
    try {
      const updated = await customerOrderCancel(id, 'customer_request');
      setOrder((prev) => ({ ...(prev ?? {}), ...updated } as ApiOrder & Record<string, unknown>));
      toast.success('Order cancelled.');
      setShowCancel(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Cancel failed.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-600 text-sm font-medium">
        Loading order…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-slate-800 font-semibold">{error ?? 'Order not found.'}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 font-semibold"
        >
          Retry
        </button>
        <Link href="/customer/home" className="block text-emerald-700 font-semibold">
          Back to home
        </Link>
      </div>
    );
  }

  const total = Number(order.total_amount ?? 0);
  const base = Number(order.base_amount ?? 0);
  const conv = Number(order.convenience_fee ?? 0);
  const gst = Number(order.gst_amount ?? 0);
  const emerg = Number(order.emergency_charge ?? 0);

  const canCancel = status === 'PENDING' || status === 'ASSIGNED';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 pb-24">
      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-700 tracking-wide">
              #{order.order_number ?? order.id.slice(0, 8)}
            </p>
            <h1
              className="mt-1 text-2xl font-extrabold text-[#0F172A]"
              style={{ fontFamily: 'var(--font-syne), Syne, sans-serif' }}
            >
              {titleForServiceKey(serviceKey)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {channelLive ? (
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

        {/* Timeline */}
        <div className="mt-8">
          <p className="text-sm font-semibold text-slate-700 mb-4">Order progress</p>
          {status === 'CANCELLED' ? (
            <p className="text-sm text-rose-700 font-medium">This order has been cancelled.</p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              {timelineSteps.map((step, i, arr) => (
                <div key={step.key} className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-2 min-w-0">
                  <div className="flex items-center sm:flex-col sm:w-full gap-2">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        step.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-400 bg-white'
                      }`}
                    >
                      {step.done ? '✓' : i + 1}
                    </div>
                    {i < arr.length - 1 ? (
                      <div className="hidden sm:block flex-1 h-1 rounded-full bg-slate-200 min-w-[12px]" aria-hidden />
                    ) : null}
                  </div>
                  <div className="sm:text-center min-w-0">
                    <p className={`text-sm font-semibold truncate ${step.current ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{order.updated_at?.slice?.(0, 10) ?? ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tech && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(status) && (
        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-slate-900">Technician</h2>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-extrabold text-emerald-800">
              {(tech.full_name ?? '?').slice(0, 1)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{tech.full_name ?? 'Assigned pro'}</p>
              <p className="text-sm text-slate-600">{tech.phone ?? 'Phone on file'}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {tech.phone ? (
              <a href={`tel:${tech.phone.replace(/\D/g, '')}`} className="rounded-xl bg-emerald-600 text-white px-4 py-2 font-semibold">
                📞 Call
              </a>
            ) : null}
            <a
              href={`${supportWa}?text=${encodeURIComponent(`Hi — I'm customer for order ${order.order_number ?? order.id.slice(0, 8)}.`)}`}
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
        <div className="flex justify-between"><span className="text-slate-600">Base</span><span>{inr(base)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">Convenience</span><span>{inr(conv)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">GST</span><span>{inr(gst)}</span></div>
        {emerg > 0 ? (
          <div className="flex justify-between text-amber-800"><span>Emergency</span><span>{inr(emerg)}</span></div>
        ) : null}
        <hr />
        <div className="flex justify-between font-extrabold text-emerald-800 text-base">
          <span>Total</span><span>{inr(total)}</span>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-3">
        <h2 className="font-bold text-slate-900">Delivery address</h2>
        <p className="text-slate-700">{addrStr}</p>
        <a href={mapsHref(addrStr)} target="_blank" rel="noreferrer" className="text-emerald-700 font-semibold text-sm">
          Open in Maps
        </a>
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
        <a
          href={`${supportWa}?text=${encodeURIComponent(`Need help with order ${order.order_number ?? order.id}`)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-slate-900 text-white px-5 py-3 font-semibold text-center"
        >
          Need help?
        </a>
      </div>

      {showReview ? (
        <ReviewModal orderId={id} onClose={() => setShowReview(false)} />
      ) : null}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Cancel this order?</h3>
            <p className="text-sm text-slate-600">
              Order #{order.order_number ?? order.id.slice(0, 8)} · {titleForServiceKey(serviceKey)} ·{' '}
              {order.scheduled_date ?? '—'}
            </p>
            <div className="flex gap-3 justify-end flex-wrap">
              <button type="button" className="rounded-xl border px-4 py-2 font-semibold" onClick={() => setShowCancel(false)}>
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
    </div>
  );
}
