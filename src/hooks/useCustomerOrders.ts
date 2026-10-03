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
 *  - Realtime updates + 15s polling while an order is active + refresh on tab focus
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

  const load = useCallback(
    async (mode: 'initial' | 'silent') => {
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
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
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
    if (!ready) return;
    void load('initial');
  }, [ready, load]);

  /* Logged-out visitors: stop the spinner */
  useEffect(() => {
    if (hydrated && !ready) setLoading(false);
  }, [hydrated, ready]);

  const hasActive = orders.some((o) => isActiveStatus(o.status));

  /* Polling + refresh when the tab becomes visible again */
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void load('silent');
    };
    const t = window.setInterval(tick, hasActive ? 15_000 : 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
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
          timer = window.setTimeout(() => void load('silent'), 400);
        }
      )
      .subscribe((s) => setLive(s === 'SUBSCRIBED'));
    return () => {
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
