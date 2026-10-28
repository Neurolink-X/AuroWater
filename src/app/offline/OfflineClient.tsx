'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─────────────────────────────────────────────
   The only interactive part of the offline page.
   It does three jobs:
   1. Shows whether the phone is REALLY online (navigator.onLine can say "online" on Wi-Fi with no internet).
   2. Checks again by itself, gently, so the customer never has to hunt for a button.
   3. When the connection is back, sends the customer to the page they were trying to open.
───────────────────────────────────────────── */

type Status = 'offline' | 'checking' | 'online';

/* A real network test. The ping address is unique each time so a cached copy can never fool us,
   and we check the answer is JSON so an "offline page" reply is not mistaken for success. */
async function reallyOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`/manifest.webmanifest?ping=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
    return res.ok && (res.headers.get('content-type') || '').includes('json');
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

const BTN_PRIMARY =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-400 px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none sm:w-auto focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-cyan-200';
const BTN_SECONDARY =
  'inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 motion-reduce:transition-none sm:w-auto focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-cyan-200';

export default function OfflineClient() {
  const [status, setStatus] = useState<Status>('offline');
  const [triedManually, setTriedManually] = useState(false);
  const busy = useRef(false);

  const recover = useCallback(() => {
    setStatus('online');
    // The browser keeps the address the customer asked for, so reloading brings them to THAT page.
    // If they opened /offline directly (for example from the app icon), send them home instead.
    window.setTimeout(() => {
      if (window.location.pathname.startsWith('/offline')) window.location.replace('/');
      else window.location.reload();
    }, 700);
  }, []);

  const check = useCallback(
    async (manual: boolean) => {
      if (busy.current) return;
      busy.current = true;
      if (manual) {
        setTriedManually(true);
        setStatus('checking');
      }
      const ok = await reallyOnline();
      busy.current = false;
      if (ok) recover();
      else setStatus('offline');
    },
    [recover],
  );

  useEffect(() => {
    // Defer the initial async check until after the effect setup to avoid cascading renders.
    const initialCheck = window.setTimeout(() => void check(false), 0);

    const onOnline = () => void check(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(false);
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    // Gentle background check, only while the screen is open. Stops once we are back online.
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check(false);
    }, 10000);

    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
    };
  }, [check]);

  const label =
    status === 'online' ? 'Back online. Taking you back…' : status === 'checking' ? 'Checking connection…' : 'Waiting for connection';
  const dot = status === 'online' ? 'bg-emerald-400' : status === 'checking' ? 'bg-cyan-300' : 'bg-amber-400';

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/80"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot} ${status === 'offline' ? 'motion-safe:animate-pulse' : ''}`} />
        {label}
      </div>

      <div className="mt-6 flex w-full max-w-sm flex-col items-center gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <button type="button" onClick={() => void check(true)} disabled={status === 'checking' || status === 'online'} className={BTN_PRIMARY}>
          {status === 'checking' ? 'Checking…' : 'Try again'}
        </button>

        {/* A plain link on purpose: a full page load can be answered from the saved copy, a client-side jump cannot. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={BTN_SECONDARY}>
          Go to home
        </a>
      </div>

      {triedManually && status === 'offline' && (
        <p role="status" className="mt-3 max-w-sm text-xs leading-5 text-white/70">
          Still no connection. We will keep checking and take you back as soon as it returns.
        </p>
      )}
    </>
  );
}
