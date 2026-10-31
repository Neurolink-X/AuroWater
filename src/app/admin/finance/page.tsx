
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  adminFinance,
  getApiErrorMessage,
} from '@/lib/api-client';

type RangeKey = '7d' | '30d' | '90d' | 'all';

type FinancePayload = {
  range: RangeKey;
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
};

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All available (currently up to 10 years)' },
];

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatINR(value: number): string {
  return INR_FORMATTER.format(value);
}

function isRangeKey(value: string): value is RangeKey {
  return value === '7d' ||
    value === '30d' ||
    value === '90d' ||
    value === 'all';
}

function isFinancePayload(value: unknown): value is FinancePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    isRangeKey(String(payload.range ?? '')) &&
    typeof payload.order_count === 'number' &&
    Number.isSafeInteger(payload.order_count) &&
    payload.order_count >= 0 &&
    typeof payload.gross_revenue === 'number' &&
    Number.isFinite(payload.gross_revenue) &&
    payload.gross_revenue >= 0 &&
    typeof payload.collected_revenue === 'number' &&
    Number.isFinite(payload.collected_revenue) &&
    payload.collected_revenue >= 0 &&
    typeof payload.pending_payments === 'number' &&
    Number.isFinite(payload.pending_payments) &&
    payload.pending_payments >= 0
  );
}

const EMPTY_METRICS = [
  {
    key: 'orders',
    label: 'Completed orders',
    description: 'Orders marked completed by the API',
    format: 'count',
  },
  {
    key: 'gross_revenue',
    label: 'Gross revenue',
    description: 'Total value reported for completed orders',
    format: 'currency',
  },
  {
    key: 'collected_revenue',
    label: 'Recorded paid orders',
    description: 'Marked paid in the app; external bank settlement is not verified here',
    format: 'currency',
  },
  {
    key: 'pending_payments',
    label: 'Recorded unpaid balance',
    description: 'Gross revenue minus collected payments',
    format: 'currency',
  },
] as const;

export default function AdminFinancePage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFinance(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const response: unknown = await adminFinance(range);

        if (!isFinancePayload(response)) {
          throw new Error(
            'The finance service returned an unexpected response. Please retry.'
          );
        }

        if (active) {
          setData(response);
        }
      } catch (cause: unknown) {
        if (!active) return;

        const message = getApiErrorMessage(cause);
        setData(null);
        setError(message);
        toast.error(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFinance();

    return () => {
      // Prevent outdated requests from changing the current screen.
      active = false;
    };
  }, [range, retryKey]);

  const retry = () => {
    setRetryKey((current) => current + 1);
  };

  const metricValues: Record<string, number> = {
    orders: data?.order_count ?? 0,
    gross_revenue: data?.gross_revenue ?? 0,
    collected_revenue: data?.collected_revenue ?? 0,
    pending_payments: data?.pending_payments ?? 0,
  };

  return (
    <section
      className="space-y-6"
      aria-labelledby="admin-finance-heading"
      aria-busy={loading}
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            id="admin-finance-heading"
            className="text-2xl font-bold text-white"
          >
            Finance
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Completed-order financial summary from recorded application statuses. Not a verified bank settlement report.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="finance-range"
            className="text-sm text-slate-300"
          >
            Reporting period
          </label>

          <select
            id="finance-range"
            value={range}
            onChange={(event) => {
              const nextRange = event.target.value;

              if (isRangeKey(nextRange)) {
                setRange(nextRange);
              }
            }}
            disabled={loading}
            className="min-w-40 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={retry}
            disabled={loading}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-amber-400/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
        <strong>Reconciliation required:</strong> A status marked paid is an application record, not proof of UPI/bank settlement.
        Verify cash collection, payment-provider references and supplier payouts separately before closing a discrepancy.
        <a href="/admin/order-health" className="ml-2 font-bold underline underline-offset-2">Review payment and order exceptions →</a>
      </div>

      {loading && (
        <div
          className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300"
          role="status"
          aria-live="polite"
        >
          Loading finance data…
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-5"
          role="alert"
        >
          <p className="font-medium text-rose-200">
            Finance data could not be loaded.
          </p>
          <p className="mt-2 break-words text-sm text-rose-100/80">
            {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-lg border border-rose-300/30 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400/10"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div
            className="grid gap-4 sm:grid-cols-2"
            aria-label="Finance summary"
          >
            {EMPTY_METRICS.map((metric) => {
              const value = metricValues[metric.key];

              return (
                <article
                  key={metric.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {metric.label}
                  </h2>

                  <p className="mt-2 break-words text-2xl font-bold text-white">
                    {metric.format === 'count'
                      ? value.toLocaleString('en-IN')
                      : formatINR(value)}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {metric.description}
                  </p>
                </article>
              );
            })}
          </div>

          {data.order_count === 0 && (
            <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-300">
              No completed orders were reported for this period. Revenue
              values are zero for the returned dataset.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Reporting period: {RANGE_OPTIONS.find(
              (option) => option.value === data.range
            )?.label ?? data.range}
            . Values reflect the API response and may depend on the
            server-side query and database limits.
          </p>
        </>
      )}
    </section>
  );
}
