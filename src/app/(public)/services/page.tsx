import Link from 'next/link';

import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import { getPublicCatalog, inr } from '@/lib/public-catalog';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Water Delivery & Home Services in Kanpur | AuroWater',
  'Explore water delivery, tankers, RO service, plumbing, borewell, pump repair and water-tank cleaning with AuroWater. Check serviceability before booking.',
  '/services',
);

const serviceOrder = [
  'water_can',
  'water_tanker',
  'ro_service',
  'plumbing',
  'borewell',
  'motor_pump',
  'tank_cleaning',
];

const iconByKey: Record<string, string> = {
  water_can: '💧',
  water_tanker: '🚚',
  ro_service: '⚙️',
  plumbing: '🔧',
  borewell: '🕳️',
  motor_pump: '🔩',
  tank_cleaning: '🧽',
};

export default async function ServicesPage() {
  const { services } = await getPublicCatalog();
  const ranked = [...services].sort(
    (a, b) =>
      serviceOrder.indexOf(a.key) - serviceOrder.indexOf(b.key),
  );

  return (
    <main className="min-h-screen bg-[#F6FAF8] text-slate-950">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Services', path: '/services' },
        ]}
      />

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(16,185,129,.2),transparent_30%),radial-gradient(circle_at_10%_30%,rgba(14,165,233,.16),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-18 pt-14 sm:px-6 sm:pb-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
              AuroWater service catalogue
            </p>
            <h1 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] font-black leading-[0.95] tracking-[-0.055em]">
              Water delivery and water-system services, in one place.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Start with the service you need. AuroWater checks your address and
              shows the applicable pricing and delivery options before you confirm.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book?service=water_can"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-3.5 text-sm font-black text-emerald-950 transition hover:bg-emerald-300"
              >
                Book water delivery
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black text-white transition hover:bg-white/10"
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((service, index) => (
            <article
              key={service.key}
              className={[
                'group flex h-full flex-col rounded-[1.65rem] border bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,23,42,0.09)]',
                index === 0
                  ? 'border-emerald-200 ring-1 ring-emerald-100'
                  : 'border-slate-200/90',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-2xl">
                  <span aria-hidden>{iconByKey[service.key] ?? '💧'}</span>
                </div>
                {index === 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Start here
                  </span>
                ) : null}
              </div>

              <h2 className="mt-5 text-xl font-black tracking-[-0.02em] text-slate-950">
                {service.name}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                {service.description || 'Professional service support through AuroWater.'}
              </p>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Starting from
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {inr(service.base_price)}
                  <span className="ml-1 text-xs font-bold text-slate-500">
                    {service.unit.replace(/^per\s+/i, ' / ')}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Final price is shown in the booking flow after serviceability and order details are checked.
                </p>
              </div>

              <Link
                href={`/book?service=${encodeURIComponent(service.key)}`}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Book this service →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            ['01', 'Check serviceability', 'Tell us where the service is needed.'],
            ['02', 'See the real price', 'Pricing is calculated from current platform settings and your order details.'],
            ['03', 'Confirm and track', 'Place the order and follow its fulfilment status online.'],
          ].map(([step, title, description]) => (
            <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-black tracking-[0.18em] text-emerald-700">{step}</div>
              <h2 className="mt-3 font-black text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Before you book</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Common questions
          </h2>
        </div>
        <div className="mt-8 divide-y divide-slate-200 rounded-[1.5rem] border border-slate-200 bg-white">
          {[
            ['Can I order a single water can?', 'Yes. Water-can bookings support small quantities, subject to current platform limits and your address serviceability.'],
            ['Are the listed prices final?', 'They are starting/reference prices. The booking flow calculates the applicable total using your selected service, quantity, fees, taxes and current serviceability rules.'],
            ['Do you offer scheduled or recurring delivery?', 'Water-can customers can choose scheduled delivery and recurring plans where the service is available.'],
            ['Which locations are currently active?', 'AuroWater currently operates with an active configuration covering Kanpur, Gorakhpur and Lucknow, while every order still passes an address-level serviceability check.'],
          ].map(([question, answer]) => (
            <details key={question} className="group p-5 open:bg-slate-50/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-black text-slate-900">
                <span>{question}</span>
                <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pr-8 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Need help choosing?</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Start with the address, not the guess.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              We can help you choose between water cans, tanker delivery and home water-system services.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 hover:bg-slate-100"
          >
            Contact AuroWater
          </Link>
        </div>
      </section>
    </main>
  );
}
