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
  /** Fallback polling interval used ONLY while realtime is not live. */
  fallbackPollMs?: number;
  /** Debounce window to coalesce bursts of row changes into one refetch. */
  debounceMs?: number;
};

/**
 * Production realtime hook for the supplier dashboard.
 *
 * Improvements over the inline setup:
 *  - single channel, always cleaned up (no leaks on supplier change)
 *  - debounced refetch (burst of updates = one network call)
 *  - polling runs ONLY when the websocket is down (saves ~6 req/min per supplier)
 *  - refetches immediately on tab focus / network regain
 *  - exposes `status` so the UI can show a Live / Reconnecting badge
 *
 * Callbacks are held in refs so the channel is NOT torn down on every render.
 */
export function useSupplierRealtime({
  supplierId,
  onOrdersChange,
  onNotification,
  fallbackPollMs = 10_000,
  debounceMs = 400,
}: Options): { status: RealtimeStatus; refresh: () => void } {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const supabaseRef = useRef(createClient());

  const ordersCb = useRef(onOrdersChange);
  const notifCb = useRef(onNotification);
  ordersCb.current = onOrdersChange;
  notifCb.current = onNotification;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void ordersCb.current();
    }, debounceMs);
  }, [debounceMs]);

  // Realtime channel
  useEffect(() => {
    if (!supplierId) return;
    const supabase = supabaseRef.current;
    setStatus('connecting');

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
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [supplierId, refresh]);

  // Fallback polling only while offline
  useEffect(() => {
    if (!supplierId || status === 'live') return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void ordersCb.current();
    }, fallbackPollMs);
    return () => window.clearInterval(id);
  }, [supplierId, status, fallbackPollMs]);

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
