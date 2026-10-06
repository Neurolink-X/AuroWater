import Link from 'next/link';

export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading AuroWater"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#071525] px-6 text-white"
      style={{
        fontFamily:
          'var(--font-dm-sans, "DM Sans"), system-ui, sans-serif',
      }}
    >
      {/* Background atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="absolute bottom-[-10rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center text-center">
        {/* Brand mark */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Outer pulse */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[28px] border border-cyan-300/10 motion-safe:animate-pulse"
          />

          {/* Glow */}
          <span
            aria-hidden="true"
            className="absolute inset-2 rounded-[26px] bg-cyan-400/10 blur-xl"
          />

          {/* Logo container */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-[25px] border border-white/10 bg-white/[0.06] shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
            <svg
              viewBox="0 0 64 64"
              width="42"
              height="42"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M32 7C20.5 21 12 30.4 12 40.5a20 20 0 0 0 40 0C52 30.4 43.5 21 32 7Z"
                fill="url(#auroWaterGradient)"
              />

              <path
                d="M32 16C24.2 26 19 32.5 19 40a13 13 0 0 0 26 0c0-7.5-5.2-14-13-24Z"
                fill="#071525"
                fillOpacity="0.4"
              />

              <path
                d="M23.5 40.5c.4 3.8 2.8 6.7 6.2 8"
                stroke="white"
                strokeOpacity="0.75"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              <defs>
                <linearGradient
                  id="auroWaterGradient"
                  x1="14"
                  y1="8"
                  x2="50"
                  y2="53"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#67E8F9" />
                  <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Brand */}
        <div className="mt-6">
          <div className="text-[26px] font-extrabold tracking-tight">
            Auro<span className="text-cyan-300">Water</span>
          </div>

          <p className="mt-1 text-xs font-medium tracking-wide text-slate-400">
            Water services, simplified.
          </p>
        </div>

        {/* Loading indicator */}
        <div
          aria-hidden="true"
          className="mt-9 h-1 w-32 overflow-hidden rounded-full bg-white/10"
        >
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-300 to-sky-400 motion-safe:animate-[auro-loading_1.4s_ease-in-out_infinite]" />
        </div>

        <p className="mt-4 text-[11px] font-medium text-slate-500">
          Preparing your experience…
        </p>

        {/* Accessibility */}
        <span className="sr-only">
          Loading AuroWater. Please wait.
        </span>
      </div>

      <style>{`
        @keyframes auro-loading {
          0% {
            transform: translateX(-140%);
          }

          50% {
            transform: translateX(120%);
          }

          100% {
            transform: translateX(280%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-pulse,
          .motion-safe\\:animate-\\[auro-loading_1\\.4s_ease-in-out_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}








// export default function Loading() {
//   return (
//     <main
//       role="status"
//       aria-busy="true"
//       aria-label="Loading AuroWater"
//       className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
//     >
//       <div className="flex flex-col items-center">

//         {/* AuroWater mark */}
//         <div
//           aria-hidden="true"
//           className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#003049] shadow-[0_12px_35px_rgba(0,48,73,0.18)]"
//         >
//           {/* Water drop */}
//           <svg
//             viewBox="0 0 32 32"
//             className="h-8 w-8 text-white"
//             fill="none"
//             aria-hidden="true"
//           >
//             <path
//               d="M16 4.5C16 4.5 8.5 13.1 8.5 19.1C8.5 23.5 11.85 27 16 27C20.15 27 23.5 23.5 23.5 19.1C23.5 13.1 16 4.5 16 4.5Z"
//               fill="currentColor"
//             />

//             <path
//               d="M12.5 20.5C12.95 22.55 14.2 23.8 16.15 24.2"
//               stroke="#2A9D8F"
//               strokeWidth="2"
//               strokeLinecap="round"
//             />
//           </svg>

//           {/* Subtle pulse */}
//           <span
//             aria-hidden="true"
//             className="absolute inset-0 rounded-[22px] border border-[#2A9D8F]/30 motion-safe:animate-ping"
//           />
//         </div>

//         {/* Brand */}
//         <div className="mt-5 text-center">
//           <p className="text-lg font-bold tracking-tight text-[#003049]">
//             AuroWater
//           </p>

//           <p className="mt-1 text-xs font-medium text-slate-400">
//             Water services, simplified.
//           </p>
//         </div>

//         {/* Loading indicator */}
//         <div
//           aria-hidden="true"
//           className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-slate-200"
//         >
//           <div className="h-full w-1/2 rounded-full bg-[#2A9D8F] motion-safe:animate-[loading_1.2s_ease-in-out_infinite]" />
//         </div>

//         <span className="sr-only">
//           Loading AuroWater. Please wait.
//         </span>
//       </div>

//       <style>{`
//         @keyframes loading {
//           0% {
//             transform: translateX(-100%);
//           }

//           50% {
//             transform: translateX(100%);
//           }

//           100% {
//             transform: translateX(200%);
//           }
//         }

//         @media (prefers-reduced-motion: reduce) {
//           .motion-safe\\:animate-ping,
//           .motion-safe\\:animate-\\[loading_1\\.2s_ease-in-out_infinite\\] {
//             animation: none !important;
//           }
//         }
//       `}</style>
//     </main>
//   );
// }
