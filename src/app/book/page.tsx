'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

type StepId = 1 | 2 | 3 | 4 | 5;

type Address = {
  id: string;
  houseFlat: string;
  area: string;
  city: string;
  pincode: string;
  landmark?: string;
  label?: string;
  createdAt: number;
  isDefault?: boolean;
};

type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

type ServiceDef = {
  key: ServiceKey;
  emoji: string;
  title: string;
  fromPrice: number;
  description: string;
  subOptions?: { key: string; label: string; priceDelta?: number }[];
};

type DatePill = {
  isoDate: string; // YYYY-MM-DD
  label: string;
  disabled: boolean;
};

type TimeSlot = {
  key: string;
  label: string;
  start: string;
  end: string;
  // reserved for later modifiers; spec wants optional emergency modifier
  emergency?: boolean;
};

const STORAGE_ADDRESSES_KEY = 'aurowater_addresses';
const STORAGE_ORDERS_KEY = 'aurowater_orders';

const CONVENIENCE_FEE = 29;
const GST_PERCENT = 18;
const EMERGENCY_SURCHARGE = 199;

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

const SERVICE_DEFS: ServiceDef[] = [
  {
    key: 'water_tanker',
    emoji: '💧',
    title: 'Water Tanker Delivery',
    fromPrice: 299,
    description: 'Fresh tanker delivery with reliable scheduling.',
    subOptions: [{ key: 'standard', label: 'Standard delivery' }],
  },
  {
    key: 'ro_service',
    emoji: '🔧',
    title: 'RO Service & Repair',
    fromPrice: 199,
    description: 'AMC, one-time repairs, filter changes.',
    subOptions: [
      { key: 'amc', label: 'AMC (Annual Maintenance)', priceDelta: 0 },
      { key: 'repair', label: 'One-time repair', priceDelta: 0 },
      { key: 'filter', label: 'Filter change', priceDelta: 0 },
    ],
  },
  {
    key: 'plumbing',
    emoji: '🪠',
    title: 'Plumbing Services',
    fromPrice: 149,
    description: 'Fittings, boring/repair, leak fixes and more.',
    subOptions: [
      { key: 'fitting', label: 'Fittings & repair' },
      { key: 'leak', label: 'Leak fixing' },
      { key: 'pump', label: 'Pump repair' },
    ],
  },
  {
    key: 'borewell',
    emoji: '⛏️',
    title: 'Borewell Services',
    fromPrice: 499,
    description: 'Borewell maintenance, installation and repairs.',
    subOptions: [
      { key: 'repair', label: 'Borewell repair' },
      { key: 'installation', label: 'Installation' },
      { key: 'boring', label: 'Boring' },
    ],
  },
  {
    key: 'motor_pump',
    emoji: '⚙️',
    title: 'Motor Pump Repair',
    fromPrice: 249,
    description: 'Motor/pump servicing with transparent pricing.',
    subOptions: [
      { key: 'service', label: 'Motor servicing' },
      { key: 'repair', label: 'Motor repair' },
      { key: 'pump', label: 'Pump check & repair' },
    ],
  },
  {
    key: 'tank_cleaning',
    emoji: '🪣',
    title: 'Water Tank Cleaning',
    fromPrice: 349,
    description: 'Deep clean and hygiene-first tank sanitation.',
    subOptions: [
      { key: 'clean', label: 'Tank cleaning' },
      { key: 'sanitise', label: 'Sanitization' },
    ],
  },
];

const BASE_TIME_SLOTS: TimeSlot[] = [
  { key: 'morning', label: 'Morning • 8:00 AM – 12:00 PM', start: '08:00', end: '12:00' },
  { key: 'afternoon', label: 'Afternoon • 12:00 PM – 5:00 PM', start: '12:00', end: '17:00' },
  { key: 'evening', label: 'Evening • 5:00 PM – 8:00 PM', start: '17:00', end: '20:00' },
];

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function makeOrderId() {
  const n = Math.floor(10000000 + Math.random() * 90000000); // 8 digits
  return `AW-${n}`;
}

