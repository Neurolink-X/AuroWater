'use client';
/**
 * src/components/supplier/DeliveryActionButton.tsx   (REPLACES the existing file)
 *
 * One button that walks the supplier through a delivery:
 *
 *   ASSIGNED     green   "Start Delivery"
 *      | tap  (changes IMMEDIATELY, before the server answers: starting is easy to undo)
 *   IN_PROGRESS  amber   "Complete Delivery"   (pulsing dot + minutes on the road)
 *      | tap  -> "Confirm: customer received it"  -> tap again
 *        (completing is what triggers earnings, so it asks once and waits for the server)
 *   COMPLETED    green   "Delivered"
 *
 * SAME PROPS AS BEFORE, so your existing code keeps working:
 *   status, onAdvance, disabled, className
 *
 * NEW, all optional:
 *   confirmComplete  default true. Set false for one-tap completion like before.
 *   startedAt        when the delivery started (ISO string, number or Date). Shows "On the way for 12 min".
 *   customerPhone    shows a Call button. Works even with no internet.
 *   address          shows a Navigate button that opens Google Maps with driving directions.
 *   timeoutMs        default 20000. Stops a stuck spinner on a weak network.
 *
 * onAdvance now also receives a second argument { idempotencyKey }. Old code can ignore it.
 * If your API accepts it, send it (for example as an "Idempotency-Key" header): a retry after a
 * weak-network timeout then cannot complete the same delivery twice.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type NextStatus = 'IN_PROGRESS' | 'COMPLETED';
type Stage = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface AdvanceMeta {
  /** Same value for every retry of the same step. Use it to stop double updates on the server. */
  idempotencyKey: string;
}

interface DeliveryActionButtonProps {
  /** The order's current status from your data (e.g. 'ASSIGNED'). */
  status: string;
  /** Called with the status to move to. Must reject (throw) on failure. */
  onAdvance: (next: NextStatus, meta?: AdvanceMeta) => Promise<void>;
  /** Optional: disable while something else is loading. */
  disabled?: boolean;
  className?: string;
  /** Ask once before completing. Default true. */
  confirmComplete?: boolean;
  startedAt?: string | number | Date | null;
  customerPhone?: string | null;
  address?: string | null;
  timeoutMs?: number;
}

/* ───────────── helpers (outside the component, so they are never re-created) ───────────── */

/** Accepts "assigned", "In Progress", "in-progress" and so on. Anything else returns null. */
function toStage(raw: unknown): Stage | null {
  const s = String(raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return s === 'ASSIGNED' || s === 'IN_PROGRESS' || s === 'COMPLETED' ? s : null;
}

/** A small buzz on Android phones. Quietly does nothing elsewhere. */
function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* not supported: fine */
  }
}

function makeKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const TIMEOUT_MARK = '__timeout__';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(TIMEOUT_MARK)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function friendlyError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === TIMEOUT_MARK) return 'Slow connection. Check the order status first, then try again.';
    if (e.message) return e.message;
  }
  return 'Could not update the order. Please try again.';
}

const STEPS: ReadonlyArray<{ key: Stage; label: string }> = [
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'On the way' },
  { key: 'COMPLETED', label: 'Delivered' },
];

const STAGE_STYLE: Record<Exclude<Stage, 'COMPLETED'>, { label: string; hint: string; classes: string }> = {
  ASSIGNED: {
    label: 'Start Delivery',
    hint: 'Tap when you leave to deliver.',
    classes: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
  },
  IN_PROGRESS: {
    label: 'Complete Delivery',
    hint: 'Tap once the customer has received the order.',
    classes: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
  },
};

