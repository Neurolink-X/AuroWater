'use client';

import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import {
  customerSubscriptionUpdate,
  customerSubscriptionsList,
  type CustomerSubscription,
} from '@/lib/api-client';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Every day',
  alternate: 'Every 2 days',
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
};

function frequencyLabel(value: string): string {
  return (
    FREQUENCY_LABELS[value] ??
    value.replace(/_/g, ' ')
  );
}

function formatDate(value: string): string {
  const date = new Date(
    value + 'T00:00:00+05:30'
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  ).format(date);
}

function money(value: number): string {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

function statusStyle(
  status: CustomerSubscription['status']
): string {
  if (status === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  if (status === 'PAUSED') {
    return 'bg-amber-50 text-amber-700 ring-amber-200';
  }

  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function statusLabel(
  status: CustomerSubscription['status']
): string {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'PAUSED') return 'Paused';
  return 'Cancelled';
}

export default function CustomerSubscriptionsPage() {
  const {
    hydrated,
    isLoggedIn,
    isCustomer,
  } = useAuth();

  const [items, setItems] =
    useState<CustomerSubscription[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  async function load(
    silent = false
  ) {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const data =
        await customerSubscriptionsList();

      setItems(
        Array.isArray(data)
          ? data
          : []
      );
    } catch {
      setError(
        'We could not load your subscriptions right now. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (
      hydrated &&
      isLoggedIn &&
      isCustomer
    ) {
      void load();
    }
  }, [
    hydrated,
    isLoggedIn,
    isCustomer,
  ]);

  async function updateSubscription(
    id: string,
    action:
      | 'pause'
      | 'resume'
      | 'cancel'
  ) {
    if (busyId) return;

    const subscription =
      items.find(
        (item) =>
          item.id === id
      );

    if (!subscription) return;

    const messages = {
      pause:
        'Pause future deliveries for this subscription?',
      resume:
        'Resume this subscription and schedule its next delivery?',
      cancel:
        'Cancel this subscription? Future unaccepted deliveries will be cancelled.',
    };

    if (
      !window.confirm(
        messages[action]
      )
    ) {
      return;
    }

    setBusyId(id);
    setError('');
    setNotice('');

    try {
      const updated =
        await customerSubscriptionUpdate(
          id,
          action
        );

      setItems(
        (current) =>
          current.map(
            (item) =>
              item.id === id
                ? updated
                : item
          )
      );

      setNotice(
        action === 'pause'
          ? 'Subscription paused. No new future deliveries will be created until you resume it.'
          : action === 'resume'
            ? 'Subscription resumed. Your next delivery has been prepared.'
            : 'Subscription cancelled. Future unaccepted deliveries are cancelled.'
      );
    } catch {
      setError(
        'We could not update this subscription. Please try again.'
      );
    } finally {
      setBusyId(null);
    }
  }

  if (
    !hydrated ||
    loading
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl animate-pulse">
          <div className="h-8 w-48 rounded bg-slate-200" />
          <div className="mt-3 h-20 rounded-3xl bg-white" />
          <div className="mt-4 h-56 rounded-3xl bg-white" />
          <div className="mt-4 h-56 rounded-3xl bg-white" />
        </div>
      </main>
    );
  }

  if (
    !isLoggedIn ||
    !isCustomer
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-extrabold text-slate-950">
            Customer account required
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Please sign in with a customer account to manage recurring water deliveries.
          </p>
          <Link
            href="/auth/login?returnTo=%2Fcustomer%2Fsubscriptions"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-cyan-800"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const activeCount =
    items.filter(
      (item) =>
        item.status === 'ACTIVE'
    ).length;

  const pausedCount =
    items.filter(
      (item) =>
        item.status === 'PAUSED'
    ).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf8ff_0%,#f8fbff_42%,#ffffff_100%)] px-4 pb-28 pt-6 text-slate-900 sm:pt-10">
      <div className="mx-auto max-w-4xl">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm font-semibold text-slate-500"
        >
          <Link
            href="/customer/home"
            className="hover:text-cyan-700"
          >
            Home
          </Link>
          <ChevronRight
            className="h-4 w-4 text-slate-300"
            aria-hidden="true"
          />
          <Link
            href="/customer/account"
            className="hover:text-cyan-700"
          >
            Account
          </Link>
          <ChevronRight
            className="h-4 w-4 text-slate-300"
            aria-hidden="true"
          />
          <span
            className="text-slate-900"
            aria-current="page"
          >
            Subscriptions
          </span>
        </nav>

        <header className="mt-6 overflow-hidden rounded-[2rem] border border-white bg-slate-950 shadow-[0_26px_80px_rgba(15,23,42,0.12)]">
          <div className="relative px-6 py-8 sm:px-10 sm:py-11">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500" />

            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                  <RotateCcw
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  Recurring water delivery
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  My subscriptions
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Manage your recurring water-can deliveries in one place.
                  Your plan controls the delivery schedule; each delivery remains a separate order.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:w-auto">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
                    Active
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {activeCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
                    Paused
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {pausedCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/book?service=water_can"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-cyan-800"
          >
            Start a new plan
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <Link
            href="/customer/history"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Order history
          </Link>

          <button
            type="button"
            onClick={() =>
              void load(true)
            }
            disabled={refreshing}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={
                refreshing
                  ? 'h-4 w-4 animate-spin'
                  : 'h-4 w-4'
              }
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {notice ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="font-semibold">{notice}</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4">
            <p className="text-sm font-extrabold text-rose-800">
              Something needs attention
            </p>
            <p className="mt-1 text-xs leading-5 text-rose-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800"
            >
              Try again
            </button>
          </div>
        ) : null}

        {items.length === 0 && !error ? (
          <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <RotateCcw className="h-8 w-8" aria-hidden="true" />
            </div>

            <h2 className="mt-5 text-xl font-extrabold text-slate-950">
              No subscriptions yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Choose a quantity, delivery frequency and address when booking water cans to create a recurring plan.
            </p>

            <Link
              href="/book?service=water_can"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-cyan-800"
            >
              Book water
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <section className="mt-5 space-y-4">
            {items.map((item) => {
              const busy =
                busyId === item.id;

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]"
                >
                  <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-lg">
                            💧
                          </span>

                          <div>
                            <h2 className="text-lg font-extrabold text-slate-950">
                              {item.quantity} water can{item.quantity === 1 ? '' : 's'}
                            </h2>

                            <p className="text-xs font-semibold text-slate-500">
                              {frequencyLabel(item.frequency)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <span
                        className={[
                          'inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset',
                          statusStyle(item.status),
                        ].join(' ')}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Next delivery
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                        <CalendarDays className="h-4 w-4 text-cyan-700" aria-hidden="true" />
                        {item.status === 'ACTIVE'
                          ? formatDate(item.next_order_date)
                          : 'Not scheduled'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Rate
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">
                        {money(item.price_per_can)} / can
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Delivery value
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">
                        {money(
                          Number(item.quantity) *
                            Number(item.price_per_can)
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Payment
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-slate-900">
                        {item.payment_method === 'upi'
                          ? 'UPI per delivery'
                          : 'Cash per delivery'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-5 py-5 sm:px-7">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Preferred window
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {item.preferred_time_slot}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Started {formatDate(item.start_date)}
                        </p>
                      </div>

                      {item.status === 'ACTIVE' ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateSubscription(
                                item.id,
                                'pause'
                              )
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                          >
                            <Pause className="h-4 w-4" aria-hidden="true" />
                            {busy ? 'Updating…' : 'Pause'}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateSubscription(
                                item.id,
                                'cancel'
                              )
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      ) : item.status === 'PAUSED' ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateSubscription(
                                item.id,
                                'resume'
                              )
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <Play className="h-4 w-4" aria-hidden="true" />
                            {busy ? 'Updating…' : 'Resume'}
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void updateSubscription(
                                item.id,
                                'cancel'
                              )
                            }
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          This plan is closed
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sm font-extrabold text-slate-950">
                Billing stays transparent
              </h2>
              <p className="mt-1 text-xs leading-5 text-emerald-900">
                AuroTap creates a separate order for each recurring delivery.
                Automatic payment debit is not enabled in the current subscription flow.
                Your payment method is applied per delivery.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
