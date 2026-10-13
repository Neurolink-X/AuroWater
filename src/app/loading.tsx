import Image from 'next/image';

/**
 * src/app/loading.tsx
 *
 * Instant loading UI for route changes and first load.
 *
 * WHY IT IS BUILT THIS WAY
 * ─────────────────────────
 * 1. Server Component, zero JavaScript.
 *    It paints with the first HTML bytes. No hydration, no useEffect,
 *    no matchMedia: reduced motion is handled in CSS.
 *
 * 2. Delayed reveal (anti-flash).
 *    Nothing is visible for the first REVEAL_DELAY. Fast navigations finish
 *    before that, so the user never sees a flicker. Slow ones get feedback
 *    right after. (Pure CSS: animation-delay.)
 *
 * 3. Top progress bar + page skeleton.
 *    The bar says "something is happening". The skeleton shows the shape of
 *    the page, which feels faster than a spinner. The header and footer from
 *    RootChrome stay on screen, so moving between pages feels instant.
 *
 * 4. Compositor-only animation.
 *    Only `transform` and `opacity` are animated (GPU, no layout, no paint
 *    storms). No blur filters, no gradients on large areas, no images beyond
 *    one tiny SVG. Smooth even on low-end Android.
 *
 * 5. Slow-network helper.
 *    After SLOW_HINT_AFTER a short message appears. Nobody is left staring at
 *    a skeleton wondering if the app is stuck. (Pure CSS timer.)
 *
 * 6. Accessible and future proof.
 *    role="status" + sr-only text, reduced-motion respected, forced-colors
 *    (high contrast) supported, safe-area aware, all colours are CSS
 *    variables (add a dark block later without touching the markup), and the
 *    brand name comes from one env var.
 *
 * TUNING: change the two values below (REVEAL_DELAY, SLOW_HINT_AFTER).
 */

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'AuroTap';

const REVEAL_DELAY = '120ms'; // nothing shows before this (prevents flicker)
const SLOW_HINT_AFTER = '4s'; // "taking longer than usual" message

const loadingCss = `
.al-root{
  --al-base:#E2E8F0;
  --al-shine:rgba(255,255,255,.65);
  --al-accent-a:#0284C7;
  --al-accent-b:#2563EB;
  animation:al-reveal .2s ease-out ${REVEAL_DELAY} both;
}

/* ── Progress bar (top of screen) ── */
.al-bar{
  position:fixed;left:0;right:0;top:env(safe-area-inset-top,0px);
  height:3px;overflow:hidden;pointer-events:none;z-index:99990;
}
.al-bar::before{
  content:"";position:absolute;top:0;bottom:0;left:0;width:40%;
  background:linear-gradient(90deg,transparent,var(--al-accent-a),var(--al-accent-b),transparent);
  transform:translateX(-100%);will-change:transform;
  animation:al-slide 1.3s cubic-bezier(.4,0,.2,1) infinite;
}

/* ── Skeleton blocks with a light sweep ── */
.al-skel{position:relative;overflow:hidden;background:var(--al-base)}
.al-skel::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(90deg,transparent,var(--al-shine),transparent);
  transform:translateX(-100%);will-change:transform;
  animation:al-shimmer 1.4s ease-in-out infinite;
}

/* ── Brand mark ── */
.al-mark{animation:al-breathe 1.8s ease-in-out infinite;will-change:transform,opacity}

/* ── Slow-network message ── */
.al-slow{animation:al-reveal .3s ease-out ${SLOW_HINT_AFTER} both}

@keyframes al-reveal{from{opacity:0;visibility:hidden}to{opacity:1;visibility:visible}}
@keyframes al-slide{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@keyframes al-shimmer{to{transform:translateX(100%)}}
@keyframes al-breathe{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.07);opacity:1}}

@media (prefers-reduced-motion:reduce){
  .al-bar::before{animation:none;width:100%;transform:none;opacity:.35}
  .al-skel::after{animation:none;display:none}
  .al-mark{animation:none;opacity:1}
}

@media (forced-colors:active){
  .al-skel{background:Canvas;outline:1px solid GrayText}
  .al-bar::before{background:Highlight}
}
`;

function Skel({ className }: { className: string }) {
  return <div aria-hidden="true" className={`al-skel ${className}`} />;
}

