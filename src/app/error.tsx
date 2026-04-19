'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[app/error]', error);
    }
  }, [error]);

  const showMessage = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16 bg-slate-50">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-sm p-8 text-center">
        <p className="text-xs font-semibold tracking-[0.16em] uppercase text-sky-600">AuroWater</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-600">
          We hit an unexpected issue. Please try again.
        </p>
        {showMessage ? (
          <p className="mt-4 text-xs text-rose-600 break-words">{error.message}</p>
        ) : null}

        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto rounded-xl bg-sky-600 text-white px-5 py-2.5 font-semibold hover:bg-sky-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto rounded-xl border border-slate-300 text-slate-800 px-5 py-2.5 font-semibold hover:bg-slate-100 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

