import Link from 'next/link';

import BreadcrumbJsonLd from '@/components/seo/BreadcrumbJsonLd';
import { getPublicCatalog, inr } from '@/lib/public-catalog';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'AuroWater Pricing | Water Delivery & Home Services',
  'See current AuroWater water-can and home-service starting prices, recurring delivery rates, booking fees and emergency charges before you book.',
  '/pricing',
);

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function PricingPage() {
  const { services, pricing } = await getPublicCatalog();
  const waterCan = services.find((service) => service.key === 'water_can');
  const serviceRows = services.filter((service) => service.key !== 'water_can');

  return (
    <main className="min-h-screen bg-[#F6FAF8] text-slate-950">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ]}
      />

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 pb-18 pt-14 sm:px-6 sm:pb-24 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
            Transparent pricing
          </p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.6rem,6vw,5rem)] font-black leading-[0.95] tracking-[-0.055em]">
            Know the pricing model before you place the order.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            AuroWater keeps public pricing simple: water-can rates, service starting prices,
            and the platform fees that may apply. The final checkout total is calculated from
            the current booking details and serviceability rules.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/book?service=water_can"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-3.5 text-sm font-black text-emerald-950 hover:bg-emerald-300"
            >
              Book water delivery
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black text-white hover:bg-white/10"
            >
              Compare services
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-[1.65rem] border border-emerald-200 bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Pay as you go</p>
            <p className="mt-3 text-4xl font-black text-slate-950">{inr(pricing.default_can_price)}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">per 20L water can</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              The standard water-can reference rate in the current platform configuration.
            </p>
          </article>

          <article className="rounded-[1.65rem] border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-sky-700">Recurring delivery</p>
            <p className="mt-3 text-4xl font-black text-slate-950">{inr(pricing.subscription_can_price)}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">per 20L water can</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Current subscription rate for recurring water-can deliveries.
            </p>
          </article>

          <article className="rounded-[1.65rem] border border-violet-200 bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">Bulk water cans</p>
            <p className="mt-3 text-4xl font-black text-slate-950">{inr(pricing.bulk_can_price)}</p>
            <p className="mt-1 text-sm font-bold text-slate-500">per can from {pricing.bulk_threshold}+ cans</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              The configured bulk-can rate is available when the order reaches the current bulk threshold.
            </p>
          </article>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Convenience fee</p>
            <p className="mt-2 text-2xl font-black">{inr(pricing.convenience_fee)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Emergency surcharge</p>
            <p className="mt-2 text-2xl font-black">{inr(pricing.emergency_surcharge)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Configured GST rate</p>
            <p className="mt-2 text-2xl font-black">{percent(pricing.gst_rate)}</p>
          </div>
        </div>

        <section className="mt-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Service starting prices</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
                The rest of the catalogue
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              Service prices can vary by scope, parts, distance, quantity and other job details.
              The booking flow is the source for your final payable amount.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
            <div className="hidden grid-cols-[1.2fr_2fr_.8fr_1fr] gap-4 bg-slate-50 px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-slate-400 sm:grid">
              <div>Service</div>
              <div>What it covers</div>
              <div>Unit</div>
              <div className="text-right">Starting from</div>
            </div>
            {serviceRows.map((service) => (
              <Link
                key={service.key}
                href={`/book?service=${encodeURIComponent(service.key)}`}
                className="grid gap-3 border-t border-slate-100 px-5 py-5 transition hover:bg-slate-50 sm:grid-cols-[1.2fr_2fr_.8fr_1fr] sm:items-center"
              >
                <div className="font-black text-slate-900">{service.name}</div>
                <div className="text-sm leading-6 text-slate-600">{service.description}</div>
                <div className="text-xs font-bold text-slate-500">{service.unit}</div>
                <div className="text-left text-lg font-black text-slate-950 sm:text-right">
                  {inr(service.base_price)}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Example</p>
            <h2 className="mt-2 text-2xl font-black">What happens at checkout?</h2>
            <div className="mt-6 space-y-3">
              {[
                ['1', 'Base service or water quantity', 'Your selected service and quantity determine the base amount.'],
                ['2', 'Applicable fees', `Current platform convenience fee is ${inr(pricing.convenience_fee)}; emergency orders may include the configured surcharge.`],
                ['3', 'Tax', `The current platform configuration uses a ${percent(pricing.gst_rate)} GST rate where applicable.`],
                ['4', 'Final total', 'The server recalculates the order before confirmation so client-side displayed values are not authoritative.'],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-4 rounded-2xl bg-slate-50 p-4">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">
                    {number}
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-emerald-50 p-6 ring-1 ring-emerald-100 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Good to know</p>
            <h2 className="mt-2 text-2xl font-black">The price you see is explainable.</h2>
            <p className="mt-4 text-sm leading-6 text-emerald-950/75">
              AuroWater is moving toward a single pricing source of truth: public pages explain
              the current model, checkout calculates the exact order, and the saved order keeps its
              financial snapshot for operational and finance review.
            </p>
            <Link
              href="/how-it-works"
              className="mt-6 inline-flex items-center gap-2 text-sm font-black text-emerald-800"
            >
              See how booking works →
            </Link>
          </div>
        </section>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Pricing FAQ</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Questions before you book</h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-[1.5rem] border border-slate-200">
            {[
              ['Are the water-can rates fixed?', 'They are the current configured platform rates. Serviceability, quantity, fees, taxes and any applicable order rules are still evaluated during checkout.'],
              ['Can bulk orders get a different rate?', `Yes. The current platform configuration uses a bulk threshold of ${pricing.bulk_threshold} cans and a configured bulk rate of ${inr(pricing.bulk_can_price)} per can.`],
              ['Are service starting prices final?', 'No. For non-water services, scope, parts, distance and other job details can change the final quote or payable amount.'],
              ['Why can checkout differ from a public starting price?', 'The public catalogue is a reference. Checkout uses the specific order details and the server-side pricing/serviceability rules.'],
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

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/book?service=water_can" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800">
              Start booking
            </Link>
            <Link href="/contact?subject=Pricing%20Question" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50">
              Ask a pricing question
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
