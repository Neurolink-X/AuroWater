'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { adminSettingsGet } from '@/lib/api-client';

type UnknownRecord = Record<string, unknown>;

type ServiceRate = {
  key: string;
  name: string;
  price: number;
};

const SERVICE_NAMES: Record<string, string> = {
  water_can: '20L water can',
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

const RATE_MAP_KEYS = [
  'service_base_prices',
  'serviceBasePrices',
  'configured_price',
  'configured_prices',
] as const;

const RATE_VALUE_KEYS = [
  'price',
  'base_price',
  'basePrice',
  'amount',
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Supports common settings API response envelopes.
 * Does not assume that every response uses the same nesting.
 */
function getSettings(payload: unknown): UnknownRecord | null {
  if (!isRecord(payload)) return null;

  let current: UnknownRecord = payload;

  for (let depth = 0; depth < 4; depth += 1) {
    if (isRecord(current.settings)) {
      current = current.settings;
      continue;
    }

    if (isRecord(current.data)) {
      current = current.data;
      continue;
    }

    return current;
  }

  return current;
}

/**
 * Parses a non-negative finite price from a number,
 * numeric string, or supported price object.
 */
function parsePrice(value: unknown): number | null {
  let candidate = value;

  if (isRecord(value)) {
    candidate = undefined;

    for (const key of RATE_VALUE_KEYS) {
      if (value[key] !== undefined && value[key] !== null) {
        candidate = value[key];
        break;
      }
    }
  }

  if (typeof candidate === 'string') {
    if (!candidate.trim()) return null;
    candidate = Number(candidate);
  }

  if (
    typeof candidate !== 'number' ||
    !Number.isFinite(candidate) ||
    candidate < 0
  ) {
    return null;
  }

  return candidate;
}

function getConfiguredRates(
  settings: UnknownRecord | null,
): ServiceRate[] {
  if (!settings) return [];

  let rateMap: UnknownRecord | null = null;

  for (const key of RATE_MAP_KEYS) {
    if (isRecord(settings[key])) {
      rateMap = settings[key] as UnknownRecord;
      break;
    }
  }

  if (!rateMap) return [];

  return Object.entries(rateMap)
    .flatMap(([key, value]) => {
      const price = parsePrice(value);

      if (price === null) return [];

      return [
        {
          key,
          name:
            SERVICE_NAMES[key] ??
            key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase()),
          price,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getErrorMessage(cause: unknown): string {
  if (!(cause instanceof Error)) {
    return 'An unexpected error occurred while loading service settings.';
  }

  if (
    /unauthorized|no authentication token|http 401/i.test(cause.message)
  ) {
    return 'Your admin session may have expired. Sign in again and retry.';
  }

  if (/forbidden|http 403/i.test(cause.message)) {
    return 'Your account does not have permission to view service settings.';
  }

  return cause.message || 'Could not load service settings.';
}

export default function AdminServicesPage() {
  const [rates, setRates] = useState<ServiceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasRateConfiguration, setHasRateConfiguration] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');

  // Ignore results from older requests after refresh or unmount.
  const requestId = useRef(0);

  const loadServicesOverview = useCallback(async () => {
    const currentRequestId = ++requestId.current;

    setLoading(true);
    setError('');

    try {
      // Uses the existing authenticated API client.
      const payload: unknown = await adminSettingsGet();

      if (currentRequestId !== requestId.current) return;

      const settings = getSettings(payload);

      let hasRates = false;

      if (settings) {
        hasRates = RATE_MAP_KEYS.some((key) =>
          isRecord(settings[key]),
        );
      }

      setHasRateConfiguration(hasRates);
      setRates(getConfiguredRates(settings));
    } catch (cause) {
      if (currentRequestId !== requestId.current) return;

      setHasRateConfiguration(false);
      setRates([]);
      setError(getErrorMessage(cause));
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadServicesOverview();

    return () => {
      requestId.current += 1;
    };
  }, [loadServicesOverview, refreshKey]);

  const filteredRates = rates.filter((rate) => {
    const term = search.trim().toLowerCase();

    return (
      !term ||
      rate.name.toLowerCase().includes(term) ||
      rate.key.toLowerCase().includes(term)
    );
  });

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-cyan-700">
              AUROTAP / ADMIN
            </p>

            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Water &amp; home services
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Review configured service rates and access pricing controls.
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
        <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-wider text-cyan-800">
                Water delivered. Water problems solved.
              </p>

              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                One service platform for everyday needs.
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                Keep water delivery as the primary service, with plumbing and
                other home water services available as customers need them.
              </p>
            </div>

            <div
              aria-hidden="true"
              className="flex h-28 w-28 shrink-0 items-center justify-center self-start rounded-3xl bg-white text-6xl shadow-sm ring-1 ring-cyan-100 sm:self-center"
            >
              💧
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-cyan-100 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-xl">
              💧
            </div>

            <h3 className="mt-4 font-bold">Water delivery</h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Normal and chilled 20L RO water. Check order prices and delivery
              totals in the existing customer checkout.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-xl">
              🛠️
            </div>

            <h3 className="mt-4 font-bold">Plumbing</h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Plumbing requests and technician availability should follow the
              existing booking and dispatch workflow.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-xl">
              🏠
            </div>

            <h3 className="mt-4 font-bold">Home water services</h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              RO servicing, tanks, pumps and other configured services can be
              listed when supported by the existing catalog.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold">Configured service rates</h2>

              <p className="mt-1 text-sm text-slate-500">
                Read-only view of rates returned by the existing settings API.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label>
                <span className="sr-only">Search configured services</span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search services…"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-50 sm:w-64"
                />
              </label>

              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                disabled={loading}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4"
            >
              <p className="font-semibold text-rose-800">
                Could not load service settings
              </p>

              <p className="mt-1 break-words text-sm text-rose-700">
                {error}
              </p>

              <p className="mt-2 text-sm text-rose-700">
                Check your admin session and server permissions. Keep
                server-side authorization enabled.
              </p>

              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <p
              className="py-12 text-center text-sm text-slate-500"
              role="status"
            >
              Loading service settings…
            </p>
          ) : !hasRateConfiguration ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <h3 className="font-semibold">
                Service rates are not exposed here
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                The settings response did not contain a recognised rate map.
                Verify the actual API response and database schema before
                changing the pricing configuration. This page does not invent
                rates or create database records.
              </p>
            </div>
          ) : filteredRates.length === 0 ? (
            <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
              {rates.length === 0
                ? 'The configured rate map contains no valid numeric rates.'
                : 'No configured rates match this search.'}
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {filteredRates.map((rate) => (
                <div
                  key={rate.key}
                  className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{rate.name}</p>

                    <p className="mt-1 break-all text-xs text-slate-400">
                      {rate.key}
                    </p>
                  </div>

                  <p className="shrink-0 font-bold">
                    ₹{rate.price.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-5">
            <Link
              href="/admin/pricing"
              className="inline-flex items-center rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-800"
            >
              Review pricing
              <span className="ml-2" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
