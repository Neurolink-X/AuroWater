
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Service = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  active?: boolean;
  is_active?: boolean;
  price?: number | null;
  base_price?: number | null;
};

type ApiResult = {
  ok?: boolean;
  data?: unknown;
  services?: unknown;
  error?: string;
  message?: string;
};

function extractServices(payload: unknown): Service[] {
  if (Array.isArray(payload)) return payload as Service[];

  if (!payload || typeof payload !== 'object') return [];

  const result = payload as ApiResult;
  const data = result.data;

  if (Array.isArray(data)) return data as Service[];

  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>;

    if (Array.isArray(nested.services)) {
      return nested.services as Service[];
    }
  }

  if (Array.isArray(result.services)) {
    return result.services as Service[];
  }

  return [];
}

const categories = ['All', 'Water', 'Plumbing', 'Maintenance', 'Other'];

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      setLoading(true);
      setError('');

      try {
        // This is the existing admin settings API.
        // It avoids inventing a new service table or endpoint.
      
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
            `Unable to load settings (HTTP ${response.status}).`;

          throw new Error(message);
        }

        if (!cancelled) {
          setServices(extractServices(payload));
        }
    catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Something went wrong while loading services.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadServices();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !term ||
        service.name?.toLowerCase().includes(term) ||
        service.description?.toLowerCase().includes(term);

      const matchesCategory =
        category === 'All' ||
        (service.category || 'Other').toLowerCase() ===
          category.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [services, search, category]);

  const activeCount = services.filter(
    (service) => service.active === true || service.is_active === true,
  ).length;

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <div className="mb-1 text-sm font-semibold text-cyan-700">
              AUROTAP · ADMINISTRATION
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Water & Home Services
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor the service catalog and keep your local service
              marketplace organised.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
          >
            ← Admin dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5">
            <p className="text-sm font-medium text-cyan-800">
              Catalog services
            </p>
            <p className="mt-2 text-3xl font-bold">{services.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              Services returned by the API
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
            <p className="text-sm font-medium text-emerald-800">
              Active services
            </p>
            <p className="mt-2 text-3xl font-bold">{activeCount}</p>
            <p className="mt-1 text-sm text-slate-500">
              Based on explicit active flags
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-600">
              Filtered results
            </p>
            <p className="mt-2 text-3xl font-bold">
              {filteredServices.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Matching your current filters
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Service catalog</h2>
              <p className="mt-1 text-sm text-slate-500">
                Search and inspect services configured for AuroTap.
              </p>
            </div>

            <label className="w-full md:max-w-sm">
              <span className="sr-only">Search services</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search water, plumbing..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-50"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  category === item
                    ? 'bg-cyan-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div
              className="py-16 text-center text-sm text-slate-500"
              role="status"
            >
              Loading service catalog…
            </div>
          ) : error ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="font-semibold text-rose-800">
                Could not load services
              </h3>
              <p className="mt-2 break-words text-sm text-rose-700">
                {error}
              </p>
              <p className="mt-2 text-sm text-rose-700">
                If you see 401 or 403, check your admin session and role.
                Do not remove server-side authorization to make this page load.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
              >
                Try again
              </button>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
              <div className="text-3xl" aria-hidden="true">
                💧
              </div>
              <h3 className="mt-3 font-semibold">
                {services.length === 0
                  ? 'No service list was returned'
                  : 'No matching services'}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                {services.length === 0
                  ? 'The settings API may not expose the service catalog. Connect this page to the existing service catalog endpoint before enabling service management.'
                  : 'Try another search term or select a different category.'}
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredServices.map((service) => {
                const active =
                  service.active === true || service.is_active === true;

                const price = service.base_price ?? service.price;

                return (
                  <article
                    key={service.id}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-cyan-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-xl">
                        💧
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {active ? 'Active' : 'Status not confirmed'}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold">{service.name}</h3>
                    <p className="mt-1 min-h-10 text-sm leading-6 text-slate-500">
                      {service.description || 'No description provided.'}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">
                        {service.category || 'Uncategorised'}
                      </span>
                      <span className="font-bold text-slate-900">
                        {typeof price === 'number'
                          ? `₹${price.toLocaleString('en-IN')}`
                          : 'Price not available'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <p className="mt-5 text-xs leading-5 text-slate-400">
          Read-only catalog view. Pricing and service status are not modified
          from this page. Use the existing approved admin workflow for changes.
        </p>
      </div>
    </main>
  );
}
