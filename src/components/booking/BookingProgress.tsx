'use client';

import React from 'react';

const LABELS = ['Service', 'Options', 'Address', 'Schedule', 'Review', 'Done'];

export interface BookingProgressProps {
  /** Current step 1–6 */
  step: number;
  /** Furthest step reached (optional; enables going forward again after going back) */
  maxStep?: number;
  /** If provided, reached steps (except Done) become clickable */
  onStepClick?: (step: number) => void;
}

/**
 * Horizontal progress for desktop; compact progress bar on mobile.
 * Completed steps can be clicked to go back without losing data.
 * Props and behaviour are unchanged from the previous version.
 */
export default function BookingProgress({ step, maxStep, onStepClick }: BookingProgressProps) {
  const safeStep = Math.min(6, Math.max(1, step));
  const reach = Math.min(5, Math.max(safeStep, maxStep ?? safeStep));
  const finished = safeStep === 6;
  const nextLabel = safeStep < 6 ? LABELS[safeStep] : null;

  return (
    <>
      {/* Mobile: slim bar with a "next up" hint */}
      <div className="sm:hidden mb-6">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-bold text-slate-800">
            Step {safeStep} of 6 · {LABELS[safeStep - 1]}
          </p>
          {nextLabel ? (
            <p className="text-[11px] font-semibold text-slate-400">Next: {nextLabel}</p>
          ) : (
            <p className="text-[11px] font-bold text-emerald-700">Complete</p>
          )}
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Booking progress"
          aria-valuemin={1}
          aria-valuemax={6}
          aria-valuenow={safeStep}
          aria-valuetext={`Step ${safeStep} of 6: ${LABELS[safeStep - 1]}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(8, (safeStep / 6) * 100)}%` }}
          />
        </div>
      </div>

      {/* Desktop */}
      <ol className="hidden sm:flex items-center w-full mb-10 px-2" aria-label="Booking progress">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const clickable = Boolean(onStepClick) && !finished && n <= reach && n !== safeStep && n <= 5;
          const done = safeStep > n;
          const current = safeStep === n;
          const circleCls =
            'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-extrabold transition-all duration-300 ' +
            (done
              ? 'border-transparent bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25'
              : current
                ? 'border-emerald-500 bg-white text-emerald-700 shadow-md ring-4 ring-emerald-100'
                : 'border-slate-200 bg-white text-slate-400');

          const circle = done ? <span aria-hidden>✓</span> : <span>{n}</span>;

          return (
            <React.Fragment key={n}>
              {n > 1 ? (
                <li className="h-1.5 flex-1 min-w-[10px] overflow-hidden rounded-full bg-slate-200 list-none" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
                    style={{ width: safeStep >= n ? '100%' : '0%' }}
                  />
                </li>
              ) : null}
              <li className="flex flex-col items-center shrink-0 list-none" aria-current={current ? 'step' : undefined}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onStepClick?.(n)}
                    aria-label={`Go to step ${n}: ${LABELS[n - 1]}`}
                    className={`${circleCls} cursor-pointer hover:ring-4 hover:ring-emerald-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200`}
                  >
                    {circle}
                  </button>
                ) : (
                  <div className={circleCls}>{circle}</div>
                )}
                <span
                  className={
                    'mt-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-center max-w-[4.5rem] sm:max-w-[5.5rem] truncate ' +
                    (current ? 'text-emerald-700' : done ? 'text-slate-700' : 'text-slate-400')
                  }
                >
                  {LABELS[n - 1]}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </>
  );
}
