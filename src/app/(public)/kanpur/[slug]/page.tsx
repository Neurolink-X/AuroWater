import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  SERVICE_LANDINGS,
  bookingHref,
  buildServiceMetadata,
  getServiceLanding,
} from '@/lib/seo/service-landings';
import { pageMeta } from '@/lib/seo';

type AreaLanding = {
  name: string;
  slug: string;
  title: string;
  description: string;
  intro: string;
  faqs: Array<{ q: string; a: string }>;
};

const AREA_LANDINGS: Record<string, AreaLanding> = {
  kalyanpur: {
    slug: 'kalyanpur',
    name: 'Kalyanpur',
    title: 'Water Delivery & Home Services in Kalyanpur, Kanpur | AuroWater',
    description: 'Book water delivery and selected home water services in Kalyanpur, Kanpur through AuroWater. Check your exact address for availability.',
    intro: 'AuroWater helps customers in Kalyanpur check water delivery and selected home-service availability before confirming a booking.',
    faqs: [
      { q: 'Can I order water in Kalyanpur?', a: 'Water delivery is available only for addresses that pass the current AuroWater serviceability check.' },
      { q: 'Can I book a plumber in Kalyanpur?', a: 'Plumbing and other listed services depend on service type, local professional capacity and the exact address.' },
      { q: 'Do you guarantee same-day delivery?', a: 'Same-day availability depends on the delivery window, supplier capacity, stock and current operating conditions.' },
    ],
  },
  kakadeo: {
    slug: 'kakadeo',
    name: 'Kakadeo',
    title: 'Water Delivery & Home Services in Kakadeo, Kanpur | AuroWater',
    description: 'Explore water delivery and selected home services in Kakadeo, Kanpur with AuroWater. Check your address and book only when serviceability is confirmed.',
    intro: 'Use AuroWater to check serviceability for water delivery and selected home services around Kakadeo before you place a request.',
    faqs: [
      { q: 'Is water can delivery available in Kakadeo?', a: 'Availability is checked against the delivery address, supplier capacity and the service requested.' },
      { q: 'Can I schedule a future delivery?', a: 'Future slots can be selected where the booking flow shows an available delivery window.' },
      { q: 'Why can availability change?', a: 'Supplier capacity, stock, delivery windows, traffic and operating conditions can change during the day.' },
    ],
  },
  barra: {
    slug: 'barra',
    name: 'Barra',
    title: 'Water Delivery & Home Services in Barra, Kanpur | AuroWater',
    description: 'Find water delivery, tanker supply and selected home services in Barra, Kanpur with AuroWater. Enter your address to check live serviceability.',
    intro: 'AuroWater brings address-aware booking for water delivery and selected water-related services in and around Barra.',
    faqs: [
      { q: 'How do I check delivery availability in Barra?', a: 'Start a booking and enter your exact delivery address. The platform checks serviceability before confirmation.' },
      { q: 'Can I order bulk tanker water?', a: 'Tanker delivery can be requested where the required capacity and supplier availability are available for the delivery address.' },
      { q: 'Can I book RO or pump service?', a: 'Listed home water services can be requested where the selected service is available in your area.' },
    ],
  },
  'swaroop-nagar': {
    slug: 'swaroop-nagar',
    name: 'Swaroop Nagar',
    title: 'Water Delivery & Home Services in Swaroop Nagar, Kanpur | AuroWater',
    description: 'Book water delivery and selected home water services in Swaroop Nagar, Kanpur through AuroWater. Check your address before confirming.',
    intro: 'For Swaroop Nagar households and businesses, AuroWater provides one booking flow for water delivery and selected home water services, subject to live availability.',
    faqs: [
      { q: 'Can I book water-can delivery in Swaroop Nagar?', a: 'Yes, where the exact address is within the current serviceable area and an eligible supplier has capacity.' },
      { q: 'Can I book an urgent service?', a: 'Urgent availability depends on the selected service and the professionals or suppliers currently available.' },
      { q: 'Does the platform show the final price before booking?', a: 'The booking flow calculates and validates the applicable price before an order is confirmed.' },
    ],
  },
};

export const revalidate = 3600;

