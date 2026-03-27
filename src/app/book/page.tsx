// 'use client';

// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { motion } from 'framer-motion';
// import confetti from 'canvas-confetti';
// import { toast } from 'sonner';

// type StepId = 1 | 2 | 3 | 4 | 5;

// type Address = {
//   id: string;
//   houseFlat: string;
//   area: string;
//   city: string;
//   pincode: string;
//   landmark?: string;
//   label?: string;
//   createdAt: number;
//   isDefault?: boolean;
// };

// type ServiceKey =
//   | 'water_tanker'
//   | 'ro_service'
//   | 'plumbing'
//   | 'borewell'
//   | 'motor_pump'
//   | 'tank_cleaning';

// type ServiceDef = {
//   key: ServiceKey;
//   emoji: string;
//   title: string;
//   fromPrice: number;
//   description: string;
//   subOptions?: { key: string; label: string; priceDelta?: number }[];
// };

// type DatePill = {
//   isoDate: string; // YYYY-MM-DD
//   label: string;
//   disabled: boolean;
// };

// type TimeSlot = {
//   key: string;
//   label: string;
//   start: string;
//   end: string;
//   // reserved for later modifiers; spec wants optional emergency modifier
//   emergency?: boolean;
// };

// const STORAGE_ADDRESSES_KEY = 'aurowater_addresses';
// const STORAGE_ORDERS_KEY = 'aurowater_orders';

// const CONVENIENCE_FEE = 29;
// const GST_PERCENT = 18;
// const EMERGENCY_SURCHARGE = 199;

// const UP_CITIES = [
//   'Kanpur',
//   'Gorakhpur',
//   'Lucknow',
//   'Varanasi',
//   'Prayagraj',
//   'Agra',
//   'Meerut',
//   'Bareilly',
//   'Aligarh',
//   'Mathura',
//   'Delhi',
//   'Noida',
//   'Ghaziabad',
// ] as const;

// const SERVICE_DEFS: ServiceDef[] = [
//   {
//     key: 'water_tanker',
//     emoji: '💧',
//     title: 'Water Tanker Delivery',
//     fromPrice: 299,
//     description: 'Fresh tanker delivery with reliable scheduling.',
//     subOptions: [{ key: 'standard', label: 'Standard delivery' }],
//   },
//   {
//     key: 'ro_service',
//     emoji: '🔧',
//     title: 'RO Service & Repair',
//     fromPrice: 199,
//     description: 'AMC, one-time repairs, filter changes.',
//     subOptions: [
//       { key: 'amc', label: 'AMC (Annual Maintenance)', priceDelta: 0 },
//       { key: 'repair', label: 'One-time repair', priceDelta: 0 },
//       { key: 'filter', label: 'Filter change', priceDelta: 0 },
//     ],
//   },
//   {
//     key: 'plumbing',
//     emoji: '🪠',
//     title: 'Plumbing Services',
//     fromPrice: 149,
//     description: 'Fittings, boring/repair, leak fixes and more.',
//     subOptions: [
//       { key: 'fitting', label: 'Fittings & repair' },
//       { key: 'leak', label: 'Leak fixing' },
//       { key: 'pump', label: 'Pump repair' },
//     ],
//   },
//   {
//     key: 'borewell',
//     emoji: '⛏️',
//     title: 'Borewell Services',
//     fromPrice: 499,
//     description: 'Borewell maintenance, installation and repairs.',
//     subOptions: [
//       { key: 'repair', label: 'Borewell repair' },
//       { key: 'installation', label: 'Installation' },
//       { key: 'boring', label: 'Boring' },
//     ],
//   },
//   {
//     key: 'motor_pump',
//     emoji: '⚙️',
//     title: 'Motor Pump Repair',
//     fromPrice: 249,
//     description: 'Motor/pump servicing with transparent pricing.',
//     subOptions: [
//       { key: 'service', label: 'Motor servicing' },
//       { key: 'repair', label: 'Motor repair' },
//       { key: 'pump', label: 'Pump check & repair' },
//     ],
//   },
//   {
//     key: 'tank_cleaning',
//     emoji: '🪣',
//     title: 'Water Tank Cleaning',
//     fromPrice: 349,
//     description: 'Deep clean and hygiene-first tank sanitation.',
//     subOptions: [
//       { key: 'clean', label: 'Tank cleaning' },
//       { key: 'sanitise', label: 'Sanitization' },
//     ],
//   },
// ];

// const BASE_TIME_SLOTS: TimeSlot[] = [
//   { key: 'morning', label: 'Morning • 8:00 AM – 12:00 PM', start: '08:00', end: '12:00' },
//   { key: 'afternoon', label: 'Afternoon • 12:00 PM – 5:00 PM', start: '12:00', end: '17:00' },
//   { key: 'evening', label: 'Evening • 5:00 PM – 8:00 PM', start: '17:00', end: '20:00' },
// ];

// function safeParseJSON<T>(raw: string | null): T | null {
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw) as T;
//   } catch {
//     return null;
//   }
// }

// function makeOrderId() {
//   const n = Math.floor(10000000 + Math.random() * 90000000); // 8 digits
//   return `AW-${n}`;
// }

// function formatMoney(n: number) {
//   const val = Number.isFinite(n) ? n : 0;
//   return `₹${Math.round(val).toLocaleString('en-IN')}`;
// }

// function calcPrice(base: number, emergency: boolean) {
//   const convenience = CONVENIENCE_FEE;
//   const emergencyExtra = emergency ? EMERGENCY_SURCHARGE : 0;
//   const taxable = base + convenience + emergencyExtra;
//   const gst = Math.round((taxable * GST_PERCENT) / 100);
//   const total = base + convenience + emergencyExtra + gst;
//   return { base, convenience, emergencyExtra, gst, total };
// }

// function isValidCity(city: string) {
//   const normalized = city.trim().toLowerCase();
//   return UP_CITIES.some((c) => c.toLowerCase() === normalized);
// }

// function isValidPincode(pin: string) {
//   return /^[0-9]{6}$/.test(pin.trim());
// }

// export default function BookPage() {
//   const [step, setStep] = useState<StepId>(1);
//   const [initialServiceKey, setInitialServiceKey] = useState<ServiceKey | null>(null);

//   const [addresses, setAddresses] = useState<Address[]>([]);
//   const [addressError, setAddressError] = useState<string | null>(null);

//   const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
//   const selectedAddress = useMemo(
//     () => addresses.find((a) => a.id === selectedAddressId) ?? null,
//     [addresses, selectedAddressId]
//   );

//   const [inlineHouseFlat, setInlineHouseFlat] = useState('');
//   const [inlineArea, setInlineArea] = useState('');
//   const [inlineCity, setInlineCity] = useState('');
//   const [inlinePincode, setInlinePincode] = useState('');
//   const [inlineLandmark, setInlineLandmark] = useState('');
//   const [inlineError, setInlineError] = useState<string | null>(null);

//   const [serviceKey, setServiceKey] = useState<ServiceKey | null>(null);
//   const serviceDef = useMemo(
//     () => SERVICE_DEFS.find((s) => s.key === serviceKey) ?? null,
//     [serviceKey]
//   );

//   const [subOptionKey, setSubOptionKey] = useState<string | null>(null);

//   const [datePills, setDatePills] = useState<DatePill[]>([]);
//   const [selectedDate, setSelectedDate] = useState<string | null>(null);

//   const [selectedTimeKey, setSelectedTimeKey] = useState<string | null>(null);
//   const [emergency, setEmergency] = useState(false);

//   const selectedTime = useMemo(() => BASE_TIME_SLOTS.find((t) => t.key === selectedTimeKey) ?? null, [
//     selectedTimeKey,
//   ]);

//   const canContinueAddress = useMemo(() => {
//     return !!selectedAddress;
//   }, [selectedAddress]);

//   const canContinueService = useMemo(() => {
//     if (!serviceDef) return false;
//     const subs = serviceDef.subOptions ?? [];
//     if (subs.length === 0) return !!serviceKey;
//     return !!subOptionKey;
//   }, [serviceDef, serviceKey, subOptionKey]);

//   const canContinueTime = useMemo(() => {
//     return !!selectedDate && !!selectedTimeKey;
//   }, [selectedDate, selectedTimeKey]);

//   const [termsAccepted, setTermsAccepted] = useState(false);

//   const [orderId, setOrderId] = useState<string | null>(null);
//   const [bookingCreatedAt, setBookingCreatedAt] = useState<number | null>(null);

//   const [confettiDone, setConfettiDone] = useState(false);

//   const bookingBasePrice = useMemo(() => {
//     if (!serviceDef) return 0;
//     const subDelta =
//       (serviceDef.subOptions ?? []).find((s) => s.key === subOptionKey)?.priceDelta ?? 0;
//     return serviceDef.fromPrice + subDelta;
//   }, [serviceDef, subOptionKey]);

//   const price = useMemo(() => calcPrice(bookingBasePrice, emergency), [bookingBasePrice, emergency]);

//   // Stepper UI
//   const STEPS = useMemo(
//     () =>
//       [
//         { id: 1 as StepId, label: 'Address' },
//         { id: 2 as StepId, label: 'Service' },
//         { id: 3 as StepId, label: 'Date & Time' },
//         { id: 4 as StepId, label: 'Review' },
//         { id: 5 as StepId, label: 'Done' },
//       ] as const,
//     []
//   );

//   // Load date pills + addresses from localStorage
//   useEffect(() => {
//     const now = new Date();
//     const todayISO = now.toISOString().slice(0, 10);
//     const todayDay = now.getDay(); // 0=Sun

