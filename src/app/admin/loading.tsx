// src/app/admin/loading.tsx

/**
 * AuroWater Admin: Loading screen
 * Theme: "water filling the control center"
 *
 * Why it is fast:
 * - Server component: no "use client", no hooks, no JS shipped for this file
 * - Pure CSS animations (GPU-friendly: transform + opacity + background-position)
 * - No images, no fonts, no network requests
 * - Respects prefers-reduced-motion
 */

type SkelProps = {
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
};

/** A skeleton block with a flowing-water shimmer */
function Skel({ className = '', style, delay = 0 }: SkelProps) {
  return (
    <div
      className={`aw-skel ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
    />
  );
}

/** Bubbles rising in the background (fixed values = no hydration issues) */
const BUBBLES = [
  { left: '6%', size: 10, duration: 9, delay: 0 },
  { left: '14%', size: 6, duration: 7, delay: 2 },
  { left: '27%', size: 14, duration: 11, delay: 1 },
  { left: '38%', size: 8, duration: 8, delay: 4 },
  { left: '52%', size: 12, duration: 10, delay: 3 },
  { left: '63%', size: 6, duration: 7.5, delay: 5 },
  { left: '74%', size: 16, duration: 12, delay: 0.5 },
  { left: '83%', size: 9, duration: 9, delay: 2.5 },
  { left: '92%', size: 7, duration: 8, delay: 6 },
];

const CHART_BARS = [42, 65, 48, 78, 56, 88, 68, 96, 72, 84, 62, 76];

/** Seamless wave: path repeats every 600 units, we slide by 50% */
function Wave({
  className = '',
  duration = 6,
  reverse = false,
}: {
  className?: string;
  duration?: number;
  reverse?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      className={`aw-wave absolute bottom-0 left-0 h-6 w-[200%] ${className}`}
      style={{
        animationDuration: `${duration}s`,
        animationDirection: reverse ? 'reverse' : 'normal',
      }}
    >
      <path
        d="M0 20 Q150 0 300 20 T600 20 T900 20 T1200 20 V40 H0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AdminLoading() {
  return (
    <div
      className="aw-root relative min-h-[calc(100vh-4rem)] overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading AuroWater admin control center"
    >
      {/* All animations live here (CSS only) */}
      <style>{`
        @keyframes aw-flow {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes aw-wave {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes aw-bubble {
          0%   { transform: translate3d(0, 0, 0) scale(0.6); opacity: 0; }
          15%  { opacity: 0.55; }
          85%  { opacity: 0.25; }
          100% { transform: translate3d(14px, -110vh, 0) scale(1.1); opacity: 0; }
        }
        @keyframes aw-ripple {
          0%   { transform: scale(0.55); opacity: 0.7; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes aw-drop {
          0%, 100% { transform: translate3d(0, -2px, 0) scale(1, 1); }
          50%      { transform: translate3d(0, 3px, 0) scale(1.06, 0.94); }
        }
        @keyframes aw-level {
          0%, 100% { transform: scaleY(0.82); }
          50%      { transform: scaleY(1); }
        }
        @keyframes aw-fill {
          0%   { transform: translate3d(-101%, 0, 0); }
          100% { transform: translate3d(101%, 0, 0); }
        }
        @keyframes aw-hop {
          0%, 80%, 100% { transform: translate3d(0, 0, 0); opacity: 0.4; }
          40%           { transform: translate3d(0, -6px, 0); opacity: 1; }
        }
        @keyframes aw-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.08); }
        }

        .aw-skel {
          background-color: rgba(255, 255, 255, 0.06);
          background-image: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0) 30%,
            rgba(34, 211, 238, 0.16) 48%,
            rgba(96, 165, 250, 0.16) 52%,
            rgba(255, 255, 255, 0) 70%
          );
          background-size: 200% 100%;
          animation: aw-flow 1.8s linear infinite;
          border-radius: 0.5rem;
          will-change: background-position;
        }
        .aw-wave   { animation: aw-wave 6s linear infinite; will-change: transform; }
        .aw-bubble { animation: aw-bubble linear infinite; will-change: transform, opacity; }
        .aw-ripple { animation: aw-ripple 2.4s ease-out infinite; }
        .aw-drop   { animation: aw-drop 1.8s ease-in-out infinite; }
        .aw-level  { transform-origin: bottom; animation: aw-level 2.6s ease-in-out infinite; }
        .aw-fill   { animation: aw-fill 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .aw-hop    { animation: aw-hop 1.2s ease-in-out infinite; }
        .aw-glow   { animation: aw-glow 4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .aw-root *, .aw-root *::before, .aw-root *::after {
            animation: none !important;
          }
        }
      `}</style>

      {/* Top flowing water line (feels like instant progress) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-white/5"
      >
        <div className="aw-fill h-full w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
      </div>

      {/* Ambient background: glows + rising bubbles */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="aw-glow absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div
          className="aw-glow absolute right-0 top-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"
          style={{ animationDelay: '1.5s' }}
        />

        {BUBBLES.map((bubble, index) => (
          <span
            key={index}
            className="aw-bubble absolute -bottom-6 rounded-full border border-cyan-300/30 bg-cyan-300/10"
            style={{
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDuration: `${bubble.duration}s`,
              animationDelay: `${bubble.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-7xl space-y-6">
        {/* =====================================================
            HEADER (water drop + ripples + flowing wave)
           ===================================================== */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-4 pb-9 sm:p-6 sm:pb-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              {/* Droplet loader */}
              <div
                aria-hidden="true"
                className="relative flex h-14 w-14 shrink-0 items-center justify-center"
              >
                <span className="aw-ripple absolute inset-0 rounded-full border border-cyan-400/50" />
                <span
                  className="aw-ripple absolute inset-0 rounded-full border border-cyan-400/40"
                  style={{ animationDelay: '0.8s' }}
                />
                <span
                  className="aw-ripple absolute inset-0 rounded-full border border-blue-400/30"
                  style={{ animationDelay: '1.6s' }}
                />
                <svg
                  viewBox="0 0 24 24"
                  className="aw-drop relative h-8 w-8 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
                >
                  <defs>
                    <linearGradient id="aw-drop-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#67e8f9" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5Z"
                    fill="url(#aw-drop-grad)"
                  />
                  <path
                    d="M9 14.5a3 3 0 0 0 2.2 2.9"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </div>

              <div className="space-y-3">
                <Skel className="h-7 w-44 rounded-lg sm:h-8 sm:w-64" />
                <Skel className="h-3.5 w-60 max-w-full sm:w-96" delay={120} />
                <div className="flex items-center gap-2 pt-1">
                  <span className="aw-hop h-2 w-2 rounded-full bg-cyan-400/80" />
                  <Skel className="h-3 w-20" delay={240} />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Skel className="h-10 w-24 rounded-xl" delay={150} />
              <Skel className="h-10 w-28 rounded-xl" delay={300} />
            </div>
          </div>

          {/* Two layered waves at the bottom of the header */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 text-cyan-400/15">
            <Wave duration={7} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-6 text-blue-400/15">
            <Wave duration={5} reverse />
          </div>
        </section>

        {/* =====================================================
            QUICK ACTIONS
           ===================================================== */}
        <section>
          <Skel className="mb-3 h-3 w-28" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skel
                key={index}
                className="h-14 rounded-xl border border-white/10"
                delay={index * 90}
              />
            ))}
          </div>
        </section>

        {/* =====================================================
            KPI CARDS (each card has a small water level)
           ===================================================== */}
        <section>
          <Skel className="mb-3 h-3 w-24" />

          <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="relative h-32 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                {/* water level inside card */}
                <div
                  aria-hidden="true"
                  className="aw-level pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-cyan-400/10 to-transparent"
                  style={{ animationDelay: `${index * 250}ms` }}
                />

                <div className="relative flex items-start justify-between">
                  <Skel className="h-9 w-9 rounded-xl" delay={index * 90} />
                  <Skel className="h-3 w-12" delay={index * 90 + 60} />
                </div>

                <Skel className="relative mt-5 h-7 w-24" delay={index * 90 + 120} />
                <Skel className="relative mt-2 h-3 w-32" delay={index * 90 + 180} />
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            ANALYTICS / OPERATIONS
           ===================================================== */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="min-h-[280px] rounded-2xl border border-white/10 bg-white/[0.035] p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <Skel className="h-5 w-36" />
                <Skel className="mt-2 h-3 w-52" delay={100} />
              </div>

              <Skel className="h-9 w-24" delay={200} />
            </div>

            {/* Water-level chart: bars rise and fall like tides */}
            <div className="mt-8 flex h-44 items-end gap-2">
              {CHART_BARS.map((height, index) => (
                <div
                  key={index}
                  className="aw-level flex-1 rounded-t-lg bg-gradient-to-t from-cyan-400/25 via-blue-400/15 to-white/[0.04]"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${index * 140}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[280px] rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <Skel className="h-5 w-32" />
            <Skel className="mt-2 h-3 w-44" delay={100} />

            <div className="mt-8 space-y-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index}>
                  <div className="flex justify-between">
                    <Skel className="h-3 w-20" delay={index * 100} />
                    <Skel className="h-3 w-10" delay={index * 100 + 50} />
                  </div>

                  {/* Progress bar with flowing water */}
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full overflow-hidden rounded-full bg-cyan-400/20"
                      style={{ width: `${35 + index * 15}%` }}
                    >
                      <div
                        className="aw-fill h-full w-full bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent"
                        style={{ animationDelay: `${index * 200}ms` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            RECENT ACTIVITY / TABLE
           ===================================================== */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5">
            <div>
              <Skel className="h-5 w-36" />
              <Skel className="mt-2 h-3 w-48" delay={100} />
            </div>

            <Skel className="h-9 w-20" delay={200} />
          </div>

          {/* Desktop/tablet rows */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-5 gap-4 border-b border-white/5 px-5 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skel key={index} className="h-3 rounded" delay={index * 60} />
              ))}
            </div>

            <div className="divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, row) => (
                <div
                  key={row}
                  className="grid grid-cols-5 items-center gap-4 px-5 py-4"
                >
                  {Array.from({ length: 5 }).map((_, column) => (
                    <Skel
                      key={column}
                      className={`h-4 rounded ${
                        column === 0
                          ? 'w-28'
                          : column === 4
                            ? 'w-16'
                            : 'w-20'
                      }`}
                      delay={row * 110 + column * 40}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile rows */}
          <div className="divide-y divide-white/5 sm:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Skel className="h-4 w-28 rounded" delay={index * 110} />
                  <Skel className="h-4 w-16 rounded" delay={index * 110 + 40} />
                </div>

                <Skel className="h-3 w-40 rounded" delay={index * 110 + 80} />

                <div className="flex justify-between">
                  <Skel className="h-3 w-20 rounded" delay={index * 110 + 120} />
                  <Skel className="h-3 w-24 rounded" delay={index * 110 + 160} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            FOOTER STATUS
           ===================================================== */}
        <div className="flex items-center justify-center gap-3 py-2">
          <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="aw-hop h-1.5 w-1.5 rounded-full bg-cyan-400"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>

          <span className="text-xs text-slate-500">
            Filling AuroWater Control Center…
          </span>
        </div>
      </div>

      <span className="sr-only">
        Loading dashboard data, analytics, orders, users and
        operational metrics…
      </span>
    </div>
  );
}








// export default function AdminLoading() {
//   return (
//     <div
//       className="relative min-h-[calc(100vh-4rem)] overflow-hidden"
//       role="status"
//       aria-label="Loading AuroWater admin control center"
//     >
//       {/* Ambient background */}
//       <div
//         aria-hidden="true"
//         className="pointer-events-none absolute inset-0 overflow-hidden"
//       >
//         <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
//         <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />
//       </div>

//       <div className="relative mx-auto w-full max-w-7xl space-y-6">
//         {/* =====================================================
//             HEADER
//            ===================================================== */}
//         <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
//           <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
//             <div className="space-y-3">
//               <div className="h-7 w-52 animate-pulse rounded-lg bg-white/10 sm:h-8 sm:w-64" />

//               <div className="h-3.5 w-72 max-w-full animate-pulse rounded bg-white/5 sm:w-96" />

//               <div className="flex items-center gap-2 pt-1">
//                 <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400/60" />
//                 <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
//               </div>
//             </div>

//             <div className="flex gap-2">
//               <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" />
//               <div className="h-10 w-28 animate-pulse rounded-xl bg-white/5" />
//             </div>
//           </div>
//         </section>

//         {/* =====================================================
//             QUICK ACTIONS
//            ===================================================== */}
//         <section>
//           <div className="mb-3 h-3 w-28 animate-pulse rounded bg-white/5" />

//           <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
//             {Array.from({ length: 4 }).map((_, index) => (
//               <div
//                 key={index}
//                 className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.035]"
//               />
//             ))}
//           </div>
//         </section>

//         {/* =====================================================
//             KPI CARDS
//            ===================================================== */}
//         <section>
//           <div className="mb-3 h-3 w-24 animate-pulse rounded bg-white/5" />

//           <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
//             {Array.from({ length: 4 }).map((_, index) => (
//               <div
//                 key={index}
//                 className="relative h-32 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5"
//               >
//                 <div className="flex items-start justify-between">
//                   <div className="h-9 w-9 animate-pulse rounded-xl bg-white/10" />
//                   <div className="h-3 w-12 animate-pulse rounded bg-white/5" />
//                 </div>

//                 <div className="mt-5 h-7 w-24 animate-pulse rounded-lg bg-white/10" />

//                 <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/5" />
//               </div>
//             ))}
//           </div>
//         </section>

//         {/* =====================================================
//             ANALYTICS / OPERATIONS
//            ===================================================== */}
//         <section className="grid gap-4 lg:grid-cols-3">
//           <div className="min-h-[280px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.035] p-5 lg:col-span-2">
//             <div className="flex items-center justify-between">
//               <div>
//                 <div className="h-5 w-36 rounded bg-white/10" />
//                 <div className="mt-2 h-3 w-52 rounded bg-white/5" />
//               </div>

//               <div className="h-9 w-24 rounded-lg bg-white/5" />
//             </div>

//             {/* Fake chart */}
//             <div className="mt-8 flex h-44 items-end gap-2">
//               {[42, 65, 48, 78, 56, 88, 68, 96, 72, 84, 62, 76].map(
//                 (height, index) => (
//                   <div
//                     key={index}
//                     className="flex-1 rounded-t-lg bg-white/[0.07]"
//                     style={{ height: `${height}%` }}
//                   />
//                 ),
//               )}
//             </div>
//           </div>

//           <div className="min-h-[280px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.035] p-5">
//             <div className="h-5 w-32 rounded bg-white/10" />
//             <div className="mt-2 h-3 w-44 rounded bg-white/5" />

//             <div className="mt-8 space-y-5">
//               {Array.from({ length: 4 }).map((_, index) => (
//                 <div key={index}>
//                   <div className="flex justify-between">
//                     <div className="h-3 w-20 rounded bg-white/5" />
//                     <div className="h-3 w-10 rounded bg-white/5" />
//                   </div>

//                   <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
//                     <div
//                       className="h-full rounded-full bg-white/[0.08]"
//                       style={{
//                         width: `${35 + index * 15}%`,
//                       }}
//                     />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </section>

//         {/* =====================================================
//             RECENT ACTIVITY / TABLE
//            ===================================================== */}
//         <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
//           <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5">
//             <div>
//               <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
//               <div className="mt-2 h-3 w-48 animate-pulse rounded bg-white/5" />
//             </div>

//             <div className="h-9 w-20 animate-pulse rounded-lg bg-white/5" />
//           </div>

//           {/* Desktop/tablet rows */}
//           <div className="hidden sm:block">
//             <div className="grid grid-cols-5 gap-4 border-b border-white/5 px-5 py-3">
//               {Array.from({ length: 5 }).map((_, index) => (
//                 <div
//                   key={index}
//                   className="h-3 animate-pulse rounded bg-white/5"
//                 />
//               ))}
//             </div>

//             <div className="divide-y divide-white/5">
//               {Array.from({ length: 5 }).map((_, row) => (
//                 <div
//                   key={row}
//                   className="grid grid-cols-5 items-center gap-4 px-5 py-4"
//                 >
//                   {Array.from({ length: 5 }).map((_, column) => (
//                     <div
//                       key={column}
//                       className={`h-4 animate-pulse rounded bg-white/[0.055] ${
//                         column === 0
//                           ? 'w-28'
//                           : column === 4
//                             ? 'w-16'
//                             : 'w-20'
//                       }`}
//                     />
//                   ))}
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Mobile rows */}
//           <div className="divide-y divide-white/5 sm:hidden">
//             {Array.from({ length: 4 }).map((_, index) => (
//               <div key={index} className="space-y-3 p-4">
//                 <div className="flex items-center justify-between">
//                   <div className="h-4 w-28 animate-pulse rounded bg-white/[0.08]" />
//                   <div className="h-4 w-16 animate-pulse rounded bg-white/5" />
//                 </div>

//                 <div className="h-3 w-40 animate-pulse rounded bg-white/5" />

//                 <div className="flex justify-between">
//                   <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
//                   <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
//                 </div>
//               </div>
//             ))}
//           </div>
//         </section>

//         {/* =====================================================
//             FOOTER STATUS
//            ===================================================== */}
//         <div className="flex items-center justify-center gap-2 py-2">
//           <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />

//           <span className="text-xs text-slate-500">
//             Loading AuroWater Control Center…
//           </span>
//         </div>
//       </div>

//       <span className="sr-only">
//         Loading dashboard data, analytics, orders, users and
//         operational metrics…
//       </span>
//     </div>
//   );
// }
