'use client';

import React from 'react';

export default function AnnouncementBar() {
  const [dismissed, setDismissed] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const d = localStorage.getItem('aurowater_bar_dismissed') === '1';
      setDismissed(d);
      setVisible(!d);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      className="announcement-bar fixed left-0 right-0 top-0 z-60 h-[40px] flex items-center justify-center px-4 text-white text-sm font-medium bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8]"
      role="region"
      aria-label="Announcement"
    >
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap">🎉 First 100 founding members get priority service —</span>
        <a href="/auth/register" className="font-bold underline decoration-white/70 hover:decoration-white">
          Claim Your Spot →
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem('aurowater_bar_dismissed', '1');
          } catch {
            // ignore
          }
          setDismissed(true);
          setVisible(false);
        }}
        className="close-btn absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}

// 'use client';

// /**
//  * AuroWater — TimeSlotPicker
//  * Place at: src/components/booking/TimeSlotPicker.tsx
//  *
//  * Features:
//  *   • Visual slot cards (Morning / Afternoon / Evening / Night) instead of raw time inputs
//  *   • Optional custom time toggle for power users
//  *   • Emergency booking mode with fee display
//  *   • Real-time validation with clear inline errors
//  *   • Fully accessible (keyboard, ARIA, labels)
//  *   • Syne + DM Sans typography, AuroWater blue theme
//  *   • Zero Tailwind dependency — all styles inline/scoped
//  */

// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import {
//   validateTimeSlotClient,
//   getTimeOptions,
//   getMinDate,
// } from '@/lib/validation/time-slot-client';

// /* ─────────────────────────────────────────────
//    TYPES
// ───────────────────────────────────────────── */
// export interface TimeSlotPickerValue {
//   time_slot:      string;
//   scheduled_time: string;
//   valid:          boolean;
//   errors:         string[];
//   startTime:      string;
//   endTime:        string;
//   date:           string;
//   isEmergency:    boolean;
// }

// interface TimeSlotPickerProps {
//   value?:           Partial<TimeSlotPickerValue>;
//   /** Called whenever any field changes. Safe to omit — defaults to a no-op. */
//   onChange?:        (v: TimeSlotPickerValue) => void;
//   minDate?:         string;
//   showEmergency?:   boolean;
//   emergencyFee?:    number;
//   className?:       string;
//   label?:           string;
// }

// /* ─────────────────────────────────────────────
//    SLOT PRESETS
//    Visual cards for the most common booking windows
// ───────────────────────────────────────────── */
// interface SlotPreset {
//   id:        string;
//   label:     string;
//   sub:       string;
//   emoji:     string;
//   startTime: string;
//   endTime:   string;
//   popular?:  boolean;
// }

// const SLOT_PRESETS: SlotPreset[] = [
//   { id:'morning',   label:'Morning',   sub:'8:00 – 12:00',  emoji:'🌅', startTime:'08:00', endTime:'12:00', popular:true },
//   { id:'afternoon', label:'Afternoon', sub:'12:00 – 16:00', emoji:'☀️', startTime:'12:00', endTime:'16:00' },
//   { id:'evening',   label:'Evening',   sub:'16:00 – 20:00', emoji:'🌆', startTime:'16:00', endTime:'20:00' },
//   { id:'night',     label:'Night',     sub:'20:00 – 22:00', emoji:'🌙', startTime:'20:00', endTime:'22:00' },
//   { id:'custom',    label:'Custom',    sub:'Choose exact time', emoji:'🕐', startTime:'09:00', endTime:'09:30' },
// ];

// /* ─────────────────────────────────────────────
//    HELPERS
// ───────────────────────────────────────────── */
// function fmt12(time: string): string {
//   const [hStr, mStr] = time.split(':');
//   const h = parseInt(hStr, 10);
//   const m = mStr ?? '00';
//   const period = h >= 12 ? 'PM' : 'AM';
//   const h12 = h % 12 === 0 ? 12 : h % 12;
//   return `${h12}:${m} ${period}`;
// }

// function todayStr(): string {
//   return new Date().toISOString().slice(0, 10);
// }

// function tomorrowStr(): string {
//   const d = new Date();
//   d.setDate(d.getDate() + 1);
//   return d.toISOString().slice(0, 10);
// }

