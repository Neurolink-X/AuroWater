'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

type Options = {
  supplierId: string | null | undefined;
  /** Called (debounced) when any order row for this supplier changes. */
  onOrdersChange: () => void | Promise<void>;
  /** Called immediately when a notification is inserted for this supplier. */
  onNotification?: (row: Record<string, unknown>) => void;
  /** Safety-net refresh interval. Polling continues even if realtime says connected but DB events are not delivered. */
  fallbackPollMs?: number;
  /** Debounce window to coalesce bursts of row changes into one refetch. */
  debounceMs?: number;
};

/**
 * Production realtime hook for the supplier dashboard.
 *
 *  - single channel, always cleaned up (no leaks on supplier change)
 *  - debounced refetch (a burst of updates = one network call)
 *  - realtime gives fast updates, with low-frequency polling as a safety net
 *    (a connected channel can still miss events if database publication/filter setup is wrong)
 *  - refetches immediately on tab focus / network regain
 *  - exposes `status` so the UI can show a Live / Reconnecting badge
 *
 * Callbacks are kept in refs that are updated inside an effect (never during
 * render), so the channel is NOT torn down on every render and the React
 * Compiler "refs during render" lint rule is satisfied.
 */
export function useSupplierRealtime({
  supplierId,
  onOrdersChange,
  onNotification,
  fallbackPollMs = 10_000,
  debounceMs = 400,
}: Options): { status: RealtimeStatus; refresh: () => void } {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  // Lazy initialiser: the client is created once, not on every render.
  const [supabase] = useState(() => createClient());

  const ordersCb = useRef(onOrdersChange);
  const notifCb = useRef(onNotification);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest callbacks available to the channel without resubscribing.
  // Declared BEFORE the subscription effect so it always runs first.
  useEffect(() => {
    ordersCb.current = onOrdersChange;
    notifCb.current = onNotification;
  });

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void ordersCb.current();
    }, debounceMs);
  }, [debounceMs]);

  // Realtime channel
  useEffect(() => {
    if (!supplierId) return;

    const channel = supabase
      .channel(`supplier-live-${supplierId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `supplier_id=eq.${supplierId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${supplierId}` },
        (payload) => notifCb.current?.(payload.new as Record<string, unknown>),
      )
      .subscribe((s: string) => {
        if (s === 'SUBSCRIBED') {
          setStatus('live');
          refresh(); // catch anything missed while connecting
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('offline');
        }
      });

    return () => {
      const pending = timer.current;
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [supabase, supplierId, refresh]);

  // Safety-net polling while the tab is visible. A channel can report SUBSCRIBED
  // even when Postgres changes are not enabled for a table or a row filter misses
  // an event; periodic reads prevent the supplier dashboard from silently going stale.
  useEffect(() => {
    if (!supplierId) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ordersCb.current();
    }, fallbackPollMs);
    return () => window.clearInterval(id);
  }, [supplierId, fallbackPollMs]);

  // Instant refresh on focus / reconnect
  useEffect(() => {
    if (!supplierId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onOnline = () => refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [supplierId, refresh]);

  return { status, refresh };
}
