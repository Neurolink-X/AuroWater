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
 * Horizontal progress for desktop; compact “Step N of 6” on mobile.
 * Completed steps can be clicked to go back without losing data.
 */
export default function BookingProgress({ step, maxStep, onStepClick }: BookingProgressProps) {
  const safeStep = Math.min(6, Math.max(1, step));
  const reach = Math.min(5, Math.max(safeStep, maxStep ?? safeStep));
  const finished = safeStep === 6;

  return (
    <>
      <div className="sm:hidden mb-6 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Step {safeStep} of 6 · {LABELS[safeStep - 1]}
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden" aria-hidden>
          <div
            className="h-full rounded-full bg-[#0D9B6C] transition-all"
            style={{ width: `${(safeStep / 6) * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden sm:flex items-center w-full mb-10 px-2" aria-label="Booking progress">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const clickable = Boolean(onStepClick) && !finished && n <= reach && n !== safeStep && n <= 5;
          const circleCls =
            'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-extrabold transition-colors ' +
            (safeStep > n
              ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white shadow-sm'
              : safeStep === n
                ? 'border-[#0D9B6C] bg-white text-[#0D9B6C] shadow-sm'
                : 'border-slate-200 bg-white text-slate-400');

          const circle = safeStep > n ? <span aria-hidden>✓</span> : <span>{n}</span>;

          return (
            <React.Fragment key={n}>
              {n > 1 ? (
                <li
                  className={
                    'h-1 flex-1 min-w-[10px] rounded-full transition-colors list-none ' +
                    (safeStep >= n ? 'bg-[#0D9B6C]' : 'bg-slate-200')
                  }
                  aria-hidden
                />
              ) : null}
              <li className="flex flex-col items-center shrink-0 list-none" aria-current={safeStep === n ? 'step' : undefined}>
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
                    'mt-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-center max-w-[4.5rem] sm:max-w-[5.5rem] truncate ' +
                    (safeStep === n ? 'text-[#0D9B6C]' : safeStep > n ? 'text-slate-700' : 'text-slate-400')
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














// 'use client';

// import React from 'react';

// const LABELS = ['Service', 'Options', 'Address', 'Schedule', 'Review', 'Done'];

// export interface BookingProgressProps {
//   /** Current step 1–6 */
//   step: number;
// }

// /**
//  * Horizontal progress for desktop; compact “Step N of 6” on mobile — booking stays scannable on narrow viewports.
//  */
// export default function BookingProgress({ step }: BookingProgressProps) {
//   const safeStep = Math.min(6, Math.max(1, step));

//   return (
//     <>
//       <div className="sm:hidden mb-6 text-center">
//         <p className="text-sm font-semibold text-slate-700">
//           Step {safeStep} of 6 · {LABELS[safeStep - 1]}
//         </p>
//       </div>

//       <div className="hidden sm:flex items-center w-full mb-10 px-2">
//         {[1, 2, 3, 4, 5, 6].map((n) => (
//           <React.Fragment key={n}>
//             {n > 1 ? (
//               <div
//                 className={
//                   'h-1 flex-1 min-w-[10px] rounded-full transition-colors ' +
//                   (safeStep >= n ? 'bg-[#0D9B6C]' : 'bg-slate-200')
//                 }
//                 aria-hidden
//               />
//             ) : null}
//             <div className="flex flex-col items-center shrink-0">
//               <div
//                 className={
//                   'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-extrabold transition-colors ' +
//                   (safeStep > n
//                     ? 'border-[#0D9B6C] bg-[#0D9B6C] text-white shadow-sm'
//                     : safeStep === n
//                       ? 'border-[#0D9B6C] bg-white text-[#0D9B6C] shadow-sm'
//                       : 'border-slate-200 bg-white text-slate-400')
//                 }
//                 aria-current={safeStep === n ? 'step' : undefined}
//               >
//                 {safeStep > n ? <span aria-hidden>✓</span> : <span>{n}</span>}
//               </div>
//               <span
//                 className={
//                   'mt-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-center max-w-[4.5rem] sm:max-w-[5.5rem] truncate ' +
//                   (safeStep === n ? 'text-[#0D9B6C]' : safeStep > n ? 'text-slate-700' : 'text-slate-400')
//                 }
//               >
//                 {LABELS[n - 1]}
//               </span>
//             </div>
//           </React.Fragment>
//         ))}
//       </div>
//     </>
//   );
// }
