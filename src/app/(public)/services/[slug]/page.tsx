import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import ServicePrice from '@/components/services/ServicePrice';
import { SERVICE_DETAILS, SHARED_FAQS, serviceKeywords, serviceSeoTitle, type ServiceDetail } from '../service-details';
import { BRAND, CITY_LINE, ILLUSTRATIONS, ILLUSTRATION_ALT, LIVE_CITIES, SERVICES, SITE_URL } from '../services-data';

/* ─────────────────────────────────────────────
   Speed: every service page is built once, served from the CDN,
   and unknown slugs return 404 instantly instead of rendering on demand.
───────────────────────────────────────────── */
export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return Object.keys(SERVICE_DETAILS).map((slug) => ({ slug }));
}

const getService = (slug: string): ServiceDetail | undefined => (SERVICE_DETAILS as Record<string, ServiceDetail | undefined>)[slug];

/* ─────────────────────────────────────────────
   SEO metadata
   No prices in titles or descriptions: prices are live and must never disagree with the page.
───────────────────────────────────────────── */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return { title: `Service not found | ${BRAND}`, robots: { index: false, follow: false } };

  const title = serviceSeoTitle(service);
  const path = `/services/${service.key}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: service.metaDescription,
    keywords: serviceKeywords(service),
    alternates: { canonical: path, languages: { 'en-IN': path } },
    // The share image comes from opengraph-image.tsx in this folder (WhatsApp, Facebook, LinkedIn, X).
    openGraph: { title, description: service.metaDescription, url: path, type: 'website', siteName: BRAND, locale: 'en_IN' },
    twitter: { card: 'summary_large_image', title, description: service.metaDescription },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
  };
}

/* ─────────────────────────────────────────────
   Neumorphic tokens: same look as the /services list page
───────────────────────────────────────────── */
const RAISED = 'rounded-3xl bg-[#E4EDF7] shadow-[9px_9px_20px_#BCC8D8,-9px_-9px_20px_#FFFFFF]';
const RAISED_SM = 'rounded-2xl bg-[#E4EDF7] shadow-[5px_5px_11px_#BCC8D8,-5px_-5px_11px_#FFFFFF]';
const INSET = 'rounded-2xl bg-[#E4EDF7] shadow-[inset_5px_5px_11px_#BCC8D8,inset_-5px_-5px_11px_#FFFFFF]';
const PRESS = 'transition-shadow duration-200 motion-reduce:transition-none hover:shadow-[13px_13px_26px_#BCC8D8,-13px_-13px_26px_#FFFFFF] active:shadow-[inset_5px_5px_11px_#BCC8D8,inset_-5px_-5px_11px_#FFFFFF]';
const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-sky-700';
const BTN_BASE = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-extrabold transition duration-200 motion-reduce:transition-none';
const BTN_SOFT = `${BTN_BASE} bg-[#E4EDF7] text-sky-900 shadow-[5px_5px_11px_#BCC8D8,-5px_-5px_11px_#FFFFFF] hover:shadow-[8px_8px_16px_#BCC8D8,-8px_-8px_16px_#FFFFFF] active:shadow-[inset_4px_4px_9px_#BCC8D8,inset_-4px_-4px_9px_#FFFFFF] ${FOCUS}`;
const BTN_GHOST = `${BTN_BASE} border border-white/25 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-cyan-300`;

/* Optional contact buttons: appear only if these are set in .env */
const PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || '';
const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');

const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();

  const accent = service.accent;
  const path = `/services/${service.key}`;
  const pageUrl = SITE_URL + path;
  const bookingHref = `/book?service=${encodeURIComponent(service.key)}`;
  const illustration = ILLUSTRATIONS[service.key];
  const illustrationAlt = ILLUSTRATION_ALT[service.key];
  const waLink = WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi ${BRAND}, I want to book: ${service.title}`)}` : '';

  const allFaqs = [...service.faqs, ...SHARED_FAQS];

  // Internal links: same category first, then the rest. Helps Google crawl and gets people to a second booking.
  const category = SERVICES.find((s) => s.key === service.key)?.category;
  const related = [
    ...SERVICES.filter((s) => s.key !== service.key && s.category === category),
    ...SERVICES.filter((s) => s.key !== service.key && s.category !== category),
  ]
    .slice(0, 3)
    .map((s) => SERVICE_DETAILS[s.key]);

  const areaServed = LIVE_CITIES.map((name) => ({
    '@type': 'City',
    name,
    containedInPlace: { '@type': 'State', name: 'Uttar Pradesh' },
  }));

  /* Structured data: no prices, no ratings (prices are live, ratings must be real). */
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: BRAND,
      url: SITE_URL,
      areaServed,
      ...(PHONE ? { contactPoint: [{ '@type': 'ContactPoint', telephone: PHONE, contactType: 'customer support', areaServed: 'IN', availableLanguage: ['en', 'hi'] }] } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${pageUrl}#service`,
      name: service.title,
      serviceType: service.title,
      description: service.description,
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed,
      url: pageUrl,
      availableChannel: { '@type': 'ServiceChannel', serviceUrl: `${SITE_URL}${bookingHref}`, availableLanguage: ['en', 'hi'] },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: serviceSeoTitle(service),
      description: service.metaDescription,
      inLanguage: 'en-IN',
      isPartOf: { '@type': 'WebSite', name: BRAND, url: SITE_URL },
      about: { '@id': `${pageUrl}#service` },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE_URL}/services` },
        { '@type': 'ListItem', position: 3, name: service.title, item: pageUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: allFaqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
  ];

  return (
    <main className="min-h-screen bg-[#E4EDF7] text-slate-900">
      {ld.map((o, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(o) }} />
      ))}

      {/* ══ HERO (dark brand block; accent glow is a gradient, not a heavy blur filter) ══ */}
      <section className="relative overflow-hidden bg-slate-950 px-5 pb-16 pt-8 text-white sm:pb-24">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 85% 0%, ${accent}40, transparent 55%)` }} />
        <div className="relative mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-slate-300">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="hover:text-white">Home</Link></li>
              <li aria-hidden>/</li>
              <li><Link href="/services" className="hover:text-white">Services</Link></li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-white">{service.title}</li>
            </ol>
          </nav>

          <div className="grid items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="mb-4 text-sm font-bold text-sky-300">{service.eyebrow}</p>
              <div className="mb-5 text-5xl" aria-hidden="true">{service.icon}</div>

              {/* The H1 carries the service AND the cities people search for */}
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                {service.title}
                <span className="mt-2 block text-2xl font-bold text-slate-300 sm:text-3xl">in {CITY_LINE}</span>
              </h1>
              <p lang="hi" className="mt-4 text-lg font-semibold text-sky-200">{service.hindi}</p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{service.description}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={bookingHref} className={`${BTN_BASE} text-white shadow-lg hover:brightness-110 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-cyan-300`} style={{ background: accent }}>
                  Book this service <span aria-hidden="true">→</span>
                </Link>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>WhatsApp us</a>
                )}
                {PHONE && (
                  <a href={`tel:${PHONE}`} className={BTN_GHOST}>Call us</a>
                )}
                <Link href="/pricing" prefetch={false} className={BTN_GHOST}>View pricing</Link>
              </div>

              {/* Trust points: all true to how booking works today */}
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-200">
                {['Address checked before booking', 'Price confirmed before work', 'Live in 3 UP cities'].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span aria-hidden className="text-emerald-400">✓</span>{t}</li>
                ))}
              </ul>
            </div>

            <aside className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] shadow-2xl">
              {/* Local SVG: no external image host, nothing to block rendering. The first image loads at top priority. */}
              <Image
                src={illustration}
                alt={illustrationAlt}
                width={640}
                height={420}
                loading="eager"
                fetchPriority="high"
                className="block h-auto w-full"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
              <div className="p-7">
                <p className="text-sm font-semibold text-slate-300">Current configured price</p>
                {service.key === 'water_can' ? (
                  <div className="space-y-4">
                    <div>
                      <p className="mt-2 text-sm font-bold text-slate-200">Normal RO · Everyday use</p>
                      <ServicePrice serviceKey="water_can" fallback="₹20" unit="per 20L can" />
                    </div>
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-sm font-bold text-slate-200">Chilled RO · Events & gatherings</p>
                      <ServicePrice serviceKey="chilled_water" fallback="₹25" unit="per 20L can · one-time booking" />
                    </div>
                  </div>
                ) : (
                  <ServicePrice serviceKey={service.key} fallback={service.startingPrice} unit={service.unit} />
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ══ BENEFITS ══ */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20" aria-labelledby="benefits-h">
        <div className="max-w-2xl">
          <p className="text-sm font-bold" style={{ color: accent }}>Designed around your needs</p>
          <h2 id="benefits-h" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">A clearer way to arrange {service.title.toLowerCase()}</h2>
          <p className="mt-4 leading-7 text-slate-600">Find the service, understand the typical scope and confirm availability and the final quote before work begins.</p>
        </div>
        <ul className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {service.benefits.map((benefit, index) => (
            <li key={benefit} className={`${RAISED_SM} p-5`}>
              <span className={`${INSET} flex h-10 w-10 items-center justify-center text-sm font-black`} style={{ color: accent }}>{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-4 font-bold leading-6">{benefit}</h3>
            </li>
          ))}
        </ul>
      </section>

      {/* ══ HOW BOOKING WORKS ══ */}
      <section className="mx-auto max-w-6xl px-5 pb-14 sm:pb-20" aria-labelledby="how-h">
        <h2 id="how-h" className="text-3xl font-black tracking-tight">How booking works</h2>
        <ol className="mt-8 grid gap-7 md:grid-cols-3">
          {service.process.map((step, index) => (
            <li key={step} className={`${RAISED_SM} flex gap-4 p-6`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-white" style={{ background: accent }}>{index + 1}</span>
              <p className="pt-1 font-semibold leading-6">{step}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Link href={bookingHref} className={BTN_SOFT}>Start your booking</Link>
        </div>
      </section>

      {/* ══ WHERE WE SERVE: local SEO text, honest about coverage ══ */}
      <section className="mx-auto max-w-6xl px-5 pb-14 sm:pb-20" aria-labelledby="cities-h">
        <h2 id="cities-h" className="text-3xl font-black tracking-tight">{service.title} in {CITY_LINE}</h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          {BRAND} is live in {LIVE_CITIES.length} Uttar Pradesh cities. Availability depends on your exact area, so enter your address while booking and we will check it first. We do not serve Delhi NCR yet.
        </p>
        <ul className="mt-8 grid gap-7 sm:grid-cols-3">
          {LIVE_CITIES.map((city) => (
            <li key={city} className={`${RAISED_SM} p-6`}>
              <h3 className="font-extrabold text-slate-900">{city}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Book {service.title.toLowerCase()} in supported areas of {city}. Check your address to see availability.</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ══ RELATED SERVICES: internal links ══ */}
      <section className="mx-auto max-w-6xl px-5 pb-14 sm:pb-20" aria-labelledby="related-h">
        <h2 id="related-h" className="text-3xl font-black tracking-tight">Other services you may need</h2>
        <ul className="mt-8 grid gap-7 md:grid-cols-3">
          {related.map((r) => (
            <li key={r.key}>
              <Link href={`/services/${r.key}`} prefetch={false} className={`flex h-full flex-col gap-3 p-6 ${RAISED} ${PRESS} ${FOCUS}`}>
                <span aria-hidden className={`${INSET} flex h-12 w-12 items-center justify-center text-2xl`}>{r.icon}</span>
                <span className="text-lg font-extrabold leading-6">{r.title}</span>
                <span className="text-sm leading-6 text-slate-600">{r.eyebrow}</span>
                <span className="mt-auto text-sm font-bold text-sky-800">View details →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ══ FAQ + CLOSING CTA ══ */}
      <section className="mx-auto max-w-4xl px-5 pb-28 sm:pb-24" aria-labelledby="faq-h">
        <h2 id="faq-h" className="text-3xl font-black tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 flex flex-col gap-5">
          {allFaqs.map((faq) => (
            <details key={faq.question} className={`group ${RAISED_SM} px-5 py-2 open:shadow-[inset_5px_5px_11px_#BCC8D8,inset_-5px_-5px_11px_#FFFFFF]`}>
              <summary className={`flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                {faq.question}
                <span className="text-xl text-sky-800 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="max-w-3xl pb-3 pt-1 leading-7 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-slate-950 p-7 text-white shadow-[9px_9px_20px_#BCC8D8,-9px_-9px_20px_#FFFFFF] sm:p-10">
          <h2 className="text-2xl font-black sm:text-3xl">Ready to get started?</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">Check service availability for your address and review the booking details before you confirm.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={bookingHref} className={`${BTN_BASE} text-white hover:brightness-110 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-cyan-300`} style={{ background: accent }}>
              Continue to booking <span aria-hidden="true">→</span>
            </Link>
            {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>WhatsApp us</a>}
            {PHONE && <a href={`tel:${PHONE}`} className={BTN_GHOST}>Call us</a>}
          </div>
        </div>
      </section>

      {/* ══ STICKY MOBILE BAR: the shortest path from reading to booking ══ */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex gap-3 bg-[#E4EDF7]/95 px-4 pt-3 shadow-[0_-6px_16px_#BCC8D8] md:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Link href={bookingHref} className={`${BTN_BASE} flex-1 text-white`} style={{ background: accent }}>Book now</Link>
        {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className={BTN_SOFT}>WhatsApp</a>}
        {PHONE && <a href={`tel:${PHONE}`} aria-label="Call us" className={BTN_SOFT}>Call</a>}
      </div>
    </main>
  );
}








// import Link from 'next/link';
// import Image from 'next/image';
// import { notFound } from 'next/navigation';
// import type { Metadata } from 'next';
// import ServicePrice from '@/components/services/ServicePrice';

// type ServiceDetail = {
//   key: string;
//   title: string;
//   eyebrow: string;
//   description: string;
//   startingPrice: string;
//   unit: string;
//   icon: string;
//   accent: string;
//   benefits: string[];
//   process: string[];
//   faqs: { question: string; answer: string }[];
// };

// const SERVICE_DETAILS: Record<string, ServiceDetail> = {
//   water_can: {
//     key: 'water_can', title: '20L Water Can Delivery', eyebrow: 'Daily drinking water',
//     description: 'Order a 20-litre drinking water can for home, shops or offices in eligible areas of Kanpur, Lucknow and Gorakhpur. Choose Normal RO for everyday use or Chilled RO for gatherings; check address serviceability and the current total before confirming.',
//     startingPrice: '₹20', unit: 'per 20L Normal RO can; Chilled RO priced separately', icon: '💧', accent: '#0284c7',
//     benefits: ['Normal RO and Chilled RO options', 'One-time orders and Normal RO recurring delivery', 'Address and delivery-slot availability checked', 'Review current unit price and order total before confirming'],
//     process: ['Choose Normal RO or Chilled RO and quantity', 'Confirm your address and available delivery slot', 'Review the final total and place your order'],
//     faqs: [
//       { question: 'How much does a 20L water can cost?', answer: 'The current configured Normal RO and Chilled RO rates are shown on the pricing page and in booking. Check the final total for your address before placing an order.' },
//       { question: 'Can I order chilled water on a recurring schedule?', answer: 'Chilled RO is currently a one-time booking option. Recurring delivery is available for Normal RO where supported.' },
//       { question: 'Where is delivery available?', answer: 'AuroWater currently serves eligible areas of Kanpur, Lucknow and Gorakhpur. Availability is checked against your delivery address.' },
//     ],
//   },
//   water_tanker: {
//     key: 'water_tanker', title: 'Water Tanker Delivery', eyebrow: 'Bulk water supply',
//     description: 'Request bulk water delivery for homes, apartments, offices, construction sites and events. Availability depends on your delivery location and capacity needs.',
//     startingPrice: '₹299–₹799', unit: 'starting estimate; volume and access affect the quote', icon: '🚚', accent: '#0284c7',
//     benefits: ['Share the volume you need', 'Confirm delivery access and location', 'See available options before confirming', 'Keep booking details in one account'],
//     process: ['Choose tanker service and volume', 'Provide delivery address and timing', 'Confirm the available quote and booking'],
//     faqs: [{ question: 'Is every tanker size available everywhere?', answer: 'No. Available volume and delivery options depend on the location and supplier.' }],
//   },
//   ro_service: {
//     key: 'ro_service', title: 'RO Service & Repair', eyebrow: 'Water purifier care',
//     description: 'Request water-purifier diagnostics, filter service or repairs. The technician can assess the unit and confirm any parts or additional work before proceeding.',
//     startingPrice: '₹349', unit: 'starting estimate; parts may cost extra', icon: '🛠️', accent: '#0369a1',
//     benefits: ['Describe your purifier issue', 'Request diagnostics and filter service', 'Confirm repair scope before work', 'Keep service history with your account'],
//     process: ['Choose the RO issue or service type', 'Select address and a suitable slot', 'Review the visit details and confirm'],
//     faqs: [{ question: 'Are filters included in the starting rate?', answer: 'Replacement parts may cost extra. Confirm the itemised estimate before approving repairs.' }],
//   },
//   plumbing: {
//     key: 'plumbing', title: 'Plumbing Services', eyebrow: 'Home water systems',
//     description: 'Book help for leaking taps, pipe issues, fittings, blockages and routine plumbing work, subject to local service availability.',
//     startingPrice: '₹149', unit: 'indicative starting visit rate', icon: '🔧', accent: '#1e40af',
//     benefits: ['Describe the issue before the visit', 'Request help with common household plumbing', 'Review any additional work estimate', 'Keep booking updates in one place'],
//     process: ['Select the issue and add details', 'Choose your address and available slot', 'Review the estimate and confirm'],
//     faqs: [{ question: 'Does the visit price include materials?', answer: 'Materials and additional work may be charged separately. Confirm the estimate with the service professional.' }],
//   },
//   borewell: {
//     key: 'borewell', title: 'Borewell Services', eyebrow: 'Borewell installation and repair',
//     description: 'Submit a request for borewell inspection, repair or installation. The scope, equipment and final quote depend on the site and job requirements.',
//     startingPrice: '₹499', unit: 'indicative starting rate', icon: '⛏️', accent: '#1d4ed8',
//     benefits: ['Explain the site and issue in advance', 'Request inspection or repair support', 'Confirm scope before major work', 'Access booking details after confirmation'],
//     process: ['Choose inspection, repair or installation', 'Share site location and job details', 'Confirm feasibility, scope and quote'],
//     faqs: [{ question: 'Can installation be quoted from the website alone?', answer: 'Complex jobs usually require site details or an inspection before a reliable quote can be confirmed.' }],
//   },
//   motor_pump: {
//     key: 'motor_pump', title: 'Motor & Submersible Pump Repair', eyebrow: 'Water pump support',
//     description: 'Request inspection or repair for household motors and submersible pumps. Final work and parts depend on the diagnosis.',
//     startingPrice: '₹299', unit: 'starting estimate; parts may cost extra', icon: '⚙️', accent: '#2563eb',
//     benefits: ['Describe the motor or pump symptoms', 'Request a diagnostic visit', 'Confirm parts and repair charges before work', 'Keep the service request accessible in your account'],
//     process: ['Select the pump problem', 'Share address and preferred timing', 'Review the visit details and confirm'],
//     faqs: [{ question: 'Are spare parts included?', answer: 'Parts are generally quoted separately after diagnosis. Confirm any warranty terms before approving work.' }],
//   },
//   tank_cleaning: {
//     key: 'tank_cleaning', title: 'Water Tank Cleaning', eyebrow: 'Tank hygiene',
//     description: 'Request cleaning and sanitation for household or commercial water tanks. Confirm tank size, access and the service scope before booking.',
//     startingPrice: '₹599', unit: 'starting estimate; tank size affects the quote', icon: '🪣', accent: '#075985',
//     benefits: ['Specify tank type and approximate capacity', 'Arrange an appropriate service slot', 'Confirm the cleaning scope before work', 'Keep booking information in your account'],
//     process: ['Share tank type and capacity', 'Choose address and available timing', 'Confirm scope and final price'],
//     faqs: [{ question: 'Does price depend on tank size?', answer: 'It can. Confirm the final rate for your tank capacity and access requirements before confirming.' }],
//   },
// };

// export function generateStaticParams() {
//   return Object.keys(SERVICE_DETAILS).map((slug) => ({ slug }));
// }

// export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
//   const { slug } = await params;
//   const service = SERVICE_DETAILS[slug];
//   if (!service) return { title: 'Service not found | AuroWater' };
//   return {
//     title: `${service.title} in Kanpur, Lucknow & Gorakhpur | AuroWater`,
//     description: service.description,
//     alternates: { canonical: `/services/${service.key}` },
//     keywords: [service.title, `${service.title} near me`, `${service.title} Kanpur`, `${service.title} Lucknow`, `${service.title} Gorakhpur`, 'AuroWater'],
//     openGraph: { title: `${service.title} | AuroWater`, description: service.description, url: `/services/${service.key}`, type: 'website' },
//     robots: { index: true, follow: true },
//   };
// }

// export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
//   const { slug } = await params;
//   const service = SERVICE_DETAILS[slug];
//   if (!service) notFound();

//   const bookingHref = `/book?service=${encodeURIComponent(service.key)}`;
//   const illustration = service.key === 'water_can' || service.key === 'ro_service' ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Home_water_filters%2C_water_purifiers%2C_and_bottled_water_in_India.jpg/960px-Home_water_filters%2C_water_purifiers%2C_and_bottled_water_in_India.jpg'
//     : service.key === 'plumbing' ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Plumber_at_work.jpg/960px-Plumber_at_work.jpg'
//     : service.key === 'water_tanker' ? '/illustrations/water-tanker.svg'
//     : service.key === 'tank_cleaning' ? '/illustrations/tank-cleaning.svg'
//     : service.key === 'motor_pump' || service.key === 'ro_service' ? '/illustrations/pump-service.svg'
//     : '/illustrations/home-technician.svg';
//   const serviceSchema = {
//     '@context': 'https://schema.org',
//     '@type': 'Service',
//     name: service.title,
//     description: service.description,
//     serviceType: service.title,
//     provider: { '@type': 'Organization', name: 'AuroWater', url: 'https://aurotap.in/' },
//     areaServed: ['Kanpur', 'Lucknow', 'Gorakhpur'].map((name) => ({ '@type': 'City', name, containedInPlace: { '@type': 'State', name: 'Uttar Pradesh' } })),
//     url: `https://aurotap.in/services/${service.key}`,
//   };
//   const faqSchema = {
//     '@context': 'https://schema.org',
//     '@type': 'FAQPage',
//     mainEntity: service.faqs.map((faq) => ({
//       '@type': 'Question',
//       name: faq.question,
//       acceptedAnswer: { '@type': 'Answer', text: faq.answer },
//     })),
//   };

//   return (
//     <main className="min-h-screen bg-slate-50 text-slate-900">
//       <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
//       <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
//       <section className="relative overflow-hidden bg-slate-950 px-5 py-16 text-white sm:py-24">
//         <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: service.accent }} />
//         <div className="relative mx-auto max-w-6xl">
//           <nav aria-label="Breadcrumb" className="mb-8 text-sm text-slate-300">
//             <Link href="/" className="hover:text-white">Home</Link><span className="mx-2">/</span>
//             <Link href="/services" className="hover:text-white">Services</Link><span className="mx-2">/</span>
//             <span aria-current="page" className="text-white">{service.title}</span>
//           </nav>
//           <div className="grid items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
//             <div>
//               <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#7dd3fc' }}>{service.eyebrow}</p>
//               <div className="mb-5 text-5xl" aria-hidden="true">{service.icon}</div>
//               <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{service.title}</h1>
//               <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{service.description}</p>
//               <div className="mt-8 flex flex-wrap gap-3">
//                 <Link href={bookingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 font-bold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{ background: service.accent }}>
//                   Book this service <span className="ml-2" aria-hidden="true">→</span>
//                 </Link>
//                 <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/10">View pricing</Link>
//               </div>
//             </div>
//             <aside className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur">
//               <Image src={illustration} alt={service.key === 'plumbing' ? 'Plumber at work repairing household plumbing' : service.key === 'water_can' || service.key === 'ro_service' ? '20 litre reusable water jars and household water purification equipment in India' : `${service.title} service illustration`} width={640} height={420} priority className="block h-auto w-full" sizes="(max-width: 768px) 100vw, 40vw" />
//               {(service.key === 'water_can' || service.key === 'ro_service') && <p className="px-4 py-2 text-[10px] text-slate-300/80">Photo: FacetsOfNonStickPans · <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></p>}
//               {service.key === 'plumbing' && <p className="px-4 py-2 text-[10px] text-slate-300/80">Photo: rick / Wikimedia Commons · <a className="underline" href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a></p>}
//               <div className="p-7">
//               <p className="text-sm font-semibold text-slate-300">Current configured price</p>
//               {service.key === 'water_can' ? (
//                 <div className="space-y-4">
//                   <div>
//                     <p className="mt-2 text-sm font-bold text-slate-200">Normal RO · Everyday use</p>
//                     <ServicePrice serviceKey="water_can" fallback="₹20" unit="per 20L can" />
//                   </div>
//                   <div className="border-t border-white/10 pt-4">
//                     <p className="text-sm font-bold text-slate-200">Chilled RO · Events & gatherings</p>
//                     <ServicePrice serviceKey="chilled_water" fallback="₹25" unit="per 20L can · one-time booking" />
//                   </div>
//                 </div>
//               ) : <ServicePrice serviceKey={service.key} fallback={service.startingPrice} unit={service.unit} />}
//               </div>
//             </aside>
//           </div>
//         </div>
//       </section>

//       <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
//         <div className="max-w-2xl">
//           <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: service.accent }}>Designed around your needs</p>
//           <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A clearer way to arrange {service.title.toLowerCase()}</h2>
//           <p className="mt-4 leading-7 text-slate-600">Find the service, understand the typical scope and confirm availability and the final quote before work begins.</p>
//         </div>
//         <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
//           {service.benefits.map((benefit, index) => (
//             <article key={benefit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
//               <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black" style={{ background: `${service.accent}15`, color: service.accent }}>{String(index + 1).padStart(2, '0')}</span>
//               <h3 className="mt-4 font-bold">{benefit}</h3>
//             </article>
//           ))}
//         </div>
//       </section>

//       <section className="border-y border-slate-200 bg-white px-5 py-14 sm:py-20">
//         <div className="mx-auto max-w-6xl">
//           <h2 className="text-3xl font-black tracking-tight">How booking works</h2>
//           <div className="mt-8 grid gap-5 md:grid-cols-3">
//             {service.process.map((step, index) => (
//               <div key={step} className="flex gap-4 rounded-2xl bg-slate-50 p-6">
//                 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-white" style={{ background: service.accent }}>{index + 1}</span>
//                 <p className="pt-1 font-semibold leading-6">{step}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       <section className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
//         <h2 className="text-3xl font-black tracking-tight">Frequently asked questions</h2>
//         <div className="mt-6 space-y-3">
//           {service.faqs.map((faq) => (
//             <details key={faq.question} className="group rounded-2xl border border-slate-200 bg-white p-5">
//               <summary className="cursor-pointer list-none pr-5 font-bold marker:hidden focus-visible:outline-none">
//                 {faq.question}
//                 <span className="float-right ml-3 text-slate-400 transition group-open:rotate-45" aria-hidden="true">＋</span>
//               </summary>
//               <p className="mt-3 leading-7 text-slate-600">{faq.answer}</p>
//             </details>
//           ))}
//         </div>
//         <div className="mt-10 rounded-3xl bg-slate-950 p-7 text-white sm:p-10">
//           <h2 className="text-2xl font-black sm:text-3xl">Ready to get started?</h2>
//           <p className="mt-3 max-w-2xl leading-7 text-slate-300">Check service availability for your address and review the booking details before you confirm.</p>
//           <Link href={bookingHref} className="mt-6 inline-flex min-h-12 items-center rounded-xl px-6 py-3 font-bold text-white transition hover:brightness-110" style={{ background: service.accent }}>Continue to booking →</Link>
//         </div>
//       </section>
//     </main>
//   );
// }
