import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  SERVICE_LANDINGS,
  buildServiceMetadata,
  getServiceLanding,
  bookingHref,
} from '@/lib/seo/service-landings';

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
  return data ? (buildServiceMetadata(slug, 'Kanpur') as Metadata) : {};
}

export default async function KanpurServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = getServiceLanding(slug);

  if (!data) notFound();

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-[#06253D] text-white">
        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-22">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-cyan-100">
              <span>{data.icon}</span>
              Kanpur · {data.eyebrow}
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
                className="rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black"
              >
                Book now
              </Link>
              <Link href="/kanpur" className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-bold">
                Back to Kanpur services
              </Link>
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
            <details key={faq.q} className="group rounded-2xl border border-slate-200 bg-white p-5">
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
          <Link
            href={data.slug.startsWith('water-') ? '/book?service=water_can' : `/book?service=${encodeURIComponent(data.slug)}`}
            className="mt-6 inline-flex rounded-2xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-black lg:mt-0"
          >
            Check availability
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: `${data.name} in Kanpur`,
            serviceType: data.name,
            provider: { '@id': 'https://aurotap.in/#organization' },
            areaServed: { '@type': 'City', name: 'Kanpur', addressCountry: 'IN' },
            url: `https://aurotap.in/kanpur/${data.slug}`,
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