//     const next7: DatePill[] = Array.from({ length: 7 }).map((_, i) => {
//       const d = new Date();
//       d.setDate(now.getDate() + i);
//       const iso = d.toISOString().slice(0, 10);
//       const day = d.toLocaleDateString('en-US', { weekday: 'short' });
//       const date = d.getDate();
//       const label = i === 0 ? 'Today' : `${day} ${date}`;
//       const disabled = iso < todayISO;
//       return { isoDate: iso, label, disabled };
//     });

//     setDatePills(next7);
//     setSelectedDate((prev) => prev ?? next7[0]?.isoDate ?? null);

//     const saved = safeParseJSON<Address[]>(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ADDRESSES_KEY) : null);
//     const list = Array.isArray(saved) ? saved : [];
//     setAddresses(list);
//     const defaultAddr = list.find((a) => a.isDefault) ?? list[0] ?? null;
//     setSelectedAddressId(defaultAddr?.id ?? null);
//   }, []);

//   // Read ?service=... from URL (client-only) for preselection
//   useEffect(() => {
//     if (typeof window === 'undefined') return;
//     const sp = new URLSearchParams(window.location.search);
//     const raw = sp.get('service');
//     if (!raw) return;
//     const key = raw.toString() as ServiceKey;
//     const exists = SERVICE_DEFS.some((s) => s.key === key);
//     if (exists) setInitialServiceKey(key);
//   }, []);

//   // Pre-select service from query param
//   useEffect(() => {
//     if (!initialServiceKey) return;
//     const exists = SERVICE_DEFS.some((s) => s.key === initialServiceKey);
//     if (!exists) return;
//     setServiceKey(initialServiceKey);
//     const subs = SERVICE_DEFS.find((s) => s.key === initialServiceKey)?.subOptions ?? [];
//     if (subs.length > 0) {
//       setSubOptionKey(subs[0].key);
//     } else {
//       setSubOptionKey(null);
//     }
//   }, [initialServiceKey]);

//   useEffect(() => {
//     // If service changes, reset suboption if incompatible.
//     if (!serviceDef) return;
//     const subs = serviceDef.subOptions ?? [];
//     if (subs.length === 0) {
//       setSubOptionKey(null);
//       return;
//     }
//     if (subOptionKey && subs.some((s) => s.key === subOptionKey)) return;
//     setSubOptionKey(subs[0]?.key ?? null);
//   }, [serviceDef]); // eslint-disable-line react-hooks/exhaustive-deps

//   // Persist address adds to localStorage
//   const persistAddresses = (next: Address[]) => {
//     setAddresses(next);
//     try {
//       localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
//     } catch {
//       // ignore write errors; user can continue in-memory
//     }
//   };

//   const onSaveAndUseInline = () => {
//     setInlineError(null);
//     const cityOk = isValidCity(inlineCity);
//     const pinOk = isValidPincode(inlinePincode);
//     if (!cityOk || !pinOk) {
//       setInlineError('City and Pincode are required (6-digit PIN).');
//       return;
//     }
//     if (!inlineHouseFlat.trim() || !inlineArea.trim()) {
//       setInlineError('Please fill House/Flat No and Area.');
//       return;
//     }

//     const now = Date.now();
//     const newAddr: Address = {
//       id: `addr_${now}_${Math.random().toString(16).slice(2)}`,
//       houseFlat: inlineHouseFlat.trim(),
//       area: inlineArea.trim(),
//       city: inlineCity.trim(),
//       pincode: inlinePincode.trim(),
//       landmark: inlineLandmark.trim() ? inlineLandmark.trim() : undefined,
//       label: 'Saved address',
//       createdAt: now,
//       isDefault: addresses.length === 0,
//     };

//     const nextList = [newAddr, ...addresses].map((a) => ({ ...a }));
//     if (newAddr.isDefault) {
//       for (const a of nextList) {
//         a.isDefault = a.id === newAddr.id;
//       }
//     }
//     persistAddresses(nextList);
//     setSelectedAddressId(newAddr.id);
//     toast.success('Address saved.');
//     setStep(2);
//   };

//   const handleConfirmBooking = async () => {
//     // gating
//     if (!serviceDef || !selectedAddress || !selectedDate || !selectedTimeKey || !subOptionKey) return;
//     if (!termsAccepted) return;

//     const oid = makeOrderId();
//     const now = Date.now();
//     const order = {
//       id: oid,
//       status: 'PENDING',
//       createdAt: now,
//       serviceKey,
//       subOptionKey,
//       address: selectedAddress,
//       scheduledDate: selectedDate,
//       timeKey: selectedTimeKey,
//       emergency,
//       total: price.total,
//       paymentMethod: 'cash',
//       paymentStatus: 'unpaid',
//     };

//     try {
//       const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
//       const list = safeParseJSON<any[]>(raw) ?? [];
//       const next = [order, ...list].slice(0, 30);
//       localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
//     } catch {
//       // ignore; we still show success
//     }

//     setOrderId(oid);
//     setBookingCreatedAt(now);
//     toast.success('Booking confirmed!');
//     setStep(5);
//   };

//   // Confetti on success
//   useEffect(() => {
//     if (step !== 5) return;
//     if (confettiDone) return;
//     setConfettiDone(true);

//     try {
//       const duration = 2200;
//       const end = Date.now() + duration;

//       const colors = ['#0D9B6C', '#38BDF8', '#ffffff', '#086D4C'];
//       (function frame() {
//         confetti({
//           particleCount: 6,
//           angle: 60,
//           spread: 55,
//           origin: { x: 0 },
//           colors,
//         });
//         confetti({
//           particleCount: 6,
//           angle: 120,
//           spread: 55,
//           origin: { x: 1 },
//           colors,
//         });
//         if (Date.now() < end) {
//           requestAnimationFrame(frame);
//         }
//       })();
//     } catch {
//       // ignore
//     }
//   }, [step, confettiDone]);

//   const STEPPER = (
//     <div className="mb-8">
//       <div className="flex items-center gap-4">
//         <div className="flex-1 h-2 bg-slate-200/70 rounded-full overflow-hidden">
//           <div
//             className="h-full bg-[#0D9B6C] rounded-full transition-all"
//             style={{ width: `${(step / 5) * 100}%` }}
//           />
//         </div>
//         <div className="text-sm font-semibold text-[#0F1C18]">
//           Step {step} of 5
//         </div>
//       </div>

//       <div className="mt-4 grid grid-cols-5 gap-2">
//         {STEPS.map((s, idx) => {
//           const isDone = s.id < step;
//           const isActive = s.id === step;
//           return (
//             <div key={s.id} className="text-center">
//               <div
//                 className={[
//                   'mx-auto w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
//                   isDone
//                     ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white'
//                     : isActive
//                       ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white'
//                       : 'bg-white border-slate-200 text-slate-400',
//                 ].join(' ')}
//               >
//                 {isDone ? '✓' : s.id}
//               </div>
//               <div className="mt-2 text-xs font-semibold text-slate-600">
//                 {s.label}
//               </div>
//               {idx < 4 && (
//                 <div className="sr-only">
//                   connector
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );

//   const savedHasAny = addresses.length > 0;

//   const currentAddressLabel = selectedAddress
//     ? `${selectedAddress.houseFlat}, ${selectedAddress.area} • ${selectedAddress.city} (${selectedAddress.pincode})`
//     : '';

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
//         <div className="mb-6 flex items-start justify-between gap-4">
//           <div>
//             <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F1C18]">
//               Book a Service
//             </h1>
//             <p className="text-slate-600 mt-1">AuroWater checkout • 5 steps</p>
//           </div>
//           <Link href="/services" className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[#0D9B6C] hover:underline">
//             Browse services →
//           </Link>
//         </div>

//         {STEPperForAccessibility(STEPPER)}

//         {/* Step 1 */}
//         {step === 1 && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
//             <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//               <div className="flex items-start justify-between gap-4 mb-6">
//                 <div>
//                   <h2 className="text-xl font-bold text-[#0F1C18]">Step 1 — Choose Address</h2>
//                   <p className="text-slate-600 mt-1">Pick a saved address or add a new one.</p>
//                 </div>
//                 <Link href="/addresses" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border-2 border-[#0D9B6C] text-[#0D9B6C] font-semibold hover:bg-[#E8F8F2] transition-colors">
//                   Manage Addresses
//                 </Link>
//               </div>

//               {addressError && (
//                 <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
//                   {addressError}
//                 </div>
//               )}

//               {savedHasAny && (
//                 <>
//                   <div className="mb-3">
//                     <p className="text-sm font-semibold text-slate-700">Saved addresses</p>
//                   </div>
//                   <div className="space-y-3 mb-6">
//                     {addresses.map((a) => {
//                       const active = a.id === selectedAddressId;
//                       return (
//                         <button
//                           key={a.id}
//                           type="button"
//                           onClick={() => {
//                             setAddressError(null);
//                             setSelectedAddressId(a.id);
//                           }}
//                           className={[
//                             'w-full text-left rounded-2xl border p-4 transition-all',
//                             active ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-200 hover:border-slate-300 bg-white',
//                           ].join(' ')}
//                         >
//                           <div className="flex items-start justify-between gap-4">
//                             <div>
//                               <div className="flex items-center gap-2">
//                                 <span className="font-extrabold text-[#0F1C18]">
//                                   {a.label || 'Address'}
//                                 </span>
//                                 {a.isDefault && (
//                                   <span className="text-xs font-semibold bg-[#0D9B6C] text-white px-2 py-1 rounded-full">
//                                     Default
//                                   </span>
//                                 )}
//                               </div>
//                               <div className="text-sm text-slate-600 mt-1">
//                                 {a.houseFlat}, {a.area}
//                               </div>
//                               <div className="text-sm text-slate-600 mt-1">
//                                 {a.city} • {a.pincode}
//                               </div>
//                             </div>
//                             <div className={active ? 'text-[#0D9B6C] font-extrabold' : 'text-slate-300'}>
//                               {active ? '✓' : '○'}
//                             </div>
//                           </div>
//                         </button>
//                       );
//                     })}
//                   </div>
//                 </>
//               )}