export default function Loading() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loadingCss }} />

      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="al-root mx-auto flex min-h-[60svh] w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <span className="sr-only">Loading {APP_NAME}…</span>

        <div className="al-bar" aria-hidden="true" />

        {/* Heading row: brand mark + title lines */}
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <Image
              src="/aurotap-mark.svg"
              alt=""
              width={32}
              height={32}
              unoptimized
              loading="eager"
              className="al-mark h-8 w-8 object-contain"
            />
          </div>

          <div className="flex-1 space-y-2.5">
            <Skel className="h-6 w-44 rounded-lg sm:h-7 sm:w-60" />
            <Skel className="h-4 w-full max-w-sm rounded-md" />
          </div>
        </div>

        {/* Main feature block */}
        <Skel className="h-44 rounded-3xl sm:h-56" />

        {/* Service tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Skel className="h-28 rounded-2xl sm:h-32" />
          <Skel className="h-28 rounded-2xl sm:h-32" />
          <Skel className="h-28 rounded-2xl sm:h-32" />
          <Skel className="h-28 rounded-2xl sm:h-32" />
        </div>

        {/* Primary action */}
        <Skel className="h-12 w-full rounded-2xl sm:max-w-xs" />

        {/* Appears only if loading is slow */}
        <p className="al-slow mt-auto pt-2 text-center text-sm text-slate-500">
          Taking longer than usual. Please check your internet connection.
        </p>
      </div>
    </>
  );
}









// 'use client';

// import Image from 'next/image';
// import { useEffect, useState } from 'react';

// export default function Loading() {
//   const [reducedMotion, setReducedMotion] = useState(false);

//   useEffect(() => {
//     const mediaQuery = window.matchMedia(
//       '(prefers-reduced-motion: reduce)',
//     );

//     const updateMotionPreference = () => {
//       setReducedMotion(mediaQuery.matches);
//     };

//     updateMotionPreference();

//     mediaQuery.addEventListener('change', updateMotionPreference);

//     return () => {
//       mediaQuery.removeEventListener(
//         'change',
//         updateMotionPreference,
//       );
//     };
//   }, []);

//   return (
//     <main
//       role="status"
//       aria-live="polite"
//       aria-busy="true"
//       aria-label="Loading AuroTap"
//       className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-blue-900 px-6 py-12 text-white"
//     >
//       {/* Decorative background elements */}
//       <div
//         aria-hidden="true"
//         className="pointer-events-none absolute inset-0 overflow-hidden"
//       >
//         <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-300/15 blur-3xl" />

//         <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />

//         <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full border border-white/10" />

//         <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full border border-white/10" />
//       </div>

//       {/* Main content */}
//       <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
//         {/* Brand mark */}
//         <div
//           className={[
//             'relative grid h-36 w-36 place-items-center rounded-[2rem]',
//             'border border-white/25 bg-white/10 shadow-2xl shadow-blue-950/20',
//             'backdrop-blur-xl sm:h-40 sm:w-40',
//             reducedMotion ? '' : 'animate-[aurotap-float_3s_ease-in-out_infinite]',
//           ].join(' ')}
//         >
//           <div
//             aria-hidden="true"
//             className="absolute inset-2 rounded-[1.5rem] border border-white/10"
//           />

//           <Image
//             src="/aurotap-mark.svg"
//             alt="AuroTap"
//             width={112}
//             height={112}
//             priority
//             unoptimized
//             className="relative z-10 h-24 w-24 object-contain sm:h-28 sm:w-28"
//           />
//         </div>

//         {/* Brand name */}
//         <h1 className="mt-7 text-3xl font-extrabold tracking-tight sm:text-4xl">
//           AuroTap
//         </h1>

//         <p className="mt-2 text-sm font-medium tracking-wide text-sky-100 sm:text-base">
//           Fresh water. Trusted home services.
//         </p>

//         {/* Loading indicator */}
//         <div
//           aria-hidden="true"
//           className="mt-9 flex h-8 items-center justify-center gap-2"
//         >
//           {[0, 1, 2].map((dot) => (
//             <span
//               key={dot}
//               className={[
//                 'h-2 w-2 rounded-full bg-white',
//                 reducedMotion
//                   ? 'opacity-70'
//                   : 'animate-[aurotap-pulse_1.2s_ease-in-out_infinite]',
//               ].join(' ')}
//               style={
//                 reducedMotion
//                   ? undefined
//                   : { animationDelay: `${dot * 0.18}s` }
//               }
//             />
//           ))}
//         </div>

//         <p className="mt-3 text-xs font-medium text-sky-100/90">
//           Preparing your experience…
//         </p>
//       </div>

//       {/* Footer */}
//       <footer className="absolute bottom-6 left-0 right-0 z-10 px-6 text-center">
//         <p className="text-xs font-medium text-white/65">
//           Water delivered. Water problems solved.
//         </p>
//       </footer>

//       {/* Local animation definitions */}
//       <style jsx>{`
//         @keyframes a uro tap-float {
//           0%,
//           100% {
//             transform: translateY(0);
//           }

//           50% {
//             transform: translateY(-6px);
//           }
//         }

//         @keyframes a uro tap-pulse {
//           0%,
//           80%,
//           100% {
//             transform: scale(0.75);
//             opacity: 0.45;
//           }

//           40% {
//             transform: scale(1.15);
//             opacity: 1;
//           }
//         }
//       `}</style>
//     </main>
//   );
// }
