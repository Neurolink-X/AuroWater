import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';

import {
  SERVICE_LANDINGS,
  buildServiceMetadata,
  getServiceLanding,
  bookingHref,
} from '@/lib/seo/service-landings';

const LEGACY_REDIRECTS: Record<string, string> = {
  'tanker-water-delivery': '/water-tanker-delivery',
};

export const revalidate = 3600;

export function generateStaticParams() {
  return Object.keys(SERVICE_LANDINGS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = getServiceLanding(slug);
  return data
    ? (buildServiceMetadata(slug) as Metadata)
    : {};
}

export default async function ServiceLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (LEGACY_REDIRECTS[slug]) {
    permanentRedirect(LEGACY_REDIRECTS[slug]);
  }

  const data = getServiceLanding(slug);
  if (!data) notFound();

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-[#06253D] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,.22),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(42,157,143,.24),transparent_40%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-cyan-100">
              <span>{data.icon}</span>
              {data.eyebrow}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              {data.name} in Kanpur
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
              {data.intro}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={bookingHref(data.slug)}
                className="rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#238579]"
              >
                Book {data.shortName}
              </Link>
              <Link
                href="/services"
                className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Explore all services
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
              {['Address-aware serviceability', 'Clear booking flow', 'Supplier / professional assignment', 'Live status updates'].map((x) => (
                <span key={x} className="rounded-full bg-white/8 px-3 py-2">{x}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {data.benefits.map((benefit, i) => (
            <article key={benefit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[.18em] text-[#2A9D8F]">0{i + 1}</div>
              <h2 className="mt-4 text-lg font-extrabold">{benefit}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Built into the booking and operations workflow rather than left to manual coordination.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">How it works</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">From request to confirmed service</h2>
            <p className="mt-4 text-slate-600">
              AuroWater is designed to make local water and home-service requests easier to book and easier to follow.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {data.steps.map((step, i) => (
              <div key={step} className="relative rounded-3xl bg-slate-50 p-6">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#06253D] text-sm font-black text-white">
                  {i + 1}
                </div>
                <p className="mt-5 font-bold leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">Service area</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">Built for local delivery and service operations</h2>
            <p className="mt-4 max-w-2xl text-slate-600 leading-7">
              AuroWater currently operates in selected service areas of Kanpur, Gorakhpur and Lucknow. The booking flow checks the address and service type before confirmation.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Kanpur', 'Gorakhpur', 'Lucknow'].map((city) => (
                <span key={city} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold">{city}</span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-[#06253D] p-7 text-white shadow-sm">
            <div className="text-3xl">{data.icon}</div>
            <h3 className="mt-4 text-xl font-black">Final price before confirmation</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Serviceability, available suppliers and booking inputs can affect the final order. The platform validates key pricing inputs on the server before creating the booking.
            </p>
            <Link
              href={bookingHref(data.slug)}
              className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-[#06253D]"
            >
              Check availability
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-slate-100">
        <div className="mx-auto max-w-5xl px-6 py-14 lg:px-8">
          <p className="text-sm font-black uppercase tracking-[.18em] text-[#2A9D8F]">FAQs</p>
          <h2 className="mt-3 text-3xl font-black">Questions before you book</h2>
          <div className="mt-8 space-y-4">
            {data.faqs.map((faq) => (
              <details key={faq.q} className="group rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none pr-6 font-extrabold marker:content-none">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="rounded-[2rem] bg-gradient-to-r from-[#06253D] to-[#0B4965] p-8 text-white sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-cyan-200">Ready to book?</p>
            <h2 className="mt-2 text-3xl font-black">Check your address and see what is available.</h2>
          </div>
          <Link
            href={bookingHref(data.slug)}
            className="mt-6 inline-flex rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black lg:mt-0"
          >
            Start booking
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: data.name,
            serviceType: data.name,
            provider: { '@id': 'https://aurotap.in/#organization' },
            areaServed: { '@type': 'City', name: 'Kanpur', addressCountry: 'IN' },
            url: `https://aurotap.in/${data.slug}`,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aurotap.in/' },
              { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://aurotap.in/services' },
              { '@type': 'ListItem', position: 3, name: data.name, item: `https://aurotap.in/${data.slug}` },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: data.faqs.map((faq) => ({
              '@type': 'Question',
              name: faq.q,
              acceptedAnswer: { '@type': 'Answer', text: faq.a },
            })),
          }),
        }}
      />
    </main>
  );
}
