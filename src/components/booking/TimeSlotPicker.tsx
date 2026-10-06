'use client';

/* This component intentionally hydrates browser state after mount. */
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * src/components/booking/TimeSlotPicker.tsx
 * 3-hour delivery window cards (+ ASAP card for emergency bookings today).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ASAP_SLOT_ID,
  SLOT_BLOCKS,
  buildSlotValue,
  getMinDate,
  isAsapAvailable,
  isSlotAvailable,
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
  /** Emergency booking → shows the ASAP window (today only). */
  emergency?: boolean;
  /** Kept for backwards compatibility with older callers. */
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

export default function TimeSlotPicker({ value, onChange, minDate, emergency = false }: Props) {
  const date = value.date || minDate || getMinDate();
  const [now, setNow] = useState(() => new Date());

  const [selected, setSelected] = useState<string>(() =>
    emergency && isAsapAvailable(date) ? ASAP_SLOT_ID : value.slotId ?? '',
  );

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const asapOk = emergency && isAsapAvailable(date, now);

  const availableIds = useMemo(() => {
    const ids = SLOT_BLOCKS.filter((b) => isSlotAvailable(date, b, now)).map((b) => b.id);
    return asapOk ? [ASAP_SLOT_ID, ...ids] : ids;
  }, [date, now, asapOk]);

  // Keep the selection valid; fall back to the first available option.
  useEffect(() => {
    if (selected && availableIds.includes(selected)) return;
    setSelected(availableIds[0] ?? '');
  }, [availableIds, selected]);

  // Emit whenever date/selection changes.
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

  const asapPreview = asapOk ? buildSlotValue(date, ASAP_SLOT_ID, now) : null;

  return (
    <div className="space-y-3">
      {asapOk && asapPreview && (
        <button
          type="button"
          role="radio"
          aria-checked={selected === ASAP_SLOT_ID}
          onClick={() => setSelected(ASAP_SLOT_ID)}
          className={[
            'w-full rounded-2xl border p-4 text-left transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
            selected === ASAP_SLOT_ID
              ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
              : 'border-amber-200 bg-white hover:border-amber-400',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>⚡</span>
            <div>
              <div className="text-sm font-bold text-slate-900">ASAP · Emergency</div>
              <div className="text-xs font-semibold text-slate-600">
                Arrive between {to12h(asapPreview.startTime)} – {to12h(asapPreview.endTime)}
              </div>
            </div>
          </div>
        </button>
      )}

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
              <div className="text-xl" aria-hidden>{b.icon}</div>
              <div className="mt-1 text-sm font-bold leading-tight">{b.label}</div>
              <div className="text-xs font-semibold mt-0.5">
                {to12h(b.startTime)} – {to12h(b.endTime)}
              </div>
              {!ok && <div className="text-[10px] mt-1 font-semibold uppercase tracking-wide">Unavailable</div>}
            </button>
          );
        })}
      </div>

      {availableIds.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
          No more windows left on this date. Please pick another day above.
        </p>
      )}

      <p className="text-xs text-slate-500">
        Our partner reaches you anywhere within the selected window.
        {!emergency ? ' Need it sooner? Turn on Emergency booking in step 1.' : ''}
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
