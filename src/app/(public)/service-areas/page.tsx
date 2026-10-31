import type { Metadata } from 'next';
import Link from 'next/link';
import type { City } from '@/lib/cities';
import { getPublicServiceCities } from '@/lib/public-city-directory.server';
import {
  cityAvailabilityLabel,
} from '@/lib/public-city-directory';
import NcrWaitlistForm from '@/components/public/NcrWaitlistForm';

export const metadata: Metadata = {
  title: 'AuroTap Service Areas & Expansion Cities | Water Delivery',
  description: 'See AuroTap service cities across India, check address-level water delivery availability, and join the expansion waitlist for upcoming areas.',
  alternates: { canonical: '/service-areas' },
  openGraph: {
    title: 'AuroTap Service Areas & Upcoming Cities',
    description: 'Explore live service cities, expansion areas and availability checks.',
    url: '/service-areas',
    siteName: 'AuroTap',
  },
  robots: { index: true, follow: true },
};

export const dynamic = 'force-dynamic';

function CityCard({ city }: { city: City }) {
  const active = city.status === 'active';
  return (
    <article className="flex min-w-0 flex-col justify-between rounded-2xl border
      border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="min-w-0">
        <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-bold
          ${active ? 'bg-emerald-50 text-emerald-800' :
            city.status === 'coming_soon' ? 'bg-amber-50 text-amber-800' :
            'bg-slate-100 text-slate-700'}`}>
          {cityAvailabilityLabel(city)}
        </span>
        <h3 className="mt-3 text-xl font-extrabold tracking-tight text-slate-950">
          {city.name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {active
            ? 'Water and home services may be available in selected localities. Enter your full address to confirm coverage and current pricing.'
            : 'We are gathering interest and verifying local partners, zones and operational capacity. Bookings are not confirmed yet.'}
        </p>
      </div>
      <div className="mt-5">
        {active ? (
          <Link href="/book?service=water_can"
            aria-label={`Check water delivery availability in ${city.name}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-700
              px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Check availability <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        ) : (
          <a href="#join-waitlist"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border
              border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800
              hover:border-sky-400 hover:text-sky-800 focus-visible:outline
              focus-visible:outline-2 focus-visible:outline-offset-2">
            Request service updates <span aria-hidden="true" className="ml-2">→</span>
          </a>
        )}
      </div>
    </article>
  );
}

export default async function ServiceAreasPage() {
  const cities = await getPublicServiceCities();
  const active = cities.filter(city => city.status === 'active');
  const upcoming = cities.filter(city => city.status !== 'active');

  return (
    <div className="min-w-0 bg-slate-50 text-slate-900">
      <section className="bg-gradient-to-br from-[#071827] via-[#0a263b] to-[#073b47]
        px-4 py-12 text-white sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-sky-200">
            <Link href="/" className="hover:text-white hover:underline">Home</Link>
            <span className="mx-2 text-slate-400" aria-hidden="true">/</span>
            <span aria-current="page">Service areas</span>
          </nav>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
            AuroTap coverage
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight
            sm:text-4xl lg:text-5xl">
            Service areas across India
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
            Explore current AuroTap cities and upcoming expansion areas. City
            activation is reviewed by our operations team. Service availability
            still depends on your address, PIN code, the service you select,
            partner availability and stock.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/book?service=water_can"
              className="inline-flex min-h-11 items-center justify-center rounded-xl
                bg-sky-400 px-5 py-2.5 text-sm font-bold text-slate-950
                hover:bg-sky-300">
              Check delivery at my address
            </Link>
            <a href="#join-waitlist"
              className="inline-flex min-h-11 items-center justify-center rounded-xl
                border border-white/30 px-5 py-2.5 text-sm font-semibold text-white
                hover:bg-white/10">
              Join expansion waitlist
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
        aria-labelledby="active-areas">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
              Current operations
            </p>
            <h2 id="active-areas" className="mt-1 text-2xl font-black tracking-tight
              sm:text-3xl">Active service cities</h2>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            Confirm your exact address before booking
          </p>
        </div>
        {active.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map(city => <CityCard key={city.slug} city={city} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
            Live city availability is temporarily unavailable. Try checking your
            address in the booking flow.
          </p>
        )}
      </section>

      <section id="upcoming-areas" className="border-t border-slate-200 bg-white px-4
        py-10 sm:px-6 sm:py-14" aria-labelledby="expansion-areas">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-700">
              Next locations
            </p>
            <h2 id="expansion-areas" className="mt-1 text-2xl font-black
              tracking-tight sm:text-3xl">Upcoming and waitlist cities</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              NCR is part of the expansion plan, alongside other cities. An
              upcoming listing is not a promise of current service or a launch date.
            </p>
          </div>
          {upcoming.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map(city => <CityCard key={city.slug} city={city} />)}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
              No upcoming cities listed at the moment.
            </p>
          )}
        </div>
      </section>

      <section id="join-waitlist" className="mx-auto max-w-6xl px-4 py-10
        sm:px-6 sm:py-14">
        <NcrWaitlistForm cities={cities.map(city => ({
          name: city.name, status: city.status,
        }))} />
      </section>

      <aside className="border-t border-slate-200 bg-slate-100 px-4 py-7 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4
          sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Already have an address?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The booking flow checks serviceability and displays the applicable
              total before you confirm.
            </p>
          </div>
          <Link href="/book"
            className="inline-flex min-h-11 shrink-0 items-center justify-center
              rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white
              hover:bg-slate-700">
            Check a service
          </Link>
        </div>
      </aside>
    </div>
  );
}
