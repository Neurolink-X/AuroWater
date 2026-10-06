'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Package,
  RefreshCw,
  RotateCcw,
  Star,
  Truck,
} from 'lucide-react';

import BottomNav from '@/components/customer/BottomNav';
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
  all: {
    title: 'No orders yet',
    sub: 'Book your first delivery in under a minute.',
  },
  active: {
    title: 'Nothing in progress',
    sub: 'Your active orders will show up here.',
  },
  completed: {
    title: 'No completed orders yet',
    sub: 'Delivered orders will appear here.',
  },
  cancelled: {
    title: 'No cancelled orders',
    sub: 'Good news: you have not cancelled anything.',
  },
};

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-100" />

          <div className="min-w-0 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>

        <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function OrderCard({
  order,
}: {
  order: CustomerOrder;
}) {
  const meta = statusMeta(order.status);
  const active = isActiveStatus(order.status);
  const schedule = scheduleLabel(order);
  const completed = order.status === 'COMPLETED';

  return (
    <article
      className={[
        'overflow-hidden rounded-2xl border bg-white shadow-sm transition',
        completed && !order.hasReview
          ? 'border-amber-200 shadow-amber-100/50'
          : 'border-slate-100',
        'hover:shadow-md',
      ].join(' ')}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xl"
              aria-hidden="true"
            >
              {serviceEmoji(order.serviceKey)}
            </div>

            <div className="min-w-0">
              <h3 className="truncate font-extrabold text-slate-900">
                {order.serviceTitle}
                {order.serviceKey === 'water_can' && order.canCount
                  ? ` × ${order.canCount}`
                  : ''}
              </h3>

              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                #{order.shortId}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold text-slate-900">
              {inrFmt(order.totalAmount)}
            </p>

            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${meta.badge}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                aria-hidden="true"
              />
              {meta.label}
            </span>
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
          <div className="flex gap-2">
            <dt className="flex w-20 shrink-0 items-center gap-1.5 text-slate-400">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Placed
            </dt>
            <dd className="min-w-0">{formatWhen(order.createdAt)}</dd>
          </div>

          {schedule ? (
            <div className="flex gap-2">
              <dt className="flex w-20 shrink-0 items-center gap-1.5 text-slate-400">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                Scheduled
              </dt>
              <dd className="min-w-0">{schedule}</dd>
            </div>
          ) : null}

          {order.address ? (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-400">Address</dt>
              <dd className="min-w-0 truncate">{order.address}</dd>
            </div>
          ) : null}
        </dl>

        {completed && !order.hasReview ? (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-500 shadow-sm"
                aria-hidden="true"
              >
                <Star className="h-4.5 w-4.5 fill-current" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-slate-900">
                  How was your delivery?
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  Your feedback helps us improve water quality and delivery
                  service.
                </p>

                <Link
                  href={`/customer/feedback/${order.id}`}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 sm:w-auto"
                >
                  Rate your experience
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        ) : completed && order.hasReview ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-sm font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Feedback submitted — thank you!
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/customer/track/${order.id}`}
            className={[
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
              active
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {active ? (
              <>
                <Truck className="h-4 w-4" aria-hidden="true" />
                Track order
              </>
            ) : (
              <>
                View details
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Link>

          {!active ? (
            <Link
              href={reorderHref(order)}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reorder
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/history';
  const { hydrated, isLoggedIn, isCustomer } = useAuth();

  const [filter, setFilter] = useState<OrderFilter>('all');

  const {
    orders,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    lastUpdated,
    live,
    refresh,
    reload,
    loadMore,
  } = useCustomerOrders({
    filter,
    pageSize: 20,
  });

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace(
        `/auth/login?returnTo=${encodeURIComponent(pathname)}`,
      );
    }
  }, [hydrated, isLoggedIn, router, pathname]);

  if (!hydrated || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!isCustomer) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-20 text-center">
        <div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Package className="h-7 w-7 text-slate-500" aria-hidden="true" />
          </div>

          <h1 className="mt-5 text-xl font-extrabold text-slate-900">
            Customer accounts only
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a customer account to see your orders.
          </p>

          <Link
            href="/auth/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const activeOrder = orders.find((order) => isActiveStatus(order.status));
  const pendingReviewCount = orders.filter(
    (order) => order.status === 'COMPLETED' && !order.hasReview,
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-32">
      <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-5 sm:px-6 sm:pt-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/customer/home"
              className="inline-flex min-h-9 items-center text-sm font-semibold text-emerald-700 hover:underline"
            >
              ← Home
            </Link>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Your orders
              </h1>

              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <span
                    className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  Live
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Track deliveries, reorder water, and manage your past orders.
            </p>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              aria-label="Refresh orders"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>

            <Link
              href="/book"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:flex-none"
            >
              + Book water
            </Link>
          </div>
        </header>

        {pendingReviewCount > 0 && filter === 'all' ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-500 shadow-sm"
              aria-hidden="true"
            >
              <Star className="h-4 w-4 fill-current" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900">
                {pendingReviewCount === 1
                  ? 'You have 1 delivery waiting for your feedback.'
                  : `You have ${pendingReviewCount} deliveries waiting for your feedback.`}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                A quick rating helps us improve your next delivery.
              </p>
            </div>
          </div>
        ) : null}

        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter orders"
        >
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={[
                'min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
                filter === item.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        {lastUpdated ? (
          <p className="mt-2 text-xs text-slate-400">
            Updated{' '}
            {lastUpdated.toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        ) : null}

        <section
          className="mt-4 space-y-3"
          aria-busy={loading}
          aria-live="polite"
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center">
              <p className="font-semibold text-rose-800">
                We could not load your orders.
              </p>

              <p className="mt-1 text-sm leading-5 text-rose-700">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void reload()}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Try again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"
                aria-hidden="true"
              >
                <Package className="h-7 w-7 text-slate-400" />
              </div>

              <p className="mt-4 font-extrabold text-slate-900">
                {EMPTY[filter].title}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {EMPTY[filter].sub}
              </p>

              <Link
                href="/book"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                Book now
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          )}
        </section>

        {hasMore && !loading && !error ? (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>

      <BottomNav activeOrderId={activeOrder?.id ?? null} />
    </div>
  );
}
