'use client';
/**
 * src/components/booking/TimeSlotPicker.tsx
 * 3-hour window cards instead of free start/end dropdowns.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SLOT_BLOCKS,
  buildSlotValue,
  getAvailableSlots,
  isSlotAvailable,
  getMinDate,
} from '@/lib/validation/time-slot-client';

export interface TimeSlotPickerValue {
  date: string;
  slotId: string;
  startTime: string;
  endTime: string;
  time_slot: string;
  scheduled_time: string;
  valid: boolean;
}

interface Props {
  value: { date: string; startTime?: string; endTime?: string; slotId?: string };
  onChange: (v: TimeSlotPickerValue) => void;
  minDate?: string;
  showEmergency?: boolean;
  emergencyFee?: number;
}

function to12h(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

export default function TimeSlotPicker({ value, onChange, minDate, showEmergency, emergencyFee }: Props) {
  const date = value.date || minDate || getMinDate();
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(value.slotId ?? '');

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Refresh availability every minute so expired windows grey out.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const available = useMemo(() => getAvailableSlots(date, now), [date, now]);

  // Keep selection valid; auto-pick first available if needed.
  useEffect(() => {
    const cur = SLOT_BLOCKS.find((b) => b.id === selected);
    if (cur && isSlotAvailable(date, cur, now)) return;
    setSelected(available[0]?.id ?? '');
  }, [available, selected, date, now]);

  // Emit value whenever selection/date changes.
  useEffect(() => {
    const v = buildSlotValue(date, selected, new Date());
    onChangeRef.current({
      date: v.date,
      slotId: v.slotId,
      startTime: v.startTime,
      endTime: v.endTime,
      time_slot: v.time_slot,
      scheduled_time: v.scheduled_time,
      valid: v.valid,
    });
  }, [date, selected]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Delivery window">
        {SLOT_BLOCKS.map((b) => {
          const ok = isSlotAvailable(date, b, now);
          const active = selected === b.id && ok;
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!ok}
              onClick={() => setSelected(b.id)}
              className={[
                'rounded-2xl border p-3 text-left transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                !ok
                  ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  : active
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-300',
              ].join(' ')}
            >
              <div className="text-xl">{b.icon}</div>
              <div className="mt-1 text-sm font-bold leading-tight">{b.label}</div>
              <div className="text-xs font-semibold mt-0.5">
                {to12h(b.startTime)} – {to12h(b.endTime)}
              </div>
              {!ok && <div className="text-[10px] mt-1 font-semibold uppercase tracking-wide">Unavailable</div>}
            </button>
          );
        })}
      </div>

      {available.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No more windows left on this date. Please pick another day above.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Our partner will reach you anywhere within the selected 3-hour window.
        {showEmergency && typeof emergencyFee === 'number' && emergencyFee > 0
          ? ' Need it sooner? Use the Emergency option on step 1.'
          : ''}
      </p>
    </div>
  );
}










// 'use client';

// import React, { useCallback, useEffect, useState } from 'react';
// import {
//   validateTimeSlotClient,
//   getTimeOptions,
//   getMinDate,
//   nextFutureSlot,
// } from '@/lib/validation/time-slot-client';

// export interface TimeSlotPickerValue {
//   time_slot: string;
//   scheduled_time: string;
//   valid: boolean;
//   errors: string[];
//   startTime: string;
//   endTime: string;
//   date: string;
// }

// interface TimeSlotPickerProps {
//   value?: Partial<TimeSlotPickerValue>;
//   onChange: (v: TimeSlotPickerValue) => void;
//   minDate?: string;
//   className?: string;
//   /** Optional — shown when booking wizard enables emergency surcharge context. */
//   showEmergency?: boolean;
//   emergencyFee?: number;
// }

// const timeOptions = getTimeOptions();

// export default function TimeSlotPicker({
//   value,
//   onChange,
//   minDate,
//   className = '',
//   showEmergency,
//   emergencyFee,
// }: TimeSlotPickerProps) {
//   const min = minDate ?? getMinDate();
//   const boot = nextFutureSlot(value?.date ?? min);
//   const [date, setDate] = useState(value?.date && value.date >= min ? value.date : boot.date);
//   const [startTime, setStartTime] = useState(value?.startTime ?? boot.startTime);
//   const [endTime, setEndTime] = useState(value?.endTime ?? boot.endTime);
//   const [touched, setTouched] = useState(false);

//   useEffect(() => {
//     const check = validateTimeSlotClient(startTime, endTime, date);
//     if (check.valid) return;
//     const n = nextFutureSlot(date >= min ? date : min);
//     setDate(n.date);
//     setStartTime(n.startTime);
//     setEndTime(n.endTime);
//     // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time bump if default slot is already in the past
//   }, []);

//   const runValidation = useCallback(() => {
//     const result = validateTimeSlotClient(startTime, endTime, date);
//     onChange({
//       startTime,
//       endTime,
//       date,
//       time_slot: result.time_slot,
//       scheduled_time: result.scheduled_time,
//       valid: result.valid,
//       errors: result.errors,
//     });
//   }, [startTime, endTime, date, onChange]);

//   useEffect(() => {
//     runValidation();
//   }, [runValidation]);

//   const handleBlur = () => setTouched(true);
//   const result = validateTimeSlotClient(startTime, endTime, date);

//   return (
//     <div className={`space-y-4 ${className}`}>
//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <div>
//           <label className="block text-sm font-medium text-slate-600 mb-1.5">
//             Date
//           </label>
//           <input
//             type="date"
//             min={min}
//             value={date}
//             onChange={(e) => setDate(e.target.value)}
//             onBlur={handleBlur}
//             className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2.5 text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
//           />
//         </div>
//         <div>
//           <label className="block text-sm font-medium text-slate-600 mb-1.5">
//             Start time
//           </label>
//           <select
//             value={startTime}
//             onChange={(e) => setStartTime(e.target.value)}
//             onBlur={handleBlur}
//             className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2.5 text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
//           >
//             {timeOptions.map((t) => (
//               <option key={t} value={t}>
//                 {t}
//               </option>
//             ))}
//           </select>
//         </div>
//         <div>
//           <label className="block text-sm font-medium text-slate-600 mb-1.5">
//             End time
//           </label>
//           <select
//             value={endTime}
//             onChange={(e) => setEndTime(e.target.value)}
//             onBlur={handleBlur}
//             className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2.5 text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
//           >
//             {timeOptions.map((t) => (
//               <option key={t} value={t}>
//                 {t}
//               </option>
//             ))}
//           </select>
//         </div>
//       </div>
//       {touched && result.errors.length > 0 && (
//         <ul className="text-sm text-rose-600 space-y-1">
//           {result.errors.map((err, i) => (
//             <li key={i}>{err}</li>
//           ))}
//         </ul>
//       )}
//       {result.valid && result.time_slot && (
//         <p className="text-sm text-emerald-700 font-medium">
//           Slot: {result.time_slot} on {date}
//         </p>
//       )}
//       {showEmergency && typeof emergencyFee === 'number' && emergencyFee > 0 ? (
//         <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
//           Emergency booking adds ₹{Math.round(emergencyFee)} platform surcharge (shown in review).
//         </p>
//       ) : null}
//     </div>
//   );
// }
