'use client';
/**
 * src/components/booking/BookingWizard.tsx
 *
 * Upgrades in this version:
 *  - Mobile-safe inputs (light colours, 16px text)
 *  - Location: permission pre-check, network-first then GPS, stale-request guard,
 *    geocode timeout, coordinates kept even if street lookup fails
 *  - 3-hour delivery windows + ASAP window for emergency bookings
 *  - Draft v2: restored drafts are sanitised, slot is re-validated on restore and on confirm
 *  - Offline guard, unsaved-address guard, focus management between steps
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  customerServiceability,
  customerOrderCreate,
  reverseGeocode,
  type ApiOrder,
} from '@/lib/api-client';
import {
  ASAP_SLOT_ID,
  CLOSE_HOUR,
  OPEN_HOUR,
  buildSlotValue,
  getAvailableSlots,
  getMinDate,
  getSlotBlock,
  nextFutureSlot,
} from '@/lib/validation/time-slot-client';
import { useAuth } from '@/hooks/useAuth';
import { useSettings, inr, type PlatformSettings, type ServiceKey } from '@/hooks/useSettings';
import { safeSessionGet, safeSessionRemove, safeSessionSet } from '@/lib/storage';
import { ACTIVE_CITY_NAMES } from '@/lib/cities';
import WaitlistPanel from '@/components/ui/WaitlistPanel';

const ROUTES = {
  home: '/customer/home',
  orders: '/customer/history',
  track: (id: string) => `/customer/track/${id}`,
} as const;

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
    lat?: number;
    lng?: number;
  };
  scheduledDate: string;
  slotId: string;
  timeSlot: string;
  startTime: string;
  endTime: string;
  scheduled_time: string;
  isEmergency: boolean;
  paymentMethod: 'cash' | 'online' | 'upi';
  notes?: string;
  slotValid?: boolean;
}

const DRAFT_KEY = 'aw_booking_draft_v2';
const MAX_FORM_STEP = 5;
const MAX_CANS_ONE_TIME = 50;
const MAX_CANS_SUBSCRIPTION = 200;
const QUICK_QTY = [1, 2, 3, 5, 10, 20];
const SCOPE_SERVICES = ['borewell', 'motor_pump', 'tank_cleaning'];

const MSG_DENIED =
  'Location is blocked. Tap the 🔒 icon in your browser bar → Permissions → Location → Allow, then try again — or type your address below.';
const MSG_TIMEOUT =
  'Could not get a location fix. Move near a window or open area and retry — or type your address below.';
const MSG_UNAVAILABLE = 'Your device could not detect its location. Please type your address below.';

function maxCansFor(d: { canOrderType?: 'one_time' | 'subscription' }): number {
  return d.canOrderType === 'subscription' ? MAX_CANS_SUBSCRIPTION : MAX_CANS_ONE_TIME;
}

const SERVICE_LIST = [
  { key: 'water_can',     emoji: '💧', title: 'Normal / Chilled RO'    },
  { key: 'water_tanker',  emoji: '🚚', title: 'Water tanker'  },
  { key: 'ro_service',    emoji: '🔧', title: 'RO service'    },
  { key: 'plumbing',      emoji: '🛠️', title: 'Plumbing'      },
  { key: 'borewell',      emoji: '⛏️', title: 'Borewell'      },
  { key: 'motor_pump',    emoji: '⚙️', title: 'Motor & pump'  },
  { key: 'tank_cleaning', emoji: '✨', title: 'Tank cleaning' },
];

const LIVE_CITIES: readonly string[] = ACTIVE_CITY_NAMES;

const CITY_PIN_PREFIX: Record<string, string[]> = {
  Kanpur:    ['208', '209'],
  Gorakhpur: ['273'],
  Lucknow:   ['226', '227'],
};

function pinHint(city: string | undefined, pin: string | undefined): string {
  if (!city || !pin || pin.length < 3) return '';
  const known = CITY_PIN_PREFIX[city];
  if (!known) return '';
  if (known.some((p) => pin.startsWith(p))) return '';
  const other = Object.entries(CITY_PIN_PREFIX).find(([, ps]) => ps.some((p) => pin.startsWith(p)))?.[0];
  return other
    ? `This pincode looks like ${other}, not ${city}. Please double-check.`
    : `This pincode does not look like ${city}. Please double-check.`;
}

type AddressRow = {
  id: string;
  label: string | null;
  house_flat?: string | null;
  area?: string | null;
  line1?: string | null;
  line2?: string | null;
  city: string;
  pincode: string | null;
  landmark?: string | null;
  is_default?: boolean | null;
};

function emptyDraft(): BookingDraft {
  const slot = nextFutureSlot();
  return {
    serviceKey: 'water_can', subOptionKey: 'normal_ro',
    canQuantity: 1, canOrderType: 'one_time', canFrequency: 'weekly',
    scheduledDate: slot.date, slotId: slot.slotId,
    timeSlot: '', startTime: slot.startTime, endTime: slot.endTime,
    scheduled_time: '', isEmergency: false, paymentMethod: 'cash',
    notes: '', slotValid: false,
    newAddress: {
      label: 'Home', house_flat: '', area: '',
      city: LIVE_CITIES[0] ?? 'Gorakhpur', pincode: '', landmark: '', is_default: true,
    },
  };
}

/** Never trust sessionStorage: keep only well-formed fields. */
function sanitizeDraft(raw: unknown): Partial<BookingDraft> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<BookingDraft> = {};
  if (typeof r.serviceKey === 'string' && SERVICE_LIST.some((s) => s.key === r.serviceKey)) out.serviceKey = r.serviceKey;
  if (typeof r.subOptionKey === 'string') out.subOptionKey = r.subOptionKey;
  const q = Number(r.canQuantity);
  if (Number.isFinite(q) && q >= 1) out.canQuantity = Math.min(MAX_CANS_SUBSCRIPTION, Math.floor(q));
  if (r.canOrderType === 'one_time' || r.canOrderType === 'subscription') out.canOrderType = r.canOrderType;
  if (typeof r.canFrequency === 'string' && ['daily', 'alternate', 'weekly', 'biweekly', 'monthly'].includes(r.canFrequency)) out.canFrequency = r.canFrequency;
  if (typeof r.addressId === 'string') out.addressId = r.addressId;
  if (r.newAddress && typeof r.newAddress === 'object') out.newAddress = r.newAddress as BookingDraft['newAddress'];
  if (typeof r.scheduledDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.scheduledDate)) out.scheduledDate = r.scheduledDate;
  if (typeof r.slotId === 'string') out.slotId = r.slotId;
  if (r.paymentMethod === 'cash' || r.paymentMethod === 'online' || r.paymentMethod === 'upi') out.paymentMethod = r.paymentMethod;
  if (typeof r.isEmergency === 'boolean') out.isEmergency = r.isEmergency;
  if (typeof r.notes === 'string') out.notes = r.notes.slice(0, 500);
  return out;
}

function subOptionDelta(serviceKey: string, subOptionKey: string): number {
  if (serviceKey === 'ro_service')   return ({ service: 0, filter_change: 49, amc: 149, new_installation: 599 } as Record<string, number>)[subOptionKey] ?? 0;
  if (serviceKey === 'plumbing')     return ({ pipe_leak: 0, tap: 0, drainage: 49, new_fitting: 99, other: 0 } as Record<string, number>)[subOptionKey] ?? 0;
  if (serviceKey === 'water_tanker') return ({ '500': 0, '1000': 50, '2000': 120, custom: 80 } as Record<string, number>)[subOptionKey] ?? 0;
  return 0;
}

function computeBaseAmount(draft: BookingDraft, settings: PlatformSettings): number {
  if (draft.serviceKey === 'water_can') {
    const qty = Math.min(
      maxCansFor(draft),
      Math.max(1, draft.canQuantity ?? 1)
    );
    const per = draft.subOptionKey === 'chilled_ro'
      ? settings.chilled_can_price
      : draft.canOrderType === 'subscription'
        ? settings.subscription_can_price
        : qty >= settings.bulk_threshold && settings.bulk_can_price < settings.default_can_price
          ? settings.bulk_can_price
          : settings.default_can_price;
    return Math.round(qty * per);
  }
  const base = settings.service_base_prices[draft.serviceKey as ServiceKey] ?? 0;
  return Math.round(base + subOptionDelta(draft.serviceKey, draft.subOptionKey));
}

function serviceLabel(key: string): string {
  return SERVICE_LIST.find((s) => s.key === key)?.title ?? key;
}

function selectedServiceLabel(draft: BookingDraft): string {
  if (draft.serviceKey === 'water_can') return draft.subOptionKey === 'chilled_ro' ? 'Chilled RO Water' : 'Normal RO Water';
  return serviceLabel(draft.serviceKey);
}

function formatAddressCard(a: AddressRow): string {
  return [a.house_flat ?? a.line1, a.area ?? a.line2, a.city, a.pincode]
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .join(', ');
}

function nextFourteenIsoDates(min: string): string[] {
  const out: string[] = [];
  const [y, m, d0] = min.split('-').map(Number);
  for (let i = 0; i < 14; i++) {
    const d = new Date(y, m - 1, d0 + i, 12, 0, 0);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    out.push(`${d.getFullYear()}-${mm}-${dd}`);
  }
  return out;
}

