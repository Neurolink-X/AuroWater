'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface TechnicianErrorProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function Error({
  error,
  reset,
}: TechnicianErrorProps) {
  useEffect(() => {
    // Replace with Sentry / your telemetry provider in production.
    console.error('AuroWater technician workspace error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section
        role="alert"
        aria-labelledby="technician-error-title"
        className="w-full max-w-lg"
      >
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">

          {/* ==========================================================
              BRAND / STATUS
          ========================================================== */}
          <div className="bg-gradient-to-br from-[#003049] to-[#0A1628] px-6 py-7 text-white sm:px-8">

            <div className="flex items-center justify-between gap-4">

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <span className="text-lg font-bold">
                    A
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold">
                    AuroWater
                  </p>

                  <p className="mt-0.5 text-xs text-white/60">
                    Technician workspace
                  </p>
                </div>
              </div>

              <div className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5">
                <span className="text-xs font-semibold text-amber-200">
                  Temporary issue
                </span>
              </div>

            </div>

          </div>

          {/* ==========================================================
              ERROR CONTENT
          ========================================================== */}
          <div className="px-6 py-8 sm:px-8">

            {/* Error icon */}
            <div
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M10.3 3.9 2.9 17a2 2 0 0 0 1.74 3h14.72a2 2 0 0 0 1.74-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                />
              </svg>
            </div>

            <h1
              id="technician-error-title"
              className="mt-5 text-2xl font-bold tracking-tight text-slate-900"
            >
              We couldn't load your workspace
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Something interrupted the technician workspace.
              Your account and assigned jobs have not been changed
              by this error.
            </p>

            {/* Recovery guidance */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">

              <p className="text-sm font-semibold text-slate-800">
                Try this first
              </p>

              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Try loading the workspace again.</span>
                </li>

                <li className="flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Check your internet connection.</span>
                </li>

                <li className="flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Return to the dashboard if the problem continues.</span>
                </li>
              </ul>

            </div>

            {/* Actions */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">

              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#003049] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#00263b] focus:outline-none focus:ring-2 focus:ring-[#003049] focus:ring-offset-2"
              >
                Try again
              </button>

              <Link
                href="/technician"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              >
                Technician home
              </Link>

            </div>

            {/* Support */}
            <div className="mt-6 border-t border-slate-100 pt-5 text-center">

              <p className="text-xs text-slate-400">
                If this keeps happening, contact AuroWater support.
              </p>

              {error.digest && (
                <p className="mt-2 text-[11px] font-mono text-slate-400">
                  Reference: {error.digest}
                </p>
              )}

            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
