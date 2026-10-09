import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import ServicePrice from '@/components/services/ServicePrice';

const CITY_PAGES = {
  kanpur: {
    name: 'Kanpur',
    title: '20L Water Can Delivery in Kanpur',
    description: 'Order 20L Normal RO water cans or request Chilled RO water for gatherings in eligible areas of Kanpur. Check your address, current price and available delivery slots before confirming.',
    intro: 'Looking for 20 litre water can delivery in Kanpur? AuroWater helps households and workplaces request everyday Normal RO water, with a separate Chilled RO option for one-time event and gathering orders.',
    localIntent: 'Use the booking flow to check availability for your exact Kanpur address. Service coverage and delivery slots can vary by locality and supplier capacity.',
  },
  lucknow: {
    name: 'Lucknow',
    title: '20L Water Can Delivery in Lucknow',
    description: 'Request 20L Normal RO water can delivery or Chilled RO water for events in eligible areas of Lucknow. Check address availability and the current total before ordering.',
    intro: 'Need a 20 litre water can delivered in Lucknow? Choose Normal RO for everyday home or office use, or select Chilled RO for a one-time gathering order when available.',
    localIntent: 'Enter your delivery address in the booking flow to confirm whether your Lucknow locality is serviceable and which delivery slots are available.',
  },
  gorakhpur: {
    name: 'Gorakhpur',
    title: '20L Water Can Delivery in Gorakhpur',
    description: 'Book 20L Normal RO water cans or request Chilled RO for a one-time event in eligible areas of Gorakhpur. Confirm serviceability, current pricing and delivery slots online.',
    intro: 'AuroWater lets you request 20 litre water can delivery in Gorakhpur for home and workplace needs, with a separate Chilled RO option for gatherings where available.',
    localIntent: 'Serviceability is checked against your address. Availability, delivery timing and final totals are confirmed in the booking flow.',
  },
} as const;

type CitySlug = keyof typeof CITY_PAGES;

export function generateStaticParams() {
  return Object.keys(CITY_PAGES).map((city) => ({ city }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: rawCity } = await params;
  if (!Object.prototype.hasOwnProperty.call(CITY_PAGES, rawCity)) return { title: 'Water Delivery | AuroTap', robots: { index: false, follow: false } };
  const city = CITY_PAGES[rawCity as CitySlug];
  const url = `/water-delivery/${rawCity}`;
  return {
    title: `${city.title} | AuroTap`,
    description: city.description,
    keywords: [
      `20 litre water can delivery ${city.name}`,
      `20L water can delivery ${city.name}`,
      `water can home delivery ${city.name}`,
      `drinking water delivery ${city.name}`,
      `Normal RO water ${city.name}`,
      `Chilled water delivery ${city.name}`,
    ],
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title: `${city.title} | AuroTap`,
      description: city.description,
      url,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: city.title }],
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  };
}

export default async function WaterDeliveryCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: rawCity } = await params;
  if (!Object.prototype.hasOwnProperty.call(CITY_PAGES, rawCity)) {
    const { notFound } = await import('next/navigation');
    notFound();
  }
  const city = CITY_PAGES[rawCity as CitySlug];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: city.title,
    description: city.description,
    serviceType: '20L drinking water can delivery',
    provider: { '@type': 'Organization', name: 'AuroTap', url: 'https://aurotap.in/' },
    areaServed: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'State', name: 'Uttar Pradesh' } },
    url: `https://aurotap.in/water-delivery/${rawCity}`,
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="relative overflow-hidden bg-[#071A2B] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-950 via-[#071A2B] to-emerald-950" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:px-12">
          <div>
            <nav aria-label="Breadcrumb" className="mb-7 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">Home</Link><span className="mx-2">/</span>
              <Link href="/water-delivery" className="hover:text-white">Water delivery</Link><span className="mx-2">/</span>
              <span aria-current="page" className="text-white">{city.name}</span>
            </nav>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">AuroTap · Local water delivery</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">{city.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{city.intro}</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{city.localIntent}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book?service=water_can" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sky-500 px-6 py-3 font-bold text-white hover:bg-sky-400">Check delivery availability →</Link>
              <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-bold text-white hover:bg-white/10">View water prices</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.06] p-4 shadow-2xl sm:p-6">
            <figure className="mb-5 overflow-hidden rounded-2xl">
              <Image
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Home_water_filters%2C_water_purifiers%2C_and_bottled_water_in_India.jpg/960px-Home_water_filters%2C_water_purifiers%2C_and_bottled_water_in_India.jpg"
                alt="20-litre reusable drinking water jars and household water purification equipment"
                width={960}
                height={960}
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="h-48 w-full object-cover sm:h-56"
              />
              <figcaption className="bg-black/20 px-3 py-2 text-[10px] text-slate-300/80">Photo: FacetsOfNonStickPans · <a className="underline" href="https://commons.wikimedia.org/wiki/File:Home_water_filters,_water_purifiers,_and_bottled_water_in_India.jpg" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></figcaption>
            </figure>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-2xl" aria-hidden="true">💧</span>
              <div>
                <h2 className="text-lg font-extrabold">Choose your 20L water</h2>
                <p className="text-sm text-slate-300">Current configured prices</p>
              </div>
            </div>
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="font-bold">Normal RO · Everyday use</h3>
              <ServicePrice serviceKey="water_can" fallback="₹20" unit="per 20L can" />
            </div>
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="font-bold">Chilled RO · Gatherings & events</h3>
              <ServicePrice serviceKey="chilled_water" fallback="₹25" unit="per 20L can · one-time booking" />
            </div>
            <p className="mt-5 text-xs leading-6 text-slate-400">Prices are configuration-based. Check serviceability, any applicable charges and the final total in booking.</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-tight">Water can delivery for home and office in {city.name}</h2>
          <p className="mt-4 leading-8 text-slate-600">Use AuroTap to request water delivery without guessing whether your address is covered. Select the water type, choose the quantity, provide the delivery address and review the current price before placing your order.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-extrabold">Normal RO water</h3>
            <p className="mt-2 leading-7 text-slate-600">An everyday 20L option for household and workplace requirements. Recurring orders are available where supported.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-extrabold">Chilled RO water</h3>
            <p className="mt-2 leading-7 text-slate-600">A separate one-time option for functions, parties and gatherings, subject to supplier and locality availability.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-extrabold">Address-based availability</h3>
            <p className="mt-2 leading-7 text-slate-600">Delivery slots and serviceability are checked in the booking flow. A city page does not guarantee every pin code is covered.</p>
          </article>
        </div>
        <div className="mt-12 rounded-3xl bg-white p-7 shadow-sm sm:p-10">
          <h2 className="text-2xl font-black">Need more than drinking water?</h2>
          <p className="mt-3 leading-7 text-slate-600">You can also explore plumbing services, RO purifier repair, motor and submersible pump support, water tank cleaning and tanker enquiries.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/services" className="rounded-xl border border-slate-200 px-5 py-3 font-bold hover:bg-slate-50">Explore all services</Link>
            <Link href="/services/plumbing" className="rounded-xl border border-slate-200 px-5 py-3 font-bold hover:bg-slate-50">Plumber services</Link>
            <Link href="/services/ro_service" className="rounded-xl border border-slate-200 px-5 py-3 font-bold hover:bg-slate-50">RO repair</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
