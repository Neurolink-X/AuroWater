import Link from 'next/link';
import type { Metadata } from 'next';

import { SERVICE_LANDINGS } from '@/lib/seo/service-landings';
import { pageMeta } from '@/lib/seo';

export const revalidate = 3600;

export const metadata: Metadata = pageMeta(
  'Water Delivery & Home Services in Kanpur | AuroWater',
  'Find water delivery, water cans, tanker supply, plumbing, RO, borewell, pump repair and tank cleaning services in Kanpur with AuroWater.',
  '/kanpur'
);

export default function KanpurPage() {
  const services = Object.values(SERVICE_LANDINGS);

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-[#06253D] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(56,189,248,.22),transparent_35%),radial-gradient(circle_at_90%_20%,rgba(42,157,143,.2),transparent_38%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[.2em] text-cyan-200">Kanpur service hub</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Water delivery and home services in Kanpur
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
            AuroWater brings water delivery and selected water-related home services into one address-aware booking experience.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book" className="rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black">Book a service</Link>
            <Link href="/services" className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold">View service catalogue</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.slug}
              href={`/kanpur/${service.slug}`}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="text-3xl">{service.icon}</div>
              <h2 className="mt-4 text-xl font-black group-hover:text-[#167A70]">{service.name} in Kanpur</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
              <span className="mt-5 inline-flex text-sm font-black text-[#167A70]">Explore service →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Why this model</p>
              <h2 className="mt-3 text-3xl font-black">One platform, local fulfillment</h2>
            </div>
            {[
              ['Address first', 'Your service area is checked before confirmation so the platform does not pretend every address is covered.'],
              ['Supplier network', 'Water delivery can be assigned through a local supplier dispatch workflow rather than exposing a long list of undifferentiated suppliers.'],
              ['Track the job', 'Orders and service requests move through a defined status lifecycle so customers know what happens next.'],
            ].map(([title, body]) => (
              <article key={title} className="rounded-3xl bg-slate-50 p-6">
                <h3 className="font-black text-lg">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
        <div className="rounded-[2rem] bg-[#06253D] p-8 text-white sm:p-10">
          <p className="text-sm font-bold text-cyan-200">Kanpur availability</p>
          <h2 className="mt-2 text-3xl font-black">Check your exact address before you book.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Availability can depend on zone, supplier capacity, stock, schedule and service type. The booking workflow is designed to check these operational constraints rather than promise service blindly.
          </p>
          <Link href="/book" className="mt-6 inline-flex rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black">
            Check serviceability
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Water delivery and home services in Kanpur',
            url: 'https://aurotap.in/kanpur',
            about: services.map((s) => s.name),
          }),
        }}
      />
    </main>
  );
}
