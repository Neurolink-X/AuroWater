// src/app/cities/[city]/page.tsx
// Server component: one SEO landing page per city, generated from CITIES in marketing-pricing.ts.
// Lives OUTSIDE the (public) group on purpose: it has its own header/footer, same as your old page.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CITIES, PRICING, SITE, MAX_LOCK_MONTHS, CAN_FLOOR } from '@/lib/marketing-pricing';

export const dynamicParams = false;
export const revalidate = 3600; // re-render hourly so a scheduled price change shows up without a redeploy

type City = (typeof CITIES)[number];
type CityPageProps = { params: Promise<{ city: string }> };

const findCity = (slug: string): City | undefined => CITIES.find(c => c.slug === slug.toLowerCase());
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function generateStaticParams(): Array<{ city: string }> {
  return CITIES.map(c => ({ city: c.slug }));
}

function faqsFor(city: City) {
  const live = city.status === 'live';
  const { water, tank, plumber } = PRICING;
  return [
    { q: `How much does RO water delivery cost in ${city.name}?`,
      a: `Normal RO starts at ${inr(water.normal)} and chilled RO at ${inr(water.chilled)} per 20L can where a verified supplier is available. See the final checkout total and serviceability first.` },
    { q: `Do you deliver water in ${city.areas[0]} and nearby areas?`,
      a: city.slug === 'noida'
        ? 'Noida Sector 73 is a limited pilot. Availability depends on approved online suppliers, stock and exact address coverage; the city is not available for guaranteed delivery everywhere.'
        : live
        ? `Yes. We serve ${city.areas.join(', ')} and nearby areas in ${city.name}. Enter your address at booking and we confirm availability.`
        : `We serve selected PIN codes in ${city.name}, including areas such as ${city.areas.slice(0, 4).join(', ')}. Enter your PIN code at booking and we confirm availability before you pay.` },
    { q: `How much does water tank cleaning cost in ${city.name}?`,
      a: `Tank cleaning starts from ${inr(tank[0].from)} for tanks up to 500 litres, ${inr(tank[1].from)} up to 1,000 litres and ${inr(tank[2].from)} up to 2,000 litres. Larger or heavily soiled tanks are quoted before work begins.` },
    { q: `What is the plumber visit charge in ${city.name}?`,
      a: `The visit charge is ${inr(plumber.visitFee)} and is adjusted against the repair bill if you go ahead with the job.` },
    { q: 'Can I lock my water price?',
      a: `Yes. Monthly plans lock your per-can price for up to ${MAX_LOCK_MONTHS} months, even if list prices change later, and the per-can price never goes below ${inr(CAN_FLOOR.normal)}.` },
    { q: 'Which payment methods are accepted?',
      a: 'Cash and UPI are supported where available. The payment methods for your booking are shown before you confirm.' },
  ];
}

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { city: raw } = await params;
  const city = findCity(raw);
  if (!city) return { title: `City not found | ${SITE.name}`, robots: { index: false, follow: false } };

  const title = city.slug === 'noida'
    ? `Noida Sector 73 Pilot: Water Delivery Updates | ${SITE.name}`
    : `RO Water, Plumber & Tank Cleaning in ${city.name} | ${SITE.name}`;
  const description =
    `20L RO water cans from ${inr(PRICING.water.normal)} in ${city.name} (${city.areas.slice(0, 3).join(', ')} & more). ` +
    `Check water and home-service availability. ${city.slug === 'noida' ? 'Sector 73 pilot, subject to verified supplier readiness.' : city.status === 'live' ? 'Clear prices before you confirm.' : 'Subject to approved PIN-code coverage.'} Cash + UPI.`;
  const url = `/cities/${city.slug}`;

  return {
    title,
    description,
    keywords: [
      `water delivery ${city.name}`, `RO water can ${city.name}`, `20 litre water can price ${city.name}`,
      `plumber ${city.name}`, `water tank cleaning ${city.name}`, ...city.areas.slice(0, 4).map(a => `water delivery ${a}`),
    ],
    alternates: { canonical: url },
    openGraph: { title, description, url: `${SITE.url}${url}`, type: 'website', siteName: SITE.name, locale: 'en_IN' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { city: raw } = await params;
  const city = findCity(raw);
  if (!city) notFound();

  const live = city.status === 'live';
  const pageUrl = `${SITE.url}/cities/${city.slug}`;
  const faqs = faqsFor(city);
  const others = CITIES.filter(c => c.slug !== city.slug);
  const book = (service: string) => `/book?service=${service}&city=${city.slug}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `${pageUrl}#business`,
        name: `${SITE.name} ${city.name}`,
        url: pageUrl,
        priceRange: '₹',
        paymentAccepted: 'Cash, UPI',
        parentOrganization: { '@type': 'Organization', name: SITE.name, url: SITE.url },
        areaServed: [
          { '@type': 'City', name: city.name, containedInPlace: { '@type': 'AdministrativeArea', name: city.state } },
          ...city.areas.map(a => ({ '@type': 'Place', name: `${a}, ${city.name}` })),
        ],
        makesOffer: city.slug === 'noida' ? [] : [
          { '@type': 'Offer', name: 'Normal RO 20L can', price: PRICING.water.normal, priceCurrency: 'INR' },
          { '@type': 'Offer', name: 'Chilled RO 20L can', price: PRICING.water.chilled, priceCurrency: 'INR' },
          { '@type': 'Offer', name: 'Water tank cleaning (up to 500 L, from)', price: PRICING.tank[0].from, priceCurrency: 'INR' },
          { '@type': 'Offer', name: 'Plumber visit', price: PRICING.plumber.visitFee, priceCurrency: 'INR' },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: city.name, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />

      {/* Header */}
      <header className="border-b border-slate-100 bg-white">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-700 text-2xl text-white" aria-hidden="true">💧</span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">{SITE.name}</span>
              <span className="block text-xs text-slate-500">Water. Home. Sorted.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link href="/#pricing" className="hidden rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 sm:inline-block">Pricing</Link>
            <Link href="/" className="rounded-xl border border-slate-200 px-4 py-2.5 transition hover:border-cyan-200 hover:bg-cyan-50">Home</Link>
          </div>
        </nav>
      </header>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-5 pt-5 text-xs text-slate-500 sm:px-8">
        <Link href="/" className="hover:text-cyan-700">Home</Link> <span aria-hidden="true">/</span> <span className="font-semibold text-slate-700">{city.name}</span>
      </div>

      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-cyan-100 bg-gradient-to-b from-cyan-50 via-white to-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr,1fr]">
          <div>
            <span className={`inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold shadow-sm ${live ? 'border-emerald-200 text-emerald-800' : 'border-amber-200 text-amber-800'}`}>
              <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {live ? `Live in ${city.name}` : `${city.name}: select PIN codes`}
            </span>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              RO water, plumber &amp; tank cleaning
              <span className="mt-1 block text-cyan-700">in {city.name}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              20L RO water cans from <strong className="text-slate-900">{inr(PRICING.water.normal)}</strong>, plumbers for leaks and fittings, and
              scheduled water tank cleaning across {city.areas.slice(0, 4).join(', ')} and more. {live
                ? 'See the total before you confirm.'
                : 'Enter your PIN code to confirm availability before you pay.'}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={book('water_can')} className="inline-flex items-center justify-center rounded-xl bg-cyan-700 px-6 py-3.5 font-bold text-white shadow-lg shadow-cyan-900/10 transition hover:bg-cyan-800">
                {live ? 'Order RO Water' : 'Check my PIN code'} <span className="ml-2" aria-hidden="true">→</span>
              </Link>
              <Link href={book('plumbing')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50">🔧 Find a Plumber</Link>
              <Link href={book('tank_cleaning')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50">🧽 Clean My Tank</Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Availability and delivery times depend on your address and local provider coverage. Cash + UPI where available.</p>
          </div>

          <div className="rounded-[2rem] border border-cyan-100 bg-white p-4 shadow-xl shadow-cyan-950/5 sm:p-6">
            <div className="rounded-3xl bg-gradient-to-br from-cyan-700 to-blue-950 p-6 text-white sm:p-8">
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold tracking-wider">20L RO WATER CAN</span>
              <div className="mt-7 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-cyan-100">Normal RO</p>
                  <p className="mt-1 text-4xl font-extrabold sm:text-5xl">{inr(PRICING.water.normal)}</p>
                </div>
                <div>
                  <p className="text-sm text-cyan-100">Chilled RO</p>
                  <p className="mt-1 text-4xl font-extrabold sm:text-5xl">{inr(PRICING.water.chilled)}</p>
                </div>
              </div>
              <p className="mt-6 border-t border-white/20 pt-4 text-sm text-cyan-50">Monthly plans lock your price for up to {MAX_LOCK_MONTHS} months.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-2xl" aria-hidden="true">🧽</p>
                <p className="mt-1 font-bold">Tank cleaning</p>
                <p className="text-sm text-slate-500">from {inr(PRICING.tank[0].from)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-2xl" aria-hidden="true">🔧</p>
                <p className="mt-1 font-bold">Plumber visit</p>
                <p className="text-sm text-slate-500">{inr(PRICING.plumber.visitFee)}, adjusted in your bill</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8" aria-labelledby="plans-h">
        <h2 id="plans-h" className="text-2xl font-extrabold tracking-tight sm:text-3xl">Monthly water plans in {city.name}</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Pick a plan by how many cans you use. Your per-can price stays locked while the plan is active.</p>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {PRICING.plans.map(p => (
            <div key={p.id} className="rounded-2xl border border-slate-200 p-5 transition hover:border-cyan-200 hover:shadow-md">
              <h3 className="font-bold">{p.name}</h3>
              <p className="text-xs text-slate-500">{p.note}</p>
              <p className="mt-3 text-2xl font-extrabold">{inr(PRICING.water.normal)}<span className="text-sm font-medium text-slate-400"> / can</span></p>
              <p className={`mt-2 text-sm font-bold ${p.lockMonths ? 'text-emerald-600' : 'text-slate-400'}`}>{p.lockMonths ? `Locked ${p.lockMonths} months` : 'No commitment'}</p>
            </div>
          ))}
        </div>
        <Link href="/#pricing" className="mt-5 inline-block text-sm font-bold text-cyan-700 hover:underline">Compare with what you pay today: savings calculator →</Link>
      </section>

      {/* Areas */}
      <section className="border-y border-slate-100 bg-slate-50" aria-labelledby="areas-h">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <h2 id="areas-h" className="text-2xl font-extrabold tracking-tight sm:text-3xl">Areas we cover in {city.name}</h2>
          <p className="mt-2 max-w-2xl text-slate-600">{live ? 'Water, plumbing and tank cleaning across these areas and nearby localities.' : 'We serve approved PIN codes. These areas are covered, and we confirm your exact address at booking.'}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {city.areas.map(a => (
              <li key={a} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">📍 {a}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8" aria-labelledby="how-h">
        <h2 id="how-h" className="text-2xl font-extrabold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ['01', 'Choose your service', 'RO water cans, a plumber, or tank cleaning.'],
            ['02', 'Confirm your address', `Check availability in ${city.name} for your location.`],
            ['03', 'Review and book', 'See the final amount, then pay by cash or UPI where available.'],
          ].map(([n, t, d]) => (
            <li key={n} className="rounded-2xl border border-slate-200 p-6">
              <span className="text-sm font-extrabold text-cyan-700">{n}</span>
              <h3 className="mt-3 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ (matches FAQPage JSON-LD) */}
      <section className="border-t border-slate-100 bg-slate-50" aria-labelledby="faq-h">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
          <h2 id="faq-h" className="text-2xl font-extrabold tracking-tight sm:text-3xl">Questions about service in {city.name}</h2>
          <div className="mt-6 space-y-3">
            {faqs.map(f => (
              <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                  {f.q}<span aria-hidden="true" className="text-cyan-700 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Other cities (internal links) */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8" aria-labelledby="more-h">
        <h2 id="more-h" className="text-xl font-extrabold">Also available in</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map(c => (
            <li key={c.slug}>
              <Link href={`/cities/${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-cyan-200 hover:bg-cyan-50">
                {c.name}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.status === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{c.status === 'live' ? 'Live' : 'Select PINs'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-cyan-700 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Need water at home in {city.name}?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50">Order in under a minute and see your total before you confirm.</p>
          </div>
          <Link href={book('water_can')} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-6 py-3.5 font-bold text-cyan-800 transition hover:bg-cyan-50">
            {live ? 'Order now' : 'Check my PIN code'} <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-6 text-sm text-slate-500 sm:px-8">
          <p>© {new Date().getFullYear()} {SITE.name}</p>
          <Link href="/" className="font-semibold hover:text-cyan-700">Visit {SITE.name}</Link>
        </div>
      </footer>
    </main>
  );
}