// function fmtDisplayDate(dateStr: string): string {
//   if (!dateStr) return '';
//   try {
//     const d = new Date(`${dateStr}T00:00:00`);
//     const today    = todayStr();
//     const tomorrow = tomorrowStr();
//     if (dateStr === today)    return 'Today';
//     if (dateStr === tomorrow) return 'Tomorrow';
//     return d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' });
//   } catch { return dateStr; }
// }

// /* ─────────────────────────────────────────────
//    DATE QUICK-PICKS
// ───────────────────────────────────────────── */
// function buildDateOptions(minDate: string): { value: string; label: string }[] {
//   const result: { value: string; label: string }[] = [];
//   const min = new Date(`${minDate}T00:00:00`);
//   for (let i = 0; i < 14; i++) {
//     const d = new Date(min);
//     d.setDate(min.getDate() + i);
//     const val = d.toISOString().slice(0, 10);
//     const label = i === 0 && minDate === todayStr()
//       ? 'Today'
//       : i === 1 && minDate <= todayStr()
//       ? 'Tomorrow'
//       : d.toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' });
//     result.push({ value: val, label });
//   }
//   return result;
// }

// /* ─────────────────────────────────────────────
//    MAIN COMPONENT
// ───────────────────────────────────────────── */
// export default function TimeSlotPicker({
//   value,
//   onChange = () => {},     // ← safe default: never throws even if caller omits it
//   minDate,
//   showEmergency = false,
//   emergencyFee  = 199,
//   className     = '',
//   label         = 'Schedule your service',
// }: TimeSlotPickerProps) {
//   const min          = minDate ?? getMinDate();
//   const timeOptions  = useMemo(() => getTimeOptions(), []);
//   const dateOptions  = useMemo(() => buildDateOptions(min), [min]);

//   const [date,        setDate]        = useState<string>(value?.date ?? min);
//   const [selectedId,  setSelectedId]  = useState<string>('morning');
//   const [startTime,   setStartTime]   = useState<string>(value?.startTime ?? '08:00');
//   const [endTime,     setEndTime]     = useState<string>(value?.endTime   ?? '12:00');
//   const [isEmergency, setIsEmergency] = useState<boolean>(value?.isEmergency ?? false);
//   const [touched,     setTouched]     = useState<boolean>(false);

//   /* ── Run validation + fire onChange ── */
//   const runValidation = useCallback(() => {
//     const result = validateTimeSlotClient(startTime, endTime, date);
//     // Guard: only call if onChange is truly a function (runtime safety)
//     if (typeof onChange !== 'function') return;
//     onChange({
//       startTime,
//       endTime,
//       date,
//       isEmergency,
//       time_slot:      result.time_slot,
//       scheduled_time: result.scheduled_time,
//       valid:          result.valid,
//       errors:         result.errors,
//     });
//   }, [startTime, endTime, date, isEmergency, onChange]);

//   useEffect(() => { runValidation(); }, [runValidation]);

//   /* ── Slot card selection ── */
//   const handleSlotSelect = useCallback((preset: SlotPreset) => {
//     setSelectedId(preset.id);
//     if (preset.id !== 'custom') {
//       setStartTime(preset.startTime);
//       setEndTime(preset.endTime);
//     }
//     setTouched(true);
//   }, []);

//   /* ── Inline validation result (for display) ── */
//   const result = useMemo(
//     () => validateTimeSlotClient(startTime, endTime, date),
//     [startTime, endTime, date]
//   );

//   const isCustom = selectedId === 'custom';

//   return (
//     <>
//       {/* ── Scoped styles ── */}
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

//         @keyframes tspFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
//         @keyframes tspPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0.35)} 60%{box-shadow:0 0 0 8px rgba(37,99,235,0)} }
//         @keyframes tspShake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }

//         .tsp-root { font-family:'DM Sans',sans-serif; }

//         /* ── Label ── */
//         .tsp-label {
//           font-family:'Syne',sans-serif; font-weight:800;
//           font-size:1rem; color:#0A1628; letter-spacing:-0.2px; margin-bottom:16px;
//           display:flex; align-items:center; gap:8px;
//         }
//         .tsp-label-dot { width:7px; height:7px; border-radius:50%; background:#2563EB; }

