'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/customer/BottomNav';
import { ReviewModal } from '@/app/customer/track/[id]/_components/ReviewModal';
import { clearSession } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

interface OrderRow {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  time_slot?: string;
  can_quantity?: number | null;
  has_review?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-sky-100 text-sky-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
};

export default function OrderHistory() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/history';
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [reviewFor, setReviewFor] = useState<string | null>(null);

  const loadOrders = useCallback(async (mode: 'reset' | 'more') => {
    if (!isLoggedIn || !isCustomer) return;
    try {
      if (mode === 'reset') {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const lim = 20;
      const nextOffset = mode === 'reset' ? 0 : offset;
      const url = new URL('/api/customer/orders', window.location.origin);
      url.searchParams.set('limit', String(lim));
      url.searchParams.set('offset', String(nextOffset));
      if (statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const token = await getToken();
      if (!token) {
        clearSession();
        router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const res = await fetch(url.toString(), {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        clearSession();
        router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load orders');
      const rows = Array.isArray(json.data) ? json.data : [];

      const mapped = rows.map((o): OrderRow => {
        const r = o as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          total_amount: Number(r.total_amount ?? 0),
          status: String(r.status ?? ''),
          created_at: String(r.created_at ?? new Date().toISOString()),
          time_slot: r.time_slot == null ? undefined : String(r.time_slot),
          can_quantity: r.can_quantity == null ? null : Number(r.can_quantity),
          has_review: Boolean(r.has_review),
        };
      });

      setOrders((prev) => (mode === 'reset' ? mapped : [...prev, ...mapped]));
      setOffset(nextOffset + mapped.length);
      setHasMore(mapped.length === lim);
    } catch {
      if (mode === 'reset') setOrders([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isLoggedIn, isCustomer, statusFilter, offset, router, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn || !isCustomer) {
      setLoading(false);
      return;
    }
    void loadOrders('reset');
  }, [hydrated, isLoggedIn, isCustomer, statusFilter, loadOrders]);

  if (!hydrated) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!isLoggedIn || !isCustomer) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Order history</h1>
          <p className="text-slate-600 mb-4">Sign in as a customer to see your bookings.</p>
          <Link
            href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  const emptyMsg = useMemo(() => {
    if (statusFilter === 'PENDING') return 'No pending orders yet';
    if (statusFilter === 'IN_PROGRESS') return 'No in-progress orders yet';
    if (statusFilter === 'COMPLETED') return 'No completed orders yet';
    if (statusFilter === 'CANCELLED') return 'No cancelled orders yet';
    return 'No orders yet';
  }, [statusFilter]);

  return (
    <div className="min-h-screen gradient-section pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Order history</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Book again
            </Link>
            <Link
              href="/customer/home"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                toast.error('Use Account → Sign out.');
                router.push('/customer/account');
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="aw-card">
            <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="mt-3 space-y-2">
              <div className="h-10 rounded bg-slate-100 animate-pulse" />
              <div className="h-10 rounded bg-slate-100 animate-pulse" />
              <div className="h-10 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="aw-card text-center">
            <div className="text-4xl">📦</div>
            <p className="mt-3 text-slate-700 font-semibold">{emptyMsg}</p>
            <p className="mt-1 text-sm text-slate-500">Book water in under 60 seconds.</p>
            <Link href="/book" className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors">
              Book now →
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map((order) => {
                const st = order.status.toUpperCase();
                const isActive = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(st);
                const canCount = Math.max(1, Number(order.can_quantity ?? 1));
                return (
                  <div key={order.id} className="aw-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-extrabold text-slate-900">
                            Order #{order.id.slice(0, 8)}…
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${STATUS_CLASS[st] ?? 'bg-slate-100 text-slate-700'}`}>
                            {STATUS_LABELS[st] ?? st}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          {canCount} cans · {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="aw-heading" style={{ fontWeight: 800, color: '#0A1628' }}>
                          ₹{Math.round(order.total_amount ?? 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {isActive ? (
                        <Link href={`/customer/track/${order.id}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">
                          Track
                        </Link>
                      ) : null}
                      {st === 'COMPLETED' ? (
                        <Link href={`/book?cans=${encodeURIComponent(String(canCount))}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
                          Reorder
                        </Link>
                      ) : null}
                      {st === 'COMPLETED' && !order.has_review ? (
                        <button
                          type="button"
                          onClick={() => setReviewFor(order.id)}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-amber-200 text-amber-800 text-sm font-bold hover:bg-amber-50 transition-colors"
                        >
                          Leave Review
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadOrders('more')}
                  className="aw-touch rounded-xl border border-slate-200 bg-white px-5 py-3 font-extrabold text-slate-700 disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <BottomNav />
      {reviewFor ? <ReviewModal orderId={reviewFor} onClose={() => setReviewFor(null)} /> : null}
    </div>
  );
}
