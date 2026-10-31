'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { City } from '@/lib/cities';
import { FALLBACK_CITIES } from '@/lib/cities';
import {
  cityAvailabilityLabel,
  mergePublicCityDirectory,
  selectFooterCities,
} from '@/lib/public-city-directory';

/**
 * Compact site footer.
 *
 * Keep the city list capped, even after expansion to dozens of markets.
 * The full list is available on /service-areas, where the service-zone
 * readiness and waitlist messaging can be explained properly.
 *
 * Data comes from the existing admin-managed cities directory; we never
 * infer whether a city is active from its service_zones alone.
 */
const QUICK_LINKS = [
  { href: '/services', title: 'All services' },
  { href: '/pricing', title: 'Pricing' },
  { href: '/how-it-works', title: 'How it works' },
  { href: '/service-areas', title: 'Service areas' },
  { href: '/blog', title: 'Guides & updates' },
  { href: '/contact', title: 'Contact' },
] as const;

const SERVICES = [
  { href: '/book?service=water_can', title: '20L RO water' },
  { href: '/book?service=water_tanker', title: 'Water tanker' },
  { href: '/book?service=plumbing', title: 'Plumber' },
  { href: '/book?service=ro_service', title: 'RO repair' },
  { href: '/book?service=tank_cleaning', title: 'Tank cleaning' },
  { href: '/services', title: 'View all services' },
] as const;

const LEGAL = [
  { href: '/privacy', title: 'Privacy' },
  { href: '/terms', title: 'Terms' },
  { href: '/cookies', title: 'Cookies' },
  { href: '/security', title: 'Security' },
] as const;

const linkClass =
  'inline-flex min-h-9 items-center rounded-md py-1 text-sm leading-5 text-slate-300 ' +
  'transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-sky-300';

type GroupedCities = ReturnType<typeof selectFooterCities>;

function CompactCityList({ groups }: { groups: GroupedCities }) {
  return (
    <div aria-label="Service city directory" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {groups.active.map((city) => (
          <Link
            key={city.slug}
            href="/service-areas"
            title={`Check address-level availability for ${city.name}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-500/30
              bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100
              hover:border-emerald-400/70 hover:bg-emerald-500/20 focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {city.name}
          </Link>
        ))}
        {groups.upcoming.map((city) => (
          <Link
            key={city.slug}
            href="/service-areas#upcoming-areas"
            title={`${city.name}: ${cityAvailabilityLabel(city)}`}
            className="inline-flex min-h-9 items-center rounded-full border border-slate-600
              bg-white/5 px-3 py-1 text-xs font-medium text-slate-300
              hover:text-white focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            {city.name} · Soon
          </Link>
        ))}
      </div>
      <p className="text-xs leading-5 text-slate-400">
        Coverage varies by address, supplier availability and service.
        {groups.remaining > 0 ? ` ${groups.remaining} more areas listed online.` : ''}
      </p>
      <Link
        href="/service-areas"
        className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-sky-300
          hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Explore all cities <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default function Footer() {
  const [cities, setCities] = useState<City[]>(() =>
    mergePublicCityDirectory([], FALLBACK_CITIES),
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        const response = await fetch('/api/cities', {
          signal: controller.signal,
          cache: 'default',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('City directory unavailable');
        const data: unknown = await response.json();
        if (active) {
          setCities(mergePublicCityDirectory(data, FALLBACK_CITIES));
        }
      } catch {
        // The last rendered directory remains available offline.
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const groupedCities = useMemo(() => selectFooterCities(cities, 6, 2), [cities]);

  return (
    <footer className="w-full min-w-0 border-t border-slate-700/50 bg-[#081321] text-slate-100"
      aria-label="AuroTap site footer">
      <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pb-7 sm:pt-10 lg:px-8">
        <div className="grid min-w-0 gap-x-8 gap-y-7 md:grid-cols-[1.2fr_1fr_1fr] lg:gap-x-14">
          <div className="min-w-0">
            <Link href="/" aria-label="AuroTap home"
              className="inline-flex min-h-11 items-center gap-2 rounded-md
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                focus-visible:outline-sky-300">
              {/* Existing lightweight branded logo, no remote image request. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/splash-logo.svg" alt="" width="36" height="36"
                decoding="async" className="h-9 w-9 shrink-0 rounded-xl" />
              <span className="text-xl font-extrabold tracking-tight text-white">AuroTap</span>
            </Link>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
              RO water delivery and essential water-system services.
              Check your address and live pricing before you book.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/book?service=water_can"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-sky-500
                  px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-sky-300
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                Order water
              </Link>
              <a href="https://wa.me/919889305803" target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border
                  border-slate-500 px-4 py-2 text-sm font-semibold text-white
                  hover:border-slate-300 hover:bg-white/10 focus-visible:outline
                  focus-visible:outline-2 focus-visible:outline-offset-2">
                WhatsApp
              </a>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-white">Explore AuroTap</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3 md:grid-cols-2">
              {QUICK_LINKS.map((item) => (
                <Link key={item.href} className={linkClass} href={item.href}>
                  {item.title}
                </Link>
              ))}
            </div>
            <h2 className="mt-4 text-sm font-bold text-white">Book a service</h2>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
              {SERVICES.map((item) => (
                <Link key={item.href} className={linkClass} href={item.href}>
                  {item.title}
                </Link>
              ))}
            </div>
          </nav>

          <div className="min-w-0">
            <h2 className="mb-3 text-sm font-bold tracking-wide text-white">Where we operate</h2>
            <CompactCityList groups={groupedCities} />
            <div className="mt-3 text-xs leading-5 text-slate-400">
              Questions?{' '}
              <a href="mailto:support.aurotap@gmail.com"
                className="break-all font-semibold text-slate-200 underline-offset-4
                  hover:underline focus-visible:outline focus-visible:outline-2">
                support.aurotap@gmail.com
              </a>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-4
          text-xs leading-5 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p suppressHydrationWarning>© {new Date().getFullYear()} AuroTap. All rights reserved.</p>
          <nav aria-label="Policies" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL.map((item) => (
              <Link key={item.href} href={item.href}
                className="min-h-7 text-slate-300 hover:text-white
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                {item.title}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