//               {/* Inline form always visible */}
//               <div className="mb-3">
//                 <p className="text-sm font-semibold text-slate-700">Add New Address</p>
//                 <p className="text-xs text-slate-500 mt-1">City and Pincode are required.</p>
//               </div>

//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
//                 <div>
//                   <label className="text-xs font-semibold text-slate-600">House/Flat No</label>
//                   <input
//                     value={inlineHouseFlat}
//                     onChange={(e) => setInlineHouseFlat(e.target.value)}
//                     className={[
//                       'w-full rounded-xl border px-3 py-2 text-sm mt-1',
//                       inlineHouseFlat.trim() ? 'border-slate-200' : 'border-slate-200',
//                     ].join(' ')}
//                     placeholder="House 12 / Flat B"
//                   />
//                 </div>
//                 <div>
//                   <label className="text-xs font-semibold text-slate-600">Area</label>
//                   <input
//                     value={inlineArea}
//                     onChange={(e) => setInlineArea(e.target.value)}
//                     className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mt-1"
//                     placeholder="Sector 3 / Near Market"
//                   />
//                 </div>
//                 <div>
//                   <label className="text-xs font-semibold text-slate-600">City</label>
//                   <select
//                     value={inlineCity}
//                     onChange={(e) => setInlineCity(e.target.value)}
//                     className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mt-1"
//                   >
//                     <option value="">Select City</option>
//                     {UP_CITIES.map((c) => (
//                       <option key={c} value={c}>
//                         {c}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <div>
//                   <label className="text-xs font-semibold text-slate-600">Pincode</label>
//                   <input
//                     value={inlinePincode}
//                     onChange={(e) => setInlinePincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
//                     className={[
//                       'w-full rounded-xl border px-3 py-2 text-sm mt-1',
//                       inlinePincode.trim().length > 0 && !isValidPincode(inlinePincode) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white',
//                     ].join(' ')}
//                     placeholder="208001"
//                     inputMode="numeric"
//                   />
//                 </div>
//                 <div className="sm:col-span-2">
//                   <label className="text-xs font-semibold text-slate-600">Landmark (optional)</label>
//                   <input
//                     value={inlineLandmark}
//                     onChange={(e) => setInlineLandmark(e.target.value)}
//                     className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mt-1"
//                     placeholder="Near XYZ Temple"
//                   />
//                 </div>
//               </div>

//               {inlineError && (
//                 <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
//                   {inlineError}
//                 </div>
//               )}

//               <div className="flex flex-col sm:flex-row gap-3">
//                 <button
//                   type="button"
//                   onClick={() => {
//                     // Validate selection gating for continue.
//                     if (!selectedAddressId) {
//                       setAddressError('No address found. Add address to continue');
//                       return;
//                     }
//                     setAddressError(null);
//                     setStep(2);
//                   }}
//                   disabled={!canContinueAddress}
//                   className={[
//                     'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
//                     canContinueAddress ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
//                   ].join(' ')}
//                 >
//                   Continue
//                 </button>
//                 <button
//                   type="button"
//                   onClick={onSaveAndUseInline}
//                   className="flex-1 rounded-xl border-2 border-[#0D9B6C] text-[#0D9B6C] px-6 py-3 font-bold hover:bg-[#E8F8F2] transition-colors"
//                 >
//                   Save & Use
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 2 */}
//         {step === 2 && serviceDef && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
//             <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//               <div className="flex items-start justify-between gap-4 mb-6">
//                 <div>
//                   <h2 className="text-xl font-bold text-[#0F1C18]">Step 2 — Choose Service</h2>
//                   <p className="text-slate-600 mt-1">Pick a category, then choose the exact option.</p>
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => setStep(1)}
//                   className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
//                 >
//                   Back
//                 </button>
//               </div>

//               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
//                 {SERVICE_DEFS.map((s) => {
//                   const active = s.key === serviceKey;
//                   return (
//                     <button
//                       key={s.key}
//                       type="button"
//                       onClick={() => {
//                         setServiceKey(s.key);
//                         setSubOptionKey(s.subOptions?.[0]?.key ?? null);
//                       }}
//                       className={[
//                         'rounded-2xl border p-4 text-left transition-all',
//                         active ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-200 hover:border-slate-300 bg-white',
//                       ].join(' ')}
//                     >
//                       <div className="flex items-start justify-between gap-4">
//                         <div>
//                           <div className="flex items-center gap-2">
//                             <div className="w-10 h-10 rounded-2xl bg-[#E8F8F2] flex items-center justify-center text-2xl">
//                               {s.emoji}
//                             </div>
//                             <div className="font-extrabold text-[#0F1C18] leading-tight">{s.title}</div>
//                           </div>
//                           <div className="text-xs text-slate-500 mt-2">{s.description}</div>
//                           <div className="mt-3 text-sm font-bold text-[#0D9B6C]">
//                             From ₹{s.fromPrice}
//                           </div>
//                         </div>
//                         <div className={active ? 'text-[#0D9B6C] font-extrabold' : 'text-slate-300'}>{active ? '✓' : ''}</div>
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>

//               <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
//                 <div className="text-sm font-semibold text-slate-700 mb-2">
//                   Sub-option for {serviceDef.title}
//                 </div>
//                 <div className="flex flex-wrap gap-2">
//                   {(serviceDef.subOptions ?? []).map((opt) => {
//                     const active = opt.key === subOptionKey;
//                     return (
//                       <button
//                         type="button"
//                         key={opt.key}
//                         onClick={() => setSubOptionKey(opt.key)}
//                         className={[
//                           'px-3 py-2 rounded-xl border text-sm font-semibold transition-colors',
//                           active ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white' : 'border-slate-200 bg-white hover:bg-white',
//                         ].join(' ')}
//                       >
//                         {opt.label}
//                       </button>
//                     );
//                   })}
//                 </div>
//                 {!canContinueService && (
//                   <p className="mt-3 text-xs text-slate-600">
//                     Choose a sub-option to continue.
//                   </p>
//                 )}
//               </div>

//               <div className="mt-6 flex flex-col sm:flex-row gap-3">
//                 <button
//                   type="button"
//                   onClick={() => setStep(1)}
//                   className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
//                 >
//                   Back
//                 </button>
//                 <button
//                   type="button"
//                   disabled={!canContinueService}
//                   onClick={() => setStep(3)}
//                   className={[
//                     'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
//                     canContinueService ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
//                   ].join(' ')}
//                 >
//                   Continue
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 2 fallback when serviceDef null */}
//         {step === 2 && !serviceDef && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
//             <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//               <h2 className="text-xl font-bold text-[#0F1C18]">Step 2 — Choose Service</h2>
//               <p className="text-slate-600 mt-2">Please go back and select an address first.</p>
//               <div className="mt-4">
//                 <button type="button" onClick={() => setStep(1)} className="rounded-xl px-6 py-3 bg-[#0D9B6C] text-white font-bold hover:bg-[#086D4C] transition-colors">
//                   Back to Step 1
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 3 */}
//         {step === 3 && serviceDef && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
//             <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//               <div className="flex items-start justify-between gap-4 mb-6">
//                 <div>
//                   <h2 className="text-xl font-bold text-[#0F1C18]">Step 3 — Date & Time</h2>
//                   <p className="text-slate-600 mt-1">Choose a date and time slot. Emergency is optional.</p>
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => setStep(2)}
//                   className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
//                 >
//                   Back
//                 </button>
//               </div>

//               <div className="mb-4">
//                 <p className="text-sm font-semibold text-slate-700 mb-2">Pick a date</p>
//                 <div className="flex gap-2 overflow-x-auto pb-1">
//                   {datePills.map((d) => {
//                     const active = selectedDate === d.isoDate;
//                     return (
//                       <button
//                         key={d.isoDate}
//                         type="button"
//                         disabled={d.disabled}
//                         onClick={() => setSelectedDate(d.isoDate)}
//                         className={[
//                           'min-w-20 px-3 py-2 rounded-2xl border text-sm font-bold transition-colors',
//                           active
//                             ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white'
//                             : 'border-slate-200 bg-white hover:bg-slate-50',
//                           d.disabled ? 'opacity-40 cursor-not-allowed' : '',
//                         ].join(' ')}
//                       >
//                         {d.label}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               <div className="mb-4">
//                 <p className="text-sm font-semibold text-slate-700 mb-3">Time slots</p>
//                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//                   {BASE_TIME_SLOTS.map((slot) => {
//                     const active = selectedTimeKey === slot.key && !emergency;
//                     return (
//                       <button
//                         key={slot.key}
//                         type="button"
//                         onClick={() => {
//                           setEmergency(false);
//                           setSelectedTimeKey(slot.key);
//                         }}
//                         className={[
//                           'rounded-2xl border p-4 text-left transition-all',
//                           active
//                             ? 'border-[#0D9B6C] bg-[#E8F8F2]'
//                             : 'border-slate-200 hover:border-slate-300 bg-white',
//                         ].join(' ')}
//                       >
//                         <div className="font-extrabold text-[#0F1C18] text-sm">{slot.label.split('•')[0].trim()}</div>
//                         <div className="text-xs text-slate-600 mt-1">{slot.label.includes('•') ? slot.label.split('•')[1].trim() : slot.label}</div>
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               <button
//                 type="button"
//                 onClick={() => {
//                   setEmergency(true);
//                   // keep the same time selection if exists, else default to morning
//                   if (!selectedTimeKey) setSelectedTimeKey('morning');
//                 }}
//                 className={[
//                   'w-full rounded-2xl border p-4 text-left transition-all',
//                   emergency ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300 bg-white',
//                 ].join(' ')}
//               >
//                 <div className="flex items-center justify-between gap-4">
//                   <div>
//                     <span className="inline-flex items-center gap-2">
//                       <span className="text-red-600 font-extrabold">Emergency</span>
//                       <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
//                         +₹{EMERGENCY_SURCHARGE}
//                       </span>
//                     </span>
//                     <div className="text-xs text-slate-600 mt-1">
//                       Priority scheduling (subject to availability).
//                     </div>
//                   </div>
//                   <div className={emergency ? 'text-red-600 font-extrabold' : 'text-slate-300'}>
//                     {emergency ? '✓' : '○'}
//                   </div>
//                 </div>
//               </button>

