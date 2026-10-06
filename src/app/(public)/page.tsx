import type { Metadata } from 'next';
import Link from 'next/link';

import { pageMeta } from '@/lib/seo';
import { SERVICE_LANDINGS } from '@/lib/seo/service-landings';

export const metadata: Metadata = pageMeta(
  'Water Delivery in Kanpur | Water Cans, Tankers & Home Services | AuroWater',
  'Book water can delivery, tanker water and selected home water services in Kanpur with AuroWater. Check serviceability, choose a delivery window and follow the order status.',
  '/'
);

const primaryServices = [
  SERVICE_LANDINGS['water-can-delivery'],
  SERVICE_LANDINGS['water-tanker-delivery'],
  SERVICE_LANDINGS['plumber'],
  SERVICE_LANDINGS['ro-service'],
  SERVICE_LANDINGS['borewell'],
  SERVICE_LANDINGS['tank-cleaning'],
];

const localAreas = [
  { name: 'Kalyanpur', slug: 'kalyanpur' },
  { name: 'Kakadeo', slug: 'kakadeo' },
  { name: 'Barra', slug: 'barra' },
  { name: 'Swaroop Nagar', slug: 'swaroop-nagar' },
];

export default function HomePage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-[#06253D] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(56,189,248,.18),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(42,157,143,.22),transparent_35%)]" />
        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-8 top-32 h-52 w-52 rounded-full border border-white/10" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr]">
            <div>
              <span className="inline-flex rounded-full border border-cyan-200/20 bg-white/8 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-cyan-100">
                Kanpur · local fulfillment
              </span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Water delivery that starts with your exact address.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                Order 20L water cans, bulk tanker water or selected home water services through one address-aware platform. AuroWater checks serviceability before confirmation and keeps the order lifecycle visible.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/book?service=water_can" className="rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#238579]">
                  Order water
                </Link>
                <Link href="/water-tanker-delivery" className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                  Book tanker water
                </Link>
                <Link href="/services" className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                  Explore services
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="rounded-full bg-white/8 px-3 py-2">Address-aware serviceability</span>
                <span className="rounded-full bg-white/8 px-3 py-2">Supplier dispatch</span>
                <span className="rounded-full bg-white/8 px-3 py-2">Cash + UPI options</span>
                <span className="rounded-full bg-white/8 px-3 py-2">Live order status</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <div className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Why this works</div>
              <div className="mt-5 space-y-3">
                {[
                  ['01', 'Enter the delivery address', 'The booking flow checks whether the requested service can be fulfilled there.'],
                  ['02', 'Choose water quantity and slot', 'Review the booking details and final platform price before confirmation.'],
                  ['03', 'Supplier gets the assignment', 'The dispatch engine uses availability, location and operating capacity to find a suitable supplier.'],
                  ['04', 'Track until delivery', 'The order moves through a defined lifecycle instead of disappearing after payment.'],
                ].map(([n, title, body]) => (
                  <div key={n} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                    <div className="flex gap-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-black">{n}</div>
                      <div>
                        <h2 className="font-black">{title}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/how-it-works" className="mt-5 inline-flex text-sm font-black text-cyan-200 hover:underline">
                See the complete process →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {[
            ['Check first', 'Serviceability is validated before confirmation.'],
            ['Local network', 'Water orders can be routed to eligible nearby suppliers.'],
            ['Clear lifecycle', 'Assigned, started and completed states stay visible.'],
            ['Recurring ready', 'Water-can subscriptions create separate delivery orders.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-sm font-black text-[#167A70]">{title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-600">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Water + home services</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Book the service your household actually needs</h2>
          <p className="mt-4 text-slate-600 leading-7">
            Start with the service, add the exact address and let the platform handle the operating workflow behind the booking.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {primaryServices.map((service) => (
            <article key={service.slug} className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-2xl">{service.icon}</div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{service.shortName}</span>
              </div>
              <h3 className="mt-5 text-xl font-black">{service.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.intro}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {service.benefits.slice(0, 2).map((x) => (
                  <span key={x} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">{x}</span>
                ))}
              </div>
              <Link href={service.slug.startsWith('water-') ? '/book?service=water_can' : '/kanpur/' + service.slug} className="mt-6 inline-flex text-sm font-black text-[#167A70] group-hover:underline">
                View service →
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/services" className="inline-flex rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900 hover:bg-slate-50">
            View all AuroWater services
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-100">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Kanpur first</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A local service network, not a directory of random suppliers</h2>
            <p className="mt-4 leading-7 text-slate-600">
              AuroWater is designed around address-level serviceability and local fulfillment. Customers choose what they need; the platform handles supplier and professional assignment behind the scenes.
            </p>
            <Link href="/kanpur" className="mt-6 inline-flex rounded-2xl bg-[#06253D] px-5 py-3 text-sm font-black text-white">
              Explore Kanpur services
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {localAreas.map((area) => (
              <Link key={area.slug} href={`/kanpur/${area.slug}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Kanpur area</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">{area.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Check water delivery and selected home-service availability for this area.</p>
                <span className="mt-5 inline-flex text-sm font-black text-[#167A70]">Explore area →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="rounded-[2rem] bg-[#06253D] px-7 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[.18em] text-cyan-200">For homes, offices & sites</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Need water today?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Enter your exact delivery address and see what AuroWater can actually serve before you confirm.</p>
          </div>
          <Link href="/book?service=water_can" className="mt-7 inline-flex shrink-0 rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black text-white lg:mt-0">
            Check water availability
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            '@id': 'https://aurotap.in/#organization',
            name: 'AuroWater',
            url: 'https://aurotap.in/',
            areaServed: [
              { '@type': 'City', name: 'Kanpur', addressCountry: 'IN' },
              { '@type': 'City', name: 'Lucknow', addressCountry: 'IN' },
              { '@type': 'City', name: 'Gorakhpur', addressCountry: 'IN' },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'AuroWater',
            url: 'https://aurotap.in/',
          }),
        }}
      />
    </main>
  );
}
