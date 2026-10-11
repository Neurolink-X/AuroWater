'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Loading() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    const updateMotionPreference = () => {
      setReducedMotion(mediaQuery.matches);
    };

    updateMotionPreference();

    mediaQuery.addEventListener('change', updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener(
        'change',
        updateMotionPreference,
      );
    };
  }, []);

  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading AuroTap"
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-blue-900 px-6 py-12 text-white"
    >
      {/* Decorative background elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-300/15 blur-3xl" />

        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />

        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full border border-white/10" />

        <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full border border-white/10" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        {/* Brand mark */}
        <div
          className={[
            'relative grid h-36 w-36 place-items-center rounded-[2rem]',
            'border border-white/25 bg-white/10 shadow-2xl shadow-blue-950/20',
            'backdrop-blur-xl sm:h-40 sm:w-40',
            reducedMotion ? '' : 'animate-[aurotap-float_3s_ease-in-out_infinite]',
          ].join(' ')}
        >
          <div
            aria-hidden="true"
            className="absolute inset-2 rounded-[1.5rem] border border-white/10"
          />

          <Image
            src="/aurotap-mark.svg"
            alt="AuroTap"
            width={112}
            height={112}
            priority
            unoptimized
            className="relative z-10 h-24 w-24 object-contain sm:h-28 sm:w-28"
          />
        </div>

        {/* Brand name */}
        <h1 className="mt-7 text-3xl font-extrabold tracking-tight sm:text-4xl">
          AuroTap
        </h1>

        <p className="mt-2 text-sm font-medium tracking-wide text-sky-100 sm:text-base">
          Fresh water. Trusted home services.
        </p>

        {/* Loading indicator */}
        <div
          aria-hidden="true"
          className="mt-9 flex h-8 items-center justify-center gap-2"
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={[
                'h-2 w-2 rounded-full bg-white',
                reducedMotion
                  ? 'opacity-70'
                  : 'animate-[aurotap-pulse_1.2s_ease-in-out_infinite]',
              ].join(' ')}
              style={
                reducedMotion
                  ? undefined
                  : { animationDelay: `${dot * 0.18}s` }
              }
            />
          ))}
        </div>

        <p className="mt-3 text-xs font-medium text-sky-100/90">
          Preparing your experience…
        </p>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 left-0 right-0 z-10 px-6 text-center">
        <p className="text-xs font-medium text-white/65">
          Water delivered. Water problems solved.
        </p>
      </footer>

      {/* Local animation definitions */}
      <style jsx>{`
        @keyframes a uro tap-float {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes a uro tap-pulse {
          0%,
          80%,
          100% {
            transform: scale(0.75);
            opacity: 0.45;
          }

          40% {
            transform: scale(1.15);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