//               <div className="mt-6 flex flex-col sm:flex-row gap-3">
//                 <button
//                   type="button"
//                   onClick={() => setStep(2)}
//                   className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
//                 >
//                   Back
//                 </button>
//                 <button
//                   type="button"
//                   disabled={!canContinueTime}
//                   onClick={() => setStep(4)}
//                   className={[
//                     'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
//                     canContinueTime ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
//                   ].join(' ')}
//                 >
//                   Continue
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 4 */}
//         {step === 4 && serviceDef && selectedAddress && selectedDate && selectedTimeKey && subOptionKey && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
//             <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//               <div className="flex items-start justify-between gap-4 mb-6">
//                 <div>
//                   <h2 className="text-xl font-bold text-[#0F1C18]">Step 4 — Review & Confirm</h2>
//                   <p className="text-slate-600 mt-1">Double-check everything before placing your booking.</p>
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => setStep(3)}
//                   className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
//                 >
//                   Back
//                 </button>
//               </div>

//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
//                 <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
//                   <div className="flex items-center justify-between gap-3 mb-2">
//                     <div className="text-sm font-bold text-slate-800">Address</div>
//                     <button type="button" onClick={() => setStep(1)} className="text-sm font-bold text-[#0D9B6C] hover:underline">
//                       Edit
//                     </button>
//                   </div>
//                   <div className="text-sm text-slate-700 whitespace-pre-wrap">{currentAddressLabel}</div>
//                 </div>
//                 <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
//                   <div className="flex items-center justify-between gap-3 mb-2">
//                     <div className="text-sm font-bold text-slate-800">Service</div>
//                     <button type="button" onClick={() => setStep(2)} className="text-sm font-bold text-[#0D9B6C] hover:underline">
//                       Edit
//                     </button>
//                   </div>
//                   <div className="text-sm font-bold text-[#0F1C18]">{serviceDef.title}</div>
//                   <div className="text-sm text-slate-700 mt-1">
//                     {serviceDef.subOptions?.find((s) => s.key === subOptionKey)?.label}
//                   </div>
//                 </div>
//                 <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
//                   <div className="flex items-center justify-between gap-3 mb-2">
//                     <div className="text-sm font-bold text-slate-800">Schedule</div>
//                     <button type="button" onClick={() => setStep(3)} className="text-sm font-bold text-[#0D9B6C] hover:underline">
//                       Edit
//                     </button>
//                   </div>
//                   <div className="text-sm text-slate-700">
//                     {selectedDate} • {selectedTime?.label ?? ''}
//                   </div>
//                   {emergency && (
//                     <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
//                       Emergency +₹{EMERGENCY_SURCHARGE}
//                     </div>
//                   )}
//                 </div>
//                 <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
//                   <div className="text-sm font-bold text-slate-800 mb-2">Payment</div>
//                   <div className="text-sm text-slate-700">Cash on service (enabled)</div>
//                   <div className="text-xs text-slate-500 mt-1">Pay Online is coming soon.</div>
//                 </div>
//               </div>

//               <div className="rounded-2xl border border-slate-200 p-4 mb-4">
//                 <div className="text-sm font-bold text-slate-800 mb-3">Price Preview</div>
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-sm">
//                     <tbody className="divide-y divide-slate-100">
//                       <tr>
//                         <td className="py-2 text-slate-600">Base price</td>
//                         <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.base)}</td>
//                       </tr>
//                       <tr>
//                         <td className="py-2 text-slate-600">Convenience fee</td>
//                         <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.convenience)}</td>
//                       </tr>
//                       <tr>
//                         <td className="py-2 text-slate-600">GST ({GST_PERCENT}%)</td>
//                         <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.gst)}</td>
//                       </tr>
//                       {price.emergencyExtra > 0 && (
//                         <tr>
//                           <td className="py-2 text-slate-600">Emergency surcharge</td>
//                           <td className="py-2 text-right font-bold text-slate-800">{formatMoney(price.emergencyExtra)}</td>
//                         </tr>
//                       )}
//                     </tbody>
//                     <tfoot>
//                       <tr>
//                         <td className="pt-3 text-slate-800 font-extrabold">Total</td>
//                         <td className="pt-3 text-right text-slate-800 font-extrabold">
//                           {formatMoney(price.total)}
//                         </td>
//                       </tr>
//                     </tfoot>
//                   </table>
//                 </div>
//               </div>

//               <div className="rounded-2xl border border-slate-200 p-4 mb-4">
//                 <div className="text-sm font-bold text-slate-800 mb-3">Payment method</div>
//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                   <label className="rounded-2xl border border-[#0D9B6C] bg-[#E8F8F2] p-4 cursor-pointer">
//                     <div className="flex items-start justify-between gap-3">
//                       <div>
//                         <div className="font-extrabold text-[#0F1C18]">💵 Cash on Service</div>
//                         <div className="text-xs text-slate-600 mt-1">Pay at your doorstep.</div>
//                       </div>
//                       <input type="radio" checked readOnly className="accent-[#0D9B6C]" />
//                     </div>
//                   </label>
//                   <label
//                     className="rounded-2xl border border-slate-200 bg-white p-4 cursor-not-allowed opacity-60"
//                     aria-disabled="true"
//                   >
//                     <div className="flex items-start justify-between gap-3">
//                       <div>
//                         <div className="font-extrabold text-[#0F1C18]">📱 Pay Online (Razorpay - coming soon)</div>
//                         <div className="text-xs text-slate-600 mt-1">Coming soon. Currently disabled.</div>
//                       </div>
//                       <input type="radio" disabled className="accent-[#0D9B6C]" />
//                     </div>
//                   </label>
//                 </div>
//               </div>

//               <div className="rounded-2xl border border-slate-200 p-4 mb-4">
//                 <label className="flex items-start gap-3 cursor-pointer">
//                   <input
//                     type="checkbox"
//                     checked={termsAccepted}
//                     onChange={(e) => setTermsAccepted(e.target.checked)}
//                     className="mt-1 accent-[#0D9B6C]"
//                   />
//                   <span className="text-sm text-slate-700">
//                     I agree to <span className="font-bold">AuroWater Terms of Service</span>.
//                   </span>
//                 </label>
//               </div>

//               <div className="flex flex-col sm:flex-row gap-3">
//                 <button
//                   type="button"
//                   onClick={() => setStep(3)}
//                   className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-bold py-3 hover:bg-slate-50 transition-colors"
//                 >
//                   Edit schedule
//                 </button>
//                 <button
//                   type="button"
//                   onClick={handleConfirmBooking}
//                   disabled={!termsAccepted}
//                   className={[
//                     'flex-1 rounded-xl px-6 py-3 text-white font-bold transition-colors',
//                     termsAccepted ? 'bg-[#0D9B6C] hover:bg-[#086D4C]' : 'bg-[#0D9B6C] opacity-50 cursor-not-allowed',
//                   ].join(' ')}
//                 >
//                   Confirm Booking
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {/* Step 5 */}
//         {step === 5 && orderId && bookingCreatedAt && (
//           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
//             <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//               <div className="flex items-start justify-between gap-4 mb-6">
//                 <div>
//                   <h2 className="text-xl font-bold text-[#0F1C18]">Booking Confirmed!</h2>
//                   <p className="text-slate-600 mt-1">We’ll assign the team shortly.</p>
//                 </div>
//                 <button
//                   type="button"
//                   onClick={() => {
//                     // keep address/service selections as draft for quick rebook
//                     setStep(2);
//                   }}
//                   className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
//                 >
//                   Back to Step 2
//                 </button>
//               </div>

//               <div className="flex flex-col items-center text-center py-6">
//                 <motion.div
//                   initial={{ scale: 0.8, opacity: 0 }}
//                   animate={{ scale: 1, opacity: 1 }}
//                   transition={{ type: 'spring', stiffness: 260, damping: 18 }}
//                   className="w-20 h-20 rounded-full bg-[#E8F8F2] border border-[#0D9B6C] flex items-center justify-center"
//                 >
//                   <span className="text-4xl">✓</span>
//                 </motion.div>
//                 <h3 className="mt-5 text-2xl sm:text-3xl font-extrabold text-[#0D9B6C]">Success</h3>
//                 <p className="text-slate-600 mt-2">
//                   Order ID: <span className="font-extrabold text-[#0F1C18]">{orderId}</span>
//                 </p>
//                 <p className="text-slate-600 mt-1">
//                   Assigned: <span className="font-bold">We&apos;ll assign shortly</span>
//                 </p>
//               </div>

