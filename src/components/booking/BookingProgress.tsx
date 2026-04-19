'use client';

import React from 'react';

const LABELS = ['Service', 'Options', 'Address', 'Schedule', 'Review', 'Done'];

export interface BookingProgressProps {
  /** Current step 1–6 */
  step: number;
}

/**
 * Horizontal progress for desktop; compact “Step N of 6” on mobile — booking stays scannable on narrow viewports.
 */
export default function BookingProgress({ step }: BookingProgressProps) {
  const safeStep = Math.min(6, Math.max(1, step));

  return (
    <>
      <div className="sm:hidden mb-6 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Step {safeStep} of 6 · {LABELS[safeStep - 1]}
        </p>
      </div>

      <div className="hidden sm:flex items-center w-full mb-10 px-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <React.Fragment key={n}>
            {n > 1 ? (
              <div
                className={
                  'h-1 flex-1 min-w-[10px] rounded-full transition-colors ' +
                  (safeStep >= n ? 'bg-[#0D9B6C]' : 'bg-slate-200')
                }
                aria-hidden
              />
            ) : null}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-extrabold transition-colors ' +
                  (safeStep > n
                    ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white shadow-sm'
                    : safeStep === n
                      ? 'border-[#0D9B6C] bg-white text-[#0D9B6C] shadow-sm'
                      : 'border-slate-200 bg-white text-slate-400')
                }
                aria-current={safeStep === n ? 'step' : undefined}
              >
                {safeStep > n ? <span aria-hidden>✓</span> : <span>{n}</span>}
              </div>
              <span
                className={
                  'mt-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-center max-w-[4.5rem] sm:max-w-[5.5rem] truncate ' +
                  (safeStep === n ? 'text-[#0D9B6C]' : safeStep > n ? 'text-slate-700' : 'text-slate-400')
                }
              >
                {LABELS[n - 1]}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
