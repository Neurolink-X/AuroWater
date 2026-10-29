'use client';

import { useEffect } from 'react';

/**
 * Self-healing boundary: any render crash retries automatically (up to 2 times,
 * with backoff), then shows a manual retry. Add the same file to other route
 * segments (or app/error.tsx) to cover the whole project.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[route-error]', error.digest, error.message);
    // Hook your monitoring here (Sentry, etc.) so bugs are reported, not just survived.
    const key = `aurotap-heal:${location.pathname}`;
    const tries = Number(sessionStorage.getItem(key) ?? 0);
    if (tries >= 2) return;
    sessionStorage.setItem(key, String(tries + 1));
    const id = window.setTimeout(reset, 800 * (tries + 1));
    return () => window.clearTimeout(id);
  }, [error, reset]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-lg font-black text-slate-900">Something went wrong</p>
        <p className="mt-1 text-sm text-slate-500">We are retrying automatically. If it persists, tap below.</p>
        <button
          onClick={() => { sessionStorage.clear(); reset(); }}
          className="mt-4 min-h-11 rounded-xl bg-sky-700 px-5 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