//               <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
//                 <div className="text-sm font-bold text-slate-800 mb-2">Recap</div>
//                 <div className="text-sm text-slate-700 whitespace-pre-wrap">
//                   {selectedAddress ? `${selectedAddress.houseFlat}, ${selectedAddress.area}` : ''} •{' '}
//                   {selectedAddress ? `${selectedAddress.city} (${selectedAddress.pincode})` : ''}
//                   {'\n'}
//                   {serviceDef ? serviceDef.title : ''}{' '}
//                   {serviceDef?.subOptions?.find((s) => s.key === subOptionKey)?.label ? `• ${serviceDef?.subOptions?.find((s) => s.key === subOptionKey)?.label}` : ''}
//                   {'\n'}
//                   {selectedDate} • {selectedTime?.label}
//                   {emergency ? `\nEmergency +₹${EMERGENCY_SURCHARGE}` : ''}
//                   {'\n'}
//                   Total: {formatMoney(price.total)}
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <button
//                   type="button"
//                   onClick={() => {
//                     // public tracking via localStorage-backed page
//                     window.location.href = `/customer/track/${orderId}`;
//                   }}
//                   className="rounded-xl px-6 py-3 bg-[#0D9B6C] text-white font-bold hover:bg-[#086D4C] transition-colors"
//                 >
//                   Track in Dashboard
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => {
//                     // reset to Step 2 with service untouched if already selected
//                     setStep(2);
//                   }}
//                   className="rounded-xl px-6 py-3 border-2 border-[#0D9B6C] text-[#0D9B6C] font-bold hover:bg-[#E8F8F2] transition-colors"
//                 >
//                   Book Another Service
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}

//         {step === 5 && !orderId && (
//           <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6">
//             <p className="text-slate-700">Booking complete.</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// function STEPperForAccessibility(reactNode: React.ReactNode) {
//   // Tiny helper so TS doesn’t complain about JSX element naming.
//   return <>{reactNode}</>;
// }
























'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
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
    'ro_water_can'// ✅ ADDED
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

type DatePill = { isoDate: string; label: string; day: string; date: number; disabled: boolean };
type TimeSlot = { key: string; label: string; icon: string; period: string; start: string; end: string };

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const STORAGE_ADDRESSES_KEY = 'aurowater_addresses_v2';
const STORAGE_ORDERS_KEY = 'aurowater_orders_v2';
const CONVENIENCE_FEE = 0.29;
const GST_PERCENT = 18;
const EMERGENCY_SURCHARGE = 199;

const UP_CITIES = [
  'Delhi', 'Noida', 'Ghaziabad','Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj',
  'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura',
] as const;