export function generateStaticParams() {
  return [
    ...Object.keys(SERVICE_LANDINGS).map((slug) => ({ slug })),
    ...Object.keys(AREA_LANDINGS).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceLanding(slug);
  if (service) return buildServiceMetadata(slug, 'Kanpur') as Metadata;

  const area = AREA_LANDINGS[slug];
  if (area) return pageMeta(area.title, area.description, `/kanpur/${area.slug}`);

  return {};
}

function AreaPage({ area }: { area: AreaLanding }) {
  const services = Object.values(SERVICE_LANDINGS).slice(0, 6);

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-[#06253D] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(56,189,248,.2),transparent_34%),radial-gradient(circle_at_90%_15%,rgba(42,157,143,.2),transparent_38%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[.2em] text-cyan-200">Kanpur · {area.name}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{area.name} water delivery & home services</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{area.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black">Check availability</Link>
            <Link href="/kanpur" className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold">All Kanpur services</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Services</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Book the service you need</h2>
          <p className="mt-4 text-slate-600 leading-7">Availability is checked for the exact address and service type before confirmation.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link key={service.slug} href={`/kanpur/${service.slug}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="text-3xl">{service.icon}</div>
              <h3 className="mt-4 text-xl font-black">{service.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Questions</p>
          <h2 className="mt-3 text-3xl font-black">Frequently asked questions</h2>
          <div className="mt-8 space-y-4">
            {area.faqs.map((faq) => (
              <details key={faq.q} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <summary className="cursor-pointer list-none font-extrabold">{faq.q}</summary>
                <p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-14 lg:px-8">
        <div className="rounded-[2rem] bg-[#06253D] p-8 text-white sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-cyan-200">{area.name} · Kanpur</p>
            <h2 className="mt-2 text-3xl font-black">Check your address before you book.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Serviceability can change by zone, capacity, stock, schedule and service type. We confirm only the requests the operating network can serve.</p>
          </div>
          <Link href="/book" className="mt-6 inline-flex rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black lg:mt-0">Start booking</Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: area.title,
        description: area.description,
        url: `https://aurotap.in/kanpur/${area.slug}`,
        about: { '@type': 'Place', name: area.name, containedInPlace: { '@type': 'City', name: 'Kanpur', addressCountry: 'IN' } },
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: area.faqs.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })),
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aurotap.in/' },
          { '@type': 'ListItem', position: 2, name: 'Kanpur', item: 'https://aurotap.in/kanpur' },
          { '@type': 'ListItem', position: 3, name: area.name, item: `https://aurotap.in/kanpur/${area.slug}` },
        ],
      }) }} />
    </main>
  );
}

function ServicePage({ slug }: { slug: string }) {
  const data = getServiceLanding(slug);
  if (!data) notFound();

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-[#06253D] text-white">
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-cyan-100">
              <span>{data.icon}</span>
              Kanpur · {data.eyebrow}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{data.name} in Kanpur</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{data.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={bookingHref(data.slug)} className="rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black">Book now</Link>
              <Link href="/kanpur" className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold">Back to Kanpur services</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {data.benefits.map((benefit, i) => (
            <article key={benefit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-black text-[#2A9D8F]">0{i + 1}</div>
              <h2 className="mt-4 text-lg font-extrabold">{benefit}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Available only where the booking workflow confirms the service.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Kanpur booking flow</p>
            <h2 className="mt-3 text-3xl font-black">Simple for the customer. Structured for operations.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {data.steps.map((step, i) => (
              <div key={step} className="rounded-3xl bg-slate-50 p-6">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#06253D] text-sm font-black text-white">{i + 1}</div>
                <p className="mt-5 font-bold leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">FAQs</p>
        <h2 className="mt-3 text-3xl font-black">Frequently asked questions</h2>
        <div className="mt-8 space-y-4">
          {data.faqs.map((faq) => (
            <details key={faq.q} className="rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer list-none font-extrabold">{faq.q}</summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-8">
        <div className="rounded-[2rem] bg-[#06253D] p-8 text-white sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-black">Need this service in Kanpur?</h2>
            <p className="mt-3 text-sm text-slate-300">Check the address first. We confirm only serviceable bookings.</p>
          </div>
          <Link href={bookingHref(data.slug)} className="mt-6 inline-flex rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black lg:mt-0">Check availability</Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: `${data.name} in Kanpur`,
        serviceType: data.name,
        provider: { '@id': 'https://aurotap.in/#organization' },
        areaServed: { '@type': 'City', name: 'Kanpur', addressCountry: 'IN' },
        url: `https://aurotap.in/kanpur/${data.slug}`,
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: data.faqs.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })),
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aurotap.in/' },
          { '@type': 'ListItem', position: 2, name: 'Kanpur', item: 'https://aurotap.in/kanpur' },
          { '@type': 'ListItem', position: 3, name: data.name, item: `https://aurotap.in/kanpur/${data.slug}` },
        ],
      }) }} />
    </main>
  );
}

export default async function KanpurDynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (AREA_LANDINGS[slug]) return <AreaPage area={AREA_LANDINGS[slug]} />;
  return <ServicePage slug={slug} />;
}
