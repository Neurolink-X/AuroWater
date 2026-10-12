'use client';
/**
 * src/components/supplier/DeliveryActionButton.tsx   (NEW FILE)
 *
 * One button that walks the supplier through a delivery:
 *
 *   ASSIGNED     green   "Start Delivery"
 *      ↓ tap (button changes IMMEDIATELY, before the server answers)
 *   IN_PROGRESS  amber   "Complete Delivery"   (pulsing dot = delivery is live)
 *      ↓ tap again
 *   COMPLETED    grey    "Delivered ✓"         (disabled)
 *
 * The button does NOT call your API itself. Pass `onAdvance`, which should call
 * the code you already use to update the order status, and then refresh the
 * orders AND the Recent Earnings list. If `onAdvance` throws, the button goes
 * back to where it was and shows the error under it.
 */

import React, { useEffect, useState } from 'react';

type NextStatus = 'IN_PROGRESS' | 'COMPLETED';

interface DeliveryActionButtonProps {
  /** The order's current status from your data (e.g. 'ASSIGNED'). */
  status: string;
  /** Called with the status to move to. Must reject (throw) on failure. */
  onAdvance: (next: NextStatus) => Promise<void>;
  /** Optional: disable while something else is loading. */
  disabled?: boolean;
  className?: string;
}

const STEPS = {
  ASSIGNED: {
    next: 'IN_PROGRESS' as NextStatus,
    label: 'Start Delivery',
    busyLabel: 'Starting…',
    hint: 'Tap when you leave to deliver.',
    classes: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  },
  IN_PROGRESS: {
    next: 'COMPLETED' as NextStatus,
    label: 'Complete Delivery',
    busyLabel: 'Completing…',
    hint: 'Delivery in progress. Tap once the customer has received the order.',
    classes: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
  },
} as const;

export default function DeliveryActionButton({
  status,
  onAdvance,
  disabled = false,
  className = '',
}: DeliveryActionButtonProps) {
  // What we SHOW. It moves ahead instantly on tap, then follows the real status.
  const [shown, setShown] = useState<string>(status.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whenever the real status changes (refresh, polling, other device), follow it.
  useEffect(() => {
    setShown(status.toUpperCase());
  }, [status]);

  if (shown === 'COMPLETED') {
    return (
      <button
        type="button"
        disabled
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700/60 px-4 py-3 text-sm font-bold text-slate-300 ${className}`}
      >
        <span aria-hidden>✓</span> Delivered
      </button>
    );
  }

  const step = shown === 'ASSIGNED' || shown === 'IN_PROGRESS' ? STEPS[shown] : null;
  if (!step) return null; // PENDING / CANCELLED / unknown: nothing to do here

  const handleClick = async () => {
    if (busy || disabled) return;

    const previous = shown;
    setBusy(true);
    setError(null);
    setShown(step.next); // instant: the button already changes to the next step

    try {
      await onAdvance(step.next);
    } catch (e) {
      setShown(previous); // server said no: go back
      setError(e instanceof Error && e.message ? e.message : 'Could not update the order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // While waiting for the server, show the label of the step we just started
  const isLive = shown === 'IN_PROGRESS';
  const label = busy ? (isLive ? STEPS.ASSIGNED.busyLabel : STEPS.IN_PROGRESS.busyLabel) : step.label;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        aria-busy={busy}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-70 ${step.classes}`}
      >
        {isLive && !busy && (
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-slate-950/60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-950" />
          </span>
        )}
        {busy && (
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
            aria-hidden
          />
        )}
        {label}
      </button>

      <p className="mt-1.5 text-center text-[11px] text-slate-400" aria-live="polite">
        {error ? <span className="font-semibold text-rose-400">{error}</span> : step.hint}
      </p>
    </div>
  );
}