const SERVICE_DEFS: ServiceDef[] = [

 // ✅ NEW SERVICE (CORRECTLY ADDED)
 {
  key: 'ro_water_can',
  emoji: '🚰',
  title: 'RO Water Can',
  fromPrice: 10,
  description: '20L RO cans delivered to your door. BIS certified, no hidden charges.',
  subOptions: [
    { key: '20l', label: '20L Standard Can' },
    { key: 'bulk', label: 'Bulk Order (5+ cans)', priceDelta: -1 },
  ],
},

  {
    key: 'water_tanker',
    emoji: '💧',
    title: 'Water Tanker',
    fromPrice: 299,
    description: 'Fresh tanker delivery, reliable scheduling.',
    subOptions: [
      { key: 'standard', label: 'Standard delivery (3000L)' },
      { key: 'large', label: 'Large tanker (6000L)', priceDelta: 200 },
    ],
  },
  {
    key: 'ro_service',
    emoji: '🔧',
    title: 'RO Service & Repair',
    fromPrice: 199,
    description: 'AMC, one-time repairs, filter changes.',
    subOptions: [
      { key: 'amc', label: 'AMC (Annual Maintenance)' },
      { key: 'repair', label: 'One-time repair' },
      { key: 'filter', label: 'Filter change' },
    ],
  },
  {
    key: 'plumbing',
    emoji: '🪠',
    title: 'Plumbing',
    fromPrice: 149,
    description: 'Fittings, leak fixes and more.',
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
    description: 'Maintenance, installation and repairs.',
    subOptions: [
      { key: 'repair', label: 'Borewell repair' },
      { key: 'installation', label: 'New installation' },
      { key: 'boring', label: 'Boring' },
    ],
  },
  {
    key: 'motor_pump',
    emoji: '⚙️',
    title: 'Motor Pump Repair',
    fromPrice: 249,
    description: 'Motor & pump servicing with clear pricing.',
    subOptions: [
      { key: 'service', label: 'Motor servicing' },
      { key: 'repair', label: 'Motor repair' },
      { key: 'pump', label: 'Pump check & repair' },
    ],
  },
  {
    key: 'tank_cleaning',
    emoji: '🪣',
    title: 'Tank Cleaning',
    fromPrice: 349,
    description: 'Deep clean & hygiene-first sanitation.',
    subOptions: [
      { key: 'clean', label: 'Standard cleaning' },
      { key: 'sanitise', label: 'Deep sanitization' },
    ],
  },

 
];
const TIME_SLOTS: TimeSlot[] = [
  { key: 'morning', icon: '🌅', period: 'Morning', label: '8:00 AM – 12:00 PM', start: '08:00', end: '12:00' },
  { key: 'afternoon', icon: '☀️', period: 'Afternoon', label: '12:00 PM – 5:00 PM', start: '12:00', end: '17:00' },
  { key: 'evening', icon: '🌆', period: 'Evening', label: '5:00 PM – 8:00 PM', start: '17:00', end: '20:00' },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function makeOrderId() {
  return `AW-${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function formatMoney(n: number) {
  return `₹${Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
}

function calcPrice(base: number, emergency: boolean) {
  const conv = CONVENIENCE_FEE;
  const emg = emergency ? EMERGENCY_SURCHARGE : 0;
  const taxable = base + conv + emg;
  const gst = Math.round((taxable * GST_PERCENT) / 100);
  return { base, conv, emg, gst, total: base + conv + emg + gst };
}

function isValidCity(city: string) {
  return UP_CITIES.some((c) => c.toLowerCase() === city.trim().toLowerCase());
}
function isValidPincode(p: string) { return /^[0-9]{6}$/.test(p.trim()); }

function readAddresses(): Address[] {
  if (typeof window === 'undefined') return [];
  return safeParseJSON<Address[]>(localStorage.getItem(STORAGE_ADDRESSES_KEY)) ?? [];
}
function writeAddresses(list: Address[]) {
  try { localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════
const stepVariants = {
  enter: { opacity: 0, y: 16, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2 } },
};

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/** Dark-theme input wrapper with live border glow */
function DarkInput({
  label, icon, error, children,
}: { label: string; icon?: React.ReactNode; error?: string; children: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon} {label}
      </label>
      <div
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
        style={{
          borderRadius: 12, border: `1.5px solid`,
          borderColor: error ? '#F87171' : focused ? '#0D9B6C' : 'rgba(255,255,255,0.1)',
          background: focused ? 'rgba(13,155,108,0.05)' : 'rgba(255,255,255,0.04)',
          boxShadow: focused ? '0 0 0 3px rgba(13,155,108,0.12)' : 'none',
          transition: 'all 0.18s ease',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
      {error && (
        <span style={{ fontSize: 11, color: '#F87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="5.5" fill="#F87171" opacity="0.2" />
            <path d="M5.5 3v3M5.5 7.5v.5" stroke="#F87171" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}

const inputSt: React.CSSProperties = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  padding: '10px 14px', fontSize: 14, fontWeight: 500,
  color: '#F0F4FF', fontFamily: 'inherit',
};

/** Price breakdown row */
function PriceRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: highlight ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: highlight ? 15 : 13, fontWeight: highlight ? 800 : 500, color: highlight ? '#F0F4FF' : 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ fontSize: highlight ? 17 : 13, fontWeight: highlight ? 800 : 600, color: highlight ? '#10B981' : 'rgba(255,255,255,0.8)' }}>{value}</span>
    </div>
  );
}

/** Step progress bar */
function Stepper({ step }: { step: StepId }) {
  const steps = [
    { id: 1, label: 'Address', icon: '📍' },
    { id: 2, label: 'Service', icon: '🔧' },
    { id: 3, label: 'Schedule', icon: '📅' },
    { id: 4, label: 'Review', icon: '✔' },
    { id: 5, label: 'Done', icon: '🎉' },
  ];
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${((step - 1) / 4) * 100}%`, background: 'linear-gradient(90deg, #0D9B6C, #10B981)', borderRadius: 4, transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      {/* Step dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {steps.map((s, i) => {
          const done = s.id < step;
          const active = s.id === step;
          return (
            <React.Fragment key={s.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#0D9B6C' : active ? 'rgba(13,155,108,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${done ? '#0D9B6C' : active ? '#0D9B6C' : 'rgba(255,255,255,0.1)'}`,
                  fontSize: done ? 14 : 13, color: done ? '#fff' : active ? '#0D9B6C' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, transition: 'all 0.3s ease',
                  boxShadow: active ? '0 0 0 4px rgba(13,155,108,0.15)' : 'none',
                }}>
                  {done ? '✓' : s.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#10B981' : done ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 1, background: s.id < step ? '#0D9B6C' : 'rgba(255,255,255,0.07)', margin: '0 4px', marginBottom: 22, transition: 'background 0.4s ease' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** Section card wrapper */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(14,26,48,0.95)',
      border: '1.5px solid rgba(255,255,255,0.08)',
      borderRadius: 20,
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Card header */
function CardHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div style={{ padding: '24px 28px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F0F4FF', letterSpacing: '-0.3px' }}>{title}</h2>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>{subtitle}</p>}
      </div>
      {onBack && (
        <button type="button" onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
          border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.18s ease', flexShrink: 0,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#F0F4FF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2.5L4.5 6.5L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Back
        </button>
      )}
    </div>
  );
}

/** Primary green button */
function GreenBtn({ label, onClick, disabled, loading, icon }: { label: string; onClick?: () => void; disabled?: boolean; loading?: boolean; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} style={{
      flex: 1, padding: '13px 20px', borderRadius: 13, border: 'none',
      background: disabled ? 'rgba(13,155,108,0.25)' : 'linear-gradient(135deg, #0D9B6C, #059652)',
      color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
      fontWeight: 800, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', letterSpacing: '-0.1px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: disabled ? 'none' : '0 4px 18px rgba(13,155,108,0.35)',
      transition: 'all 0.2s ease',
    }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(13,155,108,0.45)'; }}}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = disabled ? 'none' : '0 4px 18px rgba(13,155,108,0.35)'; }}
    >
      {loading ? (
        <svg style={{ animation: 'spin360 0.9s linear infinite' }} width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 1.5A6.5 6.5 0 0 0 1.5 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : icon}
      {label}
      {!loading && !disabled && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </button>
  );
}

/** Ghost back button */
function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '13px 20px', borderRadius: 13,
      border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
      color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all 0.18s ease',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#F0F4FF'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function BookPage() {
  const [step, setStep] = useState<StepId>(1);

  // ── Address state ─────────────────────────────────────────────
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ houseFlat: '', area: '', city: '', pincode: '', landmark: '' });
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});
  const [addrGlobalErr, setAddrGlobalErr] = useState<string | null>(null);

  // ── Service state ─────────────────────────────────────────────
  const [serviceKey, setServiceKey] = useState<ServiceKey | null>(null);
  const [subOptionKey, setSubOptionKey] = useState<string | null>(null);

  // ── Schedule state ────────────────────────────────────────────
  const [datePills, setDatePills] = useState<DatePill[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeKey, setSelectedTimeKey] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);

  // ── Review / confirm state ────────────────────────────────────
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // ── Success state ─────────────────────────────────────────────
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bookingCreatedAt, setBookingCreatedAt] = useState<number | null>(null);
  const [confettiDone, setConfettiDone] = useState(false);

  // ── Derived ───────────────────────────────────────────────────
  const selectedAddress = useMemo(() => addresses.find((a) => a.id === selectedAddressId) ?? null, [addresses, selectedAddressId]);
  const serviceDef = useMemo(() => SERVICE_DEFS.find((s) => s.key === serviceKey) ?? null, [serviceKey]);
  const selectedTime = useMemo(() => TIME_SLOTS.find((t) => t.key === selectedTimeKey) ?? null, [selectedTimeKey]);

  const bookingBasePrice = useMemo(() => {
    if (!serviceDef) return 0;
    const delta = (serviceDef.subOptions ?? []).find((s) => s.key === subOptionKey)?.priceDelta ?? 0;
    return serviceDef.fromPrice + delta;
  }, [serviceDef, subOptionKey]);

  const price = useMemo(() => calcPrice(bookingBasePrice, emergency), [bookingBasePrice, emergency]);

  const canContinueStep1 = !!selectedAddressId && !!selectedAddress;
  const canContinueStep2 = !!serviceKey && (!(serviceDef?.subOptions?.length) || !!subOptionKey);
  const canContinueStep3 = !!selectedDate && !!selectedTimeKey;

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    // Generate date pills
    const now = new Date();
    const pills: DatePill[] = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return {
        isoDate: iso,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        date: d.getDate(),
        disabled: false,
      };
    });
    setDatePills(pills);
    setSelectedDate(pills[0].isoDate);

    // Load addresses
    const saved = readAddresses();
    setAddresses(saved);
    const def = saved.find((a) => a.isDefault) ?? saved[0] ?? null;
    if (def) {
      setSelectedAddressId(def.id);
      setShowAddForm(false);
    } else {
      setShowAddForm(true);
    }
  }, []);

  // Pre-select service from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('service') as ServiceKey | null;
    if (!raw || !SERVICE_DEFS.some((s) => s.key === raw)) return;
    setServiceKey(raw);
    const first = SERVICE_DEFS.find((s) => s.key === raw)?.subOptions?.[0]?.key ?? null;
    setSubOptionKey(first);
  }, []);

  // Reset subOption when service changes
  useEffect(() => {
    if (!serviceDef) return;
    const subs = serviceDef.subOptions ?? [];
    if (!subs.length) { setSubOptionKey(null); return; }
    if (subOptionKey && subs.some((s) => s.key === subOptionKey)) return;
    setSubOptionKey(subs[0]?.key ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceDef]);

  // Confetti on success
  useEffect(() => {
    if (step !== 5 || confettiDone) return;
    setConfettiDone(true);
    const end = Date.now() + 2500;
    const colors = ['#0D9B6C', '#34D399', '#ffffff', '#38BDF8'];
    (function frame() {
      confetti({ particleCount: 7, angle: 60, spread: 60, origin: { x: 0 }, colors });
      confetti({ particleCount: 7, angle: 120, spread: 60, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [step, confettiDone]);

  // ── Address handlers ──────────────────────────────────────────
  const handleAddrField = (field: string, value: string) => {
    setAddrForm((p) => ({ ...p, [field]: value }));
    setAddrErrors((p) => ({ ...p, [field]: '' }));
  };

  const validateAddrForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!addrForm.houseFlat.trim()) errs.houseFlat = 'House / Flat No is required';
    if (!addrForm.area.trim()) errs.area = 'Area is required';
    if (!isValidCity(addrForm.city)) errs.city = 'Select a valid city';
    if (!isValidPincode(addrForm.pincode)) errs.pincode = 'Enter valid 6-digit pincode';
    setAddrErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveAddress = useCallback((andContinue: boolean) => {
    setAddrGlobalErr(null);
    if (!validateAddrForm()) return;
    const now = Date.now();
    const prev = readAddresses();
    const newAddr: Address = {
      id: `addr_${now}_${Math.random().toString(16).slice(2, 8)}`,
      houseFlat: addrForm.houseFlat.trim(),
      area: addrForm.area.trim(),
      city: addrForm.city.trim(),
      pincode: addrForm.pincode.trim(),
      landmark: addrForm.landmark.trim() || undefined,
      label: 'Home',
      createdAt: now,
      isDefault: prev.length === 0,
    };
    const next = [newAddr, ...prev];
    writeAddresses(next);
    setAddresses(next);
    setSelectedAddressId(newAddr.id);
    setAddrForm({ houseFlat: '', area: '', city: '', pincode: '', landmark: '' });
    setShowAddForm(false);
    toast.success('Address saved!');
    if (andContinue) setStep(2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrForm]);

  const handleDeleteAddress = (id: string) => {
    const next = addresses.filter((a) => a.id !== id);
    writeAddresses(next);
    setAddresses(next);
    if (selectedAddressId === id) {
      const def = next.find((a) => a.isDefault) ?? next[0] ?? null;
      setSelectedAddressId(def?.id ?? null);
      if (!def) setShowAddForm(true);
    }
    toast.success('Address removed.');
  };

  // ── Confirm booking ───────────────────────────────────────────
  const handleConfirm = async () => {
    if (confirming || !serviceDef || !selectedAddress || !selectedDate || !selectedTimeKey) return;
    if (!termsAccepted) { toast.error('Please accept the Terms of Service.'); return; }
    setConfirming(true);
    await new Promise((r) => setTimeout(r, 900));
    const oid = makeOrderId();
    const order = {
      id: oid, status: 'PENDING', createdAt: Date.now(),
      serviceKey, subOptionKey, address: selectedAddress,
      scheduledDate: selectedDate, timeKey: selectedTimeKey,
      emergency, total: price.total, paymentMethod: 'cash',
    };
    try {
      const prev = safeParseJSON<unknown[]>(localStorage.getItem(STORAGE_ORDERS_KEY)) ?? [];
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify([order, ...prev].slice(0, 50)));
    } catch { /* ignore */ }
    setOrderId(oid);
    setBookingCreatedAt(Date.now());
    setConfirming(false);
    toast.success('Booking confirmed! 🎉');
    setStep(5);
  };

  const resetBooking = () => {
    setServiceKey(null); setSubOptionKey(null);
    setSelectedDate(datePills[0]?.isoDate ?? null);
    setSelectedTimeKey(null); setEmergency(false);
    setTermsAccepted(false); setOrderId(null);
    setBookingCreatedAt(null); setConfettiDone(false);
    setStep(2);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800;900&display=swap');

        .book-page * { box-sizing: border-box; font-family: 'Lexend', sans-serif; }
        .book-page ::placeholder { color: rgba(255,255,255,0.22); }
        .book-page select option { background: #0E1829; color: #F0F4FF; }

        @keyframes spin360 { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes successBounce {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 0 0 rgba(13,155,108,0.5); }
          50%       { box-shadow: 0 0 0 10px rgba(13,155,108,0); }
        }
        @keyframes waveSlide {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .book-page .svc-card { transition: transform 0.2s ease, border-color 0.2s, box-shadow 0.2s; }
        .book-page .svc-card:hover { transform: translateY(-3px); }
        .book-page .addr-card { transition: border-color 0.2s, background 0.2s; }
        .book-page .date-pill { transition: all 0.18s ease; }
        .book-page .slot-card { transition: all 0.2s ease; }
        .book-page .slot-card:hover:not([data-active="true"]) { border-color: rgba(13,155,108,0.4) !important; background: rgba(13,155,108,0.05) !important; }
      `}</style>

      <div
        className="book-page"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #060C17 0%, #080E1A 40%, #0A1220 100%)',
          position: 'relative',
        }}
      >
        {/* Ambient background glow */}
        <div style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(13,155,108,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(24px,4vw,40px) clamp(16px,4vw,24px) 80px', position: 'relative', zIndex: 1 }}>

          {/* Page header */}
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(13,155,108,0.1)', border: '1px solid rgba(13,155,108,0.25)', borderRadius: 999, padding: '4px 12px', marginBottom: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulseRing 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#34D399', letterSpacing: '0.1em' }}>AUROWATER BOOKING</span>
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem,5vw,2.2rem)', fontWeight: 900, color: '#F0F4FF', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
                Book a Service
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                5 quick steps · Confirm in under 60 seconds
              </p>
            </div>
            <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#0D9B6C', textDecoration: 'none', padding: '8px 14px', borderRadius: 10, border: '1.5px solid rgba(13,155,108,0.3)', background: 'rgba(13,155,108,0.06)', whiteSpace: 'nowrap', transition: 'all 0.18s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(13,155,108,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(13,155,108,0.06)'; }}
            >
              Browse services →
            </Link>
          </div>

          <Stepper step={step} />

          {/* ══ STEPS ══════════════════════════════════════════════ */}
          <AnimatePresence mode="wait">

            {/* ── STEP 1: ADDRESS ── */}
            {step === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <Card>
                  <CardHeader title="Choose Delivery Address" subtitle="Select a saved address or add a new one" />
                  <div style={{ padding: '24px 28px' }}>

                    {/* Saved addresses */}
                    {addresses.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                          Saved Addresses
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {addresses.map((addr) => {
                            const active = addr.id === selectedAddressId;
                            return (
                              <div
                                key={addr.id}
                                className="addr-card"
                                style={{
                                  borderRadius: 14, border: `1.5px solid ${active ? '#0D9B6C' : 'rgba(255,255,255,0.08)'}`,
                                  background: active ? 'rgba(13,155,108,0.08)' : 'rgba(255,255,255,0.03)',
                                  padding: '14px 16px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 14,
                                }}
                                onClick={() => { setSelectedAddressId(addr.id); setAddrGlobalErr(null); }}
                              >
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: active ? 'rgba(13,155,108,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                                  📍
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{addr.label || 'Address'}</span>
                                    {addr.isDefault && <span style={{ fontSize: 9, fontWeight: 800, color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '2px 7px', borderRadius: 999, letterSpacing: '0.06em' }}>DEFAULT</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                                    {addr.houseFlat}, {addr.area}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                                    {addr.city} · {addr.pincode}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? '#0D9B6C' : 'rgba(255,255,255,0.15)'}`, background: active ? '#0D9B6C' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                                    {active ? '✓' : ''}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.2)', fontSize: 12, lineHeight: 1 }}
                                    title="Remove"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add another toggle */}
                        <button
                          type="button"
                          onClick={() => setShowAddForm((v) => !v)}
                          style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0D9B6C', padding: 0, fontFamily: 'inherit' }}
                        >
                          <span style={{ fontSize: 16, lineHeight: 1 }}>{showAddForm ? '−' : '+'}</span>
                          {showAddForm ? 'Cancel' : 'Add new address'}
                        </button>
                      </div>
                    )}

                    {/* Address form */}
                    <AnimatePresence>
                      {showAddForm && (
                        <motion.div
                          key="addr-form"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ borderTop: addresses.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: addresses.length > 0 ? 20 : 0 }}>
                            {addresses.length === 0 && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Add New Address</div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                              <DarkInput label="House / Flat No" error={addrErrors.houseFlat}
                                icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L1 4.5V10h3.5V7h2v3H10V4.5L5.5 1Z" stroke="#0D9B6C" strokeWidth="1.2" /></svg>}>
                                <input style={inputSt} placeholder="e.g. House 12 / Flat B" value={addrForm.houseFlat} onChange={(e) => handleAddrField('houseFlat', e.target.value)} />
                              </DarkInput>
                              <DarkInput label="Area / Locality" error={addrErrors.area}
                                icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="#0D9B6C" strokeWidth="1.2" /><path d="M5.5 3v2.5l1.5 1.5" stroke="#0D9B6C" strokeWidth="1.2" strokeLinecap="round" /></svg>}>
                                <input style={inputSt} placeholder="e.g. Sector 3, Civil Lines" value={addrForm.area} onChange={(e) => handleAddrField('area', e.target.value)} />
                              </DarkInput>
                              <DarkInput label="City" error={addrErrors.city}
                                icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1C3.8 1 2.5 2.3 2.5 4C2.5 6.5 5.5 10 5.5 10C5.5 10 8.5 6.5 8.5 4C8.5 2.3 7.2 1 5.5 1Z" stroke="#0D9B6C" strokeWidth="1.2" /><circle cx="5.5" cy="4" r="1" fill="#0D9B6C" /></svg>}>
                                <select style={{ ...inputSt, appearance: 'none', cursor: 'pointer' }} value={addrForm.city} onChange={(e) => handleAddrField('city', e.target.value)}>
                                  <option value="">Select city</option>
                                  {UP_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </DarkInput>
                              <DarkInput label="Pincode" error={addrErrors.pincode}
                                icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="2" y="4" width="7" height="6" rx="1" stroke="#0D9B6C" strokeWidth="1.2" /><path d="M4 4V3a1.5 1.5 0 0 1 3 0v1" stroke="#0D9B6C" strokeWidth="1.2" /></svg>}>
                                <input style={inputSt} placeholder="6-digit PIN" inputMode="numeric"
                                  value={addrForm.pincode}
                                  onChange={(e) => handleAddrField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} />
                              </DarkInput>
                              <DarkInput label="Landmark (optional)"
                                icon={<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5h8M8.5 2.5L10 5.5l-1.5 3H2l-1-3L2 2.5h6.5Z" stroke="#0D9B6C" strokeWidth="1.1" /></svg>}>
                                <input style={inputSt} placeholder="e.g. Near XYZ Temple" value={addrForm.landmark} onChange={(e) => handleAddrField('landmark', e.target.value)} />
                              </DarkInput>
                            </div>

                            {addrGlobalErr && (
                              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 13, color: '#F87171', fontWeight: 600 }}>
                                {addrGlobalErr}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                              <button type="button" onClick={() => handleSaveAddress(false)}
                                style={{ flex: 1, padding: '11px', borderRadius: 11, border: '1.5px solid rgba(13,155,108,0.4)', background: 'rgba(13,155,108,0.08)', color: '#0D9B6C', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(13,155,108,0.15)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(13,155,108,0.08)'; }}
                              >
                                Save address
                              </button>
                              <button type="button" onClick={() => handleSaveAddress(true)}
                                style={{ flex: 1, padding: '11px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #0D9B6C, #059652)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(13,155,108,0.35)', transition: 'all 0.18s' }}
                              >
                                Save & Continue →
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* CTA */}
                    {addrGlobalErr && (
                      <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 13, color: '#F87171', fontWeight: 600 }}>
                        {addrGlobalErr}
                      </div>
                    )}

                    {addresses.length > 0 && !showAddForm && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        <GreenBtn
                          label={canContinueStep1 ? 'Continue to Service' : 'Select an address first'}
                          disabled={!canContinueStep1}
                          onClick={() => {
                            if (!canContinueStep1) { setAddrGlobalErr('Please select or add an address to continue.'); return; }
                            setAddrGlobalErr(null);
                            setStep(2);
                          }}
                        />
                      </div>
                    )}

                    {addresses.length === 0 && !showAddForm && (
                      <div style={{ textAlign: 'center', padding: '32px 0 8px', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                        No addresses yet —{' '}
                        <button type="button" onClick={() => setShowAddForm(true)} style={{ background: 'none', border: 'none', color: '#0D9B6C', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                          add one above
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 2: SERVICE ── */}
            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <Card>
                  <CardHeader title="Choose Service" subtitle="Pick a category, then select the specific option" onBack={() => setStep(1)} />
                  <div style={{ padding: '24px 28px' }}>

                    {/* Service grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 12, marginBottom: 24 }}>
                      {SERVICE_DEFS.map((s) => {
                        const active = s.key === serviceKey;
                        return (
                          <button key={s.key} type="button"
                            className="svc-card"
                            onClick={() => setServiceKey(s.key)}
                            style={{
                              textAlign: 'left', padding: '16px', borderRadius: 14,
                              border: `1.5px solid ${active ? '#0D9B6C' : 'rgba(255,255,255,0.07)'}`,
                              background: active ? 'rgba(13,155,108,0.1)' : 'rgba(255,255,255,0.03)',
                              cursor: 'pointer', fontFamily: 'inherit',
                              boxShadow: active ? '0 0 0 1px rgba(13,155,108,0.2), 0 4px 20px rgba(13,155,108,0.15)' : 'none',
                              position: 'relative',
                            }}
                          >
                            {active && (
                              <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: '#0D9B6C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800 }}>✓</div>
                            )}
                            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.emoji}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: active ? '#F0F4FF' : 'rgba(255,255,255,0.8)', marginBottom: 4, lineHeight: 1.25 }}>{s.title}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.4 }}>{s.description}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#10B981' }}>From {formatMoney(s.fromPrice)}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Sub-options */}
                    {serviceDef && (serviceDef.subOptions?.length ?? 0) > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: '16px 18px', marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                          Select option for {serviceDef.title}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {serviceDef.subOptions!.map((opt) => {
                            const active = opt.key === subOptionKey;
                            return (
                              <button key={opt.key} type="button" onClick={() => setSubOptionKey(opt.key)} style={{
                                padding: '8px 16px', borderRadius: 999, border: `1.5px solid ${active ? '#0D9B6C' : 'rgba(255,255,255,0.1)'}`,
                                background: active ? '#0D9B6C' : 'rgba(255,255,255,0.04)',
                                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
                              }}>
                                {opt.label}
                                {opt.priceDelta ? <span style={{ marginLeft: 5, opacity: 0.7 }}>+{formatMoney(opt.priceDelta)}</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                      <GhostBtn label="Back" onClick={() => setStep(1)} />
                      <GreenBtn label="Continue to Schedule" disabled={!canContinueStep2} onClick={() => setStep(3)} />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 3: DATE & TIME ── */}
            {step === 3 && (
              <motion.div key="step3" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <Card>
                  <CardHeader title="Pick Date & Time" subtitle="Choose when you want the service" onBack={() => setStep(2)} />
                  <div style={{ padding: '24px 28px' }}>

                    {/* Date pills */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Date</div>
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {datePills.map((d) => {
                          const active = selectedDate === d.isoDate;
                          return (
                            <button key={d.isoDate} type="button"
                              className="date-pill"
                              disabled={d.disabled}
                              onClick={() => setSelectedDate(d.isoDate)}
                              style={{
                                minWidth: 64, padding: '10px 8px', borderRadius: 12, textAlign: 'center',
                                border: `1.5px solid ${active ? '#0D9B6C' : 'rgba(255,255,255,0.08)'}`,
                                background: active ? '#0D9B6C' : 'rgba(255,255,255,0.03)',
                                cursor: d.disabled ? 'not-allowed' : 'pointer', opacity: d.disabled ? 0.35 : 1,
                                fontFamily: 'inherit', flexShrink: 0,
                                boxShadow: active ? '0 4px 14px rgba(13,155,108,0.35)' : 'none',
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 700, color: active ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                                {d.label === 'Today' || d.label === 'Tomorrow' ? '' : d.label}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: active ? '#fff' : '#F0F4FF', lineHeight: 1 }}>
                                {d.label === 'Today' ? 'Today' : d.label === 'Tomorrow' ? 'Tmrw' : d.date}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time slots */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Time Slot</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                        {TIME_SLOTS.map((slot) => {
                          const active = selectedTimeKey === slot.key && !emergency;
                          return (
                            <button key={slot.key} type="button"
                              className="slot-card"
                              data-active={active ? 'true' : 'false'}
                              onClick={() => { setEmergency(false); setSelectedTimeKey(slot.key); }}
                              style={{
                                textAlign: 'left', padding: '14px 16px', borderRadius: 13, border: `1.5px solid ${active ? '#0D9B6C' : 'rgba(255,255,255,0.07)'}`,
                                background: active ? 'rgba(13,155,108,0.1)' : 'rgba(255,255,255,0.03)',
                                cursor: 'pointer', fontFamily: 'inherit',
                                boxShadow: active ? '0 0 0 1px rgba(13,155,108,0.2)' : 'none',
                              }}
                            >
                              <div style={{ fontSize: 20, marginBottom: 6 }}>{slot.icon}</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: active ? '#F0F4FF' : 'rgba(255,255,255,0.75)' }}>{slot.period}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{slot.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Emergency toggle */}
                    <button type="button"
                      onClick={() => { setEmergency(true); if (!selectedTimeKey) setSelectedTimeKey('morning'); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 13, marginBottom: 24,
                        border: `1.5px solid ${emergency ? '#F87171' : 'rgba(255,255,255,0.07)'}`,
                        background: emergency ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 14,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>🚨</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: emergency ? '#F87171' : 'rgba(255,255,255,0.75)' }}>Emergency Service</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#F87171', background: 'rgba(248,113,113,0.15)', padding: '2px 8px', borderRadius: 999 }}>+{formatMoney(EMERGENCY_SURCHARGE)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Priority scheduling · Subject to availability</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${emergency ? '#F87171' : 'rgba(255,255,255,0.15)'}`, background: emergency ? '#F87171' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', flexShrink: 0 }}>
                        {emergency ? '✓' : ''}
                      </div>
                    </button>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <GhostBtn label="Back" onClick={() => setStep(2)} />
                      <GreenBtn label="Review Booking" disabled={!canContinueStep3} onClick={() => setStep(4)} />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 4: REVIEW ── */}
            {step === 4 && serviceDef && selectedAddress && selectedDate && selectedTimeKey && (
              <motion.div key="step4" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <Card>
                  <CardHeader title="Review & Confirm" subtitle="Double-check everything before placing your booking" onBack={() => setStep(3)} />
                  <div style={{ padding: '24px 28px' }}>

                    {/* Summary grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 20 }}>
                      {[
                        {
                          icon: '📍', label: 'Address', onEdit: () => setStep(1),
                          content: (
                            <>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{selectedAddress.houseFlat}, {selectedAddress.area}</div>
                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{selectedAddress.city} · {selectedAddress.pincode}</div>
                            </>
                          ),
                        },
                        {
                          icon: serviceDef.emoji, label: 'Service', onEdit: () => setStep(2),
                          content: (
                            <>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{serviceDef.title}</div>
                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                                {serviceDef.subOptions?.find((s) => s.key === subOptionKey)?.label ?? '—'}
                              </div>
                            </>
                          ),
                        },
                        {
                          icon: '📅', label: 'Schedule', onEdit: () => setStep(3),
                          content: (
                            <>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>
                                {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </div>
                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                                {selectedTime?.period} · {selectedTime?.label}
                              </div>
                              {emergency && <div style={{ marginTop: 4, display: 'inline-flex', fontSize: 10, fontWeight: 800, color: '#F87171', background: 'rgba(248,113,113,0.12)', padding: '2px 7px', borderRadius: 999 }}>🚨 Emergency</div>}
                            </>
                          ),
                        },
                        {
                          icon: '💵', label: 'Payment', onEdit: undefined,
                          content: (
                            <>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>Cash on Service</div>
                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Pay at your doorstep</div>
                            </>
                          ),
                        },
                      ].map((row) => (
                        <div key={row.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 13, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 15 }}>{row.icon}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{row.label}</span>
                            </div>
                            {row.onEdit && (
                              <button type="button" onClick={row.onEdit} style={{ background: 'none', border: 'none', color: '#0D9B6C', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                            )}
                          </div>
                          {row.content}
                        </div>
                      ))}
                    </div>

                    {/* Price breakdown */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px', marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Price Breakdown</div>
                      <PriceRow label="Base price" value={formatMoney(price.base)} />
                      <PriceRow label={`Convenience fee`} value={formatMoney(price.conv)} />
                      {price.emg > 0 && <PriceRow label="Emergency surcharge" value={formatMoney(price.emg)} />}
                      <PriceRow label={`GST (${GST_PERCENT}%)`} value={formatMoney(price.gst)} />
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
                      <PriceRow label="Total (incl. GST)" value={formatMoney(price.total)} highlight />
                      <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                        Pay after service is completed · Cash only for now
                      </div>
                    </div>

                    {/* Payment method */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                      <div style={{ borderRadius: 12, border: '1.5px solid #0D9B6C', background: 'rgba(13,155,108,0.08)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(13,155,108,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>💵</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#F0F4FF' }}>Cash on Service</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Pay at doorstep</div>
                        </div>
                        <div style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: '#0D9B6C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 800 }}>✓</div>
                      </div>
                      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.45, cursor: 'not-allowed' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>📱</div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#F0F4FF' }}>Pay Online</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Coming soon</div>
                        </div>
                      </div>
                    </div>

                    {/* Terms */}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div
                        onClick={() => setTermsAccepted((v) => !v)}
                        style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${termsAccepted ? '#0D9B6C' : 'rgba(255,255,255,0.2)'}`, background: termsAccepted ? '#0D9B6C' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, cursor: 'pointer', transition: 'all 0.18s' }}
                      >
                        {termsAccepted && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                        I agree to AuroWater's{' '}
                        <Link href="/terms" style={{ color: '#0D9B6C', fontWeight: 700 }}>Terms of Service</Link>
                        {' '}and{' '}
                        <Link href="/privacy" style={{ color: '#0D9B6C', fontWeight: 700 }}>Privacy Policy</Link>
                      </span>
                    </label>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <GhostBtn label="Edit Schedule" onClick={() => setStep(3)} />
                      <GreenBtn
                        label={confirming ? 'Confirming…' : 'Confirm Booking'}
                        loading={confirming}
                        disabled={!termsAccepted || confirming}
                        onClick={handleConfirm}
                        icon={<span style={{ fontSize: 14 }}>✓</span>}
                      />
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 5: SUCCESS ── */}
            {step === 5 && orderId && (
              <motion.div key="step5" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <Card>
                  <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                    {/* Success icon */}
                    <div style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 24px', background: 'linear-gradient(135deg, #0D9B6C, #059652)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'successBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) both', boxShadow: '0 8px 36px rgba(13,155,108,0.45)' }}>
                      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <path d="M10 20L16 26L30 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, color: '#F0F4FF', letterSpacing: '-0.8px' }}>
                      Booking Confirmed! 🎉
                    </h2>
                    <p style={{ margin: '0 0 6px', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                      We'll assign a verified technician shortly.
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(13,155,108,0.1)', border: '1px solid rgba(13,155,108,0.25)', borderRadius: 999, padding: '6px 16px', marginBottom: 28 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Order ID</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#10B981', letterSpacing: '0.05em' }}>{orderId}</span>
                    </div>

                    {/* Recap card */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px', textAlign: 'left', marginBottom: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                          { icon: '🔧', label: 'Service', value: serviceDef?.title ?? '—' },
                          { icon: '📍', label: 'Address', value: `${selectedAddress?.city}, ${selectedAddress?.pincode}` },
                          { icon: '📅', label: 'Date', value: selectedDate ? new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                          { icon: '💰', label: 'Total', value: formatMoney(price.total) },
                        ].map((row) => (
                          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>{row.icon}</span>
                            <div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{row.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', marginTop: 1 }}>{row.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                      <button type="button" onClick={() => { window.location.href = `/customer/track/${orderId}`; }}
                        style={{ padding: '12px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #0D9B6C, #059652)', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(13,155,108,0.38)', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        Track Booking →
                      </button>
                      <button type="button" onClick={resetBooking}
                        style={{ padding: '12px 24px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      >
                        Book Another Service
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Bottom trust bar */}
          {step < 5 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginTop: 24, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { icon: '🛡️', text: 'ID-Verified Technicians' },
                { icon: '💰', text: 'No Hidden Charges' },
                { icon: '⚡', text: 'Same-Day Available' },
              ].map((t) => (
                <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  {t.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}