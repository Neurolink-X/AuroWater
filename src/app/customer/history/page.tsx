'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import BottomNav from '@/components/customer/BottomNav';
import { ReviewModal } from '@/app/customer/track/[id]/_components/ReviewModal';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerOrders, type OrderFilter } from '@/hooks/useCustomerOrders';
import {
  formatWhen,
  inrFmt,
  isActiveStatus,
  reorderHref,
  scheduleLabel,
  serviceEmoji,
  statusMeta,
  type CustomerOrder,
} from '@/lib/order-status';

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY: Record<OrderFilter, { title: string; sub: string }> = {
  all: { title: 'No orders yet', sub: 'Book your first delivery in under a minute.' },
  active: { title: 'Nothing in progress', sub: 'Your active orders will show up here.' },
  completed: { title: 'No completed orders yet', sub: 'Delivered orders will appear here.' },
  cancelled: { title: 'No cancelled orders', sub: 'Good news: you have not cancelled anything.' },
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm" aria-hidden>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="mt-4 h-3 w-3/4 rounded bg-slate-100 animate-pulse" />
    </div>
  );
}

function OrderCard({ order, onReview }: { order: CustomerOrder; onReview: (id: string) => void }) {
  const meta = statusMeta(order.status);
  const active = isActiveStatus(order.status);
  const schedule = scheduleLabel(order);

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl" aria-hidden>
            {serviceEmoji(order.serviceKey)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-extrabold text-slate-900">
              {order.serviceTitle}
              {order.serviceKey === 'water_can' && order.canCount ? ` × ${order.canCount}` : ''}
            </h3>
            <p className="text-xs font-semibold text-slate-500">#{order.shortId}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold text-slate-900">{inrFmt(order.totalAmount)}</p>
          <span
            className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${meta.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-slate-400">Placed</dt>
          <dd>{formatWhen(order.createdAt)}</dd>
        </div>
        {schedule ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-400">Scheduled</dt>
            <dd>{schedule}</dd>
          </div>
        ) : null}
        {order.address ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-400">Address</dt>
            <dd className="line-clamp-1">{order.address}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/customer/track/${order.id}`}
          className={
            active
              ? 'inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700'
              : 'inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50'
          }
        >
          {active ? 'Track order' : 'View details'}
        </Link>
        {!active ? (
          <Link
            href={reorderHref(order)}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
          >
            ↻ Reorder
          </Link>
        ) : null}
        {order.status === 'COMPLETED' && !order.hasReview ? (
          <button
            type="button"
            onClick={() => onReview(order.id)}
            className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100"
          >
            ★ Rate
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/history';
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [reviewFor, setReviewFor] = useState<string | null>(null);

  const { orders, loading, refreshing, loadingMore, error, hasMore, lastUpdated, live, refresh, reload, loadMore } =
    useCustomerOrders({ filter, pageSize: 20 });

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, router, pathname]);

  if (!hydrated || (!isLoggedIn && hydrated)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!isCustomer) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-extrabold text-slate-900">Customer accounts only</h1>
        <p className="mt-2 text-slate-600">Sign in with a customer account to see your orders.</p>
        <Link href="/auth/login" className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  const activeOrder = orders.find((o) => isActiveStatus(o.status));

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-32">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/customer/home" className="text-sm font-semibold text-emerald-700 hover:underline">
              ← Home
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">Your orders</h1>
          </div>
          <div className="flex items-center gap-2">
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              aria-label="Refresh orders"
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
            <Link
              href="/book"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              + Book
            </Link>
          </div>
        </header>

        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter orders"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === f.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {lastUpdated ? (
          <p className="mt-2 text-xs text-slate-400">
            Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
          </p>
        ) : null}

        <section className="mt-4 space-y-3" aria-busy={loading} aria-live="polite">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center">
              <p className="font-semibold text-rose-800">We could not load your orders.</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={() => void reload()}
                className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700"
              >
                Try again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-4xl" aria-hidden>
                📦
              </div>
              <p className="mt-3 font-extrabold text-slate-900">{EMPTY[filter].title}</p>
              <p className="mt-1 text-sm text-slate-500">{EMPTY[filter].sub}</p>
              <Link
                href="/book"
                className="mt-5 inline-flex rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700"
              >
                Book now →
              </Link>
            </div>
          ) : (
            orders.map((o) => <OrderCard key={o.id} order={o} onReview={setReviewFor} />)
          )}
        </section>

        {hasMore && !loading && !error ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>

      <BottomNav activeOrderId={activeOrder?.id ?? null} />
      {reviewFor ? (
        <ReviewModal
          orderId={reviewFor}
          onClose={() => {
            setReviewFor(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}











// 'use client';

// import React, { useCallback, useEffect, useState } from 'react';
// import { usePathname, useRouter } from 'next/navigation';
// import Link from 'next/link';
// import { toast } from 'sonner';
// import { useAuth } from '@/hooks/useAuth';
// import BottomNav from '@/components/customer/BottomNav';
// import { ReviewModal } from '@/app/customer/track/[id]/_components/ReviewModal';
// import { clearSession } from '@/hooks/useAuth';
// import { getToken } from '@/lib/api-client';

// interface OrderRow {
//   id: string;
//   total_amount: number;
//   status: string;
//   created_at: string;
//   time_slot?: string;
//   can_quantity?: number | null;
//   has_review?: boolean;
// }

// const STATUS_LABELS: Record<string, string> = {
//   PENDING: 'Pending',
//   ASSIGNED: 'Assigned',
//   ACCEPTED: 'Accepted',
//   IN_PROGRESS: 'In progress',
//   COMPLETED: 'Completed',
//   CANCELLED: 'Cancelled',
// };

// const STATUS_CLASS: Record<string, string> = {
//   PENDING: 'bg-amber-100 text-amber-800',
//   ASSIGNED: 'bg-sky-100 text-sky-800',
//   ACCEPTED: 'bg-blue-100 text-blue-800',
//   IN_PROGRESS: 'bg-violet-100 text-violet-800',
//   COMPLETED: 'bg-emerald-100 text-emerald-800',
//   CANCELLED: 'bg-rose-100 text-rose-800',
// };

// export default function OrderHistory() {
//   const router = useRouter();
//   const pathname = usePathname() ?? '/customer/history';
//   const { hydrated, isLoggedIn, isCustomer } = useAuth();
//   const [orders, setOrders] = useState<OrderRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [statusFilter, setStatusFilter] = useState<string>('all');
//   const [offset, setOffset] = useState(0);
//   const [hasMore, setHasMore] = useState(true);
//   const [reviewFor, setReviewFor] = useState<string | null>(null);
//   const [loadError, setLoadError] = useState<string | null>(null);

//   const loadOrders = useCallback(async (mode: 'reset' | 'more') => {
//     if (!isLoggedIn || !isCustomer) return;
//     try {
//       setLoadError(null);
//       if (mode === 'reset') {
//         setLoading(true);
//         setOffset(0);
//         setHasMore(true);
//       } else {
//         setLoadingMore(true);
//       }

//       const lim = 20;
//       const nextOffset = mode === 'reset' ? 0 : offset;
//       const params = new URLSearchParams();
//       params.set('limit', String(lim));
//       params.set('offset', String(nextOffset));
//       if (statusFilter !== 'all') params.set('status', statusFilter);
//       const apiUrl = `/api/customer/orders?${params.toString()}`;

//       const token = await getToken();
//       if (!token) {
//         clearSession();
//         router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }
//       const res = await fetch(apiUrl, {
//         credentials: 'include',
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (res.status === 401) {
//         clearSession();
//         router.push(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }
//       const json = (await res.json()) as { success?: boolean; data?: unknown; error?: string };
//       if (!res.ok || json.success === false) throw new Error(json.error ?? 'Could not load orders');
//       const rows = Array.isArray(json.data) ? json.data : [];

//       const mapped = rows.map((o): OrderRow => {
//         const r = o as Record<string, unknown>;
//         return {
//           id: String(r.id ?? ''),
//           total_amount: Number(r.total_amount ?? 0),
//           status: String(r.status ?? ''),
//           created_at: String(r.created_at ?? new Date().toISOString()),
//           time_slot: r.time_slot == null ? undefined : String(r.time_slot),
//           can_quantity: r.can_quantity == null ? null : Number(r.can_quantity),
//           has_review: Boolean(r.has_review),
//         };
//       });

//       setOrders((prev) => (mode === 'reset' ? mapped : [...prev, ...mapped]));
//       setOffset(nextOffset + mapped.length);
//       setHasMore(mapped.length === lim);
//     } catch (e: unknown) {
//       const msg = e instanceof Error ? e.message : 'Could not load orders';
//       setLoadError(msg);
//       if (mode === 'reset') setOrders([]);
//       toast.error(msg);
//     } finally {
//       setLoading(false);
//       setLoadingMore(false);
//     }
//   }, [isLoggedIn, isCustomer, statusFilter, offset, router, pathname]);

//   useEffect(() => {
//     if (!hydrated) return;
//     if (!isLoggedIn || !isCustomer) {
//       setLoading(false);
//       return;
//     }
//     void loadOrders('reset');
//   }, [hydrated, isLoggedIn, isCustomer, statusFilter, loadOrders]);

//   if (!hydrated) {
//     return (
//       <div className="min-h-screen gradient-section flex items-center justify-center px-4">
//         <p className="text-slate-600">Loading…</p>
//       </div>
//     );
//   }

//   if (!isLoggedIn || !isCustomer) {
//     return (
//       <div className="min-h-screen gradient-section flex items-center justify-center px-4">
//         <div className="max-w-md text-center">
//           <h1 className="text-2xl font-bold text-slate-900 mb-2">Order history</h1>
//           <p className="text-slate-600 mb-4">Sign in as a customer to see your bookings.</p>
//           <Link
//             href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}
//             className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
//           >
//             Sign in
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   const filters = [
//     { value: 'all', label: 'All' },
//     { value: 'PENDING', label: 'Pending' },
//     { value: 'IN_PROGRESS', label: 'In Progress' },
//     { value: 'COMPLETED', label: 'Completed' },
//     { value: 'CANCELLED', label: 'Cancelled' },
//   ];

//   const emptyMsg = (() => {
//     if (statusFilter === 'PENDING') return 'No pending orders yet';
//     if (statusFilter === 'IN_PROGRESS') return 'No in-progress orders yet';
//     if (statusFilter === 'COMPLETED') return 'No completed orders yet';
//     if (statusFilter === 'CANCELLED') return 'No cancelled orders yet';
//     return 'No orders yet';
//   })();

//   return (
//     <div className="min-h-screen gradient-section pb-20">
//       <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
//           <h1 className="text-2xl font-bold text-slate-800">Order history</h1>
//           <div className="flex flex-wrap gap-2">
//             <Link
//               href="/book"
//               className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
//             >
//               Book again
//             </Link>
//             <Link
//               href="/customer/home"
//               className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
//             >
//               Dashboard
//             </Link>
//             <button
//               type="button"
//               onClick={() => {
//                 toast.error('Use Account → Sign out.');
//                 router.push('/customer/account');
//               }}
//               className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
//             >
//               Logout
//             </button>
//           </div>
//         </div>

//         <div className="flex flex-wrap gap-2 mb-6">
//           {filters.map((f) => (
//             <button
//               key={f.value || 'all'}
//               type="button"
//               onClick={() => setStatusFilter(f.value)}
//               className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
//                 statusFilter === f.value
//                   ? 'bg-emerald-600 text-white'
//                   : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-slate-50'
//               }`}
//             >
//               {f.label}
//             </button>
//           ))}
//         </div>

//         {loadError && !loading ? (
//           <div className="aw-card text-center py-8">
//             <p className="text-slate-600 mb-4">{loadError}</p>
//             <button
//               type="button"
//               onClick={() => void loadOrders('reset')}
//               className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
//             >
//               Retry
//             </button>
//           </div>
//         ) : null}

//         {loading ? (
//           <div className="aw-card">
//             <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
//             <div className="mt-3 space-y-2">
//               <div className="h-10 rounded bg-slate-100 animate-pulse" />
//               <div className="h-10 rounded bg-slate-100 animate-pulse" />
//               <div className="h-10 rounded bg-slate-100 animate-pulse" />
//             </div>
//           </div>
//         ) : orders.length === 0 ? (
//           <div className="aw-card text-center">
//             <div className="text-4xl">📦</div>
//             <p className="mt-3 text-slate-700 font-semibold">{emptyMsg}</p>
//             <p className="mt-1 text-sm text-slate-500">Book water in under 60 seconds.</p>
//             <Link href="/book" className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors">
//               Book now →
//             </Link>
//           </div>
//         ) : (
//           <>
//             <div className="space-y-3">
//               {orders.map((order) => {
//                 const st = order.status.toUpperCase();
//                 const isActive = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(st);
//                 const canCount = Math.max(1, Number(order.can_quantity ?? 1));
//                 return (
//                   <div key={order.id} className="aw-card">
//                     <div className="flex items-start justify-between gap-3">
//                       <div className="min-w-0">
//                         <div className="flex items-center gap-2 flex-wrap">
//                           <div className="font-extrabold text-slate-900">
//                             Order #{order.id.slice(0, 8)}…
//                           </div>
//                           <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${STATUS_CLASS[st] ?? 'bg-slate-100 text-slate-700'}`}>
//                             {STATUS_LABELS[st] ?? st}
//                           </span>
//                         </div>
//                         <div className="mt-2 text-sm text-slate-600">
//                           {canCount} cans · {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
//                         </div>
//                       </div>
//                       <div className="text-right">
//                         <div className="aw-heading" style={{ fontWeight: 800, color: '#0A1628' }}>
//                           ₹{Math.round(order.total_amount ?? 0).toLocaleString('en-IN')}
//                         </div>
//                       </div>
//                     </div>

//                     <div className="mt-4 flex flex-wrap gap-2">
//                       {isActive ? (
//                         <Link href={`/customer/track/${order.id}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors">
//                           Track
//                         </Link>
//                       ) : null}
//                       {st === 'COMPLETED' ? (
//                         <Link href={`/book?cans=${encodeURIComponent(String(canCount))}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
//                           Reorder
//                         </Link>
//                       ) : null}
//                       {st === 'COMPLETED' && !order.has_review ? (
//                         <button
//                           type="button"
//                           onClick={() => setReviewFor(order.id)}
//                           className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-amber-200 text-amber-800 text-sm font-bold hover:bg-amber-50 transition-colors"
//                         >
//                           Leave Review
//                         </button>
//                       ) : null}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>

//             {hasMore ? (
//               <div className="mt-4 flex justify-center">
//                 <button
//                   type="button"
//                   disabled={loadingMore}
//                   onClick={() => void loadOrders('more')}
//                   className="aw-touch rounded-xl border border-slate-200 bg-white px-5 py-3 font-extrabold text-slate-700 disabled:opacity-60"
//                 >
//                   {loadingMore ? 'Loading…' : 'Load more'}
//                 </button>
//               </div>
//             ) : null}
//           </>
//         )}
//       </div>
//       <BottomNav />
//       {reviewFor ? <ReviewModal orderId={reviewFor} onClose={() => setReviewFor(null)} /> : null}
//     </div>
//   );
// }
