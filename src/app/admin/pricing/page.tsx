
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Settings = Record<string, unknown>;

type ApiResult = {
  ok?: boolean;
  data?: unknown;
  settings?: unknown;
  message?: string;
  error?: string;
};

function extractSettings(payload: unknown): Settings | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as ApiResult;

  if (
    root.data &&
    typeof root.data === 'object' &&
    !Array.isArray(root.data)
  ) {
    return root.data as Settings;
  }

  if (
    root.settings &&
    typeof root.settings === 'object' &&
    !Array.isArray(root.settings)
  ) {
    return root.settings as Settings;
  }

  return payload as Settings;
}

function findPriceMap(settings: Settings | null): Record<string, unknown> | null {
  if (!settings) return null;

  const candidates = [
    settings.service_base_prices,
    settings.serviceBasePrices,
    settings.configured_price,
    settings.configured_prices,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate)
    ) {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

function validPrice(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000
  );
}

const WATER_PRICES = [
  {
    name: 'Normal RO Water',
    price: 20,
    unit: 'per 20L can',
    note: 'Customer-facing price including delivery and GST.',
  },
  {
    name: 'Chilled RO Water',
    price: 25,
    unit: 'per 20L can',
    note: 'Customer-facing chilled-water price.',
  },
];

const SERVICE_LABELS: Record<string, string> = {
  water_can: 'Water can',
  plumbing: 'Plumbing',
  installation: 'Installation',
  maintenance: 'Maintenance',
  water_tanker: 'Water tanker',
  ro_service: 'RO service',
  borewell: 'Borewell service',
  motor_pump: 'Motor pump',
  tank_cleaning: 'Water tank cleaning',
};

export default function AdminPricingPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [priceMap, setPriceMap] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok) {
        const message =
          payload.message ||
          payload.error ||
          `Unable to load pricing settings (HTTP ${response.status}).`;

        throw new Error(message);
      }

      const nextSettings = extractSettings(payload);

      setSettings(nextSettings);
      setPriceMap(findPriceMap(nextSettings));
 catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load pricing configuration.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const configuredPrices = Object.entries(priceMap || {}).filter(
    ([, value]) => validPrice(value),
  );

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-sm font-semibold text-cyan-700">
              AUROTAP · REVENUE MANAGEMENT
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Pricing & Charges
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review customer-facing water prices and configured service rates.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            ← Admin dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="rounded-3xl bg-gradient-to-br from-cyan-800 to-blue-950 p-6 text-white sm:p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-cyan-100">
              SIMPLE · TRANSPARENT · LOCAL
            </p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Clear prices build customer trust.
            </h2>
            <p className="mt-3 text-sm leading-6 text-cyan-50 sm:text-base">
              Keep water pricing consistent across product cards, checkout,
              subscriptions and supplier settlements. Never silently add
              another delivery charge to a price that already includes delivery.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Water delivery prices</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your currently established customer-facing prices.
              </p>
            </div>
            <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
              20-litre cans
            </span>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {WATER_PRICES.map((item, index) => (
              <article
                key={item.name}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">
                    {index === 0 ? '💧' : '❄️'}
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Display price
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{item.name}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">
                    ₹{item.price}
                  </span>
                  <span className="text-sm text-slate-500">{item.unit}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {item.note}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Configured service rates</h2>
              <p className="mt-1 text-sm text-slate-500">
                Read from the existing admin settings endpoint.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadSettings()}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh rates'}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              <p className="font-semibold">Unable to load rates</p>
              <p className="mt-1 break-words">{error}</p>
              <p className="mt-2">
                Check your admin session, permissions and API response. Do not
                bypass server-side role checks.
              </p>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading pricing configuration…
            </div>
          ) : !error && !priceMap ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
              <h3 className="font-semibold">
                Service price configuration not found
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The endpoint did not return a recognised service price map.
                Verify the real settings schema and response shape before
                connecting price editing.
              </p>
            </div>
          ) : !error ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              {configuredPrices.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">
                  No numeric service rates were returned.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {configuredPrices.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
                    >
                      <div>
                        <p className="font-semibold">
                          {SERVICE_LABELS[key] || key.replaceAll('_', ' ')}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Configuration key: {key}
                        </p>
                      </div>
                      <span className="shrink-0 text-lg font-bold">
                        ₹{(value as number).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-bold text-amber-900">
            Before changing a price
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900/80">
            <li>Verify the final amount in the customer checkout.</li>
            <li>Confirm whether GST and delivery are already included.</li>
            <li>Keep subscription pricing consistent with the selected plan.</li>
            <li>Verify supplier earnings and platform commission separately.</li>
            <li>Never change existing pricing through an unverified payload.</li>
          </ul>
        </section>

        {notice && (
          <p role="status" className="mt-4 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        {settings && (
          <p className="mt-5 text-xs text-slate-400">
            Settings loaded successfully. Editing is intentionally disabled
            until the exact write contract and validation rules are verified.
          </p>
        )}
      </div>
    </main>
  );
}

