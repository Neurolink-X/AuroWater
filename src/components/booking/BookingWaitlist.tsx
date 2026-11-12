'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

export const DeferredWaitlistPanel = dynamic(() => import('@/components/ui/WaitlistPanel'), {
  loading: () => <p role="status" className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-900">Opening the waitlist form…</p>,
});

/** Keep locality discovery input separate from the checkout draft. */
export default function BookingWaitlist() {
  const [city, setCity] = useState('');
  return (
    <details className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-800">
        <span>Not in a live delivery city? Join the launch waitlist</span>
        <span className="shrink-0 rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold text-cyan-800">2 min</span>
      </summary>
      <div className="mt-3 space-y-3">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          Your city
          <input
            required
            maxLength={100}
            autoComplete="address-level2"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500"
            placeholder="e.g. Noida, Varanasi, Prayagraj"
            aria-label="Your city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </label>
        {city.trim().length >= 2 ? (
          <DeferredWaitlistPanel key={city.trim().toLowerCase()} cityName={city.trim()} cityId={null} role="customer" source="book" />
        ) : (
          <p className="text-xs leading-5 text-slate-600">Enter your city to continue. We will also ask for your locality and optional PIN code so we can map demand accurately.</p>
        )}
      </div>
    </details>
  );
}
