import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublicServiceCities } from '@/lib/public-city-directory.server';
import type { City } from '@/lib/cities';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '20L RO Water Can Delivery by City | AuroTap',
  description: 'Find current AuroTap water can delivery cities in India. Check your PIN code, Normal RO or Chilled RO options, and final availability before placing an order.',
  keywords: ['20 litre RO water delivery', 'water can delivery near me', '20L water can home delivery', 'normal RO water can', 'chilled water can'],
  alternates: { canonical: '/water-delivery' },
  openGraph: {
    title: '20L Water Can Delivery Service Areas | AuroTap',
    description: 'Choose your city and check water delivery availability for your exact address.',
    url: '/water-delivery',
    images: [{
      url: '/opengraph-image',
      width: 1200,
      height: 630,
      alt: 'AuroTap water can delivery',
    }],
  },
};

const DETAILED_CITY_PAGES = new Set(['kanpur', 'lucknow', 'gorakhpur']);

function CityCard({ city }: { city: City }) {
  const hasLocalPage = DETAILED_CITY_PAGES.has(city.slug);
  const href = hasLocalPage
    ? `/water-delivery/${city.slug}`
    : '/book?service=water_can';

  return (
    <article className="flex h-full min-w-0 flex-col justify-between rounded-2xl
      border border-slate-200 bg-white p-5 shadow-sm transition-shadow
      hover:border-sky-200 hover:shadow-md sm:p-6">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-sky-700">
          Active city · Check address
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
          {city.name}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Request 20L Normal RO water in eligible areas of {city.name}.
          One-time Chilled RO availability depends on the location, stock and
          services configured for your address.
        </p>
      </div>
      <Link href={href}
        aria-label={hasLocalPage
          ? `Explore water delivery in ${city.name}`
          : `Check water delivery availability for ${city.name}`}
        className="mt-6 inline-flex min-h-11 w-fit items-center justify-center
          rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white
          hover:bg-sky-800 focus-visible:outline focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-sky-600">
        {hasLocalPage ? 'Explore city service' : 'Check availability'}
        <span className="ml-2" aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export default async function WaterDeliveryIndexPage() {
  const cities = await getPublicServiceCities();
  const active = cities.filter((city) => city.status === 'active');

  return (
    <div className="min-w-0 bg-slate-50 text-slate-900">
      <section className="bg-[#071A2B] text-white">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
          <nav aria-label="Breadcrumb" className="mb-5 text-sm text-sky-200">
            <Link href="/" className="hover:text-white hover:underline">Home</Link>
            <span className="mx-2 text-slate-400" aria-hidden="true">/</span>
            <span aria-current="page">Water delivery</span>
          </nav>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">
            AuroTap · Local water delivery
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            20L water can delivery by city
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
            Select your city to explore RO water can delivery. Normal RO and
            Chilled RO may have different availability and pricing. The booking
            flow confirms your address, service, delivery time and final total.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/book?service=water_can"
              className="inline-flex min-h-11 items-center justify-center
                rounded-xl bg-sky-400 px-5 py-2.5 text-sm font-bold text-slate-950
                hover:bg-sky-300">
              Check my PIN code
            </Link>
            <Link href="/service-areas"
              className="inline-flex min-h-11 items-center justify-center
                rounded-xl border border-white/30 px-5 py-2.5 text-sm
                font-semibold text-white hover:bg-white/10">
              All cities & expansion
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
        aria-labelledby="water-delivery-cities">
        <div className="mb-6">
          <h2 id="water-delivery-cities"
            className="text-2xl font-black tracking-tight sm:text-3xl">
            Current service cities
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Listed cities may have limited coverage. Exact availability is
            checked against your delivery address.
          </p>
        </div>
        {active.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((city) => <CityCard key={city.slug} city={city} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700">
            City availability is being updated. Please check your address in
            the booking flow.
          </div>
        )}
      </section>
      <section className="border-t border-slate-200 bg-white px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3
          sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Your city is not listed?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Explore upcoming cities or request an expansion update.
            </p>
          </div>
          <Link href="/service-areas#join-waitlist"
            className="inline-flex min-h-11 items-center justify-center
              rounded-xl border border-sky-700 px-5 py-2.5 text-sm
              font-bold text-sky-800 hover:bg-sky-50">
            View expansion waitlist
          </Link>
        </div>
      </section>
    </div>
  );
}