//         /* ── Date scroll strip ── */
//         .tsp-dates {
//           display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;
//           scrollbar-width:none; margin-bottom:18px;
//         }
//         .tsp-dates::-webkit-scrollbar { display:none; }
//         .tsp-date-btn {
//           flex-shrink:0; padding:8px 16px; border-radius:10px;
//           background:#F8FAFF; border:1.5px solid #DBEAFE;
//           font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600;
//           color:#374151; cursor:pointer; transition:all 0.15s; white-space:nowrap;
//         }
//         .tsp-date-btn:hover { border-color:#93C5FD; background:#EFF6FF; }
//         .tsp-date-btn.on {
//           background:#2563EB; color:#fff; border-color:#2563EB;
//           box-shadow:0 3px 10px rgba(37,99,235,0.28);
//           font-weight:700;
//         }

//         /* ── Slot cards ── */
//         .tsp-slots { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:18px; }
//         .tsp-slot {
//           border-radius:14px; border:1.5px solid #DBEAFE; background:#fff;
//           padding:14px 8px; text-align:center; cursor:pointer;
//           transition:all 0.18s; position:relative; overflow:hidden;
//           font-family:'DM Sans',sans-serif;
//         }
//         .tsp-slot:hover { border-color:#93C5FD; background:#F8FAFF; transform:translateY(-1px); }
//         .tsp-slot.on {
//           border-color:#2563EB; border-width:2px;
//           background:linear-gradient(145deg,#EFF6FF,#DBEAFE);
//           box-shadow:0 4px 14px rgba(37,99,235,0.15); animation:tspPulse 0.6s ease;
//         }
//         .tsp-slot-emoji { font-size:22px; margin-bottom:5px; }
//         .tsp-slot-label { font-size:11px; font-weight:700; color:#0A1628; }
//         .tsp-slot-sub   { font-size:9px; color:#94A3B8; margin-top:2px; font-weight:500; }
//         .tsp-slot-popular {
//           position:absolute; top:6px; right:6px;
//           font-size:8px; font-weight:800; background:#2563EB; color:#fff;
//           padding:1px 5px; border-radius:99px; letter-spacing:0.04em; text-transform:uppercase;
//         }
//         .tsp-slot-check {
//           position:absolute; top:6px; left:6px;
//           width:16px; height:16px; border-radius:50%;
//           background:#2563EB; display:flex; align-items:center; justify-content:center;
//         }

//         /* ── Custom time row ── */
//         .tsp-custom {
//           display:grid; grid-template-columns:1fr 1fr; gap:12px;
//           padding:16px; background:#F8FAFF; border-radius:14px;
//           border:1px solid #DBEAFE; margin-bottom:18px;
//           animation:tspFadeUp 0.25s ease both;
//         }
//         .tsp-inp-label {
//           font-size:10px; font-weight:700; color:#64748B;
//           text-transform:uppercase; letter-spacing:0.07em; margin-bottom:6px;
//         }
//         .tsp-select {
//           width:100%; padding:10px 14px; border-radius:10px;
//           border:1.5px solid #DBEAFE; background:#fff;
//           font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500;
//           color:#0A1628; outline:none; transition:all 0.15s;
//           appearance:none;
//           background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
//           background-repeat:no-repeat; background-position:right 12px center;
//           padding-right:36px; cursor:pointer;
//         }
//         .tsp-select:focus { border-color:#2563EB; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }

//         /* ── Emergency toggle ── */
//         .tsp-emergency {
//           display:flex; align-items:center; justify-content:space-between;
//           padding:14px 16px; border-radius:14px; cursor:pointer;
//           border:1.5px solid #FDE68A; background:#FFFBEB;
//           margin-bottom:14px; transition:all 0.15s; gap:12px;
//         }
//         .tsp-emergency:hover { border-color:#F59E0B; background:#FEF3C7; }
//         .tsp-emergency.on { border-color:#F59E0B; background:#FEF3C7; box-shadow:0 3px 10px rgba(245,158,11,0.15); }
//         .tsp-emg-left { display:flex; align-items:center; gap:10px; }
//         .tsp-emg-icon { font-size:20px; flex-shrink:0; }
//         .tsp-emg-title { font-size:13px; font-weight:700; color:#92400E; }
//         .tsp-emg-sub   { font-size:11px; color:#B45309; margin-top:1px; }
//         .tsp-toggle {
//           width:40px; height:22px; border-radius:99px; flex-shrink:0;
//           border:none; cursor:pointer; transition:all 0.2s; position:relative;
//           background:#E2E8F0;
//         }
//         .tsp-toggle.on { background:#F59E0B; }
//         .tsp-toggle::after {
//           content:''; position:absolute; top:2px; left:2px;
//           width:18px; height:18px; border-radius:50%; background:#fff;
//           box-shadow:0 1px 3px rgba(0,0,0,0.15); transition:transform 0.2s;
//         }
//         .tsp-toggle.on::after { transform:translateX(18px); }