function shortDateLabel(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function to12h(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

/* Light colours + 16px on mobile (no iOS zoom) + color-scheme light (beats phone dark mode) */
const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base sm:text-sm text-slate-900 ' +
  'placeholder:text-slate-400 [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-emerald-300 ' +
  'focus:border-emerald-400 transition-colors';

const selectCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base sm:text-sm text-slate-900 ' +
  '[color-scheme:light] focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-colors';

const btnPrimary =
  'rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold ' +
  'hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all';

const btnGhost =
  'rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 ' +
  'hover:bg-slate-50 transition-colors';

const optionBtn = (active: boolean) =>
  `rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 transition-colors ${
    active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'
  }`;

export default function BookingWizard() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { settings, calcOrderTotal, whatsappHref } = useSettings();
  const { session }  = useAuth();

  const [step, setStep]           = useState(1);
  const [furthest, setFurthest]   = useState(1);
  const [hydrated, setHydrated]   = useState(false);
  const [draft, setDraft]         = useState<BookingDraft>(emptyDraft);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [waitlistCity, setWaitlistCity] = useState('');

  const [serviceability, setServiceability] = useState<{
    serviceable: boolean; status: string;
    zone: { id: string; name: string; city: string } | null;
    message: string; services: string[] | null;
  } | null>(null);
  const [checkingServiceability, setCheckingServiceability] = useState(false);

  const [locating, setLocating]         = useState(false);
  const [locationStep, setLocationStep] = useState<'idle' | 'network' | 'gps' | 'geocoding' | 'done' | 'error'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [flashFields, setFlashFields]   = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{
    formattedAddress: string | null; city: string | null; area: string | null;
    pincode: string | null; accuracy: number | null;
  } | null>(null);

  const submitLock     = useRef(false);
  const firstScroll    = useRef(true);
  const geoReq         = useRef(0);
  const stepRef        = useRef<HTMLDivElement | null>(null);
  const addressFormRef = useRef<HTMLDivElement | null>(null);
  const houseInputRef  = useRef<HTMLInputElement | null>(null);

  const view    = createdOrder ? 6 : Math.min(step, MAX_FORM_STEP);
  const minDate = getMinDate();
  const datePills = useMemo(() => nextFourteenIsoDates(minDate), [minDate]);
  const todayOpen = useMemo(
    () => draft.isEmergency || getAvailableSlots(minDate).length > 0,
    // view included so availability is re-read whenever the user reaches the schedule step
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minDate, draft.isEmergency, view],
  );

  const cardMotion = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: 'easeOut' as const },
  };

  const goTo = useCallback((n: number) => {
    const clamped = Math.min(MAX_FORM_STEP, Math.max(1, n));
    setStep(clamped);
    setFurthest((f) => Math.max(f, clamped));
  }, []);

  /* Cancel any in-flight geolocation work on unmount */
  useEffect(() => {
    return () => { geoReq.current += 1; };
  }, []);

  /* ───────── Hydration ───────── */
  useEffect(() => {
    let restored: Partial<BookingDraft> | null = null;
    let restoredStep = 1;
    try {
      const raw = safeSessionGet(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { draft?: unknown; step?: number };
        const s = Number(parsed?.step);
        if (parsed?.draft && typeof parsed.draft === 'object' && s >= 1 && s <= MAX_FORM_STEP) {
          restored = sanitizeDraft(parsed.draft);
          restoredStep = Math.floor(s);
        } else { safeSessionRemove(DRAFT_KEY); }
      }
    } catch { try { safeSessionRemove(DRAFT_KEY); } catch { /* */ } }

    const fresh = emptyDraft();
    const base: BookingDraft = {
      ...fresh, ...(restored ?? {}),
      newAddress: { ...(fresh.newAddress ?? {}), ...(restored?.newAddress ?? {}) },
      canFrequency: restored?.canFrequency ?? fresh.canFrequency,
    };
    base.canQuantity = Math.min(maxCansFor(base), Math.max(1, base.canQuantity ?? 1));

    const serviceParam = searchParams?.get('service') ?? '';
    const serviceOk    = SERVICE_LIST.some((s) => s.key === serviceParam);
    if (serviceOk) {
      base.serviceKey = serviceParam;
      if (serviceParam === 'water_can') {
        const waterParam = searchParams?.get('water');
        if (waterParam === 'chilled') { base.subOptionKey = 'chilled_ro'; base.canOrderType = 'one_time'; }
        else if (waterParam === 'normal') { base.subOptionKey = 'normal_ro'; }
      }
      const planCounts: Record<string, number> = { starter: 10, pro: 20, office: 50 };
      const plan = searchParams?.get('plan') ?? '';
      const frequencyParam = searchParams?.get('frequency') ?? searchParams?.get('billing') ?? '';
      const allowedFrequencies = ['daily', 'alternate', 'weekly', 'biweekly', 'monthly'];
      if (serviceParam === 'water_can' && planCounts[plan]) {
        base.canQuantity = planCounts[plan];
        base.canOrderType = 'subscription';
        base.canFrequency = allowedFrequencies.includes(frequencyParam) ? frequencyParam : 'weekly';
      }
    }
    const cansParam = parseInt(searchParams?.get('cans') ?? '', 10);
    if (serviceOk && base.serviceKey === 'water_can' && Number.isFinite(cansParam) && cansParam >= 1 && cansParam <= MAX_CANS_ONE_TIME) {
      base.canQuantity = cansParam;
    }

    let start = restored ? restoredStep : 1;
    const hm  = typeof window !== 'undefined' ? window.location.hash.match(/step-(\d+)/) : null;
    if (hm) {
      const h = parseInt(hm[1], 10);
      if (h >= 1 && h <= MAX_FORM_STEP) start = Math.min(h, restored ? restoredStep : 1);
    } else if (serviceOk && start === 1) { start = 2; }

    /* Re-validate the schedule: a draft from earlier today/yesterday may be stale */
    const min = getMinDate();
    const knownSlot = base.slotId === ASAP_SLOT_ID || !!getSlotBlock(base.slotId);
    let sv = base.scheduledDate >= min && knownSlot ? buildSlotValue(base.scheduledDate, base.slotId) : null;
    if (!sv || !sv.valid) {
      const n = nextFutureSlot();
      base.scheduledDate = n.date;
      base.slotId = n.slotId;
      sv = buildSlotValue(n.date, n.slotId);
      if (start > 4) start = 4;
    }
    base.startTime = sv.startTime;
    base.endTime = sv.endTime;
    base.timeSlot = sv.time_slot;
    base.scheduled_time = sv.scheduled_time;
    base.slotValid = sv.valid;

    setDraft(base); setStep(start); setFurthest(start); setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || createdOrder) return;
    try { safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: Math.min(step, MAX_FORM_STEP) })); } catch { /* quota */ }
  }, [draft, step, hydrated, createdOrder]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${path}#${createdOrder ? 'confirmed' : `step-${view}`}`);
  }, [view, hydrated, createdOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      if (createdOrder) return;
      const m = window.location.hash.match(/step-(\d+)/);
      if (!m) return;
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= furthest && n <= MAX_FORM_STEP) setStep(n);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [furthest, createdOrder]);

  /* Scroll to top + move focus to the new step (screen-reader & keyboard friendly) */
  useEffect(() => {
    if (!hydrated) return;
    if (firstScroll.current) { firstScroll.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    stepRef.current?.focus({ preventScroll: true });
  }, [view, hydrated]);

  useEffect(() => {
    setDraft((d) => {
      switch (d.serviceKey) {
        case 'water_can':    return { ...d, subOptionKey: ['normal_ro', 'chilled_ro'].includes(d.subOptionKey) ? d.subOptionKey : 'normal_ro', canOrderType: d.subOptionKey === 'chilled_ro' ? 'one_time' : d.canOrderType };
        case 'ro_service':   return ['service', 'filter_change', 'amc', 'new_installation'].includes(d.subOptionKey) ? d : { ...d, subOptionKey: 'service' };
        case 'plumbing':     return ['pipe_leak', 'tap', 'drainage', 'new_fitting', 'other'].includes(d.subOptionKey) ? d : { ...d, subOptionKey: 'pipe_leak' };
        case 'water_tanker': return ['500', '1000', '2000', 'custom'].includes(d.subOptionKey) ? d : { ...d, subOptionKey: '500' };
        default:             return d.subOptionKey ? d : { ...d, subOptionKey: 'standard' };
      }
    });
  }, [draft.serviceKey]);

 const loadAddresses = useCallback(async () => {
  // Guests can browse the booking flow,
  // but customer-only APIs must never be called for other roles.
  if (!session?.loggedIn || session.role !== 'customer') {
    setAddresses([]);
    setAddressesLoaded(true);
    setLoadingAddresses(false);
    return;
  }

  setLoadingAddresses(true);

  try {
    const list = (await customerAddresses()) as AddressRow[];

    setAddresses(Array.isArray(list) ? list : []);
    setAddressesLoaded(true);
  } catch (error) {
    console.error('[BookingWizard] address load failed:', error);

    setAddressesLoaded(true);

    if (
      error instanceof ApiError &&
      error.code === 'CUSTOMER_ROLE_REQUIRED'
    ) {
      return;
    }

    toast.error(
      'We couldn’t load your saved addresses. Please try again or add a new address.'
    );
  } finally {
    setLoadingAddresses(false);
  }
}, [session?.loggedIn, session?.role]);

  useEffect(() => {
    if (!session?.loggedIn || !draft.addressId || view !== 3) {
      setServiceability(null); setCheckingServiceability(false); return;
    }
    let cancelled = false;
    void (async () => {
      setCheckingServiceability(true);
      try {
        const result = await customerServiceability(draft.addressId!, draft.serviceKey);
        if (!cancelled) setServiceability(result);
      } catch (e) {
        if (!cancelled) setServiceability({ serviceable: false, status: 'ERROR', zone: null, message: e instanceof ApiError ? e.message : 'Could not check availability.', services: null });
      } finally { if (!cancelled) setCheckingServiceability(false); }
    })();
    return () => { cancelled = true; };
  }, [draft.addressId, draft.serviceKey, session?.loggedIn, view]);

  useEffect(() => {
  if (
    view >= 3 &&
    session?.loggedIn &&
    session.role === 'customer'
  ) {
    void loadAddresses();
  }
}, [
  view,
  session?.loggedIn,
  session?.role,
  loadAddresses,
]);

  useEffect(() => {
    setDraft((d) => {
      if (d.addressId && addresses.some((a) => a.id === d.addressId)) return d;
      if (!addresses.length) return d.addressId ? { ...d, addressId: undefined } : d;
      const pick = addresses.find((a) => a.is_default) ?? addresses[0];
      return { ...d, addressId: pick.id };
    });
  }, [addresses, addressesLoaded]);

  const baseAmount = useMemo(() => computeBaseAmount(draft, settings), [draft, settings]);
  const breakdown  = useMemo(() => {
    const raw = calcOrderTotal(baseAmount, draft.isEmergency, draft.serviceKey);
    return { ...raw, gst: 0, total: Math.round((raw.total - raw.gst) * 100) / 100 };
  }, [calcOrderTotal, baseAmount, draft.isEmergency, draft.serviceKey]);

  const fromPrice = useCallback((key: string) => {
    if (key === 'water_can') return settings.default_can_price;
    return settings.service_base_prices[key as ServiceKey] ?? 0;
  }, [settings]);

  const perCan = draft.subOptionKey === 'chilled_ro'
    ? settings.chilled_can_price
    : draft.canOrderType === 'subscription'
      ? settings.subscription_can_price
      : (draft.canQuantity ?? 1) >= settings.bulk_threshold && settings.bulk_can_price < settings.default_can_price
        ? settings.bulk_can_price
        : settings.default_can_price;

  const isSubscription =
    draft.serviceKey === 'water_can' &&
    draft.canOrderType === 'subscription';

  const goLoginForCheckout = () => {
    try { safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: 3 })); } catch { /* */ }
    router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-3')}`);
  };

  const onSlotChange = useCallback((v: TimeSlotPickerValue) => {
    setDraft((d) => {
      if (
        d.scheduledDate === v.date && d.slotId === v.slotId && d.timeSlot === v.time_slot &&
        d.slotValid === v.valid && d.scheduled_time === v.scheduled_time
      ) return d;
      return {
        ...d,
        scheduledDate: v.date, slotId: v.slotId,
        timeSlot: v.time_slot, startTime: v.startTime, endTime: v.endTime,
        scheduled_time: v.scheduled_time, slotValid: v.valid,
      };
    });
  }, []);

  /* ───────────────────────── Location ─────────────────────────
   * 1. Pre-check permission (instant message if blocked)
   * 2. Network location first (fast on phones), GPS only as fallback
   * 3. Reverse-geocode with a timeout; keep coordinates even if it fails
   * 4. Ignore results from superseded/unmounted requests
   * ─────────────────────────────────────────────────────────── */
  const detectLocation = useCallback(async () => {
    if (!session?.loggedIn) { toast.error('Please sign in to detect your location.'); return; }
    if (typeof window === 'undefined' || !navigator.geolocation) {
      toast.error('Location is not supported on this browser. Please type your address.');
      return;
    }
    if (locating) return;

    const reqId = ++geoReq.current;
    const stale = () => reqId !== geoReq.current;

    const fail = (msg: string) => {
      if (stale()) return;
      setLocating(false);
      setLocationStep('error');
      setLocationError(msg);
      toast.error(msg);
    };

    if (!window.isSecureContext) {
      fail('Location needs a secure (https) connection. Please type your address.');
      return;
    }

    setLocating(true);
    setLocationError(null);
    setLocationStep('network');

    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (perm?.state === 'denied') { fail(MSG_DENIED); return; }
    } catch { /* Permissions API unsupported — continue */ }

    const getPos = (opts: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });

    const acquire = async (): Promise<GeolocationPosition | null> => {
      try {
        return await getPos({ enableHighAccuracy: false, timeout: 6_000, maximumAge: 60_000 });
      } catch (e) {
        if ((e as GeolocationPositionError).code === 1) { fail(MSG_DENIED); return null; }
      }
      if (stale()) return null;
      setLocationStep('gps');
      try {
        return await getPos({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
      } catch (e) {
        const code = (e as GeolocationPositionError).code;
        fail(code === 1 ? MSG_DENIED : code === 3 ? MSG_TIMEOUT : MSG_UNAVAILABLE);
        return null;
      }
    };

    const pos = await acquire();
    if (!pos || stale()) return;

    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    setLocationStep('geocoding');

    try {
      const result = await Promise.race([
        reverseGeocode(lat, lng),
        new Promise<never>((_, reject) => { setTimeout(() => reject(new Error('geocode-timeout')), 12_000); }),
      ]);
      if (stale()) return;

      const matchedCity =
        LIVE_CITIES.find((c) => c.toLowerCase() === (result.city ?? '').trim().toLowerCase()) ?? null;

      setDraft((d) => ({
        ...d,
        newAddress: {
          ...d.newAddress,
          lat,
          lng,
          area:    result.area || d.newAddress?.area || '',
          city:    matchedCity ?? result.city ?? d.newAddress?.city ?? '',
          pincode: result.pincode || d.newAddress?.pincode || '',
        },
      }));
      setDetectedLocation({
        formattedAddress: result.formattedAddress,
        city: result.city, area: result.area, pincode: result.pincode,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
      });
      setLocationStep('done');
      setLocating(false);

      if (!matchedCity && result.city) {
        toast.warning(`We detected "${result.city}", which isn't live yet. Please check the city.`);
      } else {
        toast.success('Location detected — add flat/house no. and save.');
      }

      setFlashFields(true);
      setTimeout(() => {
        addressFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        houseInputRef.current?.focus({ preventScroll: true });
      }, 250);
      setTimeout(() => setFlashFields(false), 2500);
    } catch (e) {
      if (stale()) return;
      // Keep the GPS point so the nearest supplier can still be assigned
      setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, lat, lng } }));
      setLocating(false);
      setLocationStep('error');
      const msg =
        e instanceof ApiError
          ? e.message
          : 'We found your position but could not read the street address. Please type your area and pincode.';
      setLocationError(msg);
      toast.warning(msg);
    }
  }, [session?.loggedIn, locating]);

  const locationButtonLabel = () => {
    if (locationStep === 'network')   return 'Checking network…';
    if (locationStep === 'gps')       return 'Getting GPS…';
    if (locationStep === 'geocoding') return 'Finding address…';
    if (locationStep === 'done')      return '📍 Detected ✓ · Retry';
    if (locationStep === 'error')     return '📍 Try again';
    return '📍 Detect my location';
  };

  const flashCls = flashFields ? ' ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50' : '';

  const validateStep = (s: number): boolean => {
    if (s === 1) { if (!draft.serviceKey) { toast.error('Pick a service.'); return false; } return true; }
    if (s === 2) {
      if (draft.serviceKey === 'water_can') {
        const q = draft.canQuantity ?? 1;
        if (q < 1 || q > maxCansFor(draft)) {
          toast.error(`Quantity: 1 – ${maxCansFor(draft)}.`);
          return false;
        }
        if (
          draft.canOrderType === 'subscription' &&
          !['daily', 'alternate', 'weekly', 'biweekly', 'monthly'].includes(
            String(draft.canFrequency)
          )
        ) {
          toast.error('Choose a delivery frequency.');
          return false;
        }
      }
      if (!draft.subOptionKey) { toast.error('Choose an option.'); return false; }
      return true;
    }
    if (s === 3) {
      if (!session?.loggedIn)   { toast.error('Sign in to continue.'); return false; }
      const na = draft.newAddress;
      if (na?.house_flat?.trim() && na.area?.trim() && na.pincode?.trim().length === 6) {
        toast.info('You filled a new address — tap "Save address" first, or clear it.');
        return false;
      }
      if (!draft.addressId)     { toast.error('Select or add a delivery address.'); return false; }
      if (checkingServiceability) { toast.error('Checking availability — please wait.'); return false; }
      if (!serviceability?.serviceable) { toast.error(serviceability?.message ?? 'Address not serviceable.'); return false; }
      return true;
    }
    if (s === 4) {
      const v = buildSlotValue(draft.scheduledDate, draft.slotId);
      if (!draft.slotValid || !v.valid) { toast.error('Pick an available delivery window.'); return false; }
      return true;
    }
    return true;
  };

  const nextStep = () => { if (!validateStep(view)) return; goTo(view + 1); };
  const prevStep = () => goTo(view - 1);

  const resetWizard = useCallback(() => {
    try { safeSessionRemove(DRAFT_KEY); } catch { /* */ }
    submitLock.current = false;
    geoReq.current += 1;
    setCreatedOrder(null); setSubmitError(null);
    setLocating(false); setLocationStep('idle'); setLocationError(null); setDetectedLocation(null);
    const fresh = emptyDraft();
    const sv = buildSlotValue(fresh.scheduledDate, fresh.slotId);
    setDraft({
      ...fresh,
      startTime: sv.startTime, endTime: sv.endTime, timeSlot: sv.time_slot,
      scheduled_time: sv.scheduled_time, slotValid: sv.valid,
    });
    setStep(1); setFurthest(1);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}#step-1`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const saveInlineAddress = async () => {
    if (savingAddress) return;
    const na = draft.newAddress ?? {};
    if (!na.house_flat?.trim() || !na.area?.trim() || !na.city?.trim() || !na.pincode?.trim()) {
      toast.error('Fill flat/house, area, city, and pincode (6 digits).'); return;
    }
    if (!/^[0-9]{6}$/.test(na.pincode.trim())) { toast.error('Pincode must be exactly 6 digits.'); return; }
    setSavingAddress(true);
    try {
      const payload = {
        label:      na.label ?? 'Home',
        house_flat: na.house_flat.trim(),
        area:       na.area.trim(),
        city:       na.city.trim(),
        pincode:    na.pincode.trim(),
        landmark:   na.landmark?.trim() ?? '',
        is_default: na.is_default ?? true,
        ...(typeof na.lat === 'number' && typeof na.lng === 'number' ? { lat: na.lat, lng: na.lng } : {}),
      };
      const created = (await customerAddressCreate(payload as Parameters<typeof customerAddressCreate>[0])) as AddressRow;
      await loadAddresses();
      setDraft((d) => ({ ...d, addressId: created.id, newAddress: { ...emptyDraft().newAddress } }));
      setLocationStep('idle'); setDetectedLocation(null); setLocationError(null);
      toast.success('Address saved and selected ✓');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save address.');
    } finally { setSavingAddress(false); }
  };

  const confirmOrder = async () => {
    if (submitLock.current || createdOrder) return;
    if (!draft.addressId || !session?.loggedIn) { toast.error('Missing address or session.'); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.error('You appear to be offline. Check your connection and try again.');
      return;
    }

    /* Re-validate the window right before submitting (time has passed since step 4) */
    const sv = buildSlotValue(draft.scheduledDate, draft.slotId);
    if (!sv.valid) {
      setDraft((d) => ({ ...d, slotValid: false }));
      toast.error('Your delivery window is no longer available. Please pick another.');
      goTo(4);
      return;
    }

    submitLock.current = true;
    setSubmitting(true); setSubmitError(null);
    try {
      const order = await customerOrderCreate({
        service_type_key: draft.serviceKey, address_id: draft.addressId,
        sub_option_key: draft.subOptionKey || 'standard',
        scheduled_date: draft.scheduledDate, time_slot: sv.time_slot,
        scheduled_time: sv.scheduled_time, is_emergency: draft.isEmergency,
        base_amount: baseAmount, convenience_fee: breakdown.convenience,
        gst_amount: breakdown.gst, total_amount: breakdown.total,
        payment_method: draft.paymentMethod, notes: draft.notes?.trim() || undefined,
        can_quantity:   draft.serviceKey === 'water_can' ? draft.canQuantity  : undefined,
        can_order_type: draft.serviceKey === 'water_can' ? draft.canOrderType : undefined,
        can_frequency:  draft.serviceKey === 'water_can' && draft.canOrderType === 'subscription' ? draft.canFrequency : undefined,
      });
      try { safeSessionRemove(DRAFT_KEY); } catch { /* */ }
      setDraft((d) => ({ ...d, timeSlot: sv.time_slot, startTime: sv.startTime, endTime: sv.endTime }));
      setCreatedOrder(order);
      toast.success('Booking confirmed! 🎉');
    } catch (e) {
      submitLock.current = false;
      if (e instanceof ApiError && e.status === 401) {
        try { safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: 5 })); } catch { /* */ }
        router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-5')}`);
        return;
      }
      const msg = e instanceof ApiError ? e.message : 'Booking failed. Please try again.';
      setSubmitError(msg); toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const waLink   = whatsappHref ?? `https://wa.me/91${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '9889305803').replace(/\D/g, '')}`;
  const orderNo  = createdOrder?.order_number ?? createdOrder?.id?.slice(0, 8) ?? '—';
  const waTrackHref = useMemo(() => {
    const msg  = `Hi AuroWater — my order #${orderNo}. Please share live status.`;
    const base = waLink.split('?')[0];
    try { const u = new URL(base.includes('://') ? base : `https://${base}`); u.searchParams.set('text', msg); return u.toString(); }
    catch { return `${base}?text=${encodeURIComponent(msg)}`; }
  }, [waLink, orderNo]);

  const selectedAddress = addresses.find((a) => a.id === draft.addressId);
  const newPinHint      = pinHint(draft.newAddress?.city, draft.newAddress?.pincode);
  const orderStatus     = String((createdOrder as unknown as Record<string, unknown> | null)?.status ?? '');
  const supplierSearching = (createdOrder as unknown as Record<string, unknown> | null)?.supplier_status === 'searching' || orderStatus === 'PENDING';
  const windowText = draft.startTime && draft.endTime
    ? `${shortDateLabel(draft.scheduledDate)} · ${to12h(draft.startTime)} – ${to12h(draft.endTime)}${draft.slotId === ASAP_SLOT_ID ? ' (ASAP)' : ''}`
    : '—';

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

        <div className="text-center mb-6">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Book a service</p>
          <h1 className="mt-1 text-2xl sm:text-4xl font-extrabold text-[#0F172A]" style={{ fontFamily: 'var(--font-syne,Syne,system-ui,sans-serif)' }}>
            Schedule in minutes
          </h1>
          {view > 1 && view < 6 && (
            <button type="button" onClick={resetWizard} className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-700 underline underline-offset-2">
              Start over
            </button>
          )}
        </div>

        <BookingProgress step={view} maxStep={furthest} onStepClick={createdOrder ? undefined : (n) => goTo(n)} />

        {/* Focus target for step changes */}
        <div ref={stepRef} tabIndex={-1} className="outline-none" aria-live="polite">

        {/* STEP 1 */}
        {view === 1 && (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">1 · Choose service</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SERVICE_LIST.map((s) => (
                <button key={s.key} type="button" aria-pressed={draft.serviceKey === s.key}
                  onClick={() => setDraft((d) => ({ ...d, serviceKey: s.key }))}
                  className={[
                    'rounded-2xl border p-4 text-left transition-all hover:shadow-md',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                    draft.serviceKey === s.key
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white',
                  ].join(' ')}>
                  <div className="text-2xl" aria-hidden>{s.emoji}</div>
                  <div className="mt-2 font-semibold text-slate-900 text-sm leading-tight">{s.title}</div>
                  <div className="mt-1 text-xs text-emerald-700 font-semibold">
                    From ₹{Math.round(fromPrice(s.key)).toLocaleString('en-IN')}
                  </div>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={draft.isEmergency}
                onChange={(e) => setDraft((d) => ({ ...d, isEmergency: e.target.checked }))}
                className="h-5 w-5 rounded border-slate-300 text-emerald-600" />
              <span className="text-sm text-slate-700">
                Emergency booking (+ {inr(settings.emergency_surcharge)} surcharge) · arrives ASAP, even outside {to12h(`${OPEN_HOUR}:00`)}–{to12h(`${CLOSE_HOUR}:00`)}
              </span>
            </label>
            <div className="flex justify-end">
              <button type="button" onClick={nextStep} className={btnPrimary}>Continue →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {view === 2 && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">2 · Options · {serviceLabel(draft.serviceKey)}</h2>

            {draft.serviceKey === 'water_can' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Water type">
                  <button type="button" aria-pressed={draft.subOptionKey !== 'chilled_ro'} onClick={() => setDraft((d) => ({ ...d, subOptionKey: 'normal_ro' }))} className={optionBtn(draft.subOptionKey !== 'chilled_ro')}>
                    <span className="block text-sm font-extrabold">Everyday Normal RO</span>
                    <span className="mt-1 block text-lg font-extrabold text-emerald-700">{inr(settings.default_can_price)} / 20L</span>
                    <span className="mt-1 block text-xs text-slate-500">For daily home &amp; office use</span>
                    <span className="mt-1 block text-[11px] text-slate-500">Delivery included</span>
                  </button>
                  <button type="button" aria-pressed={draft.subOptionKey === 'chilled_ro'} onClick={() => setDraft((d) => ({ ...d, subOptionKey: 'chilled_ro', canOrderType: 'one_time' }))} className={optionBtn(draft.subOptionKey === 'chilled_ro')}>
                    <span className="block text-sm font-extrabold">Chilled RO Water</span>
                    <span className="mt-1 block text-lg font-extrabold text-sky-700">{inr(settings.chilled_can_price)} / 20L</span>
                    <span className="mt-1 block text-xs text-slate-500">For parties, weddings &amp; events</span>
                    <span className="mt-1 block text-[11px] text-slate-500">Chilled &amp; delivered</span>
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="text-sm font-medium text-slate-700">Quantity (cans)</span>
                    <span className="block text-xs text-slate-500">
                      Max {maxCansFor(draft)}{draft.canOrderType !== 'subscription' ? ' · choose subscription for more' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="Decrease quantity"
                      className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-900 text-lg font-bold hover:bg-slate-50 active:scale-95"
                      onClick={() => setDraft((d) => ({ ...d, canQuantity: Math.max(1, (d.canQuantity ?? 1) - 1) }))}>−</button>
                    <span className="font-extrabold w-10 text-center text-lg text-slate-900" aria-live="polite">{draft.canQuantity ?? 1}</span>
                    <button type="button" aria-label="Increase quantity"
                      className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-900 text-lg font-bold hover:bg-slate-50 active:scale-95"
                      onClick={() => setDraft((d) => ({ ...d, canQuantity: Math.min(maxCansFor(d), (d.canQuantity ?? 1) + 1) }))}>+</button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" aria-label="Quick quantity">
                  {QUICK_QTY.filter((n) => n <= maxCansFor(draft)).map((n) => (
                    <button key={n} type="button" aria-pressed={(draft.canQuantity ?? 1) === n}
                      onClick={() => setDraft((d) => ({ ...d, canQuantity: n }))}
                      className={`rounded-full border px-4 py-1.5 text-sm font-semibold text-slate-900 ${(draft.canQuantity ?? 1) === n ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      {n}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={draft.canOrderType !== 'subscription'}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        canOrderType: 'one_time',
                        canQuantity: Math.min(
                          d.canQuantity ?? 1,
                          MAX_CANS_ONE_TIME
                        ),
                      }))
                    }
                    className={optionBtn(draft.canOrderType !== 'subscription')}
                  >
                    <span className="block text-sm font-extrabold">One-time</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {inr(draft.subOptionKey === 'chilled_ro' ? settings.chilled_can_price : settings.default_can_price)} per can
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {draft.subOptionKey === 'chilled_ro' ? 'Chilled price applies per can' : `${inr(settings.bulk_can_price)} per can from ${settings.bulk_threshold} cans`}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={draft.subOptionKey === 'chilled_ro'}
                    aria-pressed={draft.canOrderType === 'subscription'}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        subOptionKey: 'normal_ro',
                        canOrderType: 'subscription',
                        canFrequency: d.canFrequency ?? 'weekly',
                        paymentMethod:
                          d.paymentMethod === 'online'
                            ? 'cash'
                            : d.paymentMethod,
                      }))
                    }
                    className={`${optionBtn(draft.canOrderType === 'subscription')} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold">Subscription</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                        {(draft.canQuantity ?? 1) >= settings.bulk_threshold
                          ? `Bulk rate applies at ${settings.bulk_threshold}+ cans`
                          : `Save ${inr(Math.max(0, settings.default_can_price - settings.subscription_can_price))}/can`}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {inr(settings.subscription_can_price)} per can · recurring
                    </span>
                    {draft.subOptionKey === 'chilled_ro' && <span className="mt-1 block text-[11px] text-amber-700">Subscription is available for Normal RO only.</span>}
                    <span className="mt-1 block text-[11px] text-slate-400">
                      Pay per delivery · no automatic debit
                    </span>
                  </button>
                </div>

                {draft.canOrderType === 'subscription' && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <p className="text-sm font-extrabold text-slate-900">Recurring water delivery</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      AuroTap creates a separate order for each delivery using your saved address and preferred time window.
                    </p>
                    <label htmlFor="can-freq" className="mt-4 block text-sm font-bold text-slate-700">
                      Delivery frequency
                    </label>
                    <select
                      id="can-freq"
                      className={`mt-1 ${selectCls}`}
                      value={draft.canFrequency ?? 'weekly'}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          canFrequency: e.target.value,
                        }))
                      }
                    >
                      <option value="daily">Every day</option>
                      <option value="alternate">Every 2 days</option>
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Every month</option>
                    </select>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      You can pause or cancel future deliveries later. Each delivery is billed separately.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-xs font-semibold text-slate-500">Price for this delivery</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {inr(perCan)} × {draft.canQuantity ?? 1} = {inr(perCan * (draft.canQuantity ?? 1))}
                  </span>
                </div>
              </div>
            )}

            {draft.serviceKey === 'ro_service' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['service','Routine service'],['filter_change','Filter change'],['amc','AMC'],['new_installation','New installation']].map(([k,l]) => (
                  <button key={k} type="button" aria-pressed={draft.subOptionKey === k}
                    onClick={() => setDraft((d) => ({ ...d, subOptionKey: k }))}
                    className={`${optionBtn(draft.subOptionKey === k)} text-left`}>{l}</button>
                ))}
              </div>
            )}

            {draft.serviceKey === 'plumbing' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['pipe_leak','Pipe leak'],['tap','Tap repair'],['drainage','Drainage'],['new_fitting','New fitting'],['other','Other']].map(([k,l]) => (
                  <button key={k} type="button" aria-pressed={draft.subOptionKey === k}
                    onClick={() => setDraft((d) => ({ ...d, subOptionKey: k }))}
                    className={`${optionBtn(draft.subOptionKey === k)} text-left`}>{l}</button>
                ))}
              </div>
            )}

            {draft.serviceKey === 'water_tanker' && (
              <div className="grid grid-cols-2 gap-3">
                {[['500','500L'],['1000','1000L'],['2000','2000L'],['custom','Custom']].map(([k,l]) => (
                  <button key={k} type="button" aria-pressed={draft.subOptionKey === k}
                    onClick={() => setDraft((d) => ({ ...d, subOptionKey: k }))}
                    className={optionBtn(draft.subOptionKey === k)}>{l}</button>
                ))}
              </div>
            )}

            {SCOPE_SERVICES.includes(draft.serviceKey) && (
              <div>
                <label htmlFor="scope" className="text-sm font-medium text-slate-700">Describe the issue / scope</label>
                <textarea id="scope" className={`mt-1 min-h-[90px] resize-y ${inputCls}`}
                  value={draft.notes ?? ''} maxLength={500}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional — helps our crew prepare" />
              </div>
            )}

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Estimated base</span>
                <span className="font-bold text-slate-900">{inr(baseAmount)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Water-can orders have no separate handling fee. Review the complete payable total before confirming.</p>
            </div>

            <div className="flex justify-between gap-3">
              <button type="button" onClick={prevStep} className={btnGhost}>Back</button>
              <button type="button" onClick={nextStep} className={btnPrimary}>Continue</button>
            </div>
          </motion.div>
        )}

        {/* STEP 3 */}
        {view === 3 && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">3 · Delivery address</h2>
            <p className="text-sm text-slate-500">We deliver in: {LIVE_CITIES.join(', ')}</p>

            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">My city isn&apos;t listed — join waitlist</summary>
              <div className="mt-3 rounded-2xl bg-[#0A1628] p-3 space-y-3">
                <input className="w-full rounded-xl border border-white/10 bg-[#0d1f35] px-3 py-2.5 text-base sm:text-sm text-white placeholder:text-white/40"
                  placeholder="Your city" aria-label="Your city" value={waitlistCity} onChange={(e) => setWaitlistCity(e.target.value)} />
                <WaitlistPanel cityName={waitlistCity.trim() || 'your city'} cityId={null} role="customer" source="book" />
              </div>
            </details>

            {!session?.loggedIn && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
                <p className="font-semibold text-amber-900">Sign in to save your address</p>
                <p className="text-sm text-amber-800">Your booking draft is saved — you&apos;ll return here after login.</p>
                <button type="button" onClick={goLoginForCheckout} className={btnPrimary}>Sign in to continue</button>
              </div>
            )}

            {session?.loggedIn && (
              <>
                {loadingAddresses && !addressesLoaded ? (
                  <div className="space-y-3" aria-busy="true">
                    <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
                  </div>
                ) : addresses.length > 0 && (
                  <div className="space-y-2" role="radiogroup" aria-label="Saved addresses">
                    {addresses.map((a) => (
                      <label key={a.id} className={`flex gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${draft.addressId === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                        <input type="radio" name="addr" checked={draft.addressId === a.id}
                          onChange={() => { setServiceability(null); setDraft((d) => ({ ...d, addressId: a.id })); }}
                          className="mt-1 accent-emerald-600" />
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">
                            {a.label ?? 'Address'}
                            {a.is_default && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">DEFAULT</span>}
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5">{formatAddressCard(a)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {addresses.length === 0 && addressesLoaded && (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 text-center">
                    No saved addresses yet — add one below
                  </p>
                )}

                {draft.addressId && (
                  <div className={`rounded-2xl border p-4 transition-colors ${
                    checkingServiceability || !serviceability ? 'border-slate-200 bg-slate-50' :
                    serviceability.serviceable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                  }`} aria-live="polite">
                    {checkingServiceability || !serviceability ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                        <p className="text-sm text-slate-600">Checking service availability…</p>
                      </div>
                    ) : (
                      <>
                        <p className={`font-semibold text-sm ${serviceability.serviceable ? 'text-emerald-800' : 'text-amber-900'}`}>
                          {serviceability.serviceable ? '✓ Service available' : 'Not currently available'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{serviceability.message}</p>
                        {serviceability.status === 'COMING_SOON' && (
                          <div className="mt-3">
                            <WaitlistPanel cityName={serviceability.zone?.name ?? 'your area'} cityId={null} role="customer" source="book-zone" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Add new address */}
                <div ref={addressFormRef} className="border-t border-slate-100 pt-5 space-y-4 scroll-mt-4">
                  <h3 className="font-semibold text-slate-800">Add new address</h3>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Auto-detect location</p>
                        <p className="text-xs text-slate-500 mt-0.5">Fills area, city &amp; pincode automatically</p>
                      </div>
                      <button type="button" onClick={() => void detectLocation()} disabled={locating}
                        className={[
                          'shrink-0 rounded-xl px-4 py-3 text-sm font-semibold transition-all w-full sm:w-auto',
                          locating
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 cursor-wait'
                            : locationStep === 'done'
                            ? 'border border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50',
                        ].join(' ')}>
                        {locating && <span className="inline-block h-3 w-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mr-2 align-middle" />}
                        {locationButtonLabel()}
                      </button>
                    </div>

                    {locationError && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
                        <p className="font-semibold">⚠ {locationError}</p>
                        <p className="text-xs mt-1">You can always type the address in the fields below.</p>
                      </div>
                    )}

                    {detectedLocation && locationStep === 'done' && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-sm font-semibold text-emerald-900">📍 Location filled below</p>
                        <p className="text-xs text-emerald-700 mt-1">
                          {[detectedLocation.area, detectedLocation.city].filter(Boolean).join(', ')}
                          {detectedLocation.pincode ? ` · ${detectedLocation.pincode}` : ''}
                        </p>
                        {detectedLocation.formattedAddress && (
                          <p className="text-xs text-emerald-700 mt-1 break-words">{detectedLocation.formattedAddress}</p>
                        )}
                        <p className="text-xs text-emerald-600 mt-1">
                          {detectedLocation.accuracy !== null && detectedLocation.accuracy > 500
                            ? 'Location is approximate — please check the area and pincode. '
                            : ''}
                          Add your flat/house no., then tap Save address.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input className={inputCls} placeholder="Label (e.g. Home)" aria-label="Label"
                      value={draft.newAddress?.label ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, label: e.target.value } }))} />

                    <input ref={houseInputRef} className={inputCls} placeholder="Flat / house no. *" aria-label="Flat or house" required
                      value={draft.newAddress?.house_flat ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, house_flat: e.target.value } }))} />

                    <input className={`sm:col-span-2 ${inputCls}${flashCls}`} placeholder="Area / locality *" aria-label="Area" required
                      value={draft.newAddress?.area ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, area: e.target.value } }))} />

                    <select className={`${selectCls}${flashCls}`} aria-label="City"
                      value={draft.newAddress?.city ?? LIVE_CITIES[0] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, city: e.target.value } }))}>
                      {LIVE_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <div>
                      <input className={`${inputCls}${flashCls}`} placeholder="Pincode *" aria-label="Pincode"
                        inputMode="numeric" pattern="[0-9]{6}" autoComplete="postal-code" required
                        value={draft.newAddress?.pincode ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) } }))} />
                      {newPinHint && <p className="mt-1 text-xs text-amber-700">{newPinHint}</p>}
                    </div>

                    <input className={`sm:col-span-2 ${inputCls}`} placeholder="Landmark (optional)" aria-label="Landmark"
                      value={draft.newAddress?.landmark ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, landmark: e.target.value } }))} />
                  </div>

                  <button type="button" onClick={() => void saveInlineAddress()} disabled={savingAddress}
                    className="rounded-xl border-2 border-emerald-600 bg-white px-5 py-3 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition-colors w-full sm:w-auto">
                    {savingAddress ? 'Saving…' : '+ Save address'}
                  </button>
                </div>
              </>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <button type="button" onClick={prevStep} className={btnGhost}>Back</button>
              <button type="button" onClick={nextStep}
                disabled={!session?.loggedIn || !draft.addressId || checkingServiceability || !serviceability?.serviceable}
                className={btnPrimary}>Continue</button>
            </div>
          </motion.div>
        )}

        {/* STEP 4 */}
        {view === 4 && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">4 · Schedule</h2>
            <p className="text-sm text-slate-500">
              Pick a date and a delivery window ({to12h(`${OPEN_HOUR}:00`)} – {to12h(`${CLOSE_HOUR}:00`)}).
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Delivery date">
              {datePills.map((iso) => {
                const disabled = iso === minDate && !todayOpen;
                return (
                  <button key={iso} type="button" aria-pressed={draft.scheduledDate === iso} disabled={disabled}
                    onClick={() => {
                      const n = nextFutureSlot(iso);
                      setDraft((d) => ({
                        ...d,
                        scheduledDate: iso,
                        slotId: n.date === iso ? n.slotId : '',
                        slotValid: false,
                      }));
                    }}
                    className={[
                      'shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                      disabled ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : draft.scheduledDate === iso ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}>
                    {shortDateLabel(iso)}
                  </button>
                );
              })}
            </div>

            <TimeSlotPicker
              key={`${draft.scheduledDate}-${draft.isEmergency ? 'e' : 'n'}`}
              minDate={minDate}
              emergency={draft.isEmergency}
              value={{ date: draft.scheduledDate || minDate, startTime: draft.startTime, endTime: draft.endTime, slotId: draft.slotId }}
              onChange={onSlotChange}
            />

            <p className="text-sm text-slate-500">
              Total so far: <span className="font-bold text-emerald-700">{inr(breakdown.total)}</span>
            </p>
            <div className="flex justify-between gap-3">
              <button type="button" onClick={prevStep} className={btnGhost}>Back</button>
              <button type="button" onClick={nextStep} disabled={!draft.slotValid} className={btnPrimary}>Continue</button>
            </div>
          </motion.div>
        )}

        {/* STEP 5 */}
        {view === 5 && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">5 · Review &amp; payment</h2>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm">
              {[
                ['Service', `${selectedServiceLabel(draft)}${draft.serviceKey === 'water_can' ? ` × ${draft.canQuantity ?? 1}` : ''}`],
                ['Address', selectedAddress ? formatAddressCard(selectedAddress) : '—'],
                ['Window',  windowText],
                ...(isSubscription
                  ? [['Plan', `Subscription · ${String(draft.canFrequency ?? 'weekly')}`]]
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-right text-slate-900">{v}</span>
                </div>
              ))}
              <hr className="border-slate-200" />
              <div className="flex justify-between text-slate-900"><span className="text-slate-600">Base price</span><span>{inr(breakdown.base)}</span></div>
              <div className="flex justify-between text-slate-900"><span className="text-slate-600">Convenience</span><span>{inr(breakdown.convenience)}</span></div>
              {breakdown.gst > 0 && <div className="flex justify-between text-slate-900"><span className="text-slate-600">GST</span><span>{inr(breakdown.gst)}</span></div>}
              {draft.isEmergency && <div className="flex justify-between text-amber-700"><span>Emergency</span><span>{inr(breakdown.emergency)}</span></div>}
              <hr className="border-slate-200" />
              <div className="flex justify-between text-base font-extrabold text-emerald-800">
                <span>TOTAL</span><span>{inr(breakdown.total)}</span>
              </div>
            </div>

            {!SCOPE_SERVICES.includes(draft.serviceKey) && (
              <div>
                <label htmlFor="notes" className="text-sm font-medium text-slate-700">Note for the supplier (optional)</label>
                <textarea id="notes" className={`mt-1 min-h-[70px] resize-y ${inputCls}`}
                  value={draft.notes ?? ''} maxLength={500}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="e.g. Call on arrival, gate code, 3rd floor" />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Payment method</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(isSubscription
                  ? (['cash', 'upi'] as const)
                  : (['cash', 'upi', 'online'] as const)
                ).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={draft.paymentMethod === k}
                    onClick={() =>
                      setDraft((d) => ({ ...d, paymentMethod: k }))
                    }
                    className={`${optionBtn(draft.paymentMethod === k)} text-left`}
                  >
                    {k === 'cash'
                      ? '💵 Cash on delivery'
                      : k === 'upi'
                        ? '📱 UPI per delivery'
                        : '💳 Card / netbanking'}
                  </button>
                ))}
              </div>
              {isSubscription ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                  Subscription billing is per delivery. Automatic debit is not enabled.
                </p>
              ) : draft.paymentMethod !== 'cash' ? (
                <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Online payment is coming soon. For now, payment is completed during fulfilment.
                </p>
              ) : null}
            </div>

            {submitError && (
              <div role="alert" className="rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-sm px-4 py-3">{submitError}</div>
            )}

            <div className="flex justify-between gap-3 flex-wrap">
              <button type="button" onClick={prevStep} disabled={submitting} className={btnGhost}>Back</button>
              <button type="button" disabled={submitting || !draft.addressId} onClick={() => void confirmOrder()} className={btnPrimary}>
                {submitting ? 'Placing your order…' : 'Confirm booking →'}
              </button>
            </div>
          </motion.div>
        )}

        {view === 5 && (
          <div className="fixed left-0 right-0 bottom-3 z-40 px-4 pointer-events-none">
            <div className="mx-auto max-w-3xl rounded-xl border border-blue-200 bg-blue-50 text-blue-800 px-4 py-3 text-xs font-semibold">
              🛡 Delivery slots depend on your address and local provider availability. Review the full order total before confirming.
            </div>
          </div>
        )}

        {/* STEP 6 */}
        {view === 6 && createdOrder && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-7 sm:p-10 text-center space-y-6" role="status">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl" aria-hidden>✓</div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">You&apos;re booked</p>
            <div className="text-4xl sm:text-5xl font-extrabold text-[#0F172A]" style={{ fontFamily: 'var(--font-syne,Syne,system-ui,sans-serif)' }}>
              #{orderNo}
            </div>
            <div className="text-slate-600 space-y-1 text-sm">
              <p>{selectedServiceLabel(draft)}{draft.serviceKey === 'water_can' ? ` × ${draft.canQuantity ?? 1}` : ''} · <span className="font-semibold text-slate-900">{inr(breakdown.total)}</span> · {draft.paymentMethod === 'cash' ? 'Pay on delivery' : draft.paymentMethod.toUpperCase()}</p>
              <p>Window: <span className="font-semibold text-slate-900">{windowText}</span></p>
              <p>{supplierSearching ? 'Finding the nearest supplier…' : 'Supplier assigned. Tracking updates automatically.'}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={ROUTES.track(createdOrder.id)} className={`${btnPrimary} text-center`}>Track order</Link>
              {(createdOrder as unknown as Record<string, unknown>).subscription_id ? (
                <Link
                  href="/customer/subscriptions"
                  className={`${btnGhost} text-center`}
                >
                  Manage subscription
                </Link>
              ) : null}
              <a href={waTrackHref} target="_blank" rel="noreferrer"
                className="rounded-xl border border-emerald-600 bg-white text-emerald-700 px-6 py-3 font-semibold text-center hover:bg-emerald-50">
                Track on WhatsApp
              </a>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center border-t border-slate-100 pt-4">
              <button type="button" onClick={resetWizard} className={btnGhost}>Book another</button>
              <Link href={ROUTES.home} className={`${btnGhost} text-center`}>Home</Link>
              <Link href={ROUTES.orders} className={`${btnGhost} text-center`}>My orders</Link>
            </div>
          </motion.div>
        )}
        </div>
      </div>
    </div>
  );
}












// 'use client';

// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
// import { motion } from 'framer-motion';

// import BookingProgress from '@/components/booking/BookingProgress';
// import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
// import type { TimeSlotPickerValue } from '@/components/booking/TimeSlotPicker';
// import {
//   ApiError,
//   customerAddressCreate,
//   customerAddresses,
//   customerServiceability,
//   customerOrderCreate,
//   reverseGeocode,
//   type ApiOrder,
// } from '@/lib/api-client';

// import { getMinDate, nextFutureSlot } from '@/lib/validation/time-slot-client';
// import { useAuth } from '@/hooks/useAuth';
// import { useSettings, inr, type PlatformSettings, type ServiceKey } from '@/hooks/useSettings';
// import { safeSessionGet, safeSessionRemove, safeSessionSet } from '@/lib/storage';
// import { ACTIVE_CITY_NAMES } from '@/lib/cities';
// import WaitlistPanel from '@/components/ui/WaitlistPanel';

// /* ───────────── Edit if your routes differ ───────────── */
// const ROUTES = {
//   home: '/customer/home',
//   orders: '/customer/history',
//   track: (id: string) => `/customer/track/${id}`,
// } as const;

// /** Session draft — persisted so login redirect does not lose progress. */
// export interface BookingDraft {
//   serviceKey: string;
//   subOptionKey: string;
//   canQuantity?: number;
//   canOrderType?: 'one_time' | 'subscription';
//   canFrequency?: string;
//   addressId?: string;
//   newAddress?: {
//     label?: string;
//     house_flat?: string;
//     area?: string;
//     city?: string;
//     pincode?: string;
//     landmark?: string;
//     is_default?: boolean;
//     lat?: number;
//     lng?: number;
//   };
//   scheduledDate: string;
//   timeSlot: string;
//   startTime: string;
//   endTime: string;
//   /** ISO string from validation helper — sent as `scheduled_time` to API */
//   scheduled_time: string;
//   isEmergency: boolean;
//   paymentMethod: 'cash' | 'online' | 'upi';
//   notes?: string;
//   slotValid?: boolean;
// }

// const DRAFT_KEY = 'aw_booking_draft_v1';
// const MAX_FORM_STEP = 5;
// const MAX_CANS_ONE_TIME = 50;
// const MAX_CANS_SUBSCRIPTION = 200;
// /** Early check only: the server enforces the real hours from settings. */
// const OPEN_HOUR = 7;
// const CLOSE_HOUR = 21;

// function maxCansFor(d: { canOrderType?: 'one_time' | 'subscription' }): number {
//   return d.canOrderType === 'subscription' ? MAX_CANS_SUBSCRIPTION : MAX_CANS_ONE_TIME;
// }

// const SERVICE_LIST: { key: string; emoji: string; title: string }[] = [
//   { key: 'water_can', emoji: '💧', title: 'Water cans' },
//   { key: 'water_tanker', emoji: '🚚', title: 'Water tanker' },
//   { key: 'ro_service', emoji: '🔧', title: 'RO service' },
//   { key: 'plumbing', emoji: '🛠️', title: 'Plumbing' },
//   { key: 'borewell', emoji: '⛏️', title: 'Borewell' },
//   { key: 'motor_pump', emoji: '⚙️', title: 'Motor & pump' },
//   { key: 'tank_cleaning', emoji: '✨', title: 'Tank cleaning' },
// ];

// const LIVE_CITIES = ACTIVE_CITY_NAMES;

// /** Soft check only (never blocks): helps catch city / pincode mix-ups. */
// const CITY_PIN_PREFIX: Record<string, string[]> = {
//   Kanpur: ['208', '209'],
//   Gorakhpur: ['273'],
//   Lucknow: ['226', '227'],
// };

// function pinHint(city: string | undefined, pin: string | undefined): string {
//   if (!city || !pin || pin.length < 3) return '';
//   const known = CITY_PIN_PREFIX[city];
//   if (!known) return '';
//   if (known.some((p) => pin.startsWith(p))) return '';
//   const other = Object.entries(CITY_PIN_PREFIX).find(([, ps]) => ps.some((p) => pin.startsWith(p)))?.[0];
//   return other
//     ? `This pincode looks like ${other}, not ${city}. Please double-check.`
//     : `This pincode does not look like ${city}. Please double-check.`;
// }

// type AddressRow = {
//   id: string;
//   label: string | null;
//   house_flat?: string | null;
//   area?: string | null;
//   line1?: string | null;
//   line2?: string | null;
//   city: string;
//   pincode: string | null;
//   landmark?: string | null;
//   is_default?: boolean | null;
// };

// function emptyDraft(): BookingDraft {
//   const slot = nextFutureSlot();
//   return {
//     serviceKey: 'water_can',
//     subOptionKey: 'standard',
//     canQuantity: 1,
//     canOrderType: 'one_time',
//     canFrequency: 'weekly',
//     scheduledDate: slot.date,
//     timeSlot: '',
//     startTime: slot.startTime,
//     endTime: slot.endTime,
//     scheduled_time: '',
//     isEmergency: false,
//     paymentMethod: 'cash',
//     notes: '',
//     slotValid: false,
//     newAddress: {
//       label: 'Home',
//       house_flat: '',
//       area: '',
//       city: LIVE_CITIES[0] ?? 'Gorakhpur',
//       pincode: '',
//       landmark: '',
//       is_default: true,
//     },
//   };
// }

// function subOptionDelta(serviceKey: string, subOptionKey: string): number {
//   if (serviceKey === 'ro_service') {
//     const m: Record<string, number> = { service: 0, filter_change: 49, amc: 149, new_installation: 599 };
//     return m[subOptionKey] ?? 0;
//   }
//   if (serviceKey === 'plumbing') {
//     const m: Record<string, number> = { pipe_leak: 0, tap: 0, drainage: 49, new_fitting: 99, other: 0 };
//     return m[subOptionKey] ?? 0;
//   }
//   if (serviceKey === 'water_tanker') {
//     const m: Record<string, number> = { '500': 0, '1000': 50, '2000': 120, custom: 80 };
//     return m[subOptionKey] ?? 0;
//   }
//   return 0;
// }

// function computeBaseAmount(draft: BookingDraft, settings: PlatformSettings): number {
//   if (draft.serviceKey === 'water_can') {
//     const qty = Math.min(maxCansFor(draft), Math.max(1, draft.canQuantity ?? 1));
//     const per =
//       draft.canOrderType === 'subscription' ? settings.subscription_can_price : settings.default_can_price;
//     return Math.round(qty * per);
//   }
//   const baseKey = draft.serviceKey as ServiceKey;
//   const base = settings.service_base_prices[baseKey] ?? 0;
//   return Math.round(base + subOptionDelta(draft.serviceKey, draft.subOptionKey));
// }

// function serviceLabel(key: string): string {
//   return SERVICE_LIST.find((s) => s.key === key)?.title ?? key;
// }

// function formatAddressCard(a: AddressRow): string {
//   const parts = [a.house_flat ?? a.line1, a.area ?? a.line2, a.city, a.pincode].filter(
//     (x) => typeof x === 'string' && x.trim()
//   );
//   return parts.join(', ');
// }

// function nextFourteenIsoDates(min: string): string[] {
//   const out: string[] = [];
//   const start = new Date(min + 'T12:00:00');
//   for (let i = 0; i < 14; i++) {
//     const d = new Date(start);
//     d.setDate(d.getDate() + i);
//     out.push(d.toISOString().slice(0, 10));
//   }
//   return out;
// }

// function shortDateLabel(iso: string): string {
//   const d = new Date(iso + 'T12:00:00');
//   return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
// }

// function to12h(t: string): string {
//   const m = /^(\d{1,2}):(\d{2})/.exec(t);
//   if (!m) return t;
//   let h = parseInt(m[1], 10);
//   const ap = h >= 12 ? 'PM' : 'AM';
//   h = h % 12 || 12;
//   return `${h}:${m[2]} ${ap}`;
// }

// const inputCls =
//   'rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400';
// const btnPrimary =
//   'rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition';
// const btnGhost =
//   'rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 transition';

// export default function BookingWizard() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const { settings, calcOrderTotal, whatsappHref } = useSettings();
//   const { session } = useAuth();

//   const [step, setStep] = useState(1);
//   const [furthest, setFurthest] = useState(1);
//   const [hydrated, setHydrated] = useState(false);
//   const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
//   const [addresses, setAddresses] = useState<AddressRow[]>([]);
//   const [addressesLoaded, setAddressesLoaded] = useState(false);
//   const [loadingAddresses, setLoadingAddresses] = useState(false);
//   const [savingAddress, setSavingAddress] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
//   const [submitError, setSubmitError] = useState<string | null>(null);
//   const [waitlistCity, setWaitlistCity] = useState('');
  
//   const [serviceability, setServiceability] = useState<{
//   serviceable: boolean;
//   status: string;
//   zone: {
//     id: string;
//     name: string;
//     city: string;
//   } | null;
//   message: string;
//   services: string[] | null;
// } | null>(null);

// const [checkingServiceability, setCheckingServiceability] = useState(false);

//   const [locating, setLocating] = useState(false);

// const [locationError, setLocationError] = useState<string | null>(null);

// const [detectedLocation, setDetectedLocation] = useState<{
//   formattedAddress: string | null;
//   city: string | null;
//   area: string | null;
//   pincode: string | null;
// } | null>(null);

//   const submitLock = useRef(false);
//   const firstScroll = useRef(true);

//   /** The step actually shown. Step 6 exists ONLY when an order was really created. */
//   const view = createdOrder ? 6 : Math.min(step, MAX_FORM_STEP);

//   const minDate = getMinDate();
//   const datePills = useMemo(() => nextFourteenIsoDates(minDate), [minDate]);

//   const cardMotion = {
//     initial: { opacity: 0, y: 10 },
//     animate: { opacity: 1, y: 0 },
//     transition: { duration: 0.25, ease: 'easeOut' as const },
//   };

//   const goTo = useCallback((n: number) => {
//     const clamped = Math.min(MAX_FORM_STEP, Math.max(1, n));
//     setStep(clamped);
//     setFurthest((f) => Math.max(f, clamped));
//   }, []);

//   /* ───────── One-time hydration: draft + URL params (never restores step 6) ───────── */
//   useEffect(() => {
//     let restored: Partial<BookingDraft> | null = null;
//     let restoredStep = 1;
//     try {
//       const raw = safeSessionGet(DRAFT_KEY);
//       if (raw) {
//         const parsed = JSON.parse(raw) as { draft?: Partial<BookingDraft>; step?: number };
//         const s = Number(parsed?.step);
//         if (parsed?.draft && typeof parsed.draft === 'object' && s >= 1 && s <= MAX_FORM_STEP) {
//           restored = parsed.draft;
//           restoredStep = Math.floor(s);
//         } else {
//           // Old drafts saved at "step 6" belong to finished orders: discard.
//           safeSessionRemove(DRAFT_KEY);
//         }
//       }
//     } catch {
//       try {
//         safeSessionRemove(DRAFT_KEY);
//       } catch {
//         /* ignore */
//       }
//     }

//     const fresh = emptyDraft();
//     const base: BookingDraft = {
//       ...fresh,
//       ...(restored ?? {}),
//       newAddress: { ...(fresh.newAddress ?? {}), ...(restored?.newAddress ?? {}) },
//       canFrequency: restored?.canFrequency ?? fresh.canFrequency,
//     };

//     // Stale schedule guard (draft saved on an earlier day)
//     const min = getMinDate();
//     if (!base.scheduledDate || base.scheduledDate < min) {
//       base.scheduledDate = fresh.scheduledDate;
//       base.startTime = fresh.startTime;
//       base.endTime = fresh.endTime;
//       base.timeSlot = '';
//       base.scheduled_time = '';
//       base.slotValid = false;
//     }

//     // URL params (pricing page CTAs etc.)
//     const serviceParam = searchParams?.get('service') ?? '';
//     const serviceOk = SERVICE_LIST.some((s) => s.key === serviceParam);
//     if (serviceOk) {
//       base.serviceKey = serviceParam;
//       const planCanCounts: Record<string, number> = { starter: 30, pro: 60, office: 120 };
//       const plan = searchParams?.get('plan') ?? '';
//       const qty = plan ? planCanCounts[plan] : undefined;
//       const billing = searchParams?.get('billing');
//       if (serviceParam === 'water_can' && qty) {
//         base.canQuantity = qty;
//         base.canOrderType = 'subscription';
//         base.canFrequency = billing === 'yearly' ? 'monthly' : base.canFrequency ?? 'weekly';
//       }
//     }

//     // Reorder links: /book?service=water_can&cans=5
//     const cansParam = parseInt(searchParams?.get('cans') ?? '', 10);
//     if (serviceOk && base.serviceKey === 'water_can' && Number.isFinite(cansParam) && cansParam >= 1 && cansParam <= MAX_CANS_ONE_TIME) {
//       base.canQuantity = cansParam;
//     }

//     // Starting step
//     let start = restored ? restoredStep : 1;
//     const hm = typeof window !== 'undefined' ? window.location.hash.match(/step-(\d+)/) : null;
//     if (hm) {
//       const h = parseInt(hm[1], 10);
//       if (h >= 1 && h <= MAX_FORM_STEP) start = Math.min(h, restored ? restoredStep : 1);
//     } else if (serviceOk && start === 1) {
//       start = 2; // service already chosen -> go straight to options
//     }

//     setDraft(base);
//     setStep(start);
//     setFurthest(start);
//     setHydrated(true);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   /* Persist draft (never after an order exists, never step 6) */
//   useEffect(() => {
//     if (!hydrated || createdOrder) return;
//     try {
//       safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: Math.min(step, MAX_FORM_STEP) }));
//     } catch {
//       /* quota */
//     }
//   }, [draft, step, hydrated, createdOrder]);

//   /* Keep URL hash in sync (no history spam) */
//   useEffect(() => {
//     if (!hydrated || typeof window === 'undefined') return;
//     const path = `${window.location.pathname}${window.location.search}`;
//     window.history.replaceState(null, '', `${path}#${createdOrder ? 'confirmed' : `step-${view}`}`);
//   }, [view, hydrated, createdOrder]);

//   /* Browser back/forward via hash: only to steps already reached */
//   useEffect(() => {
//     if (typeof window === 'undefined') return;
//     const onHash = () => {
//       if (createdOrder) return;
//       const m = window.location.hash.match(/step-(\d+)/);
//       if (!m) return;
//       const n = parseInt(m[1], 10);
//       if (n >= 1 && n <= furthest && n <= MAX_FORM_STEP) setStep(n);
//     };
//     window.addEventListener('hashchange', onHash);
//     return () => window.removeEventListener('hashchange', onHash);
//   }, [furthest, createdOrder]);

//   /* Scroll to top on step change */
//   useEffect(() => {
//     if (!hydrated) return;
//     if (firstScroll.current) {
//       firstScroll.current = false;
//       return;
//     }
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   }, [view, hydrated]);

//   /* Sub-option defaults per service */
//   useEffect(() => {
//     setDraft((d) => {
//       switch (d.serviceKey) {
//         case 'water_can':
//           return { ...d, subOptionKey: d.subOptionKey || 'standard' };
//         case 'ro_service':
//           return ['service', 'filter_change', 'amc', 'new_installation'].includes(d.subOptionKey)
//             ? d
//             : { ...d, subOptionKey: 'service' };
//         case 'plumbing':
//           return ['pipe_leak', 'tap', 'drainage', 'new_fitting', 'other'].includes(d.subOptionKey)
//             ? d
//             : { ...d, subOptionKey: 'pipe_leak' };
//         case 'water_tanker':
//           return ['500', '1000', '2000', 'custom'].includes(d.subOptionKey)
//             ? d
//             : { ...d, subOptionKey: '500' };
//         default:
//           return d.subOptionKey ? d : { ...d, subOptionKey: 'standard' };
//       }
//     });
//   }, [draft.serviceKey]);

//   const loadAddresses = useCallback(async () => {
//     if (!session?.loggedIn) return;
//     setLoadingAddresses(true);
//     try {
//       const list = (await customerAddresses()) as AddressRow[];
//       setAddresses(Array.isArray(list) ? list : []);
//       setAddressesLoaded(true);
//     } catch {
//       toast.error('Could not load addresses.');
//     } finally {
//       setLoadingAddresses(false);
//     }
//   }, [session?.loggedIn]);

//   useEffect(() => {
//   if (!session?.loggedIn || !draft.addressId || view !== 3) {
//   setServiceability(null);
//   setCheckingServiceability(false);
//   return;
// }

//   let cancelled = false;

//   const checkServiceability = async () => {
//     setCheckingServiceability(true);

//     try {
//       const result = await customerServiceability(
//         draft.addressId!,
//         draft.serviceKey
//       );

//       if (!cancelled) {
//         setServiceability(result);
//       }
//     } catch (e) {
//       if (!cancelled) {
//         setServiceability({
//           serviceable: false,
//           status: 'ERROR',
//           zone: null,
//           message:
//             e instanceof ApiError
//               ? e.message
//               : 'Could not check service availability right now.',
//           services: null,
//         });
//       }
//     } finally {
//       if (!cancelled) {
//         setCheckingServiceability(false);
//       }
//     }
//   };

//   void checkServiceability();

//   return () => {
//     cancelled = true;
//   };
// }, [draft.addressId, draft.serviceKey, session?.loggedIn, view]);
  
//  useEffect(() => {
//   if (view >= 3 && session?.loggedIn) {
//     void loadAddresses();
//   }
// }, [view, session?.loggedIn, loadAddresses]);

// /* Auto-select a sensible address; drop a stale one */
// useEffect(() => {
//   setDraft((d) => {
//     if (d.addressId && addresses.some((a) => a.id === d.addressId)) {
//       return d;
//     }

//     if (!addresses.length) {
//       return d.addressId ? { ...d, addressId: undefined } : d;
//     }

//     const pick = addresses.find((a) => a.is_default) ?? addresses[0];

//     return { ...d, addressId: pick.id };
//   });
// }, [addresses, addressesLoaded]);

// const baseAmount = useMemo(
//   () => computeBaseAmount(draft, settings),
//   [draft, settings]
// );

// const breakdown = useMemo(
//     () => {
//       const raw = calcOrderTotal(baseAmount, draft.isEmergency);
//       // GST is not charged: remove it from the total everywhere.
//       return { ...raw, gst: 0, total: Math.round((raw.total - raw.gst) * 100) / 100 };
//     },
//     [calcOrderTotal, baseAmount, draft.isEmergency]
//   );

//   const fromPrice = useCallback(
//     (key: string) => {
//       if (key === 'water_can') return settings.default_can_price;
//       const k = key as ServiceKey;
//       return settings.service_base_prices[k] ?? 0;
//     },
//     [settings]
//   );

//   const goLoginForCheckout = () => {
//     try {
//       safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: 3 }));
//     } catch {
//       /* ignore */
//     }
//     router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-3')}`);
//   };

//   const onSlotChange = useCallback((v: TimeSlotPickerValue) => {
//     setDraft((d) => ({
//       ...d,
//       scheduledDate: v.date,
//       timeSlot: v.time_slot,
//       startTime: v.startTime,
//       endTime: v.endTime,
//       scheduled_time: v.scheduled_time,
//       slotValid: v.valid,
//     }));
//   }, []);

//   const validateStep = (s: number): boolean => {
//     if (s === 1) {
//       if (!draft.serviceKey) {
//         toast.error('Pick a service.');
//         return false;
//       }
//       return true;
//     }
//     if (s === 2) {
//       if (draft.serviceKey === 'water_can') {
//         const q = draft.canQuantity ?? 1;
//         if (q < 1 || q > maxCansFor(draft)) {
//           toast.error(`Quantity must be between 1 and ${maxCansFor(draft)}.`);
//           return false;
//         }
//       }
//       if (!draft.subOptionKey) {
//         toast.error('Choose an option.');
//         return false;
//       }
//       return true;
//     }
//     // if (s === 3) {
//     //   if (!session?.loggedIn) {
//     //     toast.error('Sign in to continue.');
//     //     return false;
//     //   }
//     //   if (!draft.addressId) {
//     //     toast.error('Select or add a delivery address.');
//     //     return false;
//     //   }
//     //   return true;
//     // }
//     if (s === 3) {
//   if (!session?.loggedIn) {
//     toast.error('Sign in to continue.');
//     return false;
//   }

//   if (!draft.addressId) {
//     toast.error('Select or add a delivery address.');
//     return false;
//   }

//   if (checkingServiceability) {
//     toast.error('Checking service availability. Please wait.');
//     return false;
//   }

//   if (!serviceability?.serviceable) {
//     toast.error(
//       serviceability?.message ??
//         'This address is not currently serviceable.'
//     );
//     return false;
//   }

//   return true;
// }
//     if (s === 4) {
//       if (!draft.slotValid) {
//         toast.error('Pick a valid date and time slot.');
//         return false;
//       }
//       if (!draft.isEmergency) {
//         const m = /^(\d{1,2}):(\d{2})/.exec(draft.startTime);
//         if (m) {
//           const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
//           if (mins < OPEN_HOUR * 60 || mins >= CLOSE_HOUR * 60) {
//             toast.error('We deliver between 7 AM and 9 PM. Please pick a slot in that window.');
//             return false;
//           }
//         }
//       }
//       return true;
//     }
//     return true;
//   };

//   const nextStep = () => {
//     if (!validateStep(view)) return;
//     goTo(view + 1);
//   };
//   const prevStep = () => goTo(view - 1);

//   const resetWizard = useCallback(() => {
//     try {
//       safeSessionRemove(DRAFT_KEY);
//     } catch {
//       /* ignore */
//     }
//     submitLock.current = false;
//     setCreatedOrder(null);
//     setSubmitError(null);
//     setDraft(emptyDraft());
//     setStep(1);
//     setFurthest(1);
//     if (typeof window !== 'undefined') {
//       window.history.replaceState(null, '', `${window.location.pathname}#step-1`);
//       window.scrollTo({ top: 0, behavior: 'smooth' });
//     }
//   }, []);

//   const saveInlineAddress = async () => {
//     if (savingAddress) return;
//     const na = draft.newAddress ?? {};
//     if (!na.house_flat?.trim() || !na.area?.trim() || !na.city?.trim() || !na.pincode?.trim()) {
//       toast.error('Fill house, area, city, and 6-digit pincode.');
//       return;
//     }
//     if (!/^[0-9]{6}$/.test(na.pincode.trim())) {
//       toast.error('Pincode must be 6 digits.');
//       return;
//     }
//     setSavingAddress(true);
//     try {
//       const payload = {
//         label: na.label ?? 'Home',
//         house_flat: na.house_flat.trim(),
//         area: na.area.trim(),
//         city: na.city.trim(),
//         pincode: na.pincode.trim(),
//         landmark: na.landmark?.trim() ?? '',
//         is_default: na.is_default ?? true,
//         // Optional coordinates let us assign the nearest supplier
//         ...(typeof na.lat === 'number' && typeof na.lng === 'number' ? { lat: na.lat, lng: na.lng } : {}),
//       };
//       const created = (await customerAddressCreate(
//         payload as unknown as Parameters<typeof customerAddressCreate>[0]
//       )) as AddressRow;
//       await loadAddresses();
//       setDraft((d) => ({
//         ...d,
//         addressId: created.id,
//         newAddress: { ...emptyDraft().newAddress },
//       }));
//       toast.success('Address saved and selected.');
//     } catch (e) {
//       toast.error(e instanceof ApiError ? e.message : 'Could not save address.');
//     } finally {
//       setSavingAddress(false);
//     }
//   };

// const useMyLocation = () => {
//   if (!session?.loggedIn) {
//     toast.error('Please sign in to detect your location.');
//     return;
//   }

//   if (typeof navigator === 'undefined' || !navigator.geolocation) {
//     toast.error('Location is not available on this device.');
//     return;
//   }

//   if (locating) return;

//   setLocating(true);
//   setLocationError(null);

//   navigator.geolocation.getCurrentPosition(
//     async (pos) => {
//       try {
//         const lat = pos.coords.latitude;
//         const lng = pos.coords.longitude;

//         const result = await reverseGeocode(lat, lng);

//         setDraft((d) => ({
//           ...d,
//           newAddress: {
//             ...d.newAddress,
//             lat,
//             lng,
//             area: result.area ?? d.newAddress?.area ?? '',
//             city: result.city ?? d.newAddress?.city ?? '',
//             pincode: result.pincode ?? d.newAddress?.pincode ?? '',
//           },
//         }));

//         setDetectedLocation({
//           formattedAddress: result.formattedAddress,
//           city: result.city,
//           area: result.area,
//           pincode: result.pincode,
//         });

//         toast.success('Location detected. Please review your address.');
//       } catch (e) {
//         const message =
//           e instanceof ApiError
//             ? e.message
//             : 'Could not determine your address from this location.';

//         setLocationError(message);
//         toast.error(message);
//       } finally {
//         setLocating(false);
//       }
//     },
//     (error) => {
//       let message = 'Could not get your location. You can enter the address manually.';

//       if (error.code === error.PERMISSION_DENIED) {
//         message = 'Location permission was denied. Please allow location access or enter the address manually.';
//       } else if (error.code === error.TIMEOUT) {
//         message = 'Location detection timed out. Please try again or enter the address manually.';
//       }

//       setLocationError(message);
//       setLocating(false);
//       toast.error(message);
//     },
//     {
//       enableHighAccuracy: true,
//       timeout: 15_000,
//       maximumAge: 0,
//     }
//   );
// };

//   const confirmOrder = async () => {
//     // Hard lock: a fast double-click can never create two orders
//     if (submitLock.current || createdOrder) return;
//     if (!draft.addressId || !session?.loggedIn) {
//       toast.error('Missing address or session.');
//       return;
//     }
//     submitLock.current = true;
//     setSubmitting(true);
//     setSubmitError(null);
//     try {
//       const order = await customerOrderCreate({
//         service_type_key: draft.serviceKey,
//         address_id: draft.addressId,
//         sub_option_key: draft.subOptionKey || 'standard',
//         scheduled_date: draft.scheduledDate,
//         time_slot: draft.timeSlot,
//         scheduled_time: draft.scheduled_time,
//         is_emergency: draft.isEmergency,
//         base_amount: baseAmount,
//         convenience_fee: breakdown.convenience,
//         gst_amount: breakdown.gst,
//         total_amount: breakdown.total,
//         payment_method: draft.paymentMethod,
//         notes: draft.notes?.trim() || undefined,
//         can_quantity: draft.serviceKey === 'water_can' ? draft.canQuantity : undefined,
//         can_order_type: draft.serviceKey === 'water_can' ? draft.canOrderType : undefined,
//         can_frequency:
//           draft.serviceKey === 'water_can' && draft.canOrderType === 'subscription'
//             ? draft.canFrequency
//             : undefined,
//       });
//       // Remove the draft BEFORE flipping to the done screen; persistence is also
//       // guarded by `createdOrder`, so it can never be re-saved.
//       try {
//         safeSessionRemove(DRAFT_KEY);
//       } catch {
//         /* ignore */
//       }
//       setCreatedOrder(order);
//       toast.success('Booking confirmed!');
//       // lock stays ON: this wizard run is finished
//     } catch (e) {
//       submitLock.current = false;
//       if (e instanceof ApiError && e.status === 401) {
//         try {
//           safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: 5 }));
//         } catch {
//           /* ignore */
//         }
//         router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-5')}`);
//         return;
//       }
//       const msg = e instanceof ApiError ? e.message : 'Booking failed. Please try again.';
//       setSubmitError(msg);
//       toast.error(msg);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const waLink =
//     whatsappHref ??
//     `https://wa.me/91${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '9889305803').replace(/\D/g, '')}`;

//   const orderNo = createdOrder?.order_number ?? createdOrder?.id?.slice(0, 8) ?? '—';

//   const waTrackHref = useMemo(() => {
//     const msg = `Hi AuroWater — my order #${orderNo}. Please share live status.`;
//     const base = waLink.split('?')[0];
//     try {
//       const u = new URL(base.includes('://') ? base : `https://${base}`);
//       u.searchParams.set('text', msg);
//       return u.toString();
//     } catch {
//       return `${base}?text=${encodeURIComponent(msg)}`;
//     }
//   }, [waLink, orderNo]);

//   const selectedAddress = addresses.find((a) => a.id === draft.addressId);
//   const newPinHint = pinHint(draft.newAddress?.city, draft.newAddress?.pincode);

//   const orderStatus = String((createdOrder as unknown as Record<string, unknown> | null)?.status ?? '');
//   const supplierSearching =
//     (createdOrder as unknown as Record<string, unknown> | null)?.supplier_status === 'searching' ||
//     orderStatus === 'PENDING';

//   const etaText =
//     draft.startTime && draft.endTime
//       ? `${shortDateLabel(draft.scheduledDate)} · ${to12h(draft.startTime)} – ${to12h(draft.endTime)}`
//       : draft.timeSlot || 'Within your selected window';

//   return (
//     <div className="min-h-screen bg-slate-50 pb-28">
//       <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
//         <div className="text-center mb-8">
//           <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Book a service</p>
//           <h1
//             className="mt-2 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
//             style={{ fontFamily: 'var(--font-syne), Syne, system-ui, sans-serif' }}
//           >
//             Schedule in minutes
//           </h1>
//           {view > 1 && view < 6 ? (
//             <button
//               type="button"
//               onClick={resetWizard}
//               className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2"
//             >
//               Start over
//             </button>
//           ) : null}
//         </div>

//         <BookingProgress
//           step={view}
//           maxStep={furthest}
//           onStepClick={createdOrder ? undefined : (n) => goTo(n)}
//         />

//         {/* Step 1 */}
//         {view === 1 && (
//           <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
//             <h2 className="text-lg font-bold text-slate-900">1 · Choose service</h2>
//             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
//               {SERVICE_LIST.map((s) => (
//                 <button
//                   key={s.key}
//                   type="button"
//                   aria-pressed={draft.serviceKey === s.key}
//                   onClick={() => setDraft((d) => ({ ...d, serviceKey: s.key }))}
//                   className={
//                     'rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
//                     (draft.serviceKey === s.key
//                       ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
//                       : 'border-slate-200 bg-white')
//                   }
//                 >
//                   <div className="text-2xl" aria-hidden>
//                     {s.emoji}
//                   </div>
//                   <div className="mt-2 font-semibold text-slate-900 text-sm">{s.title}</div>
//                   <div className="mt-1 text-xs text-emerald-700 font-semibold">
//                     From ₹{Math.round(fromPrice(s.key)).toLocaleString('en-IN')}
//                   </div>
//                 </button>
//               ))}
//             </div>
//             <label className="flex items-center gap-3 cursor-pointer">
//               <input
//                 type="checkbox"
//                 checked={draft.isEmergency}
//                 onChange={(e) => setDraft((d) => ({ ...d, isEmergency: e.target.checked }))}
//                 className="h-5 w-5 rounded border-slate-300 text-emerald-600"
//               />
//               <span className="text-sm text-slate-700">
//                 Emergency booking (+ {inr(settings.emergency_surcharge)} surcharge)
//               </span>
//             </label>
//             <div className="flex justify-end">
//               <button type="button" onClick={nextStep} className={btnPrimary}>
//                 Continue →
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Step 2 */}
//         {view === 2 && (
//           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
//             <h2 className="text-lg font-bold text-slate-900">2 · Options · {serviceLabel(draft.serviceKey)}</h2>

//             {draft.serviceKey === 'water_can' && (
//               <div className="space-y-4">
//                 <div className="flex items-center justify-between gap-4">
//                   <span className="text-sm font-medium text-slate-700">
//                     Quantity (cans)
//                     <span className="block text-xs font-normal text-slate-500">
//                       Up to {maxCansFor(draft)} per order{draft.canOrderType !== 'subscription' ? ' · need more? choose a subscription' : ''}
//                     </span>
//                   </span>
//                   <div className="flex items-center gap-3">
//                     <button
//                       type="button"
//                       aria-label="Decrease quantity"
//                       className="h-10 w-10 rounded-xl border border-slate-200 font-bold hover:bg-slate-50"
//                       onClick={() =>
//                         setDraft((d) => ({ ...d, canQuantity: Math.max(1, (d.canQuantity ?? 1) - 1) }))
//                       }
//                     >
//                       −
//                     </button>
//                     <span className="font-extrabold w-10 text-center" aria-live="polite">
//                       {draft.canQuantity ?? 1}
//                     </span>
//                     <button
//                       type="button"
//                       aria-label="Increase quantity"
//                       className="h-10 w-10 rounded-xl border border-slate-200 font-bold hover:bg-slate-50"
//                       onClick={() =>
//                         setDraft((d) => ({ ...d, canQuantity: Math.min(maxCansFor(d), (d.canQuantity ?? 1) + 1) }))
//                       }
//                     >
//                       +
//                     </button>
//                   </div>
//                 </div>
//                 <div className="grid grid-cols-2 gap-3">
//                   <button
//                     type="button"
//                     aria-pressed={draft.canOrderType !== 'subscription'}
//                     className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
//                       draft.canOrderType !== 'subscription' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                     }`}
//                     onClick={() =>
//                       setDraft((d) => ({
//                         ...d,
//                         canOrderType: 'one_time',
//                         canQuantity: Math.min(d.canQuantity ?? 1, MAX_CANS_ONE_TIME),
//                       }))
//                     }
//                   >
//                     One-time
//                   </button>
//                   <button
//                     type="button"
//                     aria-pressed={draft.canOrderType === 'subscription'}
//                     className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
//                       draft.canOrderType === 'subscription' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                     }`}
//                     onClick={() => setDraft((d) => ({ ...d, canOrderType: 'subscription' }))}
//                   >
//                     Subscription
//                   </button>
//                 </div>
//                 {draft.canOrderType === 'subscription' && (
//                   <div>
//                     <label htmlFor="can-frequency" className="text-sm font-medium text-slate-700">
//                       Delivery frequency
//                     </label>
//                     <select
//                       id="can-frequency"
//                       className={`mt-1 w-full ${inputCls}`}
//                       value={draft.canFrequency ?? 'weekly'}
//                       onChange={(e) => setDraft((d) => ({ ...d, canFrequency: e.target.value }))}
//                     >
//                       <option value="weekly">Weekly</option>
//                       <option value="biweekly">Every 2 weeks</option>
//                       <option value="monthly">Monthly</option>
//                     </select>
//                   </div>
//                 )}
//               </div>
//             )}

//             {draft.serviceKey === 'ro_service' && (
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 {[
//                   ['service', 'Routine service'],
//                   ['filter_change', 'Filter change'],
//                   ['amc', 'AMC'],
//                   ['new_installation', 'New installation'],
//                 ].map(([key, label]) => (
//                   <button
//                     key={key}
//                     type="button"
//                     aria-pressed={draft.subOptionKey === key}
//                     onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
//                     className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
//                       draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                     }`}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>
//             )}

//             {draft.serviceKey === 'plumbing' && (
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 {[
//                   ['pipe_leak', 'Pipe leak'],
//                   ['tap', 'Tap repair'],
//                   ['drainage', 'Drainage'],
//                   ['new_fitting', 'New fitting'],
//                   ['other', 'Other'],
//                 ].map(([key, label]) => (
//                   <button
//                     key={key}
//                     type="button"
//                     aria-pressed={draft.subOptionKey === key}
//                     onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
//                     className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
//                       draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                     }`}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>
//             )}

//             {draft.serviceKey === 'water_tanker' && (
//               <div className="grid grid-cols-2 gap-3">
//                 {[
//                   ['500', '500L'],
//                   ['1000', '1000L'],
//                   ['2000', '2000L'],
//                   ['custom', 'Custom'],
//                 ].map(([key, label]) => (
//                   <button
//                     key={key}
//                     type="button"
//                     aria-pressed={draft.subOptionKey === key}
//                     onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
//                     className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
//                       draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                     }`}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>
//             )}

//             {['borewell', 'motor_pump', 'tank_cleaning'].includes(draft.serviceKey) && (
//               <div>
//                 <label htmlFor="scope-notes" className="text-sm font-medium text-slate-700">
//                   Describe the issue / scope
//                 </label>
//                 <textarea
//                   id="scope-notes"
//                   className={`mt-1 w-full min-h-[100px] ${inputCls}`}
//                   value={draft.notes ?? ''}
//                   maxLength={500}
//                   onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
//                   placeholder="Optional details help our crew prepare."
//                 />
//                 <p className="mt-2 text-xs text-slate-500">Photo upload is planned — notes only for now.</p>
//               </div>
//             )}

//             <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
//               <div className="flex justify-between">
//                 <span>Estimated base</span>
//                 <span className="font-bold">{inr(baseAmount)}</span>
//               </div>
//               <p className="text-xs text-slate-500 mt-1">GST & platform fees are added at checkout.</p>
//             </div>

//             <div className="flex justify-between gap-3">
//               <button type="button" onClick={prevStep} className={btnGhost}>
//                 Back
//               </button>
//               <button type="button" onClick={nextStep} className={btnPrimary}>
//                 Continue
//               </button>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 3 */}
//         {view === 3 && (
//           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
//             <h2 className="text-lg font-bold text-slate-900">3 · Address</h2>
//             <p className="text-sm text-slate-600">
//               We currently deliver in {LIVE_CITIES.join(', ')}. Pick a live city, or join the waitlist if yours is not
//               listed.
//             </p>
//             <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
//               <summary className="cursor-pointer text-sm font-semibold text-slate-800">
//                 My city is not listed — join waitlist
//               </summary>
//               <div className="mt-3 space-y-3 rounded-2xl bg-[#0A1628] p-3">
//                 <input
//                   className="w-full rounded-xl border border-white/10 bg-[#0d1f35] px-3 py-2 text-sm text-white"
//                   placeholder="Your city"
//                   aria-label="Your city"
//                   value={waitlistCity}
//                   onChange={(e) => setWaitlistCity(e.target.value)}
//                 />
//                 <WaitlistPanel
//                   cityName={waitlistCity.trim() || 'your city'}
//                   cityId={null}
//                   role="customer"
//                   source="book"
//                 />
//               </div>
//             </details>

//             {!session?.loggedIn && (
//               <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
//                 <p className="font-semibold text-amber-900">Sign in to save your delivery address</p>
//                 <p className="text-sm text-amber-800">
//                   Your booking draft is saved on this device — after login you&apos;ll return here.
//                 </p>
//                 <button type="button" onClick={goLoginForCheckout} className={btnPrimary}>
//                   Sign in to continue
//                 </button>
//               </div>
//             )}

//             {session?.loggedIn && (
//               <>
//                 {loadingAddresses && !addressesLoaded ? (
//                   <div className="space-y-3" aria-busy="true">
//                     <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
//                     <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
//                   </div>
//                 ) : addresses.length === 0 ? (
//                   <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
//                     No saved addresses yet. Add your first one below.
//                   </p>
//                 ) : (
//                   <div className="space-y-3" role="radiogroup" aria-label="Saved addresses">
//                     {addresses.map((a) => (
//                       <label
//                         key={a.id}
//                         className={`flex gap-3 rounded-2xl border p-4 cursor-pointer ${
//                           draft.addressId === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                         }`}
//                       >
//                         <input
//                           type="radio"
//                           name="addr"
//                           checked={draft.addressId === a.id}
//                           onChange={() => {
//                           setServiceability(null);
//                           setDraft((d) => ({ ...d, addressId: a.id }));
//                     }}
//                           className="mt-1"
//                         />
//                         <div>
//                           <div className="font-semibold text-slate-900">
//                             {a.label ?? 'Address'}
//                             {a.is_default ? (
//                               <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
//                                 DEFAULT
//                               </span>
//                             ) : null}
//                           </div>
//                           <div className="text-sm text-slate-600">{formatAddressCard(a)}</div>
//                         </div>
//                       </label>
//                     ))}
//                   </div>
//                 )}

//                 {/* SERVICEABILITY MESSAGE — START */}
//                 {draft.addressId && (
//                   <div
//                     className={`rounded-2xl border p-4 ${
//                       checkingServiceability
//                         ? 'border-slate-200 bg-slate-50'
//                         : serviceability?.serviceable
//                           ? 'border-emerald-200 bg-emerald-50'
//                           : 'border-amber-200 bg-amber-50'
//                     }`}
//                     aria-live="polite"
//                   >
//                     {checkingServiceability || !serviceability ? (
//                       <p className="text-sm font-medium text-slate-700">
//                         Checking service availability for this address…
//                       </p>
//                     ) : (
//                       <>
//                         <p
//                           className={`font-semibold ${
//                             serviceability?.serviceable
//                               ? 'text-emerald-800'
//                               : 'text-amber-900'
//                           }`}
//                         >
//                           {serviceability?.serviceable
//                             ? '✓ Service available'
//                             : 'Service not currently available'}
//                         </p>

//                         <p className="mt-1 text-sm text-slate-700">
//                           {serviceability?.message}
//                         </p>

//                         {serviceability?.status === 'COMING_SOON' && (
//                           <div className="mt-3">
//                             <WaitlistPanel
//                               cityName={serviceability.zone?.name ?? 'your area'}
//                               cityId={null}
//                               role="customer"
//                               source="book-zone"
//                             />
//                           </div>
//                         )}
//                       </>
//                     )}
//                   </div>
//                 )}
//                 {/* SERVICEABILITY MESSAGE — END */}

//                 <div className="border-t border-slate-100 pt-6 space-y-3">
//                   <h3 className="font-semibold text-slate-800">Add new address</h3>
//                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                     <input
//                       className={inputCls}
//                       placeholder="Label (e.g. Home)"
//                       aria-label="Label"
//                       value={draft.newAddress?.label ?? ''}
//                       onChange={(e) =>
//                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, label: e.target.value } }))
//                       }
//                     />
//                     <input
//                       className={inputCls}
//                       placeholder="Flat / house no."
//                       aria-label="Flat or house number"
//                       required
//                       value={draft.newAddress?.house_flat ?? ''}
//                       onChange={(e) =>
//                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, house_flat: e.target.value } }))
//                       }
//                     />
//                     <input
//                       className={`sm:col-span-2 ${inputCls}`}
//                       placeholder="Area / locality"
//                       aria-label="Area or locality"
//                       required
//                       value={draft.newAddress?.area ?? ''}
//                       onChange={(e) =>
//                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, area: e.target.value } }))
//                       }
//                     />
//                     <select
//                       className={inputCls}
//                       aria-label="City"
//                       value={draft.newAddress?.city ?? LIVE_CITIES[0] ?? ''}
//                       onChange={(e) =>
//                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, city: e.target.value } }))
//                       }
//                     >
//                       {LIVE_CITIES.map((c) => (
//                         <option key={c} value={c}>
//                           {c}
//                         </option>
//                       ))}
//                     </select>
//                     <div>
//                       <input
//                         className={`w-full ${inputCls}`}
//                         placeholder="Pincode"
//                         aria-label="Pincode"
//                         inputMode="numeric"
//                         pattern="[0-9]{6}"
//                         required
//                         value={draft.newAddress?.pincode ?? ''}
//                         onChange={(e) =>
//                           setDraft((d) => ({
//                             ...d,
//                             newAddress: { ...d.newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) },
//                           }))
//                         }
//                       />
//                       {newPinHint ? <p className="mt-1 text-xs text-amber-700">{newPinHint}</p> : null}
//                     </div>
//                     <input
//                       className={`sm:col-span-2 ${inputCls}`}
//                       placeholder="Landmark (optional)"
//                       aria-label="Landmark"
//                       value={draft.newAddress?.landmark ?? ''}
//                       onChange={(e) =>
//                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, landmark: e.target.value } }))
//                       }
//                     />
//                   </div>

//                   {detectedLocation && (
//                     <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
//                       <div className="flex items-start gap-3">
//                         <div
//                           className="text-xl"
//                           aria-hidden="true"
//                         >
//                           📍
//                         </div>

//                         <div className="min-w-0">
//                           <p className="font-semibold text-emerald-900">
//                             Location detected
//                           </p>

//                           <p className="mt-1 text-sm text-emerald-800">
//                             {[
//                               detectedLocation.area,
//                               detectedLocation.city,
//                             ]
//                               .filter(Boolean)
//                               .join(', ') || 'Location detected'}
//                             {detectedLocation.pincode
//                               ? ` · ${detectedLocation.pincode}`
//                               : ''}
//                           </p>

//                           {detectedLocation.formattedAddress ? (
//                             <p className="mt-1 text-xs text-emerald-700">
//                               {detectedLocation.formattedAddress}
//                             </p>
//                           ) : null}

//                           <p className="mt-2 text-xs text-emerald-700">
//                             GPS location is approximate. Please review
//                             and confirm your delivery address before saving.
//                           </p>
//                         </div>
//                       </div>
//                     </div>
//                   )}

//                   {locationError ? (
//                     <div
//                       className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
//                       role="alert"
//                     >
//                       {locationError}
//                     </div>
//                   ) : null}

//                   <button
//                     type="button"
//                     onClick={useMyLocation}
//                     disabled={locating}
//                     className="mr-2 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
//                   >
//                     {locating
//                       ? '⏳ Finding your location…'
//                       : typeof draft.newAddress?.lat === 'number'
//                         ? '📍 Location detected ✓'
//                         : '📍 Use my current location'}
//                   </button>

//                   <button
//                     type="button"
//                     onClick={() => void saveInlineAddress()}
//                     disabled={savingAddress}
//                     className="rounded-xl border border-emerald-600 px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
//                   >
//                     {savingAddress ? 'Saving…' : 'Save address'}
//                   </button>
//                 </div>
//               </>
//             )}

//             <div className="flex justify-between gap-3">
//               <button type="button" onClick={prevStep} className={btnGhost}>
//                 Back
//               </button>
//               <button
//                 type="button"
//                 onClick={nextStep}
//                 disabled={
//                   !session?.loggedIn ||
//                   !draft.addressId ||
//                   checkingServiceability ||
//                    !serviceability?.serviceable
// }
//                 className={btnPrimary}
//               >
//                 Continue
//               </button>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 4 */}
//         {view === 4 && (
//           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
//             <h2 className="text-lg font-bold text-slate-900">4 · Schedule</h2>
//             <p className="text-sm text-slate-600">Pick one of the next 14 days, then fine-tune the slot.</p>
//             <div className="flex gap-2 overflow-x-auto pb-1">
//               {datePills.map((iso) => (
//                 <button
//                   key={iso}
//                   type="button"
//                   aria-pressed={draft.scheduledDate === iso}
//                   onClick={() => {
//                     const n = nextFutureSlot(iso);
//                     setDraft((d) => ({
//                       ...d,
//                       scheduledDate: n.date,
//                       startTime: n.startTime,
//                       endTime: n.endTime,
//                       slotValid: false,
//                     }));
//                   }}
//                   className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap ${
//                     draft.scheduledDate === iso ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                   }`}
//                 >
//                   {shortDateLabel(iso)}
//                 </button>
//               ))}
//             </div>
//             <TimeSlotPicker
//               key={`${draft.scheduledDate}-${view}`}
//               minDate={minDate}
//               showEmergency
//               emergencyFee={settings.emergency_surcharge}
//               value={{
//                 date: draft.scheduledDate || minDate,
//                 startTime: draft.startTime,
//                 endTime: draft.endTime,
//               }}
//               onChange={onSlotChange}
//             />
//             <p className="text-sm text-slate-600">
//               Estimated total so far: <span className="font-bold text-emerald-700">{inr(breakdown.total)}</span>
//             </p>
//             <div className="flex justify-between gap-3">
//               <button type="button" onClick={prevStep} className={btnGhost}>
//                 Back
//               </button>
//               <button type="button" onClick={nextStep} className={btnPrimary}>
//                 Continue
//               </button>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 5 */}
//         {view === 5 && (
//           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
//             <h2 className="text-lg font-bold text-slate-900">5 · Review & payment</h2>
//             <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm">
//               <div className="flex justify-between gap-4">
//                 <span className="text-slate-600">Service</span>
//                 <span className="font-semibold text-right">
//                   {serviceLabel(draft.serviceKey)}
//                   {draft.serviceKey === 'water_can' ? ` × ${draft.canQuantity ?? 1}` : ''}
//                 </span>
//               </div>
//               <div className="flex justify-between gap-4">
//                 <span className="text-slate-600">Address</span>
//                 <span className="font-semibold text-right">
//                   {selectedAddress ? formatAddressCard(selectedAddress) : '—'}
//                 </span>
//               </div>
//               <div className="flex justify-between gap-4">
//                 <span className="text-slate-600">Scheduled</span>
//                 <span className="font-semibold text-right">
//                   {draft.scheduledDate} · {draft.timeSlot || '—'}
//                 </span>
//               </div>
//               <hr className="border-slate-200" />
//               <div className="flex justify-between">
//                 <span>Base price</span>
//                 <span>{inr(breakdown.base)}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span>Convenience</span>
//                 <span>{inr(breakdown.convenience)}</span>
//               </div>
//               {breakdown.gst > 0 ? (
//                 <div className="flex justify-between">
//                   <span>GST</span>
//                   <span>{inr(breakdown.gst)}</span>
//                 </div>
//               ) : null}
//               {draft.isEmergency ? (
//                 <div className="flex justify-between text-amber-800">
//                   <span>Emergency</span>
//                   <span>{inr(breakdown.emergency)}</span>
//                 </div>
//               ) : null}
//               <hr className="border-slate-200" />
//               <div className="flex justify-between text-lg font-extrabold text-emerald-800">
//                 <span>TOTAL</span>
//                 <span>{inr(breakdown.total)}</span>
//               </div>
//             </div>

//             <div className="space-y-2">
//               <p className="text-sm font-semibold text-slate-800">Payment method</p>
//               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//                 {(
//                   [
//                     ['cash', 'Cash on delivery'],
//                     ['upi', 'UPI'],
//                     ['online', 'Card / netbanking'],
//                   ] as const
//                 ).map(([key, label]) => (
//                   <button
//                     key={key}
//                     type="button"
//                     aria-pressed={draft.paymentMethod === key}
//                     onClick={() => setDraft((d) => ({ ...d, paymentMethod: key }))}
//                     className={`rounded-xl border px-3 py-3 text-sm font-semibold text-left ${
//                       draft.paymentMethod === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
//                     }`}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>
//               {draft.paymentMethod !== 'cash' && (
//                 <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
//                   Online payment is coming soon — this choice is recorded for fulfilment only. You pay on delivery for now.
//                 </div>
//               )}
//             </div>

//             {submitError && (
//               <div role="alert" className="rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-sm px-4 py-3">
//                 {submitError}
//               </div>
//             )}

//             <div className="flex justify-between gap-3 flex-wrap">
//               <button type="button" onClick={prevStep} disabled={submitting} className={btnGhost}>
//                 Back
//               </button>
//               <button
//                 type="button"
//                 disabled={submitting || !draft.addressId}
//                 onClick={() => void confirmOrder()}
//                 className={btnPrimary}
//               >
//                 {submitting ? 'Placing your order…' : 'Confirm booking →'}
//               </button>
//             </div>
//           </motion.div>
//         )}

//         {view === 5 ? (
//           <div className="fixed left-0 right-0 bottom-3 z-40 px-4 pointer-events-none">
//             <div className="mx-auto max-w-3xl">
//               <div
//                 className="rounded-xl"
//                 style={{
//                   background: '#EFF6FF',
//                   border: '1px solid #BFDBFE',
//                   color: '#1D4ED8',
//                   borderRadius: 12,
//                   padding: '12px 16px',
//                   fontSize: 13,
//                   fontWeight: 700,
//                 }}
//               >
//                 🛡 AuroWater Guarantee: Delivered in 45 mins or next order FREE. 100% refund if we cancel.
//               </div>
//             </div>
//           </div>
//         ) : null}

//         {/* Step 6 — only when an order really exists */}
//         {view === 6 && createdOrder && (
//           <motion.div
//             {...cardMotion}
//             className="rounded-3xl bg-white border border-slate-100 shadow-sm p-8 text-center space-y-6"
//             role="status"
//             aria-live="polite"
//           >
//             <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl" aria-hidden>
//               ✓
//             </div>
//             <p className="text-sm font-semibold text-emerald-700 uppercase">You&apos;re booked</p>
//             <div
//               className="text-4xl sm:text-5xl font-extrabold text-[#0F172A]"
//               style={{ fontFamily: 'var(--font-syne), Syne, system-ui, sans-serif' }}
//             >
//               #{orderNo}
//             </div>
//             <div className="space-y-1 text-slate-600">
//               <p>
//                 {serviceLabel(draft.serviceKey)}
//                 {draft.serviceKey === 'water_can' ? ` × ${draft.canQuantity ?? 1}` : ''} ·{' '}
//                 <span className="font-semibold text-slate-900">{inr(breakdown.total)}</span> ·{' '}
//                 {draft.paymentMethod === 'cash' ? 'Pay on delivery' : draft.paymentMethod.toUpperCase()}
//               </p>
//               <p>
//                 Arrival window: <span className="font-semibold text-slate-900">{etaText}</span>
//               </p>
//               <p className="text-sm">
//                 {supplierSearching
//                   ? 'We are finding the best supplier near you. Tracking updates automatically.'
//                   : 'A supplier has been assigned. Tracking updates automatically.'}
//               </p>
//             </div>

//             <div className="flex flex-col sm:flex-row gap-3 justify-center">
//               <Link href={ROUTES.track(createdOrder.id)} className={`${btnPrimary} text-center`}>
//                 Track order
//               </Link>
//               <a
//                 href={waTrackHref}
//                 target="_blank"
//                 rel="noreferrer"
//                 className="rounded-xl border border-emerald-600 text-emerald-700 px-6 py-3 font-semibold text-center hover:bg-emerald-50"
//               >
//                 Track on WhatsApp
//               </a>
//             </div>

//             <div className="flex flex-col sm:flex-row gap-3 justify-center border-t border-slate-100 pt-5">
//               <button type="button" onClick={resetWizard} className={btnGhost}>
//                 Book another service
//               </button>
//               <Link href={ROUTES.home} className={`${btnGhost} text-center`}>
//                 Go to home
//               </Link>
//               <Link href={ROUTES.orders} className={`${btnGhost} text-center`}>
//                 My orders
//               </Link>
//             </div>
//           </motion.div>
//         )}
//       </div>
//     </div>
//   );
// }
















// // 'use client';

// // import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// // import Link from 'next/link';
// // import { useRouter, useSearchParams } from 'next/navigation';
// // import { toast } from 'sonner';
// // import { motion } from 'framer-motion';

// // import BookingProgress from '@/components/booking/BookingProgress';
// // import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
// // import type { TimeSlotPickerValue } from '@/components/booking/TimeSlotPicker';
// // import {
// //   ApiError,
// //   customerAddressCreate,
// //   customerAddresses,
// //   customerOrderCreate,
// //   type ApiOrder,
// // } from '@/lib/api-client';
// // import { getMinDate, nextFutureSlot } from '@/lib/validation/time-slot-client';
// // import { useAuth } from '@/hooks/useAuth';
// // import { useSettings, inr, type PlatformSettings, type ServiceKey } from '@/hooks/useSettings';
// // import { safeSessionGet, safeSessionRemove, safeSessionSet } from '@/lib/storage';
// // import { ACTIVE_CITY_NAMES } from '@/lib/cities';
// // import WaitlistPanel from '@/components/ui/WaitlistPanel';

// // /* ───────────── Edit if your routes differ ───────────── */
// // const ROUTES = {
// //   home: '/customer/home',
// //   orders: '/customer/history',
// //   track: (id: string) => `/customer/track/${id}`,
// // } as const;

// // /** Session draft — persisted so login redirect does not lose progress. */
// // export interface BookingDraft {
// //   serviceKey: string;
// //   subOptionKey: string;
// //   canQuantity?: number;
// //   canOrderType?: 'one_time' | 'subscription';
// //   canFrequency?: string;
// //   addressId?: string;
// //   newAddress?: {
// //     label?: string;
// //     house_flat?: string;
// //     area?: string;
// //     city?: string;
// //     pincode?: string;
// //     landmark?: string;
// //     is_default?: boolean;
// //   };
// //   scheduledDate: string;
// //   timeSlot: string;
// //   startTime: string;
// //   endTime: string;
// //   /** ISO string from validation helper — sent as `scheduled_time` to API */
// //   scheduled_time: string;
// //   isEmergency: boolean;
// //   paymentMethod: 'cash' | 'online' | 'upi';
// //   notes?: string;
// //   slotValid?: boolean;
// // }

// // const DRAFT_KEY = 'aw_booking_draft_v1';
// // const MAX_FORM_STEP = 5;

// // const SERVICE_LIST: { key: string; emoji: string; title: string }[] = [
// //   { key: 'water_can', emoji: '💧', title: 'Water cans' },
// //   { key: 'water_tanker', emoji: '🚚', title: 'Water tanker' },
// //   { key: 'ro_service', emoji: '🔧', title: 'RO service' },
// //   { key: 'plumbing', emoji: '🛠️', title: 'Plumbing' },
// //   { key: 'borewell', emoji: '⛏️', title: 'Borewell' },
// //   { key: 'motor_pump', emoji: '⚙️', title: 'Motor & pump' },
// //   { key: 'tank_cleaning', emoji: '✨', title: 'Tank cleaning' },
// // ];

// // const LIVE_CITIES = ACTIVE_CITY_NAMES;

// // /** Soft check only (never blocks): helps catch city / pincode mix-ups. */
// // const CITY_PIN_PREFIX: Record<string, string[]> = {
// //   Kanpur: ['208', '209'],
// //   Gorakhpur: ['273'],
// //   Lucknow: ['226', '227'],
// // };

// // function pinHint(city: string | undefined, pin: string | undefined): string {
// //   if (!city || !pin || pin.length < 3) return '';
// //   const known = CITY_PIN_PREFIX[city];
// //   if (!known) return '';
// //   if (known.some((p) => pin.startsWith(p))) return '';
// //   const other = Object.entries(CITY_PIN_PREFIX).find(([, ps]) => ps.some((p) => pin.startsWith(p)))?.[0];
// //   return other
// //     ? `This pincode looks like ${other}, not ${city}. Please double-check.`
// //     : `This pincode does not look like ${city}. Please double-check.`;
// // }

// // type AddressRow = {
// //   id: string;
// //   label: string | null;
// //   house_flat?: string | null;
// //   area?: string | null;
// //   line1?: string | null;
// //   line2?: string | null;
// //   city: string;
// //   pincode: string | null;
// //   landmark?: string | null;
// //   is_default?: boolean | null;
// // };

// // function emptyDraft(): BookingDraft {
// //   const slot = nextFutureSlot();
// //   return {
// //     serviceKey: 'water_can',
// //     subOptionKey: 'standard',
// //     canQuantity: 1,
// //     canOrderType: 'one_time',
// //     canFrequency: 'weekly',
// //     scheduledDate: slot.date,
// //     timeSlot: '',
// //     startTime: slot.startTime,
// //     endTime: slot.endTime,
// //     scheduled_time: '',
// //     isEmergency: false,
// //     paymentMethod: 'cash',
// //     notes: '',
// //     slotValid: false,
// //     newAddress: {
// //       label: 'Home',
// //       house_flat: '',
// //       area: '',
// //       city: LIVE_CITIES[0] ?? 'Gorakhpur',
// //       pincode: '',
// //       landmark: '',
// //       is_default: true,
// //     },
// //   };
// // }

// // function subOptionDelta(serviceKey: string, subOptionKey: string): number {
// //   if (serviceKey === 'ro_service') {
// //     const m: Record<string, number> = { service: 0, filter_change: 49, amc: 149, new_installation: 599 };
// //     return m[subOptionKey] ?? 0;
// //   }
// //   if (serviceKey === 'plumbing') {
// //     const m: Record<string, number> = { pipe_leak: 0, tap: 0, drainage: 49, new_fitting: 99, other: 0 };
// //     return m[subOptionKey] ?? 0;
// //   }
// //   if (serviceKey === 'water_tanker') {
// //     const m: Record<string, number> = { '500': 0, '1000': 50, '2000': 120, custom: 80 };
// //     return m[subOptionKey] ?? 0;
// //   }
// //   return 0;
// // }

// // function computeBaseAmount(draft: BookingDraft, settings: PlatformSettings): number {
// //   if (draft.serviceKey === 'water_can') {
// //     const qty = Math.min(200, Math.max(1, draft.canQuantity ?? 1));
// //     const per =
// //       draft.canOrderType === 'subscription' ? settings.subscription_can_price : settings.default_can_price;
// //     return Math.round(qty * per);
// //   }
// //   const baseKey = draft.serviceKey as ServiceKey;
// //   const base = settings.service_base_prices[baseKey] ?? 0;
// //   return Math.round(base + subOptionDelta(draft.serviceKey, draft.subOptionKey));
// // }

// // function serviceLabel(key: string): string {
// //   return SERVICE_LIST.find((s) => s.key === key)?.title ?? key;
// // }

// // function formatAddressCard(a: AddressRow): string {
// //   const parts = [a.house_flat ?? a.line1, a.area ?? a.line2, a.city, a.pincode].filter(
// //     (x) => typeof x === 'string' && x.trim()
// //   );
// //   return parts.join(', ');
// // }

// // function nextFourteenIsoDates(min: string): string[] {
// //   const out: string[] = [];
// //   const start = new Date(min + 'T12:00:00');
// //   for (let i = 0; i < 14; i++) {
// //     const d = new Date(start);
// //     d.setDate(d.getDate() + i);
// //     out.push(d.toISOString().slice(0, 10));
// //   }
// //   return out;
// // }

// // function shortDateLabel(iso: string): string {
// //   const d = new Date(iso + 'T12:00:00');
// //   return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
// // }

// // function to12h(t: string): string {
// //   const m = /^(\d{1,2}):(\d{2})/.exec(t);
// //   if (!m) return t;
// //   let h = parseInt(m[1], 10);
// //   const ap = h >= 12 ? 'PM' : 'AM';
// //   h = h % 12 || 12;
// //   return `${h}:${m[2]} ${ap}`;
// // }

// // const inputCls =
// //   'rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400';
// // const btnPrimary =
// //   'rounded-xl bg-emerald-600 text-white px-6 py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition';
// // const btnGhost =
// //   'rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 transition';

// // export default function BookingWizard() {
// //   const router = useRouter();
// //   const searchParams = useSearchParams();
// //   const { settings, calcOrderTotal, whatsappHref } = useSettings();
// //   const { session } = useAuth();

// //   const [step, setStep] = useState(1);
// //   const [furthest, setFurthest] = useState(1);
// //   const [hydrated, setHydrated] = useState(false);
// //   const [draft, setDraft] = useState<BookingDraft>(emptyDraft);
// //   const [addresses, setAddresses] = useState<AddressRow[]>([]);
// //   const [addressesLoaded, setAddressesLoaded] = useState(false);
// //   const [loadingAddresses, setLoadingAddresses] = useState(false);
// //   const [savingAddress, setSavingAddress] = useState(false);
// //   const [submitting, setSubmitting] = useState(false);
// //   const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
// //   const [submitError, setSubmitError] = useState<string | null>(null);
// //   const [waitlistCity, setWaitlistCity] = useState('');

// //   const submitLock = useRef(false);
// //   const firstScroll = useRef(true);

// //   /** The step actually shown. Step 6 exists ONLY when an order was really created. */
// //   const view = createdOrder ? 6 : Math.min(step, MAX_FORM_STEP);

// //   const minDate = getMinDate();
// //   const datePills = useMemo(() => nextFourteenIsoDates(minDate), [minDate]);

// //   const cardMotion = {
// //     initial: { opacity: 0, y: 10 },
// //     animate: { opacity: 1, y: 0 },
// //     transition: { duration: 0.25, ease: 'easeOut' as const },
// //   };

// //   const goTo = useCallback((n: number) => {
// //     const clamped = Math.min(MAX_FORM_STEP, Math.max(1, n));
// //     setStep(clamped);
// //     setFurthest((f) => Math.max(f, clamped));
// //   }, []);

// //   /* ───────── One-time hydration: draft + URL params (never restores step 6) ───────── */
// //   useEffect(() => {
// //     let restored: Partial<BookingDraft> | null = null;
// //     let restoredStep = 1;
// //     try {
// //       const raw = safeSessionGet(DRAFT_KEY);
// //       if (raw) {
// //         const parsed = JSON.parse(raw) as { draft?: Partial<BookingDraft>; step?: number };
// //         const s = Number(parsed?.step);
// //         if (parsed?.draft && typeof parsed.draft === 'object' && s >= 1 && s <= MAX_FORM_STEP) {
// //           restored = parsed.draft;
// //           restoredStep = Math.floor(s);
// //         } else {
// //           // Old drafts saved at "step 6" belong to finished orders: discard.
// //           safeSessionRemove(DRAFT_KEY);
// //         }
// //       }
// //     } catch {
// //       try {
// //         safeSessionRemove(DRAFT_KEY);
// //       } catch {
// //         /* ignore */
// //       }
// //     }

// //     const fresh = emptyDraft();
// //     const base: BookingDraft = {
// //       ...fresh,
// //       ...(restored ?? {}),
// //       newAddress: { ...(fresh.newAddress ?? {}), ...(restored?.newAddress ?? {}) },
// //       canFrequency: restored?.canFrequency ?? fresh.canFrequency,
// //     };

// //     // Stale schedule guard (draft saved on an earlier day)
// //     const min = getMinDate();
// //     if (!base.scheduledDate || base.scheduledDate < min) {
// //       base.scheduledDate = fresh.scheduledDate;
// //       base.startTime = fresh.startTime;
// //       base.endTime = fresh.endTime;
// //       base.timeSlot = '';
// //       base.scheduled_time = '';
// //       base.slotValid = false;
// //     }

// //     // URL params (pricing page CTAs etc.)
// //     const serviceParam = searchParams?.get('service') ?? '';
// //     const serviceOk = SERVICE_LIST.some((s) => s.key === serviceParam);
// //     if (serviceOk) {
// //       base.serviceKey = serviceParam;
// //       const planCanCounts: Record<string, number> = { starter: 30, pro: 60, office: 120 };
// //       const plan = searchParams?.get('plan') ?? '';
// //       const qty = plan ? planCanCounts[plan] : undefined;
// //       const billing = searchParams?.get('billing');
// //       if (serviceParam === 'water_can' && qty) {
// //         base.canQuantity = qty;
// //         base.canOrderType = 'subscription';
// //         base.canFrequency = billing === 'yearly' ? 'monthly' : base.canFrequency ?? 'weekly';
// //       }
// //     }

// //     // Reorder links: /book?service=water_can&cans=5
// //     const cansParam = parseInt(searchParams?.get('cans') ?? '', 10);
// //     if (serviceOk && base.serviceKey === 'water_can' && Number.isFinite(cansParam) && cansParam >= 1 && cansParam <= 200) {
// //       base.canQuantity = cansParam;
// //     }

// //     // Starting step
// //     let start = restored ? restoredStep : 1;
// //     const hm = typeof window !== 'undefined' ? window.location.hash.match(/step-(\d+)/) : null;
// //     if (hm) {
// //       const h = parseInt(hm[1], 10);
// //       if (h >= 1 && h <= MAX_FORM_STEP) start = Math.min(h, restored ? restoredStep : 1);
// //     } else if (serviceOk && start === 1) {
// //       start = 2; // service already chosen -> go straight to options
// //     }

// //     setDraft(base);
// //     setStep(start);
// //     setFurthest(start);
// //     setHydrated(true);
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, []);

// //   /* Persist draft (never after an order exists, never step 6) */
// //   useEffect(() => {
// //     if (!hydrated || createdOrder) return;
// //     try {
// //       safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: Math.min(step, MAX_FORM_STEP) }));
// //     } catch {
// //       /* quota */
// //     }
// //   }, [draft, step, hydrated, createdOrder]);

// //   /* Keep URL hash in sync (no history spam) */
// //   useEffect(() => {
// //     if (!hydrated || typeof window === 'undefined') return;
// //     const path = `${window.location.pathname}${window.location.search}`;
// //     window.history.replaceState(null, '', `${path}#${createdOrder ? 'confirmed' : `step-${view}`}`);
// //   }, [view, hydrated, createdOrder]);

// //   /* Browser back/forward via hash: only to steps already reached */
// //   useEffect(() => {
// //     if (typeof window === 'undefined') return;
// //     const onHash = () => {
// //       if (createdOrder) return;
// //       const m = window.location.hash.match(/step-(\d+)/);
// //       if (!m) return;
// //       const n = parseInt(m[1], 10);
// //       if (n >= 1 && n <= furthest && n <= MAX_FORM_STEP) setStep(n);
// //     };
// //     window.addEventListener('hashchange', onHash);
// //     return () => window.removeEventListener('hashchange', onHash);
// //   }, [furthest, createdOrder]);

// //   /* Scroll to top on step change */
// //   useEffect(() => {
// //     if (!hydrated) return;
// //     if (firstScroll.current) {
// //       firstScroll.current = false;
// //       return;
// //     }
// //     window.scrollTo({ top: 0, behavior: 'smooth' });
// //   }, [view, hydrated]);

// //   /* Sub-option defaults per service */
// //   useEffect(() => {
// //     setDraft((d) => {
// //       switch (d.serviceKey) {
// //         case 'water_can':
// //           return { ...d, subOptionKey: d.subOptionKey || 'standard' };
// //         case 'ro_service':
// //           return ['service', 'filter_change', 'amc', 'new_installation'].includes(d.subOptionKey)
// //             ? d
// //             : { ...d, subOptionKey: 'service' };
// //         case 'plumbing':
// //           return ['pipe_leak', 'tap', 'drainage', 'new_fitting', 'other'].includes(d.subOptionKey)
// //             ? d
// //             : { ...d, subOptionKey: 'pipe_leak' };
// //         case 'water_tanker':
// //           return ['500', '1000', '2000', 'custom'].includes(d.subOptionKey)
// //             ? d
// //             : { ...d, subOptionKey: '500' };
// //         default:
// //           return d.subOptionKey ? d : { ...d, subOptionKey: 'standard' };
// //       }
// //     });
// //   }, [draft.serviceKey]);

// //   const loadAddresses = useCallback(async () => {
// //     if (!session?.loggedIn) return;
// //     setLoadingAddresses(true);
// //     try {
// //       const list = (await customerAddresses()) as AddressRow[];
// //       setAddresses(Array.isArray(list) ? list : []);
// //       setAddressesLoaded(true);
// //     } catch {
// //       toast.error('Could not load addresses.');
// //     } finally {
// //       setLoadingAddresses(false);
// //     }
// //   }, [session?.loggedIn]);

// //   useEffect(() => {
// //     if (view >= 3 && session?.loggedIn) void loadAddresses();
// //   }, [view, session?.loggedIn, loadAddresses]);

// //   /* Auto-select a sensible address; drop a stale one */
// //   useEffect(() => {
// //     if (!addressesLoaded) return;
// //     setDraft((d) => {
// //       if (d.addressId && addresses.some((a) => a.id === d.addressId)) return d;
// //       if (!addresses.length) return d.addressId ? { ...d, addressId: undefined } : d;
// //       const pick = addresses.find((a) => a.is_default) ?? addresses[0];
// //       return { ...d, addressId: pick.id };
// //     });
// //   }, [addresses, addressesLoaded]);

// //   const baseAmount = useMemo(() => computeBaseAmount(draft, settings), [draft, settings]);
// //   const breakdown = useMemo(
// //     () => calcOrderTotal(baseAmount, draft.isEmergency),
// //     [calcOrderTotal, baseAmount, draft.isEmergency]
// //   );

// //   const fromPrice = useCallback(
// //     (key: string) => {
// //       if (key === 'water_can') return settings.default_can_price;
// //       const k = key as ServiceKey;
// //       return settings.service_base_prices[k] ?? 0;
// //     },
// //     [settings]
// //   );

// //   const goLoginForCheckout = () => {
// //     try {
// //       safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: 3 }));
// //     } catch {
// //       /* ignore */
// //     }
// //     router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-3')}`);
// //   };

// //   const onSlotChange = useCallback((v: TimeSlotPickerValue) => {
// //     setDraft((d) => ({
// //       ...d,
// //       scheduledDate: v.date,
// //       timeSlot: v.time_slot,
// //       startTime: v.startTime,
// //       endTime: v.endTime,
// //       scheduled_time: v.scheduled_time,
// //       slotValid: v.valid,
// //     }));
// //   }, []);

// //   const validateStep = (s: number): boolean => {
// //     if (s === 1) {
// //       if (!draft.serviceKey) {
// //         toast.error('Pick a service.');
// //         return false;
// //       }
// //       return true;
// //     }
// //     if (s === 2) {
// //       if (draft.serviceKey === 'water_can') {
// //         const q = draft.canQuantity ?? 1;
// //         if (q < 1 || q > 200) {
// //           toast.error('Quantity must be between 1 and 200.');
// //           return false;
// //         }
// //       }
// //       if (!draft.subOptionKey) {
// //         toast.error('Choose an option.');
// //         return false;
// //       }
// //       return true;
// //     }
// //     if (s === 3) {
// //       if (!session?.loggedIn) {
// //         toast.error('Sign in to continue.');
// //         return false;
// //       }
// //       if (!draft.addressId) {
// //         toast.error('Select or add a delivery address.');
// //         return false;
// //       }
// //       return true;
// //     }
// //     if (s === 4) {
// //       if (!draft.slotValid) {
// //         toast.error('Pick a valid date and time slot.');
// //         return false;
// //       }
// //       return true;
// //     }
// //     return true;
// //   };

// //   const nextStep = () => {
// //     if (!validateStep(view)) return;
// //     goTo(view + 1);
// //   };
// //   const prevStep = () => goTo(view - 1);

// //   const resetWizard = useCallback(() => {
// //     try {
// //       safeSessionRemove(DRAFT_KEY);
// //     } catch {
// //       /* ignore */
// //     }
// //     submitLock.current = false;
// //     setCreatedOrder(null);
// //     setSubmitError(null);
// //     setDraft(emptyDraft());
// //     setStep(1);
// //     setFurthest(1);
// //     if (typeof window !== 'undefined') {
// //       window.history.replaceState(null, '', `${window.location.pathname}#step-1`);
// //       window.scrollTo({ top: 0, behavior: 'smooth' });
// //     }
// //   }, []);

// //   const saveInlineAddress = async () => {
// //     if (savingAddress) return;
// //     const na = draft.newAddress ?? {};
// //     if (!na.house_flat?.trim() || !na.area?.trim() || !na.city?.trim() || !na.pincode?.trim()) {
// //       toast.error('Fill house, area, city, and 6-digit pincode.');
// //       return;
// //     }
// //     if (!/^[0-9]{6}$/.test(na.pincode.trim())) {
// //       toast.error('Pincode must be 6 digits.');
// //       return;
// //     }
// //     setSavingAddress(true);
// //     try {
// //       const created = (await customerAddressCreate({
// //         label: na.label ?? 'Home',
// //         house_flat: na.house_flat.trim(),
// //         area: na.area.trim(),
// //         city: na.city.trim(),
// //         pincode: na.pincode.trim(),
// //         landmark: na.landmark?.trim() ?? '',
// //         is_default: na.is_default ?? true,
// //       })) as AddressRow;
// //       await loadAddresses();
// //       setDraft((d) => ({
// //         ...d,
// //         addressId: created.id,
// //         newAddress: { ...emptyDraft().newAddress },
// //       }));
// //       toast.success('Address saved and selected.');
// //     } catch (e) {
// //       toast.error(e instanceof ApiError ? e.message : 'Could not save address.');
// //     } finally {
// //       setSavingAddress(false);
// //     }
// //   };

// //   const confirmOrder = async () => {
// //     // Hard lock: a fast double-click can never create two orders
// //     if (submitLock.current || createdOrder) return;
// //     if (!draft.addressId || !session?.loggedIn) {
// //       toast.error('Missing address or session.');
// //       return;
// //     }
// //     submitLock.current = true;
// //     setSubmitting(true);
// //     setSubmitError(null);
// //     try {
// //       const order = await customerOrderCreate({
// //         service_type_key: draft.serviceKey,
// //         address_id: draft.addressId,
// //         sub_option_key: draft.subOptionKey || 'standard',
// //         scheduled_date: draft.scheduledDate,
// //         time_slot: draft.timeSlot,
// //         scheduled_time: draft.scheduled_time,
// //         is_emergency: draft.isEmergency,
// //         base_amount: baseAmount,
// //         convenience_fee: breakdown.convenience,
// //         gst_amount: breakdown.gst,
// //         total_amount: breakdown.total,
// //         payment_method: draft.paymentMethod,
// //         notes: draft.notes?.trim() || undefined,
// //         can_quantity: draft.serviceKey === 'water_can' ? draft.canQuantity : undefined,
// //         can_order_type: draft.serviceKey === 'water_can' ? draft.canOrderType : undefined,
// //         can_frequency:
// //           draft.serviceKey === 'water_can' && draft.canOrderType === 'subscription'
// //             ? draft.canFrequency
// //             : undefined,
// //       });
// //       // Remove the draft BEFORE flipping to the done screen; persistence is also
// //       // guarded by `createdOrder`, so it can never be re-saved.
// //       try {
// //         safeSessionRemove(DRAFT_KEY);
// //       } catch {
// //         /* ignore */
// //       }
// //       setCreatedOrder(order);
// //       toast.success('Booking confirmed!');
// //       // lock stays ON: this wizard run is finished
// //     } catch (e) {
// //       submitLock.current = false;
// //       if (e instanceof ApiError && e.status === 401) {
// //         try {
// //           safeSessionSet(DRAFT_KEY, JSON.stringify({ draft, step: 5 }));
// //         } catch {
// //           /* ignore */
// //         }
// //         router.push(`/auth/login?returnTo=${encodeURIComponent('/book#step-5')}`);
// //         return;
// //       }
// //       const msg = e instanceof ApiError ? e.message : 'Booking failed. Please try again.';
// //       setSubmitError(msg);
// //       toast.error(msg);
// //     } finally {
// //       setSubmitting(false);
// //     }
// //   };

// //   const waLink =
// //     whatsappHref ??
// //     `https://wa.me/91${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '9889305803').replace(/\D/g, '')}`;

// //   const orderNo = createdOrder?.order_number ?? createdOrder?.id?.slice(0, 8) ?? '—';

// //   const waTrackHref = useMemo(() => {
// //     const msg = `Hi AuroWater — my order #${orderNo}. Please share live status.`;
// //     const base = waLink.split('?')[0];
// //     try {
// //       const u = new URL(base.includes('://') ? base : `https://${base}`);
// //       u.searchParams.set('text', msg);
// //       return u.toString();
// //     } catch {
// //       return `${base}?text=${encodeURIComponent(msg)}`;
// //     }
// //   }, [waLink, orderNo]);

// //   const selectedAddress = addresses.find((a) => a.id === draft.addressId);
// //   const newPinHint = pinHint(draft.newAddress?.city, draft.newAddress?.pincode);

// //   const orderStatus = String((createdOrder as unknown as Record<string, unknown> | null)?.status ?? '');
// //   const supplierSearching =
// //     (createdOrder as unknown as Record<string, unknown> | null)?.supplier_status === 'searching' ||
// //     orderStatus === 'PENDING';

// //   const etaText =
// //     draft.startTime && draft.endTime
// //       ? `${shortDateLabel(draft.scheduledDate)} · ${to12h(draft.startTime)} – ${to12h(draft.endTime)}`
// //       : draft.timeSlot || 'Within your selected window';

// //   return (
// //     <div className="min-h-screen bg-slate-50 pb-28">
// //       <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
// //         <div className="text-center mb-8">
// //           <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Book a service</p>
// //           <h1
// //             className="mt-2 text-3xl sm:text-4xl font-extrabold text-[#0F172A]"
// //             style={{ fontFamily: 'var(--font-syne), Syne, system-ui, sans-serif' }}
// //           >
// //             Schedule in minutes
// //           </h1>
// //           {view > 1 && view < 6 ? (
// //             <button
// //               type="button"
// //               onClick={resetWizard}
// //               className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2"
// //             >
// //               Start over
// //             </button>
// //           ) : null}
// //         </div>

// //         <BookingProgress
// //           step={view}
// //           maxStep={furthest}
// //           onStepClick={createdOrder ? undefined : (n) => goTo(n)}
// //         />

// //         {/* Step 1 */}
// //         {view === 1 && (
// //           <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
// //             <h2 className="text-lg font-bold text-slate-900">1 · Choose service</h2>
// //             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
// //               {SERVICE_LIST.map((s) => (
// //                 <button
// //                   key={s.key}
// //                   type="button"
// //                   aria-pressed={draft.serviceKey === s.key}
// //                   onClick={() => setDraft((d) => ({ ...d, serviceKey: s.key }))}
// //                   className={
// //                     'rounded-2xl border p-4 text-left transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
// //                     (draft.serviceKey === s.key
// //                       ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
// //                       : 'border-slate-200 bg-white')
// //                   }
// //                 >
// //                   <div className="text-2xl" aria-hidden>
// //                     {s.emoji}
// //                   </div>
// //                   <div className="mt-2 font-semibold text-slate-900 text-sm">{s.title}</div>
// //                   <div className="mt-1 text-xs text-emerald-700 font-semibold">
// //                     From ₹{Math.round(fromPrice(s.key)).toLocaleString('en-IN')}
// //                   </div>
// //                 </button>
// //               ))}
// //             </div>
// //             <label className="flex items-center gap-3 cursor-pointer">
// //               <input
// //                 type="checkbox"
// //                 checked={draft.isEmergency}
// //                 onChange={(e) => setDraft((d) => ({ ...d, isEmergency: e.target.checked }))}
// //                 className="h-5 w-5 rounded border-slate-300 text-emerald-600"
// //               />
// //               <span className="text-sm text-slate-700">
// //                 Emergency booking (+ {inr(settings.emergency_surcharge)} surcharge)
// //               </span>
// //             </label>
// //             <div className="flex justify-end">
// //               <button type="button" onClick={nextStep} className={btnPrimary}>
// //                 Continue →
// //               </button>
// //             </div>
// //           </div>
// //         )}

// //         {/* Step 2 */}
// //         {view === 2 && (
// //           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
// //             <h2 className="text-lg font-bold text-slate-900">2 · Options · {serviceLabel(draft.serviceKey)}</h2>

// //             {draft.serviceKey === 'water_can' && (
// //               <div className="space-y-4">
// //                 <div className="flex items-center justify-between gap-4">
// //                   <span className="text-sm font-medium text-slate-700">Quantity (cans)</span>
// //                   <div className="flex items-center gap-3">
// //                     <button
// //                       type="button"
// //                       aria-label="Decrease quantity"
// //                       className="h-10 w-10 rounded-xl border border-slate-200 font-bold hover:bg-slate-50"
// //                       onClick={() =>
// //                         setDraft((d) => ({ ...d, canQuantity: Math.max(1, (d.canQuantity ?? 1) - 1) }))
// //                       }
// //                     >
// //                       −
// //                     </button>
// //                     <span className="font-extrabold w-10 text-center" aria-live="polite">
// //                       {draft.canQuantity ?? 1}
// //                     </span>
// //                     <button
// //                       type="button"
// //                       aria-label="Increase quantity"
// //                       className="h-10 w-10 rounded-xl border border-slate-200 font-bold hover:bg-slate-50"
// //                       onClick={() =>
// //                         setDraft((d) => ({ ...d, canQuantity: Math.min(200, (d.canQuantity ?? 1) + 1) }))
// //                       }
// //                     >
// //                       +
// //                     </button>
// //                   </div>
// //                 </div>
// //                 <div className="grid grid-cols-2 gap-3">
// //                   <button
// //                     type="button"
// //                     aria-pressed={draft.canOrderType !== 'subscription'}
// //                     className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
// //                       draft.canOrderType !== 'subscription' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                     }`}
// //                     onClick={() => setDraft((d) => ({ ...d, canOrderType: 'one_time' }))}
// //                   >
// //                     One-time
// //                   </button>
// //                   <button
// //                     type="button"
// //                     aria-pressed={draft.canOrderType === 'subscription'}
// //                     className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
// //                       draft.canOrderType === 'subscription' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                     }`}
// //                     onClick={() => setDraft((d) => ({ ...d, canOrderType: 'subscription' }))}
// //                   >
// //                     Subscription
// //                   </button>
// //                 </div>
// //                 {draft.canOrderType === 'subscription' && (
// //                   <div>
// //                     <label htmlFor="can-frequency" className="text-sm font-medium text-slate-700">
// //                       Delivery frequency
// //                     </label>
// //                     <select
// //                       id="can-frequency"
// //                       className={`mt-1 w-full ${inputCls}`}
// //                       value={draft.canFrequency ?? 'weekly'}
// //                       onChange={(e) => setDraft((d) => ({ ...d, canFrequency: e.target.value }))}
// //                     >
// //                       <option value="weekly">Weekly</option>
// //                       <option value="biweekly">Every 2 weeks</option>
// //                       <option value="monthly">Monthly</option>
// //                     </select>
// //                   </div>
// //                 )}
// //               </div>
// //             )}

// //             {draft.serviceKey === 'ro_service' && (
// //               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //                 {[
// //                   ['service', 'Routine service'],
// //                   ['filter_change', 'Filter change'],
// //                   ['amc', 'AMC'],
// //                   ['new_installation', 'New installation'],
// //                 ].map(([key, label]) => (
// //                   <button
// //                     key={key}
// //                     type="button"
// //                     aria-pressed={draft.subOptionKey === key}
// //                     onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
// //                     className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
// //                       draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                     }`}
// //                   >
// //                     {label}
// //                   </button>
// //                 ))}
// //               </div>
// //             )}

// //             {draft.serviceKey === 'plumbing' && (
// //               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //                 {[
// //                   ['pipe_leak', 'Pipe leak'],
// //                   ['tap', 'Tap repair'],
// //                   ['drainage', 'Drainage'],
// //                   ['new_fitting', 'New fitting'],
// //                   ['other', 'Other'],
// //                 ].map(([key, label]) => (
// //                   <button
// //                     key={key}
// //                     type="button"
// //                     aria-pressed={draft.subOptionKey === key}
// //                     onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
// //                     className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
// //                       draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                     }`}
// //                   >
// //                     {label}
// //                   </button>
// //                 ))}
// //               </div>
// //             )}

// //             {draft.serviceKey === 'water_tanker' && (
// //               <div className="grid grid-cols-2 gap-3">
// //                 {[
// //                   ['500', '500L'],
// //                   ['1000', '1000L'],
// //                   ['2000', '2000L'],
// //                   ['custom', 'Custom'],
// //                 ].map(([key, label]) => (
// //                   <button
// //                     key={key}
// //                     type="button"
// //                     aria-pressed={draft.subOptionKey === key}
// //                     onClick={() => setDraft((d) => ({ ...d, subOptionKey: key }))}
// //                     className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
// //                       draft.subOptionKey === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                     }`}
// //                   >
// //                     {label}
// //                   </button>
// //                 ))}
// //               </div>
// //             )}

// //             {['borewell', 'motor_pump', 'tank_cleaning'].includes(draft.serviceKey) && (
// //               <div>
// //                 <label htmlFor="scope-notes" className="text-sm font-medium text-slate-700">
// //                   Describe the issue / scope
// //                 </label>
// //                 <textarea
// //                   id="scope-notes"
// //                   className={`mt-1 w-full min-h-[100px] ${inputCls}`}
// //                   value={draft.notes ?? ''}
// //                   maxLength={500}
// //                   onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
// //                   placeholder="Optional details help our crew prepare."
// //                 />
// //                 <p className="mt-2 text-xs text-slate-500">Photo upload is planned — notes only for now.</p>
// //               </div>
// //             )}

// //             <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm">
// //               <div className="flex justify-between">
// //                 <span>Estimated base</span>
// //                 <span className="font-bold">{inr(baseAmount)}</span>
// //               </div>
// //               <p className="text-xs text-slate-500 mt-1">GST & platform fees are added at checkout.</p>
// //             </div>

// //             <div className="flex justify-between gap-3">
// //               <button type="button" onClick={prevStep} className={btnGhost}>
// //                 Back
// //               </button>
// //               <button type="button" onClick={nextStep} className={btnPrimary}>
// //                 Continue
// //               </button>
// //             </div>
// //           </motion.div>
// //         )}

// //         {/* Step 3 */}
// //         {view === 3 && (
// //           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
// //             <h2 className="text-lg font-bold text-slate-900">3 · Address</h2>
// //             <p className="text-sm text-slate-600">
// //               We currently deliver in {LIVE_CITIES.join(', ')}. Pick a live city, or join the waitlist if yours is not
// //               listed.
// //             </p>
// //             <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
// //               <summary className="cursor-pointer text-sm font-semibold text-slate-800">
// //                 My city is not listed — join waitlist
// //               </summary>
// //               <div className="mt-3 space-y-3 rounded-2xl bg-[#0A1628] p-3">
// //                 <input
// //                   className="w-full rounded-xl border border-white/10 bg-[#0d1f35] px-3 py-2 text-sm text-white"
// //                   placeholder="Your city"
// //                   aria-label="Your city"
// //                   value={waitlistCity}
// //                   onChange={(e) => setWaitlistCity(e.target.value)}
// //                 />
// //                 <WaitlistPanel
// //                   cityName={waitlistCity.trim() || 'your city'}
// //                   cityId={null}
// //                   role="customer"
// //                   source="book"
// //                 />
// //               </div>
// //             </details>

// //             {!session?.loggedIn && (
// //               <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
// //                 <p className="font-semibold text-amber-900">Sign in to save your delivery address</p>
// //                 <p className="text-sm text-amber-800">
// //                   Your booking draft is saved on this device — after login you&apos;ll return here.
// //                 </p>
// //                 <button type="button" onClick={goLoginForCheckout} className={btnPrimary}>
// //                   Sign in to continue
// //                 </button>
// //               </div>
// //             )}

// //             {session?.loggedIn && (
// //               <>
// //                 {loadingAddresses && !addressesLoaded ? (
// //                   <div className="space-y-3" aria-busy="true">
// //                     <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
// //                     <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
// //                   </div>
// //                 ) : addresses.length === 0 ? (
// //                   <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
// //                     No saved addresses yet. Add your first one below.
// //                   </p>
// //                 ) : (
// //                   <div className="space-y-3" role="radiogroup" aria-label="Saved addresses">
// //                     {addresses.map((a) => (
// //                       <label
// //                         key={a.id}
// //                         className={`flex gap-3 rounded-2xl border p-4 cursor-pointer ${
// //                           draft.addressId === a.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                         }`}
// //                       >
// //                         <input
// //                           type="radio"
// //                           name="addr"
// //                           checked={draft.addressId === a.id}
// //                           onChange={() => setDraft((d) => ({ ...d, addressId: a.id }))}
// //                           className="mt-1"
// //                         />
// //                         <div>
// //                           <div className="font-semibold text-slate-900">
// //                             {a.label ?? 'Address'}
// //                             {a.is_default ? (
// //                               <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
// //                                 DEFAULT
// //                               </span>
// //                             ) : null}
// //                           </div>
// //                           <div className="text-sm text-slate-600">{formatAddressCard(a)}</div>
// //                         </div>
// //                       </label>
// //                     ))}
// //                   </div>
// //                 )}

// //                 <div className="border-t border-slate-100 pt-6 space-y-3">
// //                   <h3 className="font-semibold text-slate-800">Add new address</h3>
// //                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //                     <input
// //                       className={inputCls}
// //                       placeholder="Label (e.g. Home)"
// //                       aria-label="Label"
// //                       value={draft.newAddress?.label ?? ''}
// //                       onChange={(e) =>
// //                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, label: e.target.value } }))
// //                       }
// //                     />
// //                     <input
// //                       className={inputCls}
// //                       placeholder="Flat / house no."
// //                       aria-label="Flat or house number"
// //                       required
// //                       value={draft.newAddress?.house_flat ?? ''}
// //                       onChange={(e) =>
// //                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, house_flat: e.target.value } }))
// //                       }
// //                     />
// //                     <input
// //                       className={`sm:col-span-2 ${inputCls}`}
// //                       placeholder="Area / locality"
// //                       aria-label="Area or locality"
// //                       required
// //                       value={draft.newAddress?.area ?? ''}
// //                       onChange={(e) =>
// //                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, area: e.target.value } }))
// //                       }
// //                     />
// //                     <select
// //                       className={inputCls}
// //                       aria-label="City"
// //                       value={draft.newAddress?.city ?? LIVE_CITIES[0] ?? ''}
// //                       onChange={(e) =>
// //                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, city: e.target.value } }))
// //                       }
// //                     >
// //                       {LIVE_CITIES.map((c) => (
// //                         <option key={c} value={c}>
// //                           {c}
// //                         </option>
// //                       ))}
// //                     </select>
// //                     <div>
// //                       <input
// //                         className={`w-full ${inputCls}`}
// //                         placeholder="Pincode"
// //                         aria-label="Pincode"
// //                         inputMode="numeric"
// //                         pattern="[0-9]{6}"
// //                         required
// //                         value={draft.newAddress?.pincode ?? ''}
// //                         onChange={(e) =>
// //                           setDraft((d) => ({
// //                             ...d,
// //                             newAddress: { ...d.newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) },
// //                           }))
// //                         }
// //                       />
// //                       {newPinHint ? <p className="mt-1 text-xs text-amber-700">{newPinHint}</p> : null}
// //                     </div>
// //                     <input
// //                       className={`sm:col-span-2 ${inputCls}`}
// //                       placeholder="Landmark (optional)"
// //                       aria-label="Landmark"
// //                       value={draft.newAddress?.landmark ?? ''}
// //                       onChange={(e) =>
// //                         setDraft((d) => ({ ...d, newAddress: { ...d.newAddress, landmark: e.target.value } }))
// //                       }
// //                     />
// //                   </div>
// //                   <button
// //                     type="button"
// //                     onClick={() => void saveInlineAddress()}
// //                     disabled={savingAddress}
// //                     className="rounded-xl border border-emerald-600 text-emerald-700 px-4 py-2 font-semibold hover:bg-emerald-50 disabled:opacity-50"
// //                   >
// //                     {savingAddress ? 'Saving…' : 'Save address'}
// //                   </button>
// //                 </div>
// //               </>
// //             )}

// //             <div className="flex justify-between gap-3">
// //               <button type="button" onClick={prevStep} className={btnGhost}>
// //                 Back
// //               </button>
// //               <button
// //                 type="button"
// //                 onClick={nextStep}
// //                 disabled={!session?.loggedIn || !draft.addressId}
// //                 className={btnPrimary}
// //               >
// //                 Continue
// //               </button>
// //             </div>
// //           </motion.div>
// //         )}

// //         {/* Step 4 */}
// //         {view === 4 && (
// //           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
// //             <h2 className="text-lg font-bold text-slate-900">4 · Schedule</h2>
// //             <p className="text-sm text-slate-600">Pick one of the next 14 days, then fine-tune the slot.</p>
// //             <div className="flex gap-2 overflow-x-auto pb-1">
// //               {datePills.map((iso) => (
// //                 <button
// //                   key={iso}
// //                   type="button"
// //                   aria-pressed={draft.scheduledDate === iso}
// //                   onClick={() => {
// //                     const n = nextFutureSlot(iso);
// //                     setDraft((d) => ({
// //                       ...d,
// //                       scheduledDate: n.date,
// //                       startTime: n.startTime,
// //                       endTime: n.endTime,
// //                       slotValid: false,
// //                     }));
// //                   }}
// //                   className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap ${
// //                     draft.scheduledDate === iso ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                   }`}
// //                 >
// //                   {shortDateLabel(iso)}
// //                 </button>
// //               ))}
// //             </div>
// //             <TimeSlotPicker
// //               key={`${draft.scheduledDate}-${view}`}
// //               minDate={minDate}
// //               showEmergency
// //               emergencyFee={settings.emergency_surcharge}
// //               value={{
// //                 date: draft.scheduledDate || minDate,
// //                 startTime: draft.startTime,
// //                 endTime: draft.endTime,
// //               }}
// //               onChange={onSlotChange}
// //             />
// //             <p className="text-sm text-slate-600">
// //               Estimated total so far: <span className="font-bold text-emerald-700">{inr(breakdown.total)}</span>
// //             </p>
// //             <div className="flex justify-between gap-3">
// //               <button type="button" onClick={prevStep} className={btnGhost}>
// //                 Back
// //               </button>
// //               <button type="button" onClick={nextStep} className={btnPrimary}>
// //                 Continue
// //               </button>
// //             </div>
// //           </motion.div>
// //         )}

// //         {/* Step 5 */}
// //         {view === 5 && (
// //           <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-6">
// //             <h2 className="text-lg font-bold text-slate-900">5 · Review & payment</h2>
// //             <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 space-y-3 text-sm">
// //               <div className="flex justify-between gap-4">
// //                 <span className="text-slate-600">Service</span>
// //                 <span className="font-semibold text-right">
// //                   {serviceLabel(draft.serviceKey)}
// //                   {draft.serviceKey === 'water_can' ? ` × ${draft.canQuantity ?? 1}` : ''}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between gap-4">
// //                 <span className="text-slate-600">Address</span>
// //                 <span className="font-semibold text-right">
// //                   {selectedAddress ? formatAddressCard(selectedAddress) : '—'}
// //                 </span>
// //               </div>
// //               <div className="flex justify-between gap-4">
// //                 <span className="text-slate-600">Scheduled</span>
// //                 <span className="font-semibold text-right">
// //                   {draft.scheduledDate} · {draft.timeSlot || '—'}
// //                 </span>
// //               </div>
// //               <hr className="border-slate-200" />
// //               <div className="flex justify-between">
// //                 <span>Base price</span>
// //                 <span>{inr(breakdown.base)}</span>
// //               </div>
// //               <div className="flex justify-between">
// //                 <span>Convenience</span>
// //                 <span>{inr(breakdown.convenience)}</span>
// //               </div>
// //               <div className="flex justify-between">
// //                 <span>GST ({Math.round(settings.gst_rate * 100)}%)</span>
// //                 <span>{inr(breakdown.gst)}</span>
// //               </div>
// //               {draft.isEmergency ? (
// //                 <div className="flex justify-between text-amber-800">
// //                   <span>Emergency</span>
// //                   <span>{inr(breakdown.emergency)}</span>
// //                 </div>
// //               ) : null}
// //               <hr className="border-slate-200" />
// //               <div className="flex justify-between text-lg font-extrabold text-emerald-800">
// //                 <span>TOTAL</span>
// //                 <span>{inr(breakdown.total)}</span>
// //               </div>
// //             </div>

// //             <div className="space-y-2">
// //               <p className="text-sm font-semibold text-slate-800">Payment method</p>
// //               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
// //                 {(
// //                   [
// //                     ['cash', 'Cash on delivery'],
// //                     ['upi', 'UPI'],
// //                     ['online', 'Card / netbanking'],
// //                   ] as const
// //                 ).map(([key, label]) => (
// //                   <button
// //                     key={key}
// //                     type="button"
// //                     aria-pressed={draft.paymentMethod === key}
// //                     onClick={() => setDraft((d) => ({ ...d, paymentMethod: key }))}
// //                     className={`rounded-xl border px-3 py-3 text-sm font-semibold text-left ${
// //                       draft.paymentMethod === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
// //                     }`}
// //                   >
// //                     {label}
// //                   </button>
// //                 ))}
// //               </div>
// //               {draft.paymentMethod !== 'cash' && (
// //                 <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
// //                   Online payment is coming soon — this choice is recorded for fulfilment only. You pay on delivery for now.
// //                 </div>
// //               )}
// //             </div>

// //             {submitError && (
// //               <div role="alert" className="rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-sm px-4 py-3">
// //                 {submitError}
// //               </div>
// //             )}

// //             <div className="flex justify-between gap-3 flex-wrap">
// //               <button type="button" onClick={prevStep} disabled={submitting} className={btnGhost}>
// //                 Back
// //               </button>
// //               <button
// //                 type="button"
// //                 disabled={submitting || !draft.addressId}
// //                 onClick={() => void confirmOrder()}
// //                 className={btnPrimary}
// //               >
// //                 {submitting ? 'Placing your order…' : 'Confirm booking →'}
// //               </button>
// //             </div>
// //           </motion.div>
// //         )}

// //         {view === 5 ? (
// //           <div className="fixed left-0 right-0 bottom-3 z-40 px-4 pointer-events-none">
// //             <div className="mx-auto max-w-3xl">
// //               <div
// //                 className="rounded-xl"
// //                 style={{
// //                   background: '#EFF6FF',
// //                   border: '1px solid #BFDBFE',
// //                   color: '#1D4ED8',
// //                   borderRadius: 12,
// //                   padding: '12px 16px',
// //                   fontSize: 13,
// //                   fontWeight: 700,
// //                 }}
// //               >
// //                 🛡 AuroWater Guarantee: Delivered in 45 mins or next order FREE. 100% refund if we cancel.
// //               </div>
// //             </div>
// //           </div>
// //         ) : null}

// //         {/* Step 6 — only when an order really exists */}
// //         {view === 6 && createdOrder && (
// //           <motion.div
// //             {...cardMotion}
// //             className="rounded-3xl bg-white border border-slate-100 shadow-sm p-8 text-center space-y-6"
// //             role="status"
// //             aria-live="polite"
// //           >
// //             <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl" aria-hidden>
// //               ✓
// //             </div>
// //             <p className="text-sm font-semibold text-emerald-700 uppercase">You&apos;re booked</p>
// //             <div
// //               className="text-4xl sm:text-5xl font-extrabold text-[#0F172A]"
// //               style={{ fontFamily: 'var(--font-syne), Syne, system-ui, sans-serif' }}
// //             >
// //               #{orderNo}
// //             </div>
// //             <div className="space-y-1 text-slate-600">
// //               <p>
// //                 {serviceLabel(draft.serviceKey)}
// //                 {draft.serviceKey === 'water_can' ? ` × ${draft.canQuantity ?? 1}` : ''} ·{' '}
// //                 <span className="font-semibold text-slate-900">{inr(breakdown.total)}</span> ·{' '}
// //                 {draft.paymentMethod === 'cash' ? 'Pay on delivery' : draft.paymentMethod.toUpperCase()}
// //               </p>
// //               <p>
// //                 Arrival window: <span className="font-semibold text-slate-900">{etaText}</span>
// //               </p>
// //               <p className="text-sm">
// //                 {supplierSearching
// //                   ? 'We are finding the best supplier near you. Tracking updates automatically.'
// //                   : 'A supplier has been assigned. Tracking updates automatically.'}
// //               </p>
// //             </div>

// //             <div className="flex flex-col sm:flex-row gap-3 justify-center">
// //               <Link href={ROUTES.track(createdOrder.id)} className={`${btnPrimary} text-center`}>
// //                 Track order
// //               </Link>
// //               <a
// //                 href={waTrackHref}
// //                 target="_blank"
// //                 rel="noreferrer"
// //                 className="rounded-xl border border-emerald-600 text-emerald-700 px-6 py-3 font-semibold text-center hover:bg-emerald-50"
// //               >
// //                 Track on WhatsApp
// //               </a>
// //             </div>

// //             <div className="flex flex-col sm:flex-row gap-3 justify-center border-t border-slate-100 pt-5">
// //               <button type="button" onClick={resetWizard} className={btnGhost}>
// //                 Book another service
// //               </button>
// //               <Link href={ROUTES.home} className={`${btnGhost} text-center`}>
// //                 Go to home
// //               </Link>
// //               <Link href={ROUTES.orders} className={`${btnGhost} text-center`}>
// //                 My orders
// //               </Link>
// //             </div>
// //           </motion.div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }




