export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading AuroWater"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4"
    >
      <div className="flex flex-col items-center">

        {/* AuroWater mark */}
        <div
          aria-hidden="true"
          className="relative flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#003049] shadow-[0_12px_35px_rgba(0,48,73,0.18)]"
        >
          {/* Water drop */}
          <svg
            viewBox="0 0 32 32"
            className="h-8 w-8 text-white"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M16 4.5C16 4.5 8.5 13.1 8.5 19.1C8.5 23.5 11.85 27 16 27C20.15 27 23.5 23.5 23.5 19.1C23.5 13.1 16 4.5 16 4.5Z"
              fill="currentColor"
            />

            <path
              d="M12.5 20.5C12.95 22.55 14.2 23.8 16.15 24.2"
              stroke="#2A9D8F"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          {/* Subtle pulse */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[22px] border border-[#2A9D8F]/30 motion-safe:animate-ping"
          />
        </div>

        {/* Brand */}
        <div className="mt-5 text-center">
          <p className="text-lg font-bold tracking-tight text-[#003049]">
            AuroWater
          </p>

          <p className="mt-1 text-xs font-medium text-slate-400">
            Water services, simplified.
          </p>
        </div>

        {/* Loading indicator */}
        <div
          aria-hidden="true"
          className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full w-1/2 rounded-full bg-[#2A9D8F] motion-safe:animate-[loading_1.2s_ease-in-out_infinite]" />
        </div>

        <span className="sr-only">
          Loading AuroWater. Please wait.
        </span>
      </div>

      <style>{`
        @keyframes loading {
          0% {
            transform: translateX(-100%);
          }

          50% {
            transform: translateX(100%);
          }

          100% {
            transform: translateX(200%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-ping,
          .motion-safe\\:animate-\\[loading_1\\.2s_ease-in-out_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}
