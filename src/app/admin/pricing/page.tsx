'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type ApiPayload = {
  ok?: boolean;
  data?: unknown;
  settings?: unknown;
  message?: string;
  error?: string;
};

type PriceEntry = {
  key: string;
  label: string;
  price: number;
};

const SERVICE_LABELS: Record<string, string> = {
  water_can: 'Water can',
  normal_ro: 'Normal RO water',
  chilled_ro: 'Chilled RO water',
  plumbing: 'Plumbing',
  installation: 'Installation',
  maintenance: 'Maintenance',
  water_tanker: 'Water tanker',
  ro_service: 'RO service',
  borewell: 'Borewell service',
  motor_pump: 'Motor pump',
  tank_cleaning: 'Water tank cleaning',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSettings(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;

  if (isRecord(payload.settings)) return payload.settings;

  if (isRecord(payload.data)) {
    const data = payload.data;
    if (isRecord(data.settings)) return data.settings;
    return data;
  }

  return payload;
}

function getPriceMap(
  settings: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!settings) return null;

  const candidates = [
    settings.service_base_prices,
    settings.serviceBasePrices,
    settings.configured_price,
    settings.configured_prices,
  ];

  for (const candidate of candidates) {
    if (isRecord(candidate)) return candidate;
  }

  return null;
}

function toPriceEntries(
  priceMap: Record<string, unknown> | null,
): PriceEntry[] {
  if (!priceMap) return [];

  return Object.entries(priceMap)
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] >= 0,
    )
    .map(([key, price]) => ({
      key,
      label:
        SERVICE_LABELS[key] ??
        key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      price,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default function AdminPricingPage() {
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [hasPriceMap, setHasPriceMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const details = isRecord(payload)
          ? String(payload.message || payload.error || '')
          : '';

        throw new Error(
          details || `Could not load pricing settings (HTTP ${response.status}).`,
        );
      }

      const settings = getSettings(payload);
      const priceMap = getPriceMap(settings);

      setHasPriceMap(priceMap !== null);
      setPrices(toPriceEntries(priceMap));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'An unexpected error occurred while loading pricing.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing, refreshKey]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-cyan-700">
              AUROTAP / ADMIN
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Pricing & charges
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review water prices and rates returned by your existing settings API.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-800 to-blue-950 p-6 text-white sm:p-9">
          <p className="text-sm font-semibold text-cyan-100">
            TRANSPARENT WATER PRICING
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Clear prices. Better customer trust.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-50 sm:text-base">
            Keep the price shown to customers consistent with checkout,
            subscriptions and supplier settlements. Verify every charge before
            changing production pricing.
          </p>
        </section>

        <section className="mt-8">
          <div>
            <h2 className="text-xl font-bold">Customer-facing water prices</h2>
            <p className="mt-1 text-sm text-slate-500">
              Established display prices for 20-litre cans.
            </p>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <article className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">
                💧
              </div>
              <p className="mt-5 text-lg font-bold">Normal RO water</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold">₹20</span>
                <span className="text-sm text-slate-500">per 20L can</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Customer-facing price including delivery and GST, as configured
                in the current business pricing decision.
              </p>
            </article>

            <article className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                ❄️
              </div>
              <p className="mt-5 text-lg font-bold">Chilled RO water</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold">₹25</span>
                <span className="text-sm text-slate-500">per 20L can</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Display price for chilled water. Confirm the actual checkout
                calculation before publishing any price changes.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Configured service rates</h2>
              <p className="mt-1 text-sm text-slate-500">
                Read-only values returned by the existing admin settings API.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh rates'}
            </button>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4"
            >
              <p className="font-semibold text-rose-800">
                Pricing settings could not be loaded
              </p>
              <p className="mt-1 break-words text-sm text-rose-700">{error}</p>
              <p className="mt-2 text-sm text-rose-700">
                Check the admin session, permissions and API response. Do not
                disable server-side authorization to resolve a 401 or 403.
              </p>
            </div>
          ) : loading ? (
            <p className="py-12 text-center text-sm text-slate-500" role="status">
              Loading configured rates…
            </p>
          ) : !hasPriceMap ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <h3 className="font-semibold">No recognised price map found</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The settings response does not contain a recognised price map.
                Verify the actual response and schema before enabling editing.
              </p>
            </div>
          ) : prices.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
              The configured price map contains no valid numeric rates.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {prices.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{entry.label}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">
                      {entry.key}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-bold">
                    ₹{entry.price.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-950">Pricing safety checklist</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-950/80">
            <li>Confirm checkout totals match the prices displayed here.</li>
            <li>Do not add delivery twice when the advertised price includes it.</li>
            <li>Verify subscription rates separately from single-order rates.</li>
            <li>Verify supplier payout and platform commission calculations.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
