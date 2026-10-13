'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Catches unexpected render errors anywhere under /supplier so a supplier in the middle of a
 * delivery never lands on a blank screen. Hook the effect up to your error monitoring.
 */
export default function SupplierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with: Sentry.captureException(error)
    console.error('[Supplier] route error', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md items-center px-4 py-10">
      <div role="alert" className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          We couldn’t load this page. Your orders and inventory are safe. Try again, and if it keeps happening, contact support.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-slate-400">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/supplier"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
