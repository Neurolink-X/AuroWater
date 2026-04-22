'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import BookingProgress from '@/components/booking/BookingProgress';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import type { TimeSlotPickerValue } from '@/components/booking/TimeSlotPicker';
import {
  ApiError,
  customerAddressCreate,
  customerAddresses,
  customerOrderCreate,
  type ApiOrder,
} from '@/lib/api-client';
import { getMinDate } from '@/lib/validation/time-slot-client';
import { useAuth } from '@/hooks/useAuth';
import { useSettings, inr, type PlatformSettings, type ServiceKey } from '@/hooks/useSettings';

/** Session draft — persisted so login redirect does not lose progress. */
export interface BookingDraft {
  serviceKey: string;
  subOptionKey: string;
  canQuantity?: number;
  canOrderType?: 'one_time' | 'subscription';
  canFrequency?: string;
  addressId?: string;
  newAddress?: {
    label?: string;
    house_flat?: string;
    area?: string;
    city?: string;
    pincode?: string;
    landmark?: string;
    is_default?: boolean;
  };
  scheduledDate: string;
  /** Display slot label from TimeSlotPicker */
  timeSlot: string;
  startTime: string;
  endTime: string;
  /** ISO string from validation helper — sent as `scheduled_time` to API */
  scheduled_time: string;
  isEmergency: boolean;
  paymentMethod: 'cash' | 'online' | 'upi';
  notes?: string;
  slotValid?: boolean;
}

const DRAFT_KEY = 'aw_booking_draft_v1';

const SERVICE_LIST: { key: string; emoji: string; title: string }[] = [
  { key: 'water_can', emoji: '💧', title: 'Water cans' },
  { key: 'water_tanker', emoji: '🚚', title: 'Water tanker' },
  { key: 'ro_service', emoji: '🔧', title: 'RO service' },
  { key: 'plumbing', emoji: '🛠️', title: 'Plumbing' },
  { key: 'borewell', emoji: '⛏️', title: 'Borewell' },
  { key: 'motor_pump', emoji: '⚙️', title: 'Motor & pump' },
  { key: 'tank_cleaning', emoji: '✨', title: 'Tank cleaning' },
];

const UP_CITIES = [
  'Kanpur',
  'Gorakhpur',
  'Lucknow',
  'Varanasi',
  'Prayagraj',
  'Agra',
  'Meerut',
  'Bareilly',
  'Aligarh',
  'Mathura',
  'Delhi',
  'Noida',
  'Ghaziabad',
] as const;

type AddressRow = {
  id: string;
  label: string | null;
  house_flat: string;
  area: string;
  city: string;
  pincode: string;
  landmark: string | null;
  is_default: boolean | null;
};

function emptyDraft(): BookingDraft {
  const min = getMinDate();
  return {
    serviceKey: 'water_can',
    subOptionKey: 'standard',
    canQuantity: 1,
    canOrderType: 'one_time',
    canFrequency: 'weekly',
    scheduledDate: min,
    timeSlot: '',
    startTime: '09:00',
    endTime: '09:30',
    scheduled_time: '',
    isEmergency: false,
    paymentMethod: 'cash',
    notes: '',
    slotValid: false,
    newAddress: {
      label: 'Home',
      house_flat: '',
      area: '',
      city: 'Kanpur',
      pincode: '',
      landmark: '',
      is_default: true,
    },
  };
}

/** Until admin stores per–sub-option prices, use small fixed deltas so fulfillment metadata stays meaningful. */
function subOptionDelta(serviceKey: string, subOptionKey: string): number {
  if (serviceKey === 'ro_service') {
    const m: Record<string, number> = {
      service: 0,
      filter_change: 49,
      amc: 149,
      new_installation: 599,
    };
    return m[subOptionKey] ?? 0;
  }
  if (serviceKey === 'plumbing') {
    const m: Record<string, number> = {
      pipe_leak: 0,
      tap: 0,
      drainage: 49,
      new_fitting: 99,
      other: 0,
    };
    return m[subOptionKey] ?? 0;
  }
  if (serviceKey === 'water_tanker') {
    const m: Record<string, number> = {
      '500': 0,
      '1000': 50,
      '2000': 120,
      custom: 80,
    };
    return m[subOptionKey] ?? 0;
  }
  return 0;
}