//         /* ── Summary pill ── */
//         .tsp-summary {
//           display:flex; align-items:center; gap:8px;
//           background:linear-gradient(135deg,#ECFDF5,#D1FAE5);
//           border:1px solid #6EE7B7; border-radius:12px;
//           padding:10px 14px; animation:tspFadeUp 0.25s ease both;
//         }
//         .tsp-summary-dot { width:7px; height:7px; border-radius:50%; background:#059669; flex-shrink:0; }
//         .tsp-summary-text { font-size:12.5px; font-weight:700; color:#065F46; }

//         /* ── Error list ── */
//         .tsp-errors {
//           background:#FEF2F2; border:1px solid #FECACA; border-radius:12px;
//           padding:10px 14px; animation:tspShake 0.3s ease both;
//         }
//         .tsp-error-item {
//           font-size:12px; color:#DC2626; font-weight:600;
//           display:flex; align-items:center; gap:6px;
//         }
//         .tsp-error-item + .tsp-error-item { margin-top:5px; }

//         /* ── Reduced motion ── */
//         @media(prefers-reduced-motion:reduce) {
//           .tsp-slot, .tsp-date-btn, .tsp-emergency { transition:none !important; }
//           .tsp-summary, .tsp-custom, .tsp-errors   { animation:none !important; }
//         }

//         /* ── Responsive: tablet ── */
//         @media(max-width:768px) {
//           .tsp-slots { grid-template-columns:repeat(3,1fr); gap:8px; }
//           .tsp-slot  { padding:12px 6px; }
//           .tsp-slot-emoji { font-size:20px; }
//           .tsp-slot-label { font-size:10.5px; }
//           .tsp-date-btn   { padding:7px 12px; font-size:11.5px; }
//           .tsp-label      { font-size:0.95rem; }
//         }

//         /* ── Responsive: mobile ── */
//         @media(max-width:540px) {
//           .tsp-slots  { grid-template-columns:repeat(3,1fr); gap:7px; }
//           .tsp-custom { grid-template-columns:1fr; gap:10px; }
//           .tsp-slot   { padding:11px 4px; border-radius:11px; }
//           .tsp-slot-emoji { font-size:18px; margin-bottom:3px; }
//           .tsp-slot-label { font-size:10px; }
//           .tsp-slot-sub   { display:none; }
//           .tsp-label      { font-size:0.88rem; margin-bottom:12px; }
//           .tsp-emergency  { padding:12px 13px; }
//           .tsp-emg-title  { font-size:12px; }
//           .tsp-emg-sub    { font-size:10.5px; }
//           .tsp-dates      { gap:6px; margin-bottom:14px; }
//           .tsp-date-btn   { padding:7px 10px; font-size:11px; }
//           .tsp-summary    { padding:9px 12px; }
//           .tsp-summary-text { font-size:12px; }
//           .tsp-errors     { padding:9px 12px; }
//           .tsp-error-item { font-size:11.5px; }
//         }

//         /* ── Responsive: tiny phones (≤360px) ── */
//         @media(max-width:360px) {
//           .tsp-slots { grid-template-columns:1fr 1fr; gap:6px; }
//           .tsp-slot-sub { display:none; }
//           .tsp-slot-emoji { font-size:16px; }
//         }
//       `}</style>

//       <div className={`tsp-root ${className}`} role="group" aria-label="Time slot picker">

//         {/* ── Section label ── */}
//         {label && (
//           <div className="tsp-label">
//             <span className="tsp-label-dot" aria-hidden="true" />
//             {label}
//           </div>
//         )}

//         {/* ── Date strip ── */}
//         <div className="tsp-dates" role="listbox" aria-label="Select date">
//           {dateOptions.map(opt => (
//             <button
//               key={opt.value}
//               type="button"
//               role="option"
//               aria-selected={date === opt.value}
//               onClick={() => { setDate(opt.value); setTouched(true); }}
//               className={`tsp-date-btn${date === opt.value ? ' on' : ''}`}
//             >
//               {opt.label}
//             </button>
//           ))}
//           {/* Calendar input for dates beyond the strip */}
//           <input
//             type="date"
//             min={min}
//             value={date}
//             aria-label="Pick a date manually"
//             onChange={e => { setDate(e.target.value); setTouched(true); }}
//             style={{
//               flexShrink: 0, padding: '8px 12px', borderRadius: 10,
//               border: '1.5px solid #DBEAFE', background: '#F8FAFF',
//               fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600,
//               color: '#374151', cursor: 'pointer', outline: 'none',
//             }}
//           />
//         </div>