function formatMoney(n: number) {
  const val = Number.isFinite(n) ? n : 0;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function calcPrice(base: number, emergency: boolean) {
  const convenience = CONVENIENCE_FEE;
  const emergencyExtra = emergency ? EMERGENCY_SURCHARGE : 0;
  const taxable = base + convenience + emergencyExtra;
  const gst = Math.round((taxable * GST_PERCENT) / 100);
  const total = base + convenience + emergencyExtra + gst;
  return { base, convenience, emergencyExtra, gst, total };
}

function isValidCity(city: string) {
  const normalized = city.trim().toLowerCase();
  return UP_CITIES.some((c) => c.toLowerCase() === normalized);
}

function isValidPincode(pin: string) {
  return /^[0-9]{6}$/.test(pin.trim());
}

export default function BookPage() {
  const [step, setStep] = useState<StepId>(1);
  const [initialServiceKey, setInitialServiceKey] = useState<ServiceKey | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId]
  );

  const [inlineHouseFlat, setInlineHouseFlat] = useState('');
  const [inlineArea, setInlineArea] = useState('');
  const [inlineCity, setInlineCity] = useState('');
  const [inlinePincode, setInlinePincode] = useState('');
  const [inlineLandmark, setInlineLandmark] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [serviceKey, setServiceKey] = useState<ServiceKey | null>(null);
  const serviceDef = useMemo(
    () => SERVICE_DEFS.find((s) => s.key === serviceKey) ?? null,
    [serviceKey]
  );

  const [subOptionKey, setSubOptionKey] = useState<string | null>(null);

  const [datePills, setDatePills] = useState<DatePill[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [selectedTimeKey, setSelectedTimeKey] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);

  const selectedTime = useMemo(() => BASE_TIME_SLOTS.find((t) => t.key === selectedTimeKey) ?? null, [
    selectedTimeKey,
  ]);

  const canContinueAddress = useMemo(() => {
    return !!selectedAddress;
  }, [selectedAddress]);

  const canContinueService = useMemo(() => {
    if (!serviceDef) return false;
    const subs = serviceDef.subOptions ?? [];
    if (subs.length === 0) return !!serviceKey;
    return !!subOptionKey;
  }, [serviceDef, serviceKey, subOptionKey]);

  const canContinueTime = useMemo(() => {
    return !!selectedDate && !!selectedTimeKey;
  }, [selectedDate, selectedTimeKey]);

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [bookingCreatedAt, setBookingCreatedAt] = useState<number | null>(null);

  const [confettiDone, setConfettiDone] = useState(false);

  const bookingBasePrice = useMemo(() => {
    if (!serviceDef) return 0;
    const subDelta =
      (serviceDef.subOptions ?? []).find((s) => s.key === subOptionKey)?.priceDelta ?? 0;
    return serviceDef.fromPrice + subDelta;
  }, [serviceDef, subOptionKey]);

  const price = useMemo(() => calcPrice(bookingBasePrice, emergency), [bookingBasePrice, emergency]);

  // Stepper UI
  const STEPS = useMemo(
    () =>
      [
        { id: 1 as StepId, label: 'Address' },
        { id: 2 as StepId, label: 'Service' },
        { id: 3 as StepId, label: 'Date & Time' },
        { id: 4 as StepId, label: 'Review' },
        { id: 5 as StepId, label: 'Done' },
      ] as const,
    []
  );

  // Load date pills + addresses from localStorage
  useEffect(() => {
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const todayDay = now.getDay(); // 0=Sun

    const next7: DatePill[] = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      const date = d.getDate();
      const label = i === 0 ? 'Today' : `${day} ${date}`;
      const disabled = iso < todayISO;
      return { isoDate: iso, label, disabled };
    });

    setDatePills(next7);
    setSelectedDate((prev) => prev ?? next7[0]?.isoDate ?? null);

    const saved = safeParseJSON<Address[]>(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ADDRESSES_KEY) : null);
    const list = Array.isArray(saved) ? saved : [];
    setAddresses(list);
    const defaultAddr = list.find((a) => a.isDefault) ?? list[0] ?? null;
    setSelectedAddressId(defaultAddr?.id ?? null);
  }, []);

  // Read ?service=... from URL (client-only) for preselection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get('service');
    if (!raw) return;
    const key = raw.toString() as ServiceKey;
    const exists = SERVICE_DEFS.some((s) => s.key === key);
    if (exists) setInitialServiceKey(key);
  }, []);

  // Pre-select service from query param
  useEffect(() => {
    if (!initialServiceKey) return;
    const exists = SERVICE_DEFS.some((s) => s.key === initialServiceKey);
    if (!exists) return;
    setServiceKey(initialServiceKey);
    const subs = SERVICE_DEFS.find((s) => s.key === initialServiceKey)?.subOptions ?? [];
    if (subs.length > 0) {
      setSubOptionKey(subs[0].key);
    } else {
      setSubOptionKey(null);
    }
  }, [initialServiceKey]);

  useEffect(() => {
    // If service changes, reset suboption if incompatible.
    if (!serviceDef) return;
    const subs = serviceDef.subOptions ?? [];
    if (subs.length === 0) {
      setSubOptionKey(null);
      return;
    }
    if (subOptionKey && subs.some((s) => s.key === subOptionKey)) return;
    setSubOptionKey(subs[0]?.key ?? null);
  }, [serviceDef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist address adds to localStorage
  const persistAddresses = (next: Address[]) => {
    setAddresses(next);
    try {
      localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
    } catch {
      // ignore write errors; user can continue in-memory
    }
  };

  const onSaveAndUseInline = () => {
    setInlineError(null);
    const cityOk = isValidCity(inlineCity);
    const pinOk = isValidPincode(inlinePincode);
    if (!cityOk || !pinOk) {
      setInlineError('City and Pincode are required (6-digit PIN).');
      return;
    }
    if (!inlineHouseFlat.trim() || !inlineArea.trim()) {
      setInlineError('Please fill House/Flat No and Area.');
      return;
    }

    const now = Date.now();
    const newAddr: Address = {
      id: `addr_${now}_${Math.random().toString(16).slice(2)}`,
      houseFlat: inlineHouseFlat.trim(),
      area: inlineArea.trim(),
      city: inlineCity.trim(),
      pincode: inlinePincode.trim(),
      landmark: inlineLandmark.trim() ? inlineLandmark.trim() : undefined,
      label: 'Saved address',
      createdAt: now,
      isDefault: addresses.length === 0,
    };

    const nextList = [newAddr, ...addresses].map((a) => ({ ...a }));
    if (newAddr.isDefault) {
      for (const a of nextList) {
        a.isDefault = a.id === newAddr.id;
      }
    }
    persistAddresses(nextList);
    setSelectedAddressId(newAddr.id);
    toast.success('Address saved.');
    setStep(2);
  };

  const handleConfirmBooking = async () => {
    // gating
    if (!serviceDef || !selectedAddress || !selectedDate || !selectedTimeKey || !subOptionKey) return;
    if (!termsAccepted) return;

    const oid = makeOrderId();
    const now = Date.now();
    const order = {
      id: oid,
      status: 'PENDING',
      createdAt: now,
      serviceKey,
      subOptionKey,
      address: selectedAddress,
      scheduledDate: selectedDate,
      timeKey: selectedTimeKey,
      emergency,
      total: price.total,
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
    };

    try {
      const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
      const list = safeParseJSON<any[]>(raw) ?? [];
      const next = [order, ...list].slice(0, 30);
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
    } catch {
      // ignore; we still show success
    }

    setOrderId(oid);
    setBookingCreatedAt(now);
    toast.success('Booking confirmed!');
    setStep(5);
  };

  // Confetti on success
  useEffect(() => {
    if (step !== 5) return;
    if (confettiDone) return;
    setConfettiDone(true);

    try {
      const duration = 2200;
      const end = Date.now() + duration;

      const colors = ['#0D9B6C', '#38BDF8', '#ffffff', '#086D4C'];
      (function frame() {
        confetti({
          particleCount: 6,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 6,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    } catch {
      // ignore
    }
  }, [step, confettiDone]);

  const STEPPER = (
    <div className="mb-8">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-slate-200/70 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0D9B6C] rounded-full transition-all"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
        <div className="text-sm font-semibold text-[#0F1C18]">
          Step {step} of 5
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {STEPS.map((s, idx) => {
          const isDone = s.id < step;
          const isActive = s.id === step;
          return (
            <div key={s.id} className="text-center">
              <div
                className={[
                  'mx-auto w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                  isDone
                    ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white'
                    : isActive
                      ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white'
                      : 'bg-white border-slate-200 text-slate-400',
                ].join(' ')}
              >
                {isDone ? '✓' : s.id}
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-600">
                {s.label}
              </div>
              {idx < 4 && (
                <div className="sr-only">
                  connector
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const savedHasAny = addresses.length > 0;

  const currentAddressLabel = selectedAddress
    ? `${selectedAddress.houseFlat}, ${selectedAddress.area} • ${selectedAddress.city} (${selectedAddress.pincode})`
    : '';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F1C18]">
              Book a Service
            </h1>
            <p className="text-slate-600 mt-1">AuroWater checkout • 5 steps</p>
          </div>
          <Link href="/services" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[#0D9B6C] hover:underline">
            Browse services →
          </Link>
        </div>

        {STEPperForAccessibility(STEPPER)}

        {/* Step 1 */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F1C18]">Step 1 — Choose Address</h2>
                  <p className="text-slate-600 mt-1">Pick a saved address or add a new one.</p>
                </div>
                <Link href="/addresses" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-[#0D9B6C] text-[#0D9B6C] font-semibold hover:bg-[#E8F8F2] transition-colors">
                  Manage Addresses
                </Link>
              </div>

              {addressError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                  {addressError}
                </div>
              )}

              {savedHasAny && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-slate-700">Saved addresses</p>
                  </div>
                  <div className="space-y-3 mb-6">
                    {addresses.map((a) => {
                      const active = a.id === selectedAddressId;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setAddressError(null);
                            setSelectedAddressId(a.id);
                          }}
                          className={[
                            'w-full text-left rounded-2xl border p-4 transition-all',
                            active ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-200 hover:border-slate-300 bg-white',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-[#0F1C18]">
                                  {a.label || 'Address'}
                                </span>
                                {a.isDefault && (
                                  <span className="text-xs font-semibold bg-[#0D9B6C] text-white px-2 py-1 rounded-full">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-600 mt-1">
                                {a.houseFlat}, {a.area}
                              </div>
                              <div className="text-sm text-slate-600 mt-1">
                                {a.city} • {a.pincode}
                              </div>
                            </div>
                            <div className={active ? 'text-[#0D9B6C] font-extrabold' : 'text-slate-300'}>
                              {active ? '✓' : '○'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Inline form always visible */}
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-700">Add New Address</p>
                <p className="text-xs text-slate-500 mt-1">City and Pincode are required.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-xs font-semibold text-slate-600">House/Flat No</label>
                  <input
                    value={inlineHouseFlat}
                    onChange={(e) => setInlineHouseFlat(e.target.value)}
                    className={[
                      'w-full rounded-xl border px-3 py-2 text-sm mt-1',
                      inlineHouseFlat.trim() ? 'border-slate-200' : 'border-slate-200',
                    ].join(' ')}
                    placeholder="House 12 / Flat B"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Area</label>
                  <input
                    value={inlineArea}
                    onChange={(e) => setInlineArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mt-1"
                    placeholder="Sector 3 / Near Market"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">City</label>
                  <select
                    value={inlineCity}
                    onChange={(e) => setInlineCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mt-1"
                  >
                    <option value="">Select City</option>
                    {UP_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Pincode</label>
                  <input
                    value={inlinePincode}
                    onChange={(e) => setInlinePincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={[
                      'w-full rounded-xl border px-3 py-2 text-sm mt-1',
                      inlinePincode.trim().length > 0 && !isValidPincode(inlinePincode) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
                    ].join(' ')}
                    placeholder="208001"
                    inputMode="numeric"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Landmark (optional)</label>
                  <input
                    value={inlineLandmark}
                    onChange={(e) => setInlineLandmark(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mt-1"
                    placeholder="Near XYZ Temple"
                  />
                </div>
              </div>

              {inlineError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
                  {inlineError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Validate selection gating for continue.
                    if (!selectedAddressId) {
                      setAddressError('No address found. Add address to continue');
                      return;
                    }
                    setAddressError(null);
                    setStep(2);
                  }}
                  disabled={!canContinueAddress}
                  className={[
                    'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
                    canContinueAddress ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={onSaveAndUseInline}
                  className="flex-1 rounded-xl border-2 border-[#0D9B6C] text-[#0D9B6C] px-6 py-3 font-bold hover:bg-[#E8F8F2] transition-colors"
                >
                  Save & Use
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2 */}
        {step === 2 && serviceDef && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F1C18]">Step 2 — Choose Service</h2>
                  <p className="text-slate-600 mt-1">Pick a category, then choose the exact option.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                {SERVICE_DEFS.map((s) => {
                  const active = s.key === serviceKey;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setServiceKey(s.key);
                        setSubOptionKey(s.subOptions?.[0]?.key ?? null);
                      }}
                      className={[
                        'rounded-2xl border p-4 text-left transition-all',
                        active ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-200 hover:border-slate-300 bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-2xl bg-[#E8F8F2] flex items-center justify-center text-2xl">
                              {s.emoji}
                            </div>
                            <div className="font-extrabold text-[#0F1C18] leading-tight">{s.title}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-2">{s.description}</div>
                          <div className="mt-3 text-sm font-bold text-[#0D9B6C]">
                            From ₹{s.fromPrice}
                          </div>
                        </div>
                        <div className={active ? 'text-[#0D9B6C] font-extrabold' : 'text-slate-300'}>{active ? '✓' : ''}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700 mb-2">
                  Sub-option for {serviceDef.title}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(serviceDef.subOptions ?? []).map((opt) => {
                    const active = opt.key === subOptionKey;
                    return (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setSubOptionKey(opt.key)}
                        className={[
                          'px-3 py-2 rounded-xl border text-sm font-semibold transition-colors',
                          active ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white' : 'border-slate-200 bg-white hover:bg-white',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {!canContinueService && (
                  <p className="mt-3 text-xs text-slate-600">
                    Choose a sub-option to continue.
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canContinueService}
                  onClick={() => setStep(3)}
                  className={[
                    'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
                    canContinueService ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  Continue
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2 fallback when serviceDef null */}
        {step === 2 && !serviceDef && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <h2 className="text-xl font-bold text-[#0F1C18]">Step 2 — Choose Service</h2>
              <p className="text-slate-600 mt-2">Please go back and select an address first.</p>
              <div className="mt-4">
                <button type="button" onClick={() => setStep(1)} className="rounded-xl px-6 py-3 bg-[#0D9B6C] text-white font-bold hover:bg-[#086D4C] transition-colors">
                  Back to Step 1
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3 */}
        {step === 3 && serviceDef && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F1C18]">Step 3 — Date & Time</h2>
                  <p className="text-slate-600 mt-1">Choose a date and time slot. Emergency is optional.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Pick a date</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {datePills.map((d) => {
                    const active = selectedDate === d.isoDate;
                    return (
                      <button
                        key={d.isoDate}
                        type="button"
                        disabled={d.disabled}
                        onClick={() => setSelectedDate(d.isoDate)}
                        className={[
                          'min-w-20 px-3 py-2 rounded-2xl border text-sm font-bold transition-colors',
                          active
                            ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white'
                            : 'border-slate-200 bg-white hover:bg-slate-50',
                          d.disabled ? 'opacity-40 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Time slots</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {BASE_TIME_SLOTS.map((slot) => {
                    const active = selectedTimeKey === slot.key && !emergency;
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        onClick={() => {
                          setEmergency(false);
                          setSelectedTimeKey(slot.key);
                        }}
                        className={[
                          'rounded-2xl border p-4 text-left transition-all',
                          active
                            ? 'border-[#0D9B6C] bg-[#E8F8F2]'
                            : 'border-slate-200 hover:border-slate-300 bg-white',
                        ].join(' ')}
                      >
                        <div className="font-extrabold text-[#0F1C18] text-sm">{slot.label.split('•')[0].trim()}</div>
                        <div className="text-xs text-slate-600 mt-1">{slot.label.includes('•') ? slot.label.split('•')[1].trim() : slot.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEmergency(true);
                  // keep the same time selection if exists, else default to morning
                  if (!selectedTimeKey) setSelectedTimeKey('morning');
                }}
                className={[
                  'w-full rounded-2xl border p-4 text-left transition-all',
                  emergency ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300 bg-white',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-red-600 font-extrabold">Emergency</span>
                      <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                        +₹{EMERGENCY_SURCHARGE}
                      </span>
                    </span>
                    <div className="text-xs text-slate-600 mt-1">
                      Priority scheduling (subject to availability).
                    </div>
                  </div>
                  <div className={emergency ? 'text-red-600 font-extrabold' : 'text-slate-300'}>
                    {emergency ? '✓' : '○'}
                  </div>
                </div>
              </button>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canContinueTime}
                  onClick={() => setStep(4)}
                  className={[
                    'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
                    canContinueTime ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  Continue
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 4 */}
        {step === 4 && serviceDef && selectedAddress && selectedDate && selectedTimeKey && subOptionKey && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F1C18]">Step 4 — Review & Confirm</h2>
                  <p className="text-slate-600 mt-1">Double-check everything before placing your booking.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-sm font-bold text-slate-800">Address</div>
                    <button type="button" onClick={() => setStep(1)} className="text-sm font-bold text-[#0D9B6C] hover:underline">
                      Edit
                    </button>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{currentAddressLabel}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-sm font-bold text-slate-800">Service</div>
                    <button type="button" onClick={() => setStep(2)} className="text-sm font-bold text-[#0D9B6C] hover:underline">
                      Edit
                    </button>
                  </div>
                  <div className="text-sm font-bold text-[#0F1C18]">{serviceDef.title}</div>
                  <div className="text-sm text-slate-700 mt-1">
                    {serviceDef.subOptions?.find((s) => s.key === subOptionKey)?.label}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-sm font-bold text-slate-800">Schedule</div>
                    <button type="button" onClick={() => setStep(3)} className="text-sm font-bold text-[#0D9B6C] hover:underline">
                      Edit
                    </button>
                  </div>
                  <div className="text-sm text-slate-700">
                    {selectedDate} • {selectedTime?.label ?? ''}
                  </div>
                  {emergency && (
                    <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                      Emergency +₹{EMERGENCY_SURCHARGE}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <div className="text-sm font-bold text-slate-800 mb-2">Payment</div>
                  <div className="text-sm text-slate-700">Cash on service (enabled)</div>
                  <div className="text-xs text-slate-500 mt-1">Pay Online is coming soon.</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 mb-4">
                <div className="text-sm font-bold text-slate-800 mb-3">Price Preview</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 text-slate-600">Base price</td>
                        <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.base)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-600">Convenience fee</td>
                        <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.convenience)}</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-slate-600">GST ({GST_PERCENT}%)</td>
                        <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.gst)}</td>
                      </tr>
                      {price.emergencyExtra > 0 && (
                        <tr>
                          <td className="py-2 text-slate-600">Emergency surcharge</td>
                          <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.emergencyExtra)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="pt-3 text-slate-800 font-extrabold">Total</td>
                        <td className="pt-3 text-right text-slate-800 font-extrabold">
                          {formatMoney(price.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 mb-4">
                <div className="text-sm font-bold text-slate-800 mb-3">Payment method</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="rounded-2xl border border-[#0D9B6C] bg-[#E8F8F2] p-4 cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-[#0F1C18]">💵 Cash on Service</div>
                        <div className="text-xs text-slate-600 mt-1">Pay at your doorstep.</div>
                      </div>
                      <input type="radio" checked readOnly className="accent-[#0D9B6C]" />
                    </div>
                  </label>
                  <label
                    className="rounded-2xl border border-slate-200 bg-white p-4 cursor-not-allowed opacity-60"
                    aria-disabled="true"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-[#0F1C18]">📱 Pay Online (Razorpay - coming soon)</div>
                        <div className="text-xs text-slate-600 mt-1">Coming soon. Currently disabled.</div>
                      </div>
                      <input type="radio" disabled className="accent-[#0D9B6C]" />
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 mb-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 accent-[#0D9B6C]"
                  />
                  <span className="text-sm text-slate-700">
                    I agree to <span className="font-bold">AuroWater Terms of Service</span>.
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
                >
                  Edit schedule
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={!termsAccepted}
                  className={[
                    'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
                    termsAccepted ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
                  ].join(' ')}
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 5 */}
        {step === 5 && orderId && bookingCreatedAt && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F1C18]">Booking Confirmed!</h2>
                  <p className="text-slate-600 mt-1">We’ll assign the team shortly.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // keep address/service selections as draft for quick rebook
                    setStep(2);
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back to Step 2
                </button>
              </div>

              <div className="flex flex-col items-center text-center py-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="w-20 h-20 rounded-full bg-[#E8F8F2] border border-[#0D9B6C] flex items-center justify-center"
                >
                  <span className="text-4xl">✓</span>
                </motion.div>
                <h3 className="mt-5 text-2xl sm:text-3xl font-extrabold text-[#0D9B6C]">Success</h3>
                <p className="text-slate-600 mt-2">
                  Order ID: <span className="font-extrabold text-[#0F1C18]">{orderId}</span>
                </p>
                <p className="text-slate-600 mt-1">
                  Assigned: <span className="font-bold">We&apos;ll assign shortly</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
                <div className="text-sm font-bold text-slate-800 mb-2">Recap</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedAddress ? `${selectedAddress.houseFlat}, ${selectedAddress.area}` : ''} •{' '}
                  {selectedAddress ? `${selectedAddress.city} (${selectedAddress.pincode})` : ''}
                  {'\n'}
                  {serviceDef ? serviceDef.title : ''}{' '}
                  {serviceDef?.subOptions?.find((s) => s.key === subOptionKey)?.label ? `• ${serviceDef?.subOptions?.find((s) => s.key === subOptionKey)?.label}` : ''}
                  {'\n'}
                  {selectedDate} • {selectedTime?.label}
                  {emergency ? `\nEmergency +₹${EMERGENCY_SURCHARGE}` : ''}
                  {'\n'}
                  Total: {formatMoney(price.total)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // public tracking via localStorage-backed page
                    window.location.href = `/customer/track/${orderId}`;
                  }}
                  className="rounded-xl px-6 py-3 bg-[#0D9B6C] text-white font-bold hover:bg-[#086D4C] transition-colors"
                >
                  Track in Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // reset to Step 2 with service untouched if already selected
                    setStep(2);
                  }}
                  className="rounded-xl px-6 py-3 border-2 border-[#0D9B6C] text-[#0D9B6C] font-bold hover:bg-[#E8F8F2] transition-colors"
                >
                  Book Another Service
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 5 && !orderId && (
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
            <p className="text-slate-700">Booking complete.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function STEPperForAccessibility(reactNode: React.ReactNode) {
  // Tiny helper so TS doesn’t complain about JSX element naming.
  return <>{reactNode}</>;
}

