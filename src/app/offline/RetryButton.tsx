'use client';

import React, { useRef, useState } from 'react';
import { reallyOnline, returnToApp } from './connection';

/* ─────────────────────────────────────────────
   RetryButton
   Before: it only reloaded the page, so offline it looked like nothing happened.
   Now: it checks the connection for real, shows progress, tells the customer the result,
   and only reloads when the internet is actually back.

   Works exactly as before with no props:  <RetryButton />
   Optional:  <RetryButton label="Reload" />
───────────────────────────────────────────── */

type Props = {
  /** Button text. Default: "Try again" */
  label?: string;
};

type State = 'idle' | 'checking' | 'success' | 'failed';

export default function RetryButton({ label = 'Try again' }: Props) {
  const [state, setState] = useState<State>('idle');
  const busy = useRef(false);

  const handleRetry = async (): Promise<void> => {
    if (busy.current) return; // ignore double taps
    busy.current = true;
    setState('checking');

    const ok = await reallyOnline();

    if (ok) {
      setState('success');
      window.setTimeout(returnToApp, 500);
      return; // stay "busy": the page is about to reload
    }

    busy.current = false;
    setState('failed');
  };

  const disabled = state === 'checking' || state === 'success';

  return (
    <div className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={() => void handleRetry()}
        disabled={disabled}
        aria-busy={state === 'checking'}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
      >
        {state === 'checking' && (
          <svg className="h-4 w-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {state === 'checking' ? 'Checking…' : state === 'success' ? 'Connected' : label}
      </button>

      {/* Read out by screen readers and visible to everyone */}
      <p role="status" aria-live="polite" className="mt-2 min-h-5 max-w-xs text-center text-xs leading-5 text-white/70">
        {state === 'failed' && 'Still no connection. Please check your Wi-Fi or mobile data and try again.'}
        {state === 'success' && 'Back online. Opening now…'}
      </p>
    </div>
  );
}
