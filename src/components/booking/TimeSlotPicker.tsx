'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  validateTimeSlotClient,
  getTimeOptions,
  getMinDate,
} from '@/lib/validation/time-slot-client';

export interface TimeSlotPickerValue {
  time_slot: string;
  scheduled_time: string;
  valid: boolean;
  errors: string[];
  startTime: string;
  endTime: string;
  date: string;
}

interface TimeSlotPickerProps {
  value?: Partial<TimeSlotPickerValue>;
  onChange: (v: TimeSlotPickerValue) => void;
  minDate?: string;
  className?: string;
  /** Optional — shown when booking wizard enables emergency surcharge context. */
  showEmergency?: boolean;
  emergencyFee?: number;
}

const timeOptions = getTimeOptions();

export default function TimeSlotPicker({
  value,
  onChange,
  minDate,
  className = '',
  showEmergency,
  emergencyFee,
}: TimeSlotPickerProps) {
  const min = minDate ?? getMinDate();
  const [date, setDate] = useState(value?.date ?? min);
  const [startTime, setStartTime] = useState(value?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(value?.endTime ?? '09:30');
  const [touched, setTouched] = useState(false);

  const runValidation = useCallback(() => {
    const result = validateTimeSlotClient(startTime, endTime, date);
    onChange({
      startTime,
      endTime,
      date,
      time_slot: result.time_slot,
      scheduled_time: result.scheduled_time,
      valid: result.valid,
      errors: result.errors,
    });
  }, [startTime, endTime, date, onChange]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const handleBlur = () => setTouched(true);
  const result = validateTimeSlotClient(startTime, endTime, date);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Date
          </label>
          <input
            type="date"
            min={min}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={handleBlur}
            className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2.5 text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Start time
          </label>
          <select
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            onBlur={handleBlur}
            className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2.5 text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
          >
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            End time
          </label>
          <select
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            onBlur={handleBlur}
            className="w-full rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2.5 text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
          >
            {timeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      {touched && result.errors.length > 0 && (
        <ul className="text-sm text-rose-600 space-y-1">
          {result.errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
      {result.valid && result.time_slot && (
        <p className="text-sm text-emerald-700 font-medium">
          Slot: {result.time_slot} on {date}
        </p>
      )}
      {showEmergency && typeof emergencyFee === 'number' && emergencyFee > 0 ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Emergency booking adds ₹{Math.round(emergencyFee)} platform surcharge (shown in review).
        </p>
      ) : null}
    </div>
  );
}