/* Progress bar: shows where the delivery is, at a glance */
function Stepper({ stage }: { stage: Stage }) {
  const index = STEPS.findIndex((s) => s.key === stage);
  return (
    <ol aria-label="Delivery progress" className="mb-3 flex items-start gap-2 text-[11px] font-semibold">
      {STEPS.map((s, i) => {
        const done = i < index;
        const current = i === index;
        const bar = done || current ? (current && stage === 'IN_PROGRESS' ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-700';
        return (
          <li key={s.key} aria-current={current ? 'step' : undefined} className="flex flex-1 flex-col gap-1">
            <span className={`h-1.5 rounded-full transition-colors motion-reduce:transition-none ${bar}`} />
            <span className={current ? 'text-white' : done ? 'text-slate-300' : 'text-slate-400'}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const SECONDARY_ACTION =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

/* ───────────── the component ───────────── */

export default function DeliveryActionButton({
  status,
  onAdvance,
  disabled = false,
  className = '',
  confirmComplete = true,
  startedAt = null,
  customerPhone = null,
  address = null,
  timeoutMs = 20000,
}: DeliveryActionButtonProps) {
  const real = toStage(status);

  // What we SHOW can run ahead of the server: starting moves on instantly, completing waits for "yes".
  const [override, setOverride] = useState<Stage | null>(null);
  const [pending, setPending] = useState<NextStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const lock = useRef(false); // instant double-tap guard (state would be too slow)
  const mounted = useRef(true);
  const confirmTimer = useRef<number | null>(null);
  const keys = useRef<Partial<Record<NextStatus, string>>>({});

  const stage: Stage | null = override ?? real;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    };
  }, []);

  // When the real status changes (refresh, polling, another device) follow it, unless we are mid-request.
  useEffect(() => {
    if (!lock.current) setOverride(null);
  }, [real]);

  // Minutes on the road: re-checked every 30 seconds, only while the screen is visible.
  const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
  useEffect(() => {
    if (stage !== 'IN_PROGRESS' || Number.isNaN(startMs)) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, [stage, startMs]);

  const clearConfirmTimer = useCallback(() => {
    if (confirmTimer.current !== null) {
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
  }, []);

  const run = useCallback(
    async (next: NextStatus) => {
      if (lock.current || disabled) return;

      // No signal: say so at once instead of showing a spinner that can never finish.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setError('You are offline. Reconnect, then try again.');
        buzz([80, 40, 80]);
        return;
      }

      lock.current = true;
      clearConfirmTimer();
      setConfirming(false);
      setError(null);
      setPending(next);
      buzz(25);

      // Starting is easy to undo, so the screen moves on instantly.
      if (next === 'IN_PROGRESS') setOverride('IN_PROGRESS');

      // Same key on every retry of the same step, so the server can ignore a repeat.
      if (!keys.current[next]) keys.current[next] = makeKey();
      const idempotencyKey = keys.current[next] as string;

      try {
        await withTimeout(onAdvance(next, { idempotencyKey }), timeoutMs);
        delete keys.current[next];
        if (mounted.current) {
          setOverride(next); // confirmed by the server
          buzz([30, 50, 30]);
        }
      } catch (e) {
        if (mounted.current) {
          setOverride(null); // go back to the real status
          setError(friendlyError(e));
          buzz([80, 40, 80]);
        }
      } finally {
        lock.current = false;
        if (mounted.current) setPending(null);
      }
    },
    [clearConfirmTimer, disabled, onAdvance, timeoutMs],
  );

  const handlePrimary = () => {
    if (pending || disabled) return;

    if (stage === 'ASSIGNED') {
      void run('IN_PROGRESS');
      return;
    }
    if (stage === 'IN_PROGRESS') {
      if (!confirmComplete || confirming) {
        void run('COMPLETED');
        return;
      }
      // First tap only asks "are you sure?" and resets itself after 6 seconds.
      setError(null);
      setConfirming(true);
      buzz(15);
      clearConfirmTimer();
      confirmTimer.current = window.setTimeout(() => setConfirming(false), 6000);
    }
  };

  const cancelConfirm = () => {
    clearConfirmTimer();
    setConfirming(false);
  };

  /* ───── nothing to do: PENDING, CANCELLED, unknown ───── */
  if (!stage) return null;

  /* ───── done ───── */
  if (stage === 'COMPLETED') {
    return (
      <div className={className}>
        <Stepper stage="COMPLETED" />
        <div
          role="status"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-extrabold text-emerald-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Delivered
        </div>
      </div>
    );
  }

  /* ───── active delivery ───── */
  const style = STAGE_STYLE[stage];
  const isLive = stage === 'IN_PROGRESS';
  const minutes = isLive && !Number.isNaN(startMs) ? Math.max(0, Math.floor((now - startMs) / 60000)) : null;

  const label = pending
    ? pending === 'COMPLETED'
      ? 'Completing…'
      : 'Starting…'
    : confirming
      ? 'Confirm: customer received it'
      : style.label;

  const classes = confirming && !pending ? 'bg-emerald-400 text-slate-950 ring-4 ring-emerald-400/30 hover:bg-emerald-300' : style.classes;

  const hint = pending
    ? 'Saving. Please wait…'
    : confirming
      ? 'Tap again to finish this delivery. It cannot be undone.'
      : isLive && minutes !== null
        ? `On the way for ${minutes} min. ${style.hint}`
        : style.hint;

  const phone = customerPhone ? customerPhone.replace(/[^\d+]/g, '') : '';
  const mapsHref = address?.trim()
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}&travelmode=driving`
    : '';

  return (
    <div className={className}>
      <Stepper stage={stage} />

      <button
        type="button"
        onClick={handlePrimary}
        disabled={Boolean(pending) || disabled}
        aria-busy={Boolean(pending)}
        className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center text-base font-extrabold transition-colors active:scale-[0.99] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-70 ${classes}`}
      >
        {isLive && !pending && !confirming && (
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-slate-950/60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-950" />
          </span>
        )}
        {pending && (
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
        {label}
      </button>

      {confirming && !pending && (
        <button
          type="button"
          onClick={cancelConfirm}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-slate-300 transition-colors hover:text-white motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Not yet
        </button>
      )}

      {(phone || mapsHref) && (
        <div className="mt-2 flex gap-2">
          {phone && (
            <a href={`tel:${phone}`} className={SECONDARY_ACTION}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              Call customer
            </a>
          )}
          {mapsHref && (
            <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={SECONDARY_ACTION}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              Navigate
            </a>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-center text-xs font-semibold leading-5 text-rose-300">
          {error}
        </p>
      ) : (
        <p aria-live="polite" className="mt-2 text-center text-xs leading-5 text-slate-300">
          {hint}
        </p>
      )}
    </div>
  );
}











// 'use client';
// /**
//  * src/components/supplier/DeliveryActionButton.tsx   (NEW FILE)
//  *
//  * One button that walks the supplier through a delivery:
//  *
//  *   ASSIGNED     green   "Start Delivery"
//  *      ↓ tap (button changes IMMEDIATELY, before the server answers)
//  *   IN_PROGRESS  amber   "Complete Delivery"   (pulsing dot = delivery is live)
//  *      ↓ tap again
//  *   COMPLETED    grey    "Delivered ✓"         (disabled)
//  *
//  * The button does NOT call your API itself. Pass `onAdvance`, which should call
//  * the code you already use to update the order status, and then refresh the
//  * orders AND the Recent Earnings list. If `onAdvance` throws, the button goes
//  * back to where it was and shows the error under it.
//  */

// import React, { useEffect, useState } from 'react';

// type NextStatus = 'IN_PROGRESS' | 'COMPLETED';

// interface DeliveryActionButtonProps {
//   /** The order's current status from your data (e.g. 'ASSIGNED'). */
//   status: string;
//   /** Called with the status to move to. Must reject (throw) on failure. */
//   onAdvance: (next: NextStatus) => Promise<void>;
//   /** Optional: disable while something else is loading. */
//   disabled?: boolean;
//   className?: string;
// }

// const STEPS = {
//   ASSIGNED: {
//     next: 'IN_PROGRESS' as NextStatus,
//     label: 'Start Delivery',
//     busyLabel: 'Starting…',
//     hint: 'Tap when you leave to deliver.',
//     classes: 'bg-emerald-600 hover:bg-emerald-500 text-white',
//   },
//   IN_PROGRESS: {
//     next: 'COMPLETED' as NextStatus,
//     label: 'Complete Delivery',
//     busyLabel: 'Completing…',
//     hint: 'Delivery in progress. Tap once the customer has received the order.',
//     classes: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
//   },
// } as const;

// export default function DeliveryActionButton({
//   status,
//   onAdvance,
//   disabled = false,
//   className = '',
// }: DeliveryActionButtonProps) {
//   // What we SHOW. It moves ahead instantly on tap, then follows the real status.
//   const [shown, setShown] = useState<string>(status.toUpperCase());
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // Whenever the real status changes (refresh, polling, other device), follow it.
//   useEffect(() => {
//     setShown(status.toUpperCase());
//   }, [status]);

//   if (shown === 'COMPLETED') {
//     return (
//       <button
//         type="button"
//         disabled
//         className={`flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700/60 px-4 py-3 text-sm font-bold text-slate-300 ${className}`}
//       >
//         <span aria-hidden>✓</span> Delivered
//       </button>
//     );
//   }

//   const step = shown === 'ASSIGNED' || shown === 'IN_PROGRESS' ? STEPS[shown] : null;
//   if (!step) return null; // PENDING / CANCELLED / unknown: nothing to do here

//   const handleClick = async () => {
//     if (busy || disabled) return;

//     const previous = shown;
//     setBusy(true);
//     setError(null);
//     setShown(step.next); // instant: the button already changes to the next step

//     try {
//       await onAdvance(step.next);
//     } catch (e) {
//       setShown(previous); // server said no: go back
//       setError(e instanceof Error && e.message ? e.message : 'Could not update the order. Please try again.');
//     } finally {
//       setBusy(false);
//     }
//   };

//   // While waiting for the server, show the label of the step we just started
//   const isLive = shown === 'IN_PROGRESS';
//   const label = busy ? (isLive ? STEPS.ASSIGNED.busyLabel : STEPS.IN_PROGRESS.busyLabel) : step.label;

//   return (
//     <div className={className}>
//       <button
//         type="button"
//         onClick={handleClick}
//         disabled={busy || disabled}
//         aria-busy={busy}
//         className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-70 ${step.classes}`}
//       >
//         {isLive && !busy && (
//           <span className="relative flex h-2.5 w-2.5" aria-hidden>
//             <span className="absolute inline-flex h-full w-full rounded-full bg-slate-950/60 motion-safe:animate-ping" />
//             <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-950" />
//           </span>
//         )}
//         {busy && (
//           <span
//             className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
//             aria-hidden
//           />
//         )}
//         {label}
//       </button>

//       <p className="mt-1.5 text-center text-[11px] text-slate-400" aria-live="polite">
//         {error ? <span className="font-semibold text-rose-400">{error}</span> : step.hint}
//       </p>
//     </div>
//   );
// }