function computeBaseAmount(draft: BookingDraft, settings: PlatformSettings): number {
  if (draft.serviceKey === 'water_can') {
    const qty = Math.min(200, Math.max(1, draft.canQuantity ?? 1));
    const per =
      draft.canOrderType === 'subscription'
        ? settings.subscription_can_price
        : settings.default_can_price;
    return Math.round(qty * per);
  }
  const baseKey = draft.serviceKey as ServiceKey;
  const base = settings.service_base_prices[baseKey] ?? 0;
  return Math.round(base + subOptionDelta(draft.serviceKey, draft.subOptionKey));
}

function serviceLabel(key: string): string {
  return SERVICE_LIST.find((s) => s.key === key)?.title ?? key;
}

function formatAddressCard(a: AddressRow): string {
  const parts = [a.house_flat, a.area, a.city, a.pincode].filter(Boolean);
  return parts.join(', ');
}

function nextFourteenIsoDates(min: string): string[] {
  const out: string[] = [];
  const start = new Date(min + 'T12:00:00');
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function shortDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Maps time_slot label to human arrival copy — coarse buckets until fleet ETA microservice exists. */
function arrivalHint(timeSlot: string): string {
  const t = timeSlot.toLowerCase();
  if (t.includes('morning') || /0[6-9]:|1[0-2]:/.test(t)) return '8:00 AM – 12:00 PM';
  if (t.includes('afternoon') || /1[2-6]:/.test(t)) return '12:00 PM – 4:00 PM';
  return 'Within your selected window';
}

export default function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, calcOrderTotal, whatsappHref } = useSettings();
  const { session } = useAuth();

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const minDate = getMinDate();
  const datePills = useMemo(() => nextFourteenIsoDates(minDate), [minDate]);

  const cardMotion = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: 'easeOut' as const },
  };

  const applyHashStep = useCallback(() => {
    if (typeof window === 'undefined') return;
    const m = window.location.hash.match(/step-(\d+)/);
    if (!m) return;
    const n = Math.min(6, Math.max(1, parseInt(m[1], 10)));
    setStep(n);
  }, []);

  useEffect(() => {
    applyHashStep();
    window.addEventListener('hashchange', applyHashStep);
    return () => window.removeEventListener('hashchange', applyHashStep);
  }, [applyHashStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${path}#step-${step}`);
  }, [step]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { draft?: Partial<BookingDraft>; step?: number };
      if (parsed?.draft && typeof parsed.draft === 'object') {
        setDraft((d) => ({ ...emptyDraft(), ...d, ...parsed.draft }));
      }
      if (parsed?.step && typeof parsed.step === 'number' && !createdOrder) {
        setStep(Math.min(6, Math.max(1, parsed.step)));
      }
    } catch {
      /* ignore corrupt draft */
    }
  }, [createdOrder]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step }));
    } catch {
      /* quota */
    }
  }, [draft, step]);

  useEffect(() => {
    const svc = searchParams.get('service');
    if (!svc) return;
    if (SERVICE_LIST.some((s) => s.key === svc)) {
      setDraft((d) => ({ ...d, serviceKey: svc }));
    }
  }, [searchParams]);

  useEffect(() => {
    setDraft((d) => {
      switch (d.serviceKey) {
        case 'water_can':
          return { ...d, subOptionKey: d.subOptionKey || 'standard' };
        case 'ro_service':
          if (!['service', 'filter_change', 'amc', 'new_installation'].includes(d.subOptionKey)) {
            return { ...d, subOptionKey: 'service' };
          }
          return d;
        case 'plumbing':
          if (!['pipe_leak', 'tap', 'drainage', 'new_fitting', 'other'].includes(d.subOptionKey)) {
            return { ...d, subOptionKey: 'pipe_leak' };
          }
          return d;
        case 'water_tanker':
          if (!['500', '1000', '2000', 'custom'].includes(d.subOptionKey)) {
            return { ...d, subOptionKey: '500' };
          }
          return d;
        default:
          return d;
      }
    });
  }, [draft.serviceKey]);

  const loadAddresses = useCallback(async () => {
    if (!session?.loggedIn) return;
    setLoadingAddresses(true);
    try {
      const list = (await customerAddresses()) as AddressRow[];
      setAddresses(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Could not load addresses.');
    } finally {
      setLoadingAddresses(false);
    }
  }, [session?.loggedIn]);

  useEffect(() => {
    if (step >= 3 && session?.loggedIn) void loadAddresses();
  }, [step, session?.loggedIn, loadAddresses]);

  const baseAmount = useMemo(() => computeBaseAmount(draft, settings), [draft, settings]);
  const breakdown = useMemo(
    () => calcOrderTotal(baseAmount, draft.isEmergency),
    [calcOrderTotal, baseAmount, draft.isEmergency]
  );

  const fromPrice = useCallback(
    (key: string) => {
      if (key === 'water_can') return settings.default_can_price;
      const k = key as ServiceKey;
      return settings.service_base_prices[k] ?? 0;
    },
    [settings]
  );

  const goLoginForCheckout = () => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step: 3 }));
    } catch {
      /* ignore */
    }
    router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-3')}`);
  };

  const onSlotChange = useCallback((v: TimeSlotPickerValue) => {
    setDraft((d) => ({
      ...d,
      scheduledDate: v.date,
      timeSlot: v.time_slot,
      startTime: v.startTime,
      endTime: v.endTime,
      scheduled_time: v.scheduled_time,
      slotValid: v.valid,
    }));
  }, []);

  const validateStep = (s: number): boolean => {
    if (s === 1) {
      if (!draft.serviceKey) {
        toast.error('Pick a service.');
        return false;
      }
      return true;
    }
    if (s === 2) {
      if (draft.serviceKey === 'water_can') {
        const q = draft.canQuantity ?? 1;
        if (q < 1 || q > 200) {
          toast.error('Quantity must be between 1 and 200.');
          return false;
        }
      }
      if (!draft.subOptionKey) {
        toast.error('Choose an option.');
        return false;
      }
      return true;
    }
    if (s === 3) {
      if (!session?.loggedIn) {
        toast.error('Sign in to continue.');
        return false;
      }
      if (!draft.addressId) {
        toast.error('Select or add a delivery address.');
        return false;
      }
      return true;
    }
    if (s === 4) {
      if (!draft.slotValid) {
        toast.error('Pick a valid date and time slot.');
        return false;
      }
      return true;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep((x) => Math.min(6, x + 1));
  };

  const prevStep = () => setStep((x) => Math.max(1, x - 1));

  const saveInlineAddress = async () => {
    const na = draft.newAddress ?? {};
    if (!na.house_flat?.trim() || !na.area?.trim() || !na.city?.trim() || !na.pincode?.trim()) {
      toast.error('Fill house, area, city, and 6-digit pincode.');
      return;
    }
    if (!/^[0-9]{6}$/.test(na.pincode.trim())) {
      toast.error('Pincode must be 6 digits.');
      return;
    }
    try {
      const created = (await customerAddressCreate({
        label: na.label ?? 'Home',
        house_flat: na.house_flat.trim(),
        area: na.area.trim(),
        city: na.city.trim(),
        pincode: na.pincode.trim(),
        landmark: na.landmark?.trim() ?? '',
        is_default: na.is_default ?? true,
      })) as AddressRow;
      setDraft((d) => ({ ...d, addressId: created.id }));
      toast.success('Address saved.');
      await loadAddresses();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save address.');
    }
  };

  const confirmOrder = async () => {
    if (!draft.addressId || !session?.loggedIn) {
      toast.error('Missing address or session.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await customerOrderCreate({
        service_type_key: draft.serviceKey,
        address_id: draft.addressId,
        sub_option_key: draft.subOptionKey || 'standard',
        scheduled_date: draft.scheduledDate,
        time_slot: draft.timeSlot,
        scheduled_time: draft.scheduled_time,
        is_emergency: draft.isEmergency,
        base_amount: baseAmount,
        convenience_fee: breakdown.convenience,
        gst_amount: breakdown.gst,
        total_amount: breakdown.total,
        payment_method: draft.paymentMethod,
        notes: draft.notes?.trim() || undefined,
        can_quantity: draft.serviceKey === 'water_can' ? draft.canQuantity : undefined,
        can_order_type: draft.serviceKey === 'water_can' ? draft.canOrderType : undefined,
        can_frequency:
          draft.serviceKey === 'water_can' && draft.canOrderType === 'subscription'
            ? draft.canFrequency
            : undefined,
      });
      setCreatedOrder(order);
      setStep(6);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast.success('Booking confirmed!');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, step: 5 }));
        } catch {
          /* ignore */
        }
        router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-5')}`);
        return;
      }
      const msg = e instanceof ApiError ? e.message : 'Booking failed.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const waLink =
    whatsappHref ??
    `https://wa.me/91${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '9889305803').replace(/\D/g, '')}`;

  const orderNo = createdOrder?.order_number ?? createdOrder?.id?.slice(0, 8) ?? '—';

  const waTrackHref = useMemo(() => {
    const msg = `Hi AuroWater — my order #${orderNo}. Please share live status.`;
    const base = waLink.split('?')[0];
    try {
      const u = new URL(base.includes('://') ? base : `https://${base}`);
      u.searchParams.set('text', msg);
      return u.toString();
    } catch {
      return `${base}?text=${encodeURIComponent(msg)}`;
    }
  }, [waLink, orderNo]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Book a service</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-[#0F172A]" style={{ fontFamily: 'var(--font-syne), Syne, system-ui, sans-serif' }}>
            Schedule in minutes
          </h1>
        </div>

        <BookingProgress step={createdOrder ? 6 : step} />

        {/* Step 1 */}
        {step === 1 && !createdOrder && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">1 · Choose service</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SERVICE_LIST.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, serviceKey: s.key }))}
                  className={
                    'rounded-2xl border p-4 text-left transition-all hover:shadow-md ' +
                    (draft.serviceKey === s.key
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white')
                  }
                >
                  <div className="text-2xl">{s.emoji}</div>
                  <div className="mt-2 font-semibold text-slate-900 text-sm">{s.title}</div>
                  <div className="mt-1 text-xs text-emerald-700 font-semibold">
                    From ₹{Math.round(fromPrice(s.key)).toLocaleString('en-IN')}
                  </div>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isEmergency}
                onChange={(e) => setDraft((d) => ({ ...d, isEmergency: e.target.checked }))}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600"
              />
              <span className="text-sm text-slate-700">
                Emergency booking (+ {inr(settings.emergency_surcharge)} surcharge)
              </span>
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={nextStep}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700"
              >
                Select →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && !createdOrder && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">2 · Options · {serviceLabel(draft.serviceKey)}</h2>

            {draft.serviceKey === 'water_can' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-slate-700">Quantity (cans)</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="h-10 w-10 rounded-xl border border-slate-200 font-bold"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          canQuantity: Math.max(1, (d.canQuantity ?? 1) - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <span className="font-extrabold w-10 text-center">{draft.canQuantity ?? 1}</span>
                    <button
                      type="button"
                      className="h-10 w-10 rounded-xl border border-slate-200 font-bold"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          canQuantity: Math.min(200, (d.canQuantity ?? 1) + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      draft.canOrderType !== 'subscription' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                    onClick={() => setDraft((d) => ({ ...d, canOrderType: 'one_time' }))}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      draft.canOrderType === 'subscription' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                    onClick={() => setDraft((d) => ({ ...d, canOrderType: 'subscription' }))}
                  >
                    Subscription
                  </button>
                </div>
                {draft.canOrderType === 'subscription' && (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Delivery frequency</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                      value={draft.canFrequency}
                      onChange={(e) => setDraft((d) => ({ ...d, canFrequency: e.target.value }))}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                )}
                <p className="text-sm text-slate-600">
                  Preview:{' '}
                  <span className="font-bold text-emerald-700">{inr(computeBaseAmount(draft, settings))}</span> base
                  (before fees & GST)
                </p>
              </div>
            )}

            {draft.serviceKey === 'ro_service' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ['service', 'Routine service'],
                  ['filter_change', 'Filter change'],
                  ['amc', 'AMC'],
                  ['new_installation', 'New installation'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                      draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {draft.serviceKey === 'plumbing' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ['pipe_leak', 'Pipe leak'],
                  ['tap', 'Tap repair'],
                  ['drainage', 'Drainage'],
                  ['new_fitting', 'New fitting'],
                  ['other', 'Other'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                      draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {draft.serviceKey === 'water_tanker' && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['500', '500L'],
                  ['1000', '1000L'],
                  ['2000', '2000L'],
                  ['custom', 'Custom'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {['borewell', 'motor_pump', 'tank_cleaning'].includes(draft.serviceKey) && (
              <div>
                <label className="text-sm font-medium text-slate-700">Describe the issue / scope</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[100px]"
                  value={draft.notes ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional details help our crew prepare."
                />
                <p className="mt-2 text-xs text-slate-500">
                  Photo upload from the app is planned — notes only for now.
                </p>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
              <div className="flex justify-between">
                <span>Estimated base</span>
                <span className="font-bold">{inr(baseAmount)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">GST & platform fees calculated at checkout.</p>
            </div>

            <div className="flex justify-between gap-3">
              <button type="button" onClick={prevStep} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold">
                Back
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && !createdOrder && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">3 · Address</h2>

            {!session?.loggedIn && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <p className="font-semibold text-amber-900">Sign in to save your delivery address</p>
                <p className="text-sm text-amber-800">
                  Your booking draft is saved on this device — after login you&apos;ll return here.
                </p>
                <button
                  type="button"
                  onClick={goLoginForCheckout}
                  className="rounded-xl bg-emerald-600 text-white px-5 py-2.5 font-semibold"
                >
                  Sign in to continue
                </button>
              </div>
            )}

            {session?.loggedIn && (
              <>
                {loadingAddresses ? (
                  <p className="text-sm text-slate-500">Loading addresses…</p>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((a) => (
                      <label
                        key={a.id}
                        className={`flex gap-3 rounded-2xl border p-4 cursor-pointer ${
                          draft.addressId === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="addr"
                          checked={draft.addressId === a.id}
                          onChange={() => setDraft((d) => ({ ...d, addressId: a.id }))}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{a.label ?? 'Address'}</div>
                          <div className="text-sm text-slate-600">{formatAddressCard(a)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-100 pt-6 space-y-3">
                  <h3 className="font-semibold text-slate-800">Add new address</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      placeholder="Label (e.g. Home)"
                      value={draft.newAddress?.label ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newAddress: { ...d.newAddress, label: e.target.value },
                        }))
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      placeholder="Flat / house no."
                      value={draft.newAddress?.house_flat ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newAddress: { ...d.newAddress, house_flat: e.target.value },
                        }))
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 sm:col-span-2"
                      placeholder="Area / locality"
                      value={draft.newAddress?.area ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newAddress: { ...d.newAddress, area: e.target.value },
                        }))
                      }
                    />
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      value={draft.newAddress?.city ?? 'Kanpur'}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newAddress: { ...d.newAddress, city: e.target.value },
                        }))
                      }
                    >
                      {UP_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2"
                      placeholder="Pincode"
                      inputMode="numeric"
                      value={draft.newAddress?.pincode ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newAddress: {
                            ...d.newAddress,
                            pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 sm:col-span-2"
                      placeholder="Landmark (optional)"
                      value={draft.newAddress?.landmark ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newAddress: { ...d.newAddress, landmark: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveInlineAddress()}
                    className="rounded-xl border border-emerald-600 text-emerald-700 px-4 py-2 font-semibold"
                  >
                    Save address
                  </button>
                </div>
              </>
            )}

            <div className="flex justify-between gap-3">
              <button type="button" onClick={prevStep} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold">
                Back
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!session?.loggedIn}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && !createdOrder && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">4 · Schedule</h2>
            <p className="text-sm text-slate-600">Pick one of the next 14 days, then fine-tune the slot.</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {datePills.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      scheduledDate: iso,
                      slotValid: false,
                    }))
                  }
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                    draft.scheduledDate === iso ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                  }`}
                >
                  {shortDateLabel(iso)}
                </button>
              ))}
            </div>
            <TimeSlotPicker
              key={`${draft.scheduledDate}-${step}`}
              minDate={minDate}
              showEmergency
              emergencyFee={settings.emergency_surcharge}
              value={{
                date: draft.scheduledDate || minDate,
                startTime: draft.startTime,
                endTime: draft.endTime,
              }}
              onChange={onSlotChange}
            />
            <div className="flex justify-between gap-3">
              <button type="button" onClick={prevStep} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold">
                Back
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 5 */}
        {step === 5 && !createdOrder && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900">5 · Review & payment</h2>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Service</span>
                <span className="font-semibold text-right">{serviceLabel(draft.serviceKey)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Address</span>
                <span className="font-semibold text-right">
                  {addresses.find((a) => a.id === draft.addressId)
                    ? formatAddressCard(addresses.find((a) => a.id === draft.addressId)!)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Scheduled</span>
                <span className="font-semibold text-right">
                  {draft.scheduledDate} · {draft.timeSlot || '—'}
                </span>
              </div>
              <hr className="border-slate-200" />
              <div className="flex justify-between">
                <span>Base price</span>
                <span>{inr(breakdown.base)}</span>
              </div>
              <div className="flex justify-between">
                <span>Convenience</span>
                <span>{inr(breakdown.convenience)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST ({Math.round(settings.gst_rate * 100)}%)</span>
                <span>{inr(breakdown.gst)}</span>
              </div>
              {draft.isEmergency ? (
                <div className="flex justify-between text-amber-800">
                  <span>Emergency</span>
                  <span>{inr(breakdown.emergency)}</span>
                </div>
              ) : null}
              <hr className="border-slate-200" />
              <div className="flex justify-between text-lg font-extrabold text-emerald-800">
                <span>TOTAL</span>
                <span>{inr(breakdown.total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Payment method</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    ['cash', 'Cash on delivery'],
                    ['upi', 'UPI'],
                    ['online', 'Card / netbanking'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, paymentMethod: key }))}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold text-left ${
                      draft.paymentMethod === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {draft.paymentMethod !== 'cash' && (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Payment gateway integration is coming — this selection is recorded for fulfilment only.
                </div>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-sm px-4 py-3">{submitError}</div>
            )}

            <div className="flex justify-between gap-3 flex-wrap">
              <button type="button" onClick={prevStep} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold">
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void confirmOrder()}
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Confirm booking →'}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              ✓ Delivered in 45 mins or next order free &nbsp;&nbsp; ✓ 100% refund if cancelled by us
            </div>
          </motion.div>
        )}

        {step === 5 && !createdOrder ? (
          <div className="fixed left-0 right-0 bottom-3 z-40 px-4">
            <div className="mx-auto max-w-3xl">
              <div
                className="rounded-xl"
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  borderRadius: 12,
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                🛡 AuroWater Guarantee: Delivered in 45 mins or next order FREE. 100% refund if we cancel.
              </div>
            </div>
          </div>
        ) : null}

        {/* Step 6 */}
        {(step === 6 || createdOrder) && createdOrder && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-8 text-center space-y-6">
            <p className="text-sm font-semibold text-emerald-700 uppercase">You&apos;re booked</p>
            <div
              className="text-4xl sm:text-5xl font-extrabold text-[#0F172A]"
              style={{ fontFamily: 'var(--font-syne), Syne, system-ui, sans-serif' }}
            >
              #{orderNo}
            </div>
            <p className="text-slate-600">
              Estimated arrival: <span className="font-semibold text-slate-900">{arrivalHint(draft.timeSlot)}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={waTrackHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold"
              >
                Track on WhatsApp
              </a>
              <Link
                href={`/customer/track/${createdOrder.id}`}
                className="rounded-xl border border-slate-200 px-6 py-3 font-semibold text-center"
              >
                View order
              </Link>
              <button
                type="button"
                onClick={() => {
                  setCreatedOrder(null);
                  setDraft(emptyDraft());
                  setStep(1);
                  setSubmitError(null);
                  router.push('/book');
                }}
                className="rounded-xl border border-emerald-600 text-emerald-700 px-6 py-3 font-semibold"
              >
                Book another
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
