'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { customerOrdersList, getApiErrorMessage } from '@/lib/api-client';
import { createSupabaseBrowserAuthed } from '@/lib/db/supabase-user-browser';
import { useAuth } from '@/hooks/useAuth';
import { isActiveStatus, normalizeOrder, type CustomerOrder } from '@/lib/order-status';

export type OrderFilter = 'all' | 'active' | 'completed' | 'cancelled';

const FILTER_STATUS: Record<OrderFilter, string | undefined> = {
  all: undefined,
  active: 'PENDING,ASSIGNED,IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED,FAILED',
};

/**
 * One place that loads a customer's orders.
 *  - No refetch loop (the loader only changes when the filter changes)
 *  - Realtime-first updates, 60s safety polling when connected, 15s fallback for active orders when disconnected
 *  - Silent refreshes never blank the screen
 *  - Stale responses are ignored
 */
export function useCustomerOrders(opts: { filter?: OrderFilter; pageSize?: number } = {}) {
  const { filter = 'all', pageSize = 20 } = opts;
  const { hydrated, isLoggedIn, isCustomer, session } = useAuth();
  const ready = hydrated && isLoggedIn && isCustomer;
  const status = FILTER_STATUS[filter];

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  /** Increments after every successful load so other widgets (stats) can refetch. */
  const [version, setVersion] = useState(0);

  const reqId = useRef(0);
  const countRef = useRef(0);
  const silentInFlight = useRef(false);
  const lastRefreshAt = useRef(0);
  const liveRef = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'silent') => {
      // Several events may arrive together (focus, realtime, polling).
      // Coalesce silent refreshes and throttle only periodic/event refreshes;
      // explicit user refreshes can still request a fresh read via reload.
      if (mode === 'silent' && silentInFlight.current) return;
      if (mode === 'silent') silentInFlight.current = true;
      const id = ++reqId.current;
      if (mode === 'initial') {
        setLoading(true);
        setError(null);
        setOrders([]);
        countRef.current = 0;
      } else {
        setRefreshing(true);
      }
      try {
        const limit = mode === 'silent' ? Math.min(100, Math.max(pageSize, countRef.current)) : pageSize;
        const rows = await customerOrdersList({ status, limit, offset: 0 });
        if (id !== reqId.current) return;
        const list = (Array.isArray(rows) ? rows : []).map((r) =>
          normalizeOrder(r as unknown as Record<string, unknown>)
        );
        setOrders(list);
        countRef.current = list.length;
        setHasMore(list.length >= limit);
        setError(null);
        setLastUpdated(new Date());
        setVersion((v) => v + 1);
      } catch (e) {
        if (id !== reqId.current) return;
        // A failed background refresh keeps the data on screen.
        if (mode === 'initial' || countRef.current === 0) setError(getApiErrorMessage(e));
      } finally {
        if (mode === 'silent') silentInFlight.current = false;
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
          lastRefreshAt.current = Date.now();
        }
      }
    },
    [status, pageSize]
  );

  const refresh = useCallback(() => load('silent'), [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const rows = await customerOrdersList({ status, limit: pageSize, offset: countRef.current });
      if (id !== reqId.current) return;
      const more = (Array.isArray(rows) ? rows : []).map((r) =>
        normalizeOrder(r as unknown as Record<string, unknown>)
      );
      setOrders((prev) => {
        const seen = new Set(prev.map((o) => o.id));
        return [...prev, ...more.filter((o) => !seen.has(o.id))];
      });
      countRef.current += more.length;
      setHasMore(more.length >= pageSize);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, status, pageSize]);

  /* Initial load / filter change */
  useEffect(() => {
    if (!ready) {
      // Late responses from a previous account must not populate a new session.
      reqId.current += 1;
      return;
    }
    liveRef.current = false;
    void load('initial');
    return () => { reqId.current += 1; };
  }, [ready, load, session?.userId]);

  /* Logged-out visitors: stop the spinner */
  useEffect(() => {
    if (hydrated && !ready) setLoading(false);
  }, [hydrated, ready]);

  const hasActive = orders.some((o) => isActiveStatus(o.status));

  /* Realtime-first safety polling. No background traffic while hidden/offline. */
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      // A subscribed socket does not need a second 15-second polling stream.
      // Keep a slow safety poll in case a database change event was missed.
      const period = hasActive && !liveRef.current ? 15_000 : 60_000;
      if (Date.now() - lastRefreshAt.current >= period) void load('silent');
    };
    const t = window.setInterval(tick, 15_000);
    const onReturn = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('online', tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('online', tick);
    };
  }, [ready, hasActive, load]);

  /* Realtime */
  useEffect(() => {
    if (!ready || !session?.accessToken || !session.userId) return;
    const sb = createSupabaseBrowserAuthed(session.accessToken);
    if (!sb) return;
    let timer: number | undefined;
    const channel = sb
      .channel(`customer_orders_${session.userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${session.userId}` },
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            if (document.visibilityState === 'visible' && navigator.onLine) void load('silent');
          }, 400);
        }
      )
      .subscribe((s) => {
        liveRef.current = s === 'SUBSCRIBED';
        setLive(liveRef.current);
      });
    return () => {
      liveRef.current = false;
      window.clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [ready, session?.accessToken, session?.userId, load]);

  return {
    orders,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    lastUpdated,
    live,
    version,
    ready,
    refresh,
    reload: () => load('initial'),
    loadMore,
  };
}