//         {/* ── Slot preset cards ── */}
//         <div className="tsp-slots" role="listbox" aria-label="Select time slot">
//           {SLOT_PRESETS.map(preset => {
//             const isOn = selectedId === preset.id;
//             return (
//               <button
//                 key={preset.id}
//                 type="button"
//                 role="option"
//                 aria-selected={isOn}
//                 onClick={() => handleSlotSelect(preset)}
//                 className={`tsp-slot${isOn ? ' on' : ''}`}
//               >
//                 {isOn && (
//                   <span className="tsp-slot-check" aria-hidden="true">
//                     <svg width="8" height="8" viewBox="0 0 10 8" fill="none">
//                       <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
//                     </svg>
//                   </span>
//                 )}
//                 {preset.popular && !isOn && (
//                   <span className="tsp-slot-popular">Popular</span>
//                 )}
//                 <div className="tsp-slot-emoji" aria-hidden="true">{preset.emoji}</div>
//                 <div className="tsp-slot-label">{preset.label}</div>
//                 <div className="tsp-slot-sub">{preset.sub}</div>
//               </button>
//             );
//           })}
//         </div>

//         {/* ── Custom time selects (visible only when "Custom" is selected) ── */}
//         {isCustom && (
//           <div className="tsp-custom" role="group" aria-label="Custom time selection">
//             <div>
//               <div className="tsp-inp-label" id="start-time-label">Start time</div>
//               <select
//                 className="tsp-select"
//                 value={startTime}
//                 aria-labelledby="start-time-label"
//                 onChange={e => { setStartTime(e.target.value); setTouched(true); }}
//               >
//                 {timeOptions.map(t => (
//                   <option key={t} value={t}>{fmt12(t)}</option>
//                 ))}
//               </select>
//             </div>
//             <div>
//               <div className="tsp-inp-label" id="end-time-label">End time</div>
//               <select
//                 className="tsp-select"
//                 value={endTime}
//                 aria-labelledby="end-time-label"
//                 onChange={e => { setEndTime(e.target.value); setTouched(true); }}
//               >
//                 {timeOptions.map(t => (
//                   <option key={t} value={t}>{fmt12(t)}</option>
//                 ))}
//               </select>
//             </div>
//           </div>
//         )}

//         {/* ── Emergency toggle ── */}
//         {showEmergency && (
//           <button
//             type="button"
//             aria-pressed={isEmergency}
//             onClick={() => { setIsEmergency(v => !v); setTouched(true); }}
//             className={`tsp-emergency${isEmergency ? ' on' : ''}`}
//           >
//             <div className="tsp-emg-left">
//               <span className="tsp-emg-icon" aria-hidden="true">🚨</span>
//               <div>
//                 <div className="tsp-emg-title">Emergency / Same-day booking</div>
//                 <div className="tsp-emg-sub">Fastest available technician · +₹{emergencyFee} surcharge</div>
//               </div>
//             </div>
//             <div className={`tsp-toggle${isEmergency ? ' on' : ''}`} aria-hidden="true" />
//           </button>
//         )}

//         {/* ── Validation errors (shown after first interaction) ── */}
//         {touched && result.errors.length > 0 && (
//           <div className="tsp-errors" role="alert" aria-live="polite">
//             {result.errors.map((err, i) => (
//               <div key={i} className="tsp-error-item">
//                 <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
//                   <circle cx="8" cy="8" r="7" fill="#FCA5A5"/>
//                   <path d="M8 5v4M8 11v.5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
//                 </svg>
//                 {err}
//               </div>
//             ))}
//           </div>
//         )}

//         {/* ── Success summary pill ── */}
//         {result.valid && result.time_slot && (
//           <div className="tsp-summary" role="status" aria-live="polite">
//             <span className="tsp-summary-dot" aria-hidden="true" />
//             <span className="tsp-summary-text">
//               {result.time_slot} · {fmtDisplayDate(date)}
//               {isEmergency && (
//                 <span style={{ marginLeft: 8, color: '#D97706', fontWeight: 800 }}>
//                   🚨 Emergency +₹{emergencyFee}
//                 </span>
//               )}
//             </span>
//           </div>
//         )}
//       </div>
//     </>
//   );
// }