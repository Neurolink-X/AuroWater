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
 *  - Premium pass: price-vs-market savings, trust signals, sticky total bar,
 *    FAQ, share-to-WhatsApp, reduced-motion support, Sora + Plus Jakarta Sans
 *  - Pricing pass: one price table for plumbing / RO service / tanker, every
 *    extra charge visible, same itemised lines on Step 2 and Step 5
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion, useReducedMotion } from 'framer-motion';

import BookingProgress from '@/components/booking/BookingProgress';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import type { TimeSlotPickerValue } from '@/components/booking/TimeSlotPicker';
import {
  ApiError,
  customerAddressCreate,
  customerAddresses,
  customerServiceability,
  customerOrderCreate,
  forwardGeocodeAddress,
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
import { bookingBody, bookingDisplay } from '@/components/booking/booking-fonts';
import {
  CAN_PRICES,
  MARKET_CAN_PRICES,
  MARKET_PRICE_NOTE,
  SHOW_MARKET_COMPARISON,
  pctOff,
} from '@/lib/booking-pricing';

const ROUTES = {
  home: '/customer/home',
  orders: '/customer/history',
  track: (id: string) => `/customer/track/${id}`,
} as const;

export interface BookingDraft {
  serviceKey: string;
  subOptionKey: string;
  plumberType?: 'labour' | 'mistri';
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
const bookingDraftKey = (userId?: string | null) => `${DRAFT_KEY}:${userId || 'guest'}`;
const MAX_FORM_STEP = 5;
const MAX_CANS_ONE_TIME = 50;
const MAX_CANS_SUBSCRIPTION = 200;
// Approved launch prices for 20L RO cans.
const NORMAL_RO_CAN_PRICE: number = CAN_PRICES.normal;
const CHILLED_RO_CAN_PRICE: number = CAN_PRICES.chilled;
const SUBSCRIPTION_RO_CAN_PRICE: number = CAN_PRICES.subscription;
const BULK_RO_CAN_PRICE: number = CAN_PRICES.bulk;
const QUICK_QTY = [1, 2, 3, 5, 10, 20];
const SCOPE_SERVICES = ['plumbing', 'borewell', 'motor_pump', 'tank_cleaning'];

/* ───────── Service price tables: ONE source of truth ─────────
 * Edit prices here only. Option cards, price boxes, the review step
 * and the total all read from these tables, so they can never disagree. */

const PLUMBER_PRICES = {
  labour: 149,
  // Old code showed ₹700 on the card but charged ₹900. Put the REAL number here.
  mistri: 700,
} as const;

const PLUMBER_LABELS = {
  labour: 'Labour / minor repair',
  mistri: 'Mistri / skilled work',
} as const;

interface ScopeOption {
  key: string;
  label: string;
  desc?: string;
  /** Extra charge added on top of the base fee. */
  extra: number;
  /** true = final price is confirmed after the visit. */
  quoteAfterVisit?: boolean;
}

// Extras below match what your code was ALREADY charging.
// If drainage should really be free, change its extra to 0 here.
const SCOPE_OPTIONS: Record<string, ScopeOption[]> = {
  ro_service: [
    { key: 'service', label: 'Routine service', extra: 0 },
    { key: 'filter_change', label: 'Filter change', extra: 49 },
    { key: 'amc', label: 'AMC', extra: 149 },
    { key: 'new_installation', label: 'New installation', extra: 599 },
  ],
  plumbing: [
    { key: 'pipe_leak', label: 'Pipe leak', desc: 'Standard repair', extra: 0 },
    { key: 'tap', label: 'Tap repair', desc: 'Standard repair', extra: 0 },
    { key: 'drainage', label: 'Drainage', desc: 'Includes clearing tools', extra: 49 },
    { key: 'new_fitting', label: 'New fitting', desc: 'Specialized hardware setup', extra: 99 },
    { key: 'other', label: 'Other', desc: 'Custom scope', extra: 0, quoteAfterVisit: true },
  ],
  water_tanker: [
    { key: '500', label: '500L', extra: 0 },
    { key: '1000', label: '1000L', extra: 50 },
    { key: '2000', label: '2000L', extra: 120 },
    { key: 'custom', label: 'Custom', desc: 'Custom quantity', extra: 80, quoteAfterVisit: true },
  ],
};

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

/* ───────── Premium presentation helpers ───────── */

const BRAND = 'AuroTap';
const DISPLAY_FONT = 'var(--font-bk-display, var(--font-syne, system-ui, sans-serif))';

/**
 * Optional social proof. Leave empty until you have REAL numbers, e.g.
 *   [{ value: '2,500+', label: 'cans delivered' }, { value: '4.9★', label: 'average rating' }]
 */
const SOCIAL_PROOF: { value: string; label: string }[] = [];

const TRUST_POINTS = [
  { icon: '🛡', text: 'Genuine RO water' },
  { icon: '🚚', text: 'Delivery included' },
  { icon: '💵', text: 'Pay on delivery' },
  { icon: '🧾', text: 'Transparent pricing' },
];

const WHY_US = [
  { icon: '💧', title: 'Genuine RO water', body: 'Fresh 20L RO cans for daily home and office use, or chilled for events.' },
  { icon: '🏷️', title: 'Affordable, fair pricing', body: 'Simple per-can pricing with delivery included. The full total is shown before you confirm.' },
  { icon: '⚡', title: 'Fast, flexible booking', body: 'Pick a 3-hour window, or choose Emergency for ASAP delivery.' },
];

function TrustChips() {
  return (
    <ul className="mb-6 flex flex-wrap items-center justify-center gap-2" aria-label="Why book with us">
      {TRUST_POINTS.map((t) => (
        <li
          key={t.text}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm"
        >
          <span aria-hidden>{t.icon}</span>
          {t.text}
        </li>
      ))}
    </ul>
  );
}

function WhyChooseUs() {
  return (
    <section className="mt-6 space-y-4" aria-label={`Why choose ${BRAND}`}>
      {SOCIAL_PROOF.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SOCIAL_PROOF.map((p) => (
            <div key={p.label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
              <p className="text-xl font-extrabold text-emerald-700" style={{ fontFamily: DISPLAY_FONT }}>{p.value}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{p.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {WHY_US.map((w) => (
          <div key={w.title} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="text-2xl" aria-hidden>{w.icon}</div>
            <p className="mt-2 text-sm font-extrabold text-slate-900">{w.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{w.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqList({ emergencySurcharge }: { emergencySurcharge: number }) {
  const items: [string, string][] = [
    ['What does a 20L RO can cost?',
      `Normal RO is ${inr(CAN_PRICES.normal)} per can, chilled RO is ${inr(CAN_PRICES.chilled)} per can, and subscriptions are ${inr(CAN_PRICES.subscription)} per can. Delivery is included.`],
    ['How do I pay?',
      'Pay cash or UPI when your order is delivered. Online card and netbanking payment is coming soon.'],
    ['Can I pause or cancel a subscription?',
      'Yes. You can pause or cancel future deliveries later. Each delivery is billed separately and there is no automatic debit.'],
    ['Which cities do you serve?',
      `We currently deliver in ${LIVE_CITIES.join(', ')}. Not listed? Join the waitlist on the address step.`],
    ['How fast can I get water?',
      `Choose a 3-hour delivery window, or tick Emergency for ASAP delivery (${inr(emergencySurcharge)} surcharge).`],
  ];
  return (
    <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6" aria-label="Frequently asked questions">
      <h2 className="text-base font-extrabold text-slate-900" style={{ fontFamily: DISPLAY_FONT }}>Good to know</h2>
      <div className="mt-3 divide-y divide-slate-100">
        {items.map(([q, a]) => (
          <details key={q} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
              {q}
              <span className="text-slate-400 transition-transform group-open:rotate-45" aria-hidden>＋</span>
            </summary>
            <p className="mt-2 text-sm leading-6 text-slate-600">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

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
    serviceKey: 'water_can', subOptionKey: 'normal_ro', plumberType: 'labour',
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
  if (r.plumberType === 'labour' || r.plumberType === 'mistri') out.plumberType = r.plumberType;
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

function subOptionMeta(serviceKey: string, subOptionKey: string): ScopeOption | undefined {
  return SCOPE_OPTIONS[serviceKey]?.find((o) => o.key === subOptionKey);
}

function subOptionDelta(serviceKey: string, subOptionKey: string): number {
  return subOptionMeta(serviceKey, subOptionKey)?.extra ?? 0;
}

function serviceBaseFee(draft: BookingDraft, settings: PlatformSettings): number {
  if (draft.serviceKey === 'plumbing') {
    return PLUMBER_PRICES[draft.plumberType ?? 'labour'];
  }
  return settings.service_base_prices[draft.serviceKey as ServiceKey] ?? 0;
}

export interface PriceLine {
  label: string;
  amount: number;
  /** true = shown as an indented "+ extra" line. */
  isAddon: boolean;
}

/** Itemised lines for every non-water-can service. Sum of lines = baseAmount. */
function getPriceLines(draft: BookingDraft, settings: PlatformSettings): PriceLine[] {
  const baseLabel =
    draft.serviceKey === 'plumbing'
      ? `Base fee · ${PLUMBER_LABELS[draft.plumberType ?? 'labour']}`
      : 'Base service fee';

  const lines: PriceLine[] = [
    { label: baseLabel, amount: serviceBaseFee(draft, settings), isAddon: false },
  ];

  const meta = subOptionMeta(draft.serviceKey, draft.subOptionKey);
  if (meta && meta.extra > 0) {
    lines.push({ label: `${meta.label} charge`, amount: meta.extra, isAddon: true });
  }
  return lines;
}

function priceNote(draft: BookingDraft): string {
  const meta = subOptionMeta(draft.serviceKey, draft.subOptionKey);
  if (meta?.quoteAfterVisit) {
    return 'Custom work: the final quote is confirmed after inspection. Materials, if needed, are extra.';
  }
  if (draft.serviceKey === 'plumbing') {
    return 'Starting price. Spare parts and materials, if needed, are extra and shown before work begins.';
  }
  return 'Review the complete payable total before confirming your booking.';
}

function computeBaseAmount(draft: BookingDraft, settings: PlatformSettings): number {
  if (draft.serviceKey === 'water_can') {
    const qty = Math.min(
      maxCansFor(draft),
      Math.max(1, draft.canQuantity ?? 1)
    );
    const per = draft.subOptionKey === 'chilled_ro'
      ? CHILLED_RO_CAN_PRICE
      : draft.canOrderType === 'subscription'
        ? SUBSCRIPTION_RO_CAN_PRICE
        : qty >= settings.bulk_threshold
          ? BULK_RO_CAN_PRICE
          : NORMAL_RO_CAN_PRICE;
    return Math.round(qty * per);
  }

  return Math.round(
    serviceBaseFee(draft, settings) + subOptionDelta(draft.serviceKey, draft.subOptionKey),
  );
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

/* ───────── Option card with a visible extra-price tag ───────── */
function ScopeCard({
  option,
  active,
  onSelect,
}: {
  option: ScopeOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`${optionBtn(active)} flex flex-col justify-between text-left`}
    >
      <div>
        <span className="block font-bold">{option.label}</span>
        {option.desc && (
          <span className="mt-0.5 block text-xs text-slate-500">{option.desc}</span>
        )}
      </div>

      {option.extra > 0 && (
        <span className="mt-2 inline-block self-start rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
          + {inr(option.extra)} extra
        </span>
      )}

      {option.quoteAfterVisit && (
        <span className="mt-2 inline-block self-start rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
          Quote after inspection
        </span>
      )}
    </button>
  );
}

/* ───────── Full price breakdown: nothing hidden ───────── */
function ServicePriceBox({
  lines,
  convenience,
  emergency,
  total,
  note,
  estimate,
}: {
  lines: PriceLine[];
  convenience: number;
  emergency: number;
  total: number;
  note: string;
  estimate: boolean;
}) {
  return (
    <div
      className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"
      aria-live="polite"
    >
      {lines.map((l, i) => (
        <div
          key={`${l.label}-${i}`}
          className={`flex justify-between gap-3 ${l.isAddon ? 'text-xs font-medium text-emerald-700' : ''}`}
        >
          <span className={l.isAddon ? '' : 'text-slate-600'}>
            {l.isAddon ? `└ ${l.label}` : l.label}
          </span>
          <span className={l.isAddon ? '' : 'font-bold text-slate-900'}>
            {l.isAddon ? `+ ${inr(l.amount)}` : inr(l.amount)}
          </span>
        </div>
      ))}

      {convenience > 0 && (
        <div className="flex justify-between gap-3 text-slate-600">
          <span>Convenience fee</span>
          <span className="font-semibold text-slate-900">{inr(convenience)}</span>
        </div>
      )}

      {emergency > 0 && (
        <div className="flex justify-between gap-3 text-amber-700">
          <span>Emergency surcharge</span>
          <span className="font-semibold">{inr(emergency)}</span>
        </div>
      )}

      <hr className="my-1 border-slate-200" />

      <div className="flex justify-between font-extrabold text-slate-900">
        <span>{estimate ? 'Estimated total' : 'Total'}</span>
        <span>
          {estimate ? 'from ' : ''}
          {inr(total)}
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

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

  const reduceMotion = useReducedMotion();
  const cardMotion = reduceMotion
    ? {}
    : {
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
    setHydrated(false);
    let restored: Partial<BookingDraft> | null = null;
    let restoredStep = 1;
    try {
      const draftKey = bookingDraftKey(session?.userId ?? session?.aurotapId ?? null);
      const raw = safeSessionGet(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { draft?: unknown; step?: number };
        const s = Number(parsed?.step);
        if (parsed?.draft && typeof parsed.draft === 'object' && s >= 1 && s <= MAX_FORM_STEP) {
          restored = sanitizeDraft(parsed.draft);
          restoredStep = Math.floor(s);
        } else { safeSessionRemove(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null)); }
      }
    } catch { try { safeSessionRemove(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null)); } catch { /* */ } }

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
  // Re-hydrate whenever the authenticated identity changes; drafts are never shared between accounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId, session?.aurotapId, session?.loggedIn]);

  useEffect(() => {
    if (!hydrated || createdOrder) return;
    try { safeSessionSet(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null), JSON.stringify({ draft, step: Math.min(step, MAX_FORM_STEP) })); } catch { /* quota */ }
  }, [draft, step, hydrated, createdOrder, session?.userId, session?.aurotapId]);

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

  /* Itemised lines (sum = baseAmount) so every screen shows the same numbers */
  const priceLines = useMemo<PriceLine[]>(
    () =>
      draft.serviceKey === 'water_can'
        ? [{ label: 'Base price', amount: baseAmount, isAddon: false }]
        : getPriceLines(draft, settings),
    [draft, settings, baseAmount],
  );

  const quoteEstimate =
    draft.serviceKey === 'plumbing' ||
    !!subOptionMeta(draft.serviceKey, draft.subOptionKey)?.quoteAfterVisit;

  const fromPrice = useCallback((key: string) => {
    if (key === 'water_can') return NORMAL_RO_CAN_PRICE;
    if (key === 'plumbing') return PLUMBER_PRICES.labour;
    return settings.service_base_prices[key as ServiceKey] ?? 0;
  }, [settings]);

  const perCan = draft.subOptionKey === 'chilled_ro'
    ? CHILLED_RO_CAN_PRICE
    : draft.canOrderType === 'subscription'
      ? SUBSCRIPTION_RO_CAN_PRICE
      : (draft.canQuantity ?? 1) >= settings.bulk_threshold
        ? BULK_RO_CAN_PRICE
        : NORMAL_RO_CAN_PRICE;

  const isSubscription =
    draft.serviceKey === 'water_can' &&
    draft.canOrderType === 'subscription';

  /* Savings messaging (water cans only; hidden when SHOW_MARKET_COMPARISON is off) */
  const showCompareHome = SHOW_MARKET_COMPARISON && MARKET_CAN_PRICES.normal > CAN_PRICES.normal;
  const isCan = draft.serviceKey === 'water_can';
  const canQty = draft.canQuantity ?? 1;
  const marketPerCan = draft.subOptionKey === 'chilled_ro' ? MARKET_CAN_PRICES.chilled : MARKET_CAN_PRICES.normal;
  const showCompare = SHOW_MARKET_COMPARISON && isCan && marketPerCan > perCan;
  const offPct = showCompare ? pctOff(marketPerCan, perCan) : 0;
  const youSave = showCompare ? Math.round((marketPerCan - perCan) * canQty) : 0;
  const subSave =
    isCan && !isSubscription && draft.subOptionKey !== 'chilled_ro' && perCan > SUBSCRIPTION_RO_CAN_PRICE
      ? Math.round((perCan - SUBSCRIPTION_RO_CAN_PRICE) * canQty)
      : 0;

  const switchToSubscription = () =>
    setDraft((d) => ({
      ...d,
      subOptionKey: 'normal_ro',
      canOrderType: 'subscription',
      canFrequency: d.canFrequency ?? 'weekly',
      paymentMethod: d.paymentMethod === 'online' ? 'cash' : d.paymentMethod,
    }));

  const shareOnWhatsApp = () => {
    if (typeof window === 'undefined') return;
    const text = `I just booked pure RO drinking water on ${BRAND}: ${inr(CAN_PRICES.normal)} per 20L can, delivered to my door. Try it: ${window.location.origin}/book?service=water_can`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const goLoginForCheckout = () => {
    try { safeSessionSet(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null), JSON.stringify({ draft, step: 3 })); } catch { /* */ }
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
          : 'Location was detected, but the address lookup timed out. Please enter your house/flat, area, city and 6-digit pincode manually, then save the address. Your GPS coordinates are retained.';
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
    try { safeSessionRemove(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null)); } catch { /* */ }
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
      // Keep precise GPS coordinates only while the detected area/city/pincode remain unchanged.
      // If the customer edits the address manually (or has no fresh GPS result), resolve the
      // typed address again so stale coordinates can never be saved for a different address.
      const sameAsDetected =
        Boolean(detectedLocation) &&
        (na.area.trim().toLowerCase() === String(detectedLocation?.area ?? '').trim().toLowerCase()) &&
        (na.city.trim().toLowerCase() === String(detectedLocation?.city ?? '').trim().toLowerCase()) &&
        (na.pincode.trim() === String(detectedLocation?.pincode ?? '').trim());
      const hasValidCoords =
        typeof na.lat === 'number' && typeof na.lng === 'number' &&
        Number.isFinite(na.lat) && Number.isFinite(na.lng) &&
        na.lat >= -90 && na.lat <= 90 && na.lng >= -180 && na.lng <= 180;
      let lat = na.lat;
      let lng = na.lng;
      if (!hasValidCoords || !sameAsDetected) {
        setLocationStep('geocoding');
        try {
          const resolved = await forwardGeocodeAddress({
            house_flat: na.house_flat.trim(),
            area: na.area.trim(),
            city: na.city.trim(),
            pincode: na.pincode.trim(),
          });
          lat = resolved.lat;
          lng = resolved.lng;
          setDraft((d) => ({
            ...d,
            newAddress: {
              ...d.newAddress,
              lat,
              lng,
              area: resolved.area || d.newAddress?.area || '',
              city: resolved.city || d.newAddress?.city || '',
              pincode: resolved.pincode || d.newAddress?.pincode || '',
            },
          }));
        } catch (error) {
          const message = error instanceof ApiError
            ? error.message
            : 'We could not verify this address on the map. Check your house/flat, area, city and pincode, or detect your location again.';
          setLocationStep('error');
          setLocationError(message);
          toast.error(message);
          return;
        }
      }
      const payload = { label: na.label ?? 'Home', house_flat: na.house_flat.trim(), area: na.area.trim(), city: na.city.trim(), pincode: na.pincode.trim(), landmark: na.landmark?.trim() ?? '', is_default: na.is_default ?? true, lat, lng };
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
        plumber_type: draft.serviceKey === 'plumbing' ? (draft.plumberType ?? 'labour') : undefined,
      });
      try { safeSessionRemove(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null)); } catch { /* */ }
      setDraft((d) => ({ ...d, timeSlot: sv.time_slot, startTime: sv.startTime, endTime: sv.endTime }));
      setCreatedOrder(order);
      toast.success('Booking confirmed! 🎉');
    } catch (e) {
      submitLock.current = false;
      if (e instanceof ApiError && e.status === 401) {
        try { safeSessionSet(bookingDraftKey(session?.userId ?? session?.aurotapId ?? null), JSON.stringify({ draft, step: 5 })); } catch { /* */ }
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
    <div
      className={`min-h-screen bg-gradient-to-b from-emerald-50/70 via-slate-50 to-slate-50 pb-28 text-slate-900 ${bookingBody.variable} ${bookingDisplay.variable}`}
      style={{ fontFamily: 'var(--font-bk-body, system-ui, sans-serif)' }}
    >
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

        <header className="text-center mb-6">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-800">
            <span aria-hidden>💧</span> {view === 6 ? 'Order confirmed' : 'Book in under a minute'}
          </p>
          <h2 className="mt-3 text-[1.65rem] leading-tight sm:text-4xl font-extrabold tracking-tight text-[#0F172A]" style={{ fontFamily: DISPLAY_FONT }}>
            {view === 6 ? 'Thank you, your booking is confirmed' : 'Pure RO water, expert plumbing solutions - right at your door.'}
          </h2>
          {view < 6 && (
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Genuine 20L RO cans from {inr(CAN_PRICES.normal)} · delivery included · pay when it arrives.
            </p>
          )}
          {view > 1 && view < 6 && (
            <button type="button" onClick={resetWizard} className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-700 underline underline-offset-2">
              Start over
            </button>
          )}
        </header>

        {view < 6 && <TrustChips />}

        {view === 1 && SHOW_MARKET_COMPARISON && MARKET_CAN_PRICES.normal > CAN_PRICES.normal && (
          <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-900/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-100">Launch price · 20L RO can</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2.5">
                  <span className="text-4xl font-extrabold" style={{ fontFamily: DISPLAY_FONT }}>{inr(CAN_PRICES.normal)}</span>
                  <s className="text-base text-emerald-200/80" aria-label={`Typical local price ${inr(MARKET_CAN_PRICES.normal)}`}>{inr(MARKET_CAN_PRICES.normal)}</s>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-extrabold text-emerald-700">
                    {pctOff(MARKET_CAN_PRICES.normal, CAN_PRICES.normal)}% OFF
                  </span>
                </p>
                <p className="mt-1 text-xs text-emerald-100">
                  Subscribe and pay just {inr(CAN_PRICES.subscription)} per can · delivery included
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setDraft((d) => ({ ...d, serviceKey: 'water_can' })); goTo(2); }}
                className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-50 active:scale-95"
              >
                Order water now →
              </button>
            </div>
            <p className="mt-3 text-[10px] text-emerald-100/80">{MARKET_PRICE_NOTE}</p>
          </div>
        )}

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
                    'relative rounded-2xl border p-4 text-left transition-all hover:shadow-md',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                    draft.serviceKey === s.key
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                      : 'border-slate-200 bg-white',
                  ].join(' ')}>
                  {s.key === 'water_can' && showCompareHome && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      {pctOff(MARKET_CAN_PRICES.normal, CAN_PRICES.normal)}% OFF
                    </span>
                  )}
                  <div className="text-2xl" aria-hidden>{s.emoji}</div>
                  <div className="mt-2 font-semibold text-slate-900 text-sm leading-tight">{s.title}</div>
                  <div className="mt-1 text-xs text-emerald-700 font-semibold">
                    From ₹{Math.round(fromPrice(s.key)).toLocaleString('en-IN')}
                    {s.key === 'water_can' && showCompareHome && (
                      <s className="ml-1.5 font-medium text-slate-400">{inr(MARKET_CAN_PRICES.normal)}</s>
                    )}
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

        {view === 1 && (
          <>
            <WhyChooseUs />
            <FaqList emergencySurcharge={settings.emergency_surcharge} />
          </>
        )}

        {/* STEP 2 */}
        {view === 2 && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-900">2 · Options · {serviceLabel(draft.serviceKey)}</h2>

            {draft.serviceKey === 'water_can' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="Water type">
                  <button type="button" aria-pressed={draft.subOptionKey !== 'chilled_ro'} onClick={() => setDraft((d) => ({ ...d, subOptionKey: 'normal_ro' }))} className={optionBtn(draft.subOptionKey !== 'chilled_ro')}>
                    <span className="block text-sm font-extrabold">Everyday Normal RO</span>
                    <span className="mt-1 block text-lg font-extrabold text-emerald-700">{inr(NORMAL_RO_CAN_PRICE)} / 20L</span>
                    <span className="mt-1 block text-xs text-slate-500">For daily home &amp; office use</span>
                    <span className="mt-1 block text-[11px] text-slate-500">Delivery included</span>
                  </button>
                  <button type="button" aria-pressed={draft.subOptionKey === 'chilled_ro'} onClick={() => setDraft((d) => ({ ...d, subOptionKey: 'chilled_ro', canOrderType: 'one_time' }))} className={optionBtn(draft.subOptionKey === 'chilled_ro')}>
                    <span className="block text-sm font-extrabold">Chilled RO Water</span>
                    <span className="mt-1 block text-lg font-extrabold text-sky-700">{inr(CHILLED_RO_CAN_PRICE)} / 20L</span>
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

                <div className="flex flex-wrap gap-2" role="group" aria-label="Quick quantity">
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
                      {inr(draft.subOptionKey === 'chilled_ro' ? CHILLED_RO_CAN_PRICE : NORMAL_RO_CAN_PRICE)} per can
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400">
                      {draft.subOptionKey === 'chilled_ro' ? 'Chilled price applies per can' : `${inr(BULK_RO_CAN_PRICE)} per can from ${settings.bulk_threshold} cans`}
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
                          : `Save 10% · ₹${SUBSCRIPTION_RO_CAN_PRICE}/can`}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {inr(SUBSCRIPTION_RO_CAN_PRICE)} per can · Save 10% vs one-time Normal RO
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

                {showCompare && (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Your price vs typical local price</p>
                        <p className="mt-1 flex flex-wrap items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-emerald-700" style={{ fontFamily: DISPLAY_FONT }}>{inr(perCan)}</span>
                          <s className="text-sm text-slate-400">{inr(marketPerCan)}</s>
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold text-white">{offPct}% OFF</span>
                          <span className="text-xs text-slate-500">per can</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500">You save</p>
                        <p className="text-lg font-extrabold text-emerald-700" style={{ fontFamily: DISPLAY_FONT }}>{inr(youSave)}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">{MARKET_PRICE_NOTE}</p>
                  </div>
                )}

                {subSave > 0 && (
                  <button
                    type="button"
                    onClick={switchToSubscription}
                    className="w-full rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 px-4 py-3 text-left text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                  >
                    🔁 Subscribe at {inr(SUBSCRIPTION_RO_CAN_PRICE)} per can and save {inr(subSave)} more on every delivery →
                  </button>
                )}
              </div>
            )}

            {draft.serviceKey === 'ro_service' && (
              <div
                role="group"
                aria-label="RO service type"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {SCOPE_OPTIONS.ro_service.map((o) => (
                  <ScopeCard
                    key={o.key}
                    option={o}
                    active={draft.subOptionKey === o.key}
                    onSelect={() => setDraft((d) => ({ ...d, subOptionKey: o.key }))}
                  />
                ))}
              </div>
            )}

            {draft.serviceKey === 'plumbing' && (
              <div className="space-y-4">
                {/* Who is coming */}
                <div
                  role="group"
                  aria-label="Plumber charge type"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {(['labour', 'mistri'] as const).map((type) => {
                    const active = (draft.plumberType ?? 'labour') === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDraft((d) => ({ ...d, plumberType: type }))}
                        className={`${optionBtn(active)} text-left`}
                      >
                        <span className="block font-bold">{PLUMBER_LABELS[type]}</span>
                        <span className="mt-1 block text-sm">
                          {inr(PLUMBER_PRICES[type])} starting
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          Final quote depends on scope and materials.
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* What work is needed */}
                <div
                  role="group"
                  aria-label="Type of plumbing work"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {SCOPE_OPTIONS.plumbing.map((o) => (
                    <ScopeCard
                      key={o.key}
                      option={o}
                      active={draft.subOptionKey === o.key}
                      onSelect={() => setDraft((d) => ({ ...d, subOptionKey: o.key }))}
                    />
                  ))}
                </div>
              </div>
            )}

            {draft.serviceKey === 'water_tanker' && (
              <div
                role="group"
                aria-label="Tanker size"
                className="grid grid-cols-2 gap-3"
              >
                {SCOPE_OPTIONS.water_tanker.map((o) => (
                  <ScopeCard
                    key={o.key}
                    option={o}
                    active={draft.subOptionKey === o.key}
                    onSelect={() => setDraft((d) => ({ ...d, subOptionKey: o.key }))}
                  />
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

            {draft.serviceKey === 'water_can' ? (
              <p className="text-xs text-slate-500">
                Water-can orders have no separate handling fee. Review the complete payable total before confirming.
              </p>
            ) : (
              <ServicePriceBox
                lines={priceLines}
                convenience={breakdown.convenience}
                emergency={breakdown.emergency}
                total={breakdown.total}
                note={priceNote(draft)}
                estimate={quoteEstimate}
              />
            )}

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

              {priceLines.map((l, i) => (
                <div
                  key={`${l.label}-${i}`}
                  className={`flex justify-between gap-3 ${l.isAddon ? 'text-xs' : 'text-slate-900'}`}
                >
                  <span className={l.isAddon ? 'pl-2 text-slate-500' : 'text-slate-600'}>
                    {l.isAddon ? `└ ${l.label}` : l.label}
                  </span>
                  <span className={l.isAddon ? 'font-semibold text-emerald-700' : ''}>
                    {l.isAddon ? `+ ${inr(l.amount)}` : inr(l.amount)}
                  </span>
                </div>
              ))}

              <div className="flex justify-between text-slate-900">
                <span className="text-slate-600">Convenience</span>
                <span>{inr(breakdown.convenience)}</span>
              </div>
              {breakdown.gst > 0 && (
                <div className="flex justify-between text-slate-900">
                  <span className="text-slate-600">GST</span>
                  <span>{inr(breakdown.gst)}</span>
                </div>
              )}
              {draft.isEmergency && (
                <div className="flex justify-between text-amber-700">
                  <span>Emergency</span>
                  <span>{inr(breakdown.emergency)}</span>
                </div>
              )}
              <hr className="border-slate-200" />
              <div className="flex justify-between text-base font-extrabold text-emerald-800">
                <span>TOTAL</span>
                <span>{inr(breakdown.total)}</span>
              </div>
              {youSave > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-600/10 px-3 py-2 text-emerald-800">
                  <span className="text-xs font-bold">🎉 You save vs typical local price ({offPct}% off)</span>
                  <span className="font-extrabold">{inr(youSave)}</span>
                </div>
              )}
            </div>

            <ul className="grid grid-cols-1 gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-3">
              <li className="rounded-xl bg-slate-50 px-3 py-2">🛡 Genuine RO water</li>
              <li className="rounded-xl bg-slate-50 px-3 py-2">🧾 Total shown upfront</li>
              <li className="rounded-xl bg-slate-50 px-3 py-2">💵 Pay at delivery</li>
            </ul>

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

        {view >= 2 && view <= 4 && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-500">
                  {selectedServiceLabel(draft)}{isCan ? ` × ${canQty}` : ''}
                </p>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-extrabold text-slate-900" style={{ fontFamily: DISPLAY_FONT }}>{inr(breakdown.total)}</span>
                  {youSave > 0 && <span className="text-[11px] font-bold text-emerald-700">You save {inr(youSave)}</span>}
                </p>
              </div>
              <button type="button" onClick={nextStep} disabled={view === 4 && !draft.slotValid} className={btnPrimary}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 6 */}
        {view === 6 && createdOrder && (
          <motion.div {...cardMotion} className="rounded-3xl bg-white border border-slate-100 shadow-sm p-7 sm:p-10 text-center space-y-6" role="status">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl" aria-hidden>✓</div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">You&apos;re booked</p>
            <div className="text-4xl sm:text-5xl font-extrabold text-[#0F172A]" style={{ fontFamily: DISPLAY_FONT }}>
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
            {youSave > 0 && (
              <p className="mx-auto max-w-md rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                🎉 You saved {inr(youSave)} ({offPct}% off) on this order
              </p>
            )}

            <ol className="mx-auto max-w-md space-y-3 text-left text-sm" aria-label="What happens next">
              {([
                ['1', 'Supplier matched', 'We find the nearest supplier for your address.'],
                ['2', 'On the way', 'Tracking updates automatically. Follow it in the app or on WhatsApp.'],
                ['3', 'Delivered & paid', 'Pay by cash or UPI when your order arrives.'],
              ] as const).map(([n, title, body]) => (
                <li key={n} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-extrabold text-white" aria-hidden>{n}</span>
                  <span>
                    <span className="block font-bold text-slate-900">{title}</span>
                    <span className="block text-xs text-slate-500">{body}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mx-auto max-w-md rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 text-left">
              <p className="text-sm font-extrabold text-slate-900">Know a neighbour who needs water?</p>
              <p className="mt-1 text-xs text-slate-600">
                Share {BRAND} on WhatsApp: pure water at {inr(CAN_PRICES.normal)} per can, delivered.
              </p>
              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="mt-3 w-full rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 active:scale-95"
              >
                Share on WhatsApp
              </button>
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
