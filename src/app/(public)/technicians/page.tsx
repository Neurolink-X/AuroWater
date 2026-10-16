import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';

import TechniciansClient from './TechniciansClient';
import { BRAND, FAQS, PAGE_PATH, SERVICES, SITE_URL, UP_CITIES } from './technicians-shared';

// Self-hosted by Next at build time: replaces the render-blocking Google Fonts @import.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '600', '700', '800'] });

// Page is fully static: serve from the edge/CDN and refresh once a day.
export const revalidate = 86400;

/* ------------------------------------------------------------------ */
/* Contact (optional): set these in .env and the buttons appear        */
/*   NEXT_PUBLIC_SUPPORT_PHONE=+919XXXXXXXXX                           */
/*   NEXT_PUBLIC_WHATSAPP_NUMBER=919XXXXXXXXX  (country code, no +)    */
/* If they are not set, nothing is shown and nothing breaks.           */
/* ------------------------------------------------------------------ */

const PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || '';
const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '');
const WA_LINK = WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi ${BRAND}, I need a water technician.`)}` : '';

/* ------------------------------------------------------------------ */
/* SEO helpers                                                         */
/* ------------------------------------------------------------------ */

const cityShort = UP_CITIES.length > 3 ? `${UP_CITIES.slice(0, 3).join(', ')} & UP` : UP_CITIES.join(', ');
const cityAll = UP_CITIES.join(', ');

// Keep the title near 60 characters and the description near 160 so Google does not cut them.
const TITLE = `Plumber, RO Service & Water Technicians in ${cityShort} | ${BRAND}`;
const DESCRIPTION = `Book verified plumbers, RO service, borewell, motor pump, water tanker and tank cleaning technicians in ${cityAll}. Compare ratings, see who is live, book online.`;

const SERVICE_TERMS = ['plumber', 'RO service', 'borewell', 'motor pump repair', 'water tanker booking', 'water tank cleaning'];

// Every service + city combination people actually search for, for example "RO service in Lucknow".
const KEYWORDS = Array.from(
  new Set([
    ...UP_CITIES.flatMap((c) => SERVICE_TERMS.map((t) => `${t} in ${c}`)),
    'water technician Uttar Pradesh',
    'book plumber online',
    'RO water purifier service near me',
    'water tank cleaning near me',
    'borewell service Uttar Pradesh',
    'water tanker on call',
    'water softener hard water solution',
    'geyser repair near me',
    'drain cleaning service',
  ]),
).slice(0, 52);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: BRAND,
  category: 'Home services',
  alternates: { canonical: PAGE_PATH, languages: { 'en-IN': PAGE_PATH } },
  openGraph: { type: 'website', siteName: BRAND, title: TITLE, description: DESCRIPTION, url: PAGE_PATH, locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#022C22',
};

const json = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');

/* ------------------------------------------------------------------ */
/* Neumorphism tokens (full class strings so Tailwind keeps them)      */
/* ------------------------------------------------------------------ */
// Base surface #E4F1EB, dark shadow #BFCFC7, light shadow #FFFFFF.

const SURFACE = 'bg-[#E4F1EB]';
const RAISED = 'rounded-3xl bg-[#E4F1EB] shadow-[9px_9px_18px_#BFCFC7,-9px_-9px_18px_#FFFFFF]';
const RAISED_SM = 'rounded-2xl bg-[#E4F1EB] shadow-[5px_5px_11px_#BFCFC7,-5px_-5px_11px_#FFFFFF]';
const INSET = 'rounded-2xl bg-[#E4F1EB] shadow-[inset_5px_5px_10px_#BFCFC7,inset_-5px_-5px_10px_#FFFFFF]';
const PRESS = 'transition-shadow duration-200 motion-reduce:transition-none hover:shadow-[12px_12px_22px_#BFCFC7,-12px_-12px_22px_#FFFFFF] active:shadow-[inset_5px_5px_10px_#BFCFC7,inset_-5px_-5px_10px_#FFFFFF]';
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600';

const BTN_PRIMARY = `inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-3 text-sm font-extrabold text-white shadow-[6px_6px_14px_#BFCFC7,-6px_-6px_14px_#FFFFFF] transition-shadow duration-200 motion-reduce:transition-none hover:shadow-[9px_9px_18px_#BFCFC7,-9px_-9px_18px_#FFFFFF] active:shadow-[inset_4px_4px_9px_rgba(0,0,0,0.25)] ${FOCUS}`;
const BTN_SOFT = `inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#E4F1EB] px-6 py-3 text-sm font-extrabold text-emerald-900 shadow-[6px_6px_14px_#BFCFC7,-6px_-6px_14px_#FFFFFF] transition-shadow duration-200 motion-reduce:transition-none hover:shadow-[9px_9px_18px_#BFCFC7,-9px_-9px_18px_#FFFFFF] active:shadow-[inset_4px_4px_9px_#BFCFC7,inset_-4px_-4px_9px_#FFFFFF] ${FOCUS}`;

const H2 = 'text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl';
const LEAD = 'mt-2 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base';
const LABEL = 'text-sm font-bold text-emerald-800';

/* ------------------------------------------------------------------ */
/* Static marketing content                                            */
/* ------------------------------------------------------------------ */

const TRUST_POINTS: ReadonlyArray<readonly [string, string, string]> = [
  ['✅', 'Reviewed partners', 'Our team reviews every applicant and calls to verify details.'],
  ['🟢', 'Live or Busy status', 'See who can take the job now before you call.'],
  ['⭐', 'Open profiles', 'Ratings, jobs done, city and skills on every profile.'],
  ['⚡', 'Book in minutes', 'Pick a service, choose a technician, confirm online.'],
];

const STEPS: ReadonlyArray<readonly [string, string]> = [
  ['Choose your service', 'Plumber, RO service, borewell, motor pump, tanker or tank cleaning.'],
  ['Compare technicians', 'Check rating, jobs completed, skills and who is Live in your city.'],
  ['Book and get it fixed', 'Confirm online. Ask for the estimate before work starts.'],
];

const PROBLEMS: ReadonlyArray<readonly [string, string]> = [
  ['Leaking tap or pipe', 'Plumber'],
  ['Low water pressure at home', 'Plumber / motor pump'],
  ['RO gives less or no water', 'RO service'],
  ['Water tastes salty or bad', 'RO service'],
  ['Motor pump not starting', 'Motor pump repair'],
  ['Overhead tank looks dirty', 'Tank cleaning'],
  ['Borewell water level dropped', 'Borewell service'],
  ['Need water for a function or site', 'Water tanker'],
];

// Related water needs. Keep only the ones your team can really fulfil.
const MORE_SERVICES: ReadonlyArray<readonly [string, string]> = [
  ['💧', 'Water softener for hard water'],
  ['🔥', 'Geyser repair and installation'],
  ['🚿', 'Bathroom and kitchen fittings'],
  ['🕳️', 'Drain and sewer cleaning'],
  ['🧱', 'Leak detection and waterproofing'],
  ['⚙️', 'Submersible pump installation'],
  ['🧪', 'Water quality (TDS) checking'],
  ['🏭', 'Commercial RO plant service'],
];

const PRICE_FACTORS: ReadonlyArray<readonly [string, string]> = [
  ['Visiting charge', 'Many technicians charge a fixed visit fee. Ask for it before you confirm.'],
  ['Parts and material', 'Filters, membranes, pipes and motors are priced separately. Ask for the part brand and price.'],
  ['Size and difficulty', 'A tank, borewell or plant job takes more time and tools than a simple tap repair.'],
  ['Urgency and distance', 'Same-day or late-hour calls and faraway locations can cost more.'],
];

const BUSINESS_NEEDS: ReadonlyArray<readonly [string, string]> = [
  ['Apartments and societies', 'Regular tank cleaning, motor pump care and tanker supply for residents.'],
  ['Hotels, hospitals and schools', 'Safe, clean water and RO upkeep without downtime.'],
  ['Factories and shops', 'Bulk tanker supply and commercial RO service on a schedule.'],
];

const CARE_TIPS: ReadonlyArray<readonly [string, string]> = [
  ['RO filters', 'Most households service the RO and change filters every 6 to 12 months. Hard water or heavy use may need it sooner.'],
  ['Water tanks', 'Cleaning overhead and underground tanks about every 6 months keeps stored water fresh and safe.'],
  ['Motor pumps', 'Strange noise, frequent tripping or slow filling are early signs. Early repair costs less than a burnt motor.'],
  ['Not sure what you need?', 'Ask the technician to check your water (TDS and hardness) first. That tells you if you need an RO, a softener or just a filter change.'],
  ['Safety first', 'Switch off the power before anyone touches a motor, geyser or pump, and never let anyone work on wet wiring.'],
  ['Before any job', 'Ask for the visiting charge and estimate first, and keep the technician name and phone for your records.'],
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TechniciansPage() {
  const url = SITE_URL + PAGE_PATH;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: BRAND,
      url: SITE_URL,
      areaServed: UP_CITIES.map((c) => ({ '@type': 'City', name: c })),
      ...(PHONE
        ? { contactPoint: [{ '@type': 'ContactPoint', telephone: PHONE, contactType: 'customer support', areaServed: 'IN', availableLanguage: ['en', 'hi'] }] }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: TITLE,
      description: DESCRIPTION,
      url,
      isPartOf: { '@type': 'WebSite', name: BRAND, url: SITE_URL },
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-IN',
      about: SERVICE_TERMS.map((t) => ({ '@type': 'Thing', name: t })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Technicians', item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${BRAND} water services`,
      itemListElement: SERVICES.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Service',
          name: s.label,
          serviceType: s.label,
          description: s.blurb,
          provider: { '@type': 'Organization', name: BRAND, url: SITE_URL },
          areaServed: UP_CITIES.map((c) => ({ '@type': 'City', name: c })),
          url: `${SITE_URL}/book?service=${s.key}`,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return (
    <div className={jakarta.className}>
      {/* Tiny global CSS: smooth anchor scrolling and no tap flash. Motion is switched off for users who ask for it. */}
      <style>{`html{scroll-behavior:smooth}a,summary{-webkit-tap-highlight-color:transparent}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}`}</style>

      {ld.map((o, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(o) }} />
      ))}

      <nav aria-label="Breadcrumb" className="bg-[#022C22] px-6 pt-4 text-sm text-emerald-200/80">
        <ol className="mx-auto flex max-w-[1200px] items-center gap-2">
          <li>
            <Link href="/" className="font-semibold underline-offset-4 hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-white">
            Technicians
          </li>
        </ol>
      </nav>

      <TechniciansClient>
        {/* Server-rendered SEO and marketing sections, placed between the list and the join banner */}
        <div className={SURFACE}>
          <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-10">
            {/* Trust strip */}
            <section aria-label="Why customers trust us" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_POINTS.map(([icon, t, d]) => (
                <div key={t} className={`${RAISED_SM} flex items-start gap-3 p-5`}>
                  <span aria-hidden className={`${INSET} flex h-11 w-11 shrink-0 items-center justify-center text-xl`}>
                    {icon}
                  </span>
                  <div>
                    <p className="font-extrabold text-gray-900">{t}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{d}</p>
                  </div>
                </div>
              ))}
            </section>

            {/* Services */}
            <section aria-labelledby="svc-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 520px' }}>
              <p className={LABEL}>Our services</p>
              <h2 id="svc-h" className={`mt-1 ${H2}`}>
                Plumber, RO service and every water service in one place
              </h2>
              <p className={LEAD}>Pick what you need. You will see technicians in your city with rating, jobs completed and availability.</p>
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICES.map((s) => (
                  <li key={s.key}>
                    <Link href={`/book?service=${s.key}`} className={`flex h-full flex-col p-6 ${RAISED} ${PRESS} ${FOCUS}`}>
                      <span aria-hidden className={`${INSET} flex h-14 w-14 items-center justify-center text-3xl`}>
                        {s.icon}
                      </span>
                      <span className="mt-4 text-lg font-extrabold text-gray-900">{s.label}</span>
                      <span className="mt-1 text-sm leading-6 text-gray-600">{s.blurb}</span>
                      <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-emerald-800">
                        Book {s.label.toLowerCase()}
                        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* How it works: a real sequence, so numbered */}
            <section aria-labelledby="how-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 300px' }}>
              <h2 id="how-h" className={H2}>
                How booking works
              </h2>
              <ol className="mt-8 grid gap-6 md:grid-cols-3">
                {STEPS.map(([t, d], i) => (
                  <li key={t} className={`${RAISED_SM} flex gap-4 p-6`}>
                    <span aria-hidden className={`${INSET} flex h-11 w-11 shrink-0 items-center justify-center text-lg font-extrabold text-emerald-800`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-extrabold text-gray-900">{t}</p>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/book" className={BTN_PRIMARY}>
                  Book a technician now
                </Link>
                {WA_LINK && (
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className={BTN_SOFT}>
                    Chat on WhatsApp
                  </a>
                )}
                {PHONE && (
                  <a href={`tel:${PHONE}`} className={BTN_SOFT}>
                    Call us
                  </a>
                )}
                <Link href="#faq-h" className={BTN_SOFT}>
                  Read common questions
                </Link>
              </div>
            </section>

            {/* Common problems: matches how people search */}
            <section aria-labelledby="prob-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 420px' }}>
              <h2 id="prob-h" className={H2}>
                Common water problems we help fix
              </h2>
              <p className={LEAD}>Not sure which service you need? Find your problem and book the right technician.</p>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {PROBLEMS.map(([problem, service]) => (
                  <li key={problem}>
                    <Link href="/book" className={`flex h-full flex-col justify-between gap-3 p-5 ${RAISED_SM} ${PRESS} ${FOCUS}`}>
                      <span className="font-bold leading-6 text-gray-900">{problem}</span>
                      <span className={`${INSET} self-start px-3 py-1 text-xs font-bold text-emerald-800`}>{service}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Related services: more search traffic and more jobs per customer */}
            <section aria-labelledby="more-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 340px' }}>
              <h2 id="more-h" className={H2}>
                Need something else for your water?
              </h2>
              <p className={LEAD}>Tell us what you need and our team will help you find the right technician.</p>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {MORE_SERVICES.map(([icon, label]) => (
                  <li key={label}>
                    <Link href="/book" className={`flex h-full items-center gap-3 p-4 ${RAISED_SM} ${PRESS} ${FOCUS}`}>
                      <span aria-hidden className={`${INSET} flex h-11 w-11 shrink-0 items-center justify-center text-xl`}>
                        {icon}
                      </span>
                      <span className="text-sm font-bold leading-5 text-gray-900">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Price transparency: builds trust without promising fixed prices */}
            <section aria-labelledby="price-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' }}>
              <h2 id="price-h" className={H2}>
                What decides the price of a water service?
              </h2>
              <p className={LEAD}>No surprises. Here is what usually changes the final bill, so you can ask the right questions.</p>
              <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {PRICE_FACTORS.map(([t, d]) => (
                  <div key={t} className={`${RAISED_SM} p-6`}>
                    <dt className="font-extrabold text-gray-900">{t}</dt>
                    <dd className="mt-2 text-sm leading-6 text-gray-600">{d}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* B2B: apartments, hotels, factories give repeat, high-value work */}
            <section aria-labelledby="biz-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 360px' }}>
              <h2 id="biz-h" className={H2}>
                For apartments, hotels, schools and businesses
              </h2>
              <p className={LEAD}>Share your requirement and our team will get back to you with the right technicians.</p>
              <ul className="mt-8 grid gap-6 md:grid-cols-3">
                {BUSINESS_NEEDS.map(([t, d]) => (
                  <li key={t} className={`${RAISED} p-6`}>
                    <p className="font-extrabold text-gray-900">{t}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{d}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/book" className={BTN_SOFT}>
                  Share your requirement
                </Link>
              </div>
            </section>

            {/* Cities: local SEO text */}
            <section aria-labelledby="city-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 260px' }}>
              <h2 id="city-h" className={H2}>
                Water technicians across Uttar Pradesh
              </h2>
              <p className={LEAD}>
                Looking for a plumber in {UP_CITIES[0]}, RO service in {UP_CITIES[1] ?? UP_CITIES[0]} or a water tanker nearby? We list technicians in these cities:
              </p>
              <ul className="mt-6 flex flex-wrap gap-4">
                {UP_CITIES.map((c) => (
                  <li key={c} className={`${INSET} px-5 py-3 text-sm font-bold text-gray-900`}>
                    {c}
                  </li>
                ))}
              </ul>
            </section>

            {/* Why us */}
            <section aria-labelledby="why-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 300px' }}>
              <p className={LABEL}>Why {BRAND}</p>
              <h2 id="why-h" className={`mt-1 ${H2}`}>
                Clear choices, quick booking
              </h2>
              <ul className="mt-8 grid gap-6 md:grid-cols-3">
                {[
                  ['See before you book', 'Ratings, jobs completed, city and skills sit on every profile, so you can compare in seconds.'],
                  ['Know who is free', 'Each technician shows Live or Busy, so you do not waste time on someone who cannot take the job.'],
                  ['Reviewed partners', 'Every applicant is reviewed by our team, who contact them to verify their details.'],
                ].map(([t, d]) => (
                  <li key={t} className={`${RAISED} p-6`}>
                    <p className="font-extrabold text-gray-900">{t}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{d}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Helpful guide: strong E-E-A-T content for search engines */}
            <section aria-labelledby="tips-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 460px' }}>
              <h2 id="tips-h" className={H2}>
                Simple water care tips for your home
              </h2>
              <p className={LEAD}>A little care saves money. These are general guidelines, your technician can advise for your exact setup.</p>
              <dl className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {CARE_TIPS.map(([t, d]) => (
                  <div key={t} className={`${RAISED_SM} p-6`}>
                    <dt className="font-extrabold text-gray-900">{t}</dt>
                    <dd className="mt-2 text-sm leading-7 text-gray-600">{d}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* FAQ */}
            <section aria-labelledby="faq-h" className="mt-16 scroll-mt-6" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 520px' }}>
              <p className={LABEL}>Questions</p>
              <h2 id="faq-h" className={`mt-1 ${H2}`}>
                Before you book
              </h2>
              <div className="mt-8 flex flex-col gap-4">
                {FAQS.map((f) => (
                  <details key={f.q} className={`group ${RAISED_SM} px-5 py-2 open:shadow-[inset_5px_5px_10px_#BFCFC7,inset_-5px_-5px_10px_#FFFFFF] sm:px-6`}>
                    <summary className={`flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 font-bold text-gray-900 [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                      {f.q}
                      <span aria-hidden className="text-xl text-emerald-800 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="max-w-3xl pb-3 pt-1 text-sm leading-7 text-gray-600">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            {/* Closing call to action */}
            <section aria-labelledby="cta-h" className="mt-16" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}>
              <div className={`${RAISED} flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between`}>
                <div>
                  <h2 id="cta-h" className={H2}>
                    Water problem today? Get a technician today.
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-gray-600">
                    Compare technicians in {cityShort}, check who is Live and book online with {BRAND}.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-4">
                  <Link href="/book" className={BTN_PRIMARY}>
                    Book a technician
                  </Link>
                  {WA_LINK && (
                    <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className={BTN_SOFT}>
                      WhatsApp
                    </a>
                  )}
                  {PHONE && (
                    <a href={`tel:${PHONE}`} className={BTN_SOFT}>
                      Call
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* Spacer so the mobile bar never hides the last content */}
            <div aria-hidden className="h-20 md:hidden" />
          </div>
        </div>

        {/* Sticky mobile action bar: the easiest way to turn a visit into a booking */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 bg-[#E4F1EB]/95 px-4 pt-3 shadow-[0_-6px_16px_#BFCFC7] backdrop-blur md:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <Link href="/book" className={`${BTN_PRIMARY} flex-1`}>
            Book now
          </Link>
          {WA_LINK && (
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className={BTN_SOFT}>
              WhatsApp
            </a>
          )}
          {PHONE && (
            <a href={`tel:${PHONE}`} aria-label="Call us" className={BTN_SOFT}>
              Call
            </a>
          )}
        </div>
      </TechniciansClient>
    </div>
  );
}







// 'use client';

// import React, { useMemo, useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { getTechnicians } from '@/lib/api-client';

// type ServiceKey = 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';

// type Technician = {
//   id: string;
//   name: string;
//   initials: string;
//   skills: string[];
//   city: string;
//   rating: number;
//   jobs: number;
//   verified: boolean;
//   available: boolean;
//   preferredServiceKey: ServiceKey;
//   speciality: string;
//   experience: string;
// };

// const GRADIENT_PAIRS: [string, string][] = [
//   ['#0D9B6C', '#065F46'],
//   ['#0369A1', '#0C4A6E'],
//   ['#7C3AED', '#4C1D95'],
//   ['#DC2626', '#7F1D1D'],
//   ['#D97706', '#78350F'],
// ];

// const UP_CITIES = ['Kanpur', 'Gorakhpur', 'Lucknow'] as const;

// const SKILL_ICONS: Record<string, string> = {
//   'Plumbing': '🔧',
//   'RO Service': '💧',
//   'Borewell': '⛏️',
//   'Motor Repair': '⚙️',
//   'Water Tanker': '🚰',
//   'Tank Cleaning': '🪣',
// };

// function pickGradient(name: string): [string, string] {
//   return GRADIENT_PAIRS[(name.charCodeAt(0) || 0) % GRADIENT_PAIRS.length];
// }

// function StarRating({ rating }: { rating: number }) {
//   return (
//     <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
//       {[1, 2, 3, 4, 5].map((star) => (
//         <svg key={star} width="12" height="12" viewBox="0 0 12 12" fill="none">
//           <polygon
//             points="6,1 7.5,4.5 11,5 8.5,7.5 9.2,11 6,9.2 2.8,11 3.5,7.5 1,5 4.5,4.5"
//             fill={star <= Math.round(rating) ? '#F59E0B' : '#E5E7EB'}
//           />
//         </svg>
//       ))}
//     </span>
//   );
// }

// function Avatar({ name, initials }: { name: string; initials: string }) {
//   const [from, to] = pickGradient(name);
//   return (
//     <div
//       style={{
//         width: 56,
//         height: 56,
//         borderRadius: '50%',
//         background: `linear-gradient(135deg, ${from}, ${to})`,
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         color: '#fff',
//         fontWeight: 800,
//         fontSize: 18,
//         letterSpacing: '-0.5px',
//         flexShrink: 0,
//         boxShadow: `0 4px 14px ${from}55`,
//       }}
//     >
//       {initials}
//     </div>
//   );
// }

// function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'green' | 'default' | 'muted' }) {
//   const styles: Record<string, React.CSSProperties> = {
//     green: { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' },
//     default: { background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' },
//     muted: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' },
//   };
//   return (
//     <span
//       style={{
//         ...styles[variant],
//         padding: '3px 10px',
//         borderRadius: 999,
//         fontSize: 11,
//         fontWeight: 700,
//         letterSpacing: '0.02em',
//         display: 'inline-flex',
//         alignItems: 'center',
//         gap: 4,
//         whiteSpace: 'nowrap',
//       }}
//     >
//       {children}
//     </span>
//   );
// }

// function TechnicianCard({ t, onBook }: { t: Technician; onBook: (key: ServiceKey) => void }) {
//   const [hovered, setHovered] = useState(false);
//   const [from] = pickGradient(t.name);

//   return (
//     <article
//       onMouseEnter={() => setHovered(true)}
//       onMouseLeave={() => setHovered(false)}
//       style={{
//         background: '#fff',
//         borderRadius: 20,
//         border: '1.5px solid',
//         borderColor: hovered ? '#0D9B6C' : '#F3F4F6',
//         boxShadow: hovered
//           ? '0 20px 48px rgba(13,155,108,0.12), 0 4px 16px rgba(0,0,0,0.06)'
//           : '0 2px 12px rgba(0,0,0,0.06)',
//         padding: 0,
//         overflow: 'hidden',
//         transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
//         transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
//         display: 'flex',
//         flexDirection: 'column',
//       }}
//     >
//       {/* Top accent bar */}
//       <div
//         style={{
//           height: 4,
//           background: t.available
//             ? 'linear-gradient(90deg, #0D9B6C, #34D399)'
//             : 'linear-gradient(90deg, #D1D5DB, #9CA3AF)',
//         }}
//       />

//       <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
//         {/* Header row */}
//         <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//             <Avatar name={t.name} initials={t.initials} />
//             <div>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
//                 <span style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.3px' }}>
//                   {t.name}
//                 </span>
//                 {t.verified && (
//                   <span
//                     style={{
//                       display: 'inline-flex',
//                       alignItems: 'center',
//                       gap: 3,
//                       background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
//                       color: '#065F46',
//                       fontSize: 10,
//                       fontWeight: 800,
//                       padding: '2px 7px',
//                       borderRadius: 999,
//                       border: '1px solid #6EE7B7',
//                       letterSpacing: '0.05em',
//                     }}
//                   >
//                     <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
//                       <path d="M1.5 4L3 5.5L6.5 2.5" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//                     </svg>
//                     VERIFIED
//                   </span>
//                 )}
//               </div>
//               <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
//                 <StarRating rating={t.rating} />
//                 <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{t.rating.toFixed(1)}</span>
//                 <span style={{ color: '#D1D5DB', fontSize: 11 }}>•</span>
//                 <span style={{ fontSize: 12, color: '#6B7280' }}>{t.jobs} jobs</span>
//               </div>
//             </div>
//           </div>

//           {/* Availability dot + label */}
//           <div
//             style={{
//               display: 'flex',
//               flexDirection: 'column',
//               alignItems: 'center',
//               gap: 4,
//               flexShrink: 0,
//             }}
//           >
//             <div
//               style={{
//                 width: 10,
//                 height: 10,
//                 borderRadius: '50%',
//                 background: t.available ? '#10B981' : '#D1D5DB',
//                 boxShadow: t.available ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none',
//                 animation: t.available ? 'pulse 2s infinite' : 'none',
//               }}
//             />
//             <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: t.available ? '#059669' : '#9CA3AF' }}>
//               {t.available ? 'LIVE' : 'BUSY'}
//             </span>
//           </div>
//         </div>

//         {/* City + experience */}
//         <div
//           style={{
//             background: '#F9FAFB',
//             borderRadius: 10,
//             padding: '10px 14px',
//             display: 'flex',
//             justifyContent: 'space-between',
//             alignItems: 'center',
//           }}
//         >
//           <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
//             <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
//               <path
//                 d="M6.5 1.5C4.567 1.5 3 3.067 3 5c0 2.25 3.5 6.5 3.5 6.5S10 7.25 10 5c0-1.933-1.567-3.5-3.5-3.5zm0 4.75c-.69 0-1.25-.56-1.25-1.25S5.81 3.75 6.5 3.75 7.75 4.31 7.75 5 7.19 6.25 6.5 6.25z"
//                 fill="#9CA3AF"
//               />
//             </svg>
//             <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{t.city}</span>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
//             <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
//               <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" strokeWidth="1.2" />
//               <path d="M6.5 3.5v3.2l2 2" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" />
//             </svg>
//             <span style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{t.experience}</span>
//           </div>
//         </div>

//         {/* Skill tags */}
//         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
//           {t.skills.map((s) => (
//             <span
//               key={s}
//               style={{
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 gap: 5,
//                 fontSize: 11,
//                 fontWeight: 700,
//                 color: '#374151',
//                 background: '#fff',
//                 border: '1.5px solid #E5E7EB',
//                 padding: '4px 10px',
//                 borderRadius: 999,
//                 letterSpacing: '0.02em',
//               }}
//             >
//               <span style={{ fontSize: 12 }}>{SKILL_ICONS[s] ?? '🔩'}</span>
//               {s}
//             </span>
//           ))}
//         </div>

//         {/* Speciality line */}
//         <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5, fontStyle: 'italic' }}>
//           "{t.speciality}"
//         </p>

//         {/* CTA */}
//         <button
//           type="button"
//           onClick={() => onBook(t.preferredServiceKey)}
//           style={{
//             width: '100%',
//             padding: '12px 0',
//             borderRadius: 12,
//             background: t.available
//               ? 'linear-gradient(135deg, #0D9B6C, #059652)'
//               : '#F3F4F6',
//             color: t.available ? '#fff' : '#9CA3AF',
//             fontWeight: 800,
//             fontSize: 14,
//             letterSpacing: '-0.2px',
//             border: 'none',
//             cursor: t.available ? 'pointer' : 'not-allowed',
//             transition: 'all 0.2s ease',
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//             gap: 8,
//             boxShadow: t.available ? '0 4px 14px rgba(13,155,108,0.35)' : 'none',
//           }}
//           onMouseEnter={(e) => {
//             if (t.available) {
//               (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(13,155,108,0.5)';
//               (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.01)';
//             }
//           }}
//           onMouseLeave={(e) => {
//             if (t.available) {
//               (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(13,155,108,0.35)';
//               (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
//             }
//           }}
//         >
//           {t.available ? (
//             <>
//               <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//                 <rect x="1.5" y="3.5" width="11" height="9" rx="1.5" stroke="#fff" strokeWidth="1.3" />
//                 <path d="M5 3V2M9 3V2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
//                 <path d="M1.5 6.5h11" stroke="#fff" strokeWidth="1.3" />
//               </svg>
//               Book Now
//             </>
//           ) : (
//             'Currently Unavailable'
//           )}
//         </button>
//       </div>
//     </article>
//   );
// }

// function FilterSelect({
//   label,
//   value,
//   onChange,
//   options,
//   allLabel,
// }: {
//   label: string;
//   value: string;
//   onChange: (v: string) => void;
//   options: string[];
//   allLabel: string;
// }) {
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
//       <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
//         {label}
//       </label>
//       <div style={{ position: 'relative' }}>
//         <select
//           value={value}
//           onChange={(e) => onChange(e.target.value)}
//           style={{
//             width: '100%',
//             appearance: 'none',
//             background: '#fff',
//             border: '1.5px solid #E5E7EB',
//             borderRadius: 12,
//             padding: '10px 36px 10px 14px',
//             fontSize: 14,
//             fontWeight: 600,
//             color: '#111827',
//             cursor: 'pointer',
//             outline: 'none',
//             transition: 'border-color 0.2s',
//           }}
//           onFocus={(e) => { e.currentTarget.style.borderColor = '#0D9B6C'; }}
//           onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
//         >
//           <option value="All">{allLabel}</option>
//           {options.map((o) => <option key={o} value={o}>{o}</option>)}
//         </select>
//         <svg
//           style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
//           width="14" height="14" viewBox="0 0 14 14" fill="none"
//         >
//           <path d="M3.5 5.5L7 9L10.5 5.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       </div>
//     </div>
//   );
// }

// export default function TechniciansPage() {
//   const router = useRouter();
//   const [mounted, setMounted] = useState(false);
//   const [skill, setSkill] = useState<string>('All');
//   const [city, setCity] = useState<string>('All');
//   const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
//   const [searchQuery, setSearchQuery] = useState<string>('');

//   const [techs, setTechs] = useState<Technician[]>([]);
//   const [listLoading, setListLoading] = useState(true);

//   useEffect(() => { setMounted(true); }, []);

//   useEffect(() => {
//     let cancelled = false;
//     void getTechnicians()
//       .then((rows) => {
//         if (cancelled) return;
//         const mapped: Technician[] = (Array.isArray(rows) ? rows : []).map((raw) => {
//           const r = raw as Partial<Technician> & { name?: string; id?: string };
//           const name = r.name || 'Technician';
//           const initials =
//             r.initials ||
//             name
//               .split(/\s+/)
//               .slice(0, 2)
//               .map((p) => p[0]?.toUpperCase() ?? '')
//               .join('');
//           return {
//             id: String(r.id ?? name),
//             name,
//             initials,
//             skills: r.skills?.length ? r.skills : ['Plumbing'],
//             city: r.city || 'Uttar Pradesh',
//             rating: typeof r.rating === 'number' ? r.rating : 4.8,
//             jobs: typeof r.jobs === 'number' ? r.jobs : 0,
//             verified: r.verified !== false,
//             available: r.available !== false,
//             preferredServiceKey: (r.preferredServiceKey as ServiceKey) || 'plumbing',
//             speciality: r.speciality || 'AuroWater technician',
//             experience: r.experience || 'On platform',
//           };
//         });
//         setTechs(mapped);
//       })
//       .catch(() => {
//         if (!cancelled) setTechs([]);
//       })
//       .finally(() => {
//         if (!cancelled) setListLoading(false);
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   const allSkills = useMemo(() => {
//     const set = new Set<string>();
//     techs.forEach((t) => t.skills.forEach((s) => set.add(s)));
//     return Array.from(set).sort();
//   }, [techs]);

//   const filtered = useMemo(() => {
//     return techs.filter((t) => {
//       if (onlyAvailable && !t.available) return false;
//       if (city !== 'All' && t.city !== city) return false;
//       if (skill !== 'All' && !t.skills.includes(skill)) return false;
//       if (searchQuery.trim()) {
//         const q = searchQuery.toLowerCase();
//         if (!t.name.toLowerCase().includes(q) && !t.city.toLowerCase().includes(q) && !t.skills.some((s) => s.toLowerCase().includes(q))) return false;
//       }
//       return true;
//     });
//   }, [techs, onlyAvailable, city, skill, searchQuery]);

//   const availableCount = techs.filter((t) => t.available).length;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

//         .tech-page * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }

//         @keyframes pulse {
//           0%, 100% { opacity: 1; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
//           50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(16,185,129,0.08); }
//         }

//         @keyframes fadeUp {
//           from { opacity: 0; transform: translateY(24px); }
//           to { opacity: 1; transform: translateY(0); }
//         }

//         @keyframes shimmer {
//           0% { background-position: -200% 0; }
//           100% { background-position: 200% 0; }
//         }

//         .tech-page .card-grid > article {
//           animation: fadeUp 0.5s ease both;
//         }

//         .tech-page .card-grid > article:nth-child(1) { animation-delay: 0ms; }
//         .tech-page .card-grid > article:nth-child(2) { animation-delay: 60ms; }
//         .tech-page .card-grid > article:nth-child(3) { animation-delay: 120ms; }
//         .tech-page .card-grid > article:nth-child(4) { animation-delay: 180ms; }
//         .tech-page .card-grid > article:nth-child(5) { animation-delay: 240ms; }
//         .tech-page .card-grid > article:nth-child(6) { animation-delay: 300ms; }

//         .tech-page .hero-badge {
//           animation: fadeUp 0.4s ease both;
//         }

//         .tech-page input:focus, .tech-page select:focus {
//           outline: none;
//           border-color: #0D9B6C !important;
//           box-shadow: 0 0 0 3px rgba(13,155,108,0.12);
//         }
//       `}</style>

//       <div
//         className="tech-page"
//         style={{
//           minHeight: '100vh',
//           background: 'linear-gradient(180deg, #F0FDF8 0%, #F9FAFB 60%, #fff 100%)',
//         }}
//       >
//         {/* ── Hero section ── */}
//         <div
//           style={{
//             position: 'relative',
//             overflow: 'hidden',
//             background: 'linear-gradient(135deg, #022C22 0%, #064E3B 50%, #065F46 100%)',
//             padding: '64px 24px 80px',
//           }}
//         >
//           {/* decorative circles */}
//           {[
//             { w: 400, h: 400, top: -120, right: -100, opacity: 0.07 },
//             { w: 200, h: 200, bottom: -60, left: -40, opacity: 0.05 },
//             { w: 150, h: 150, top: 40, left: '40%', opacity: 0.04 },
//           ].map((circle, i) => (
//             <div
//               key={i}
//               style={{
//                 position: 'absolute',
//                 width: circle.w,
//                 height: circle.h,
//                 top: circle.top,
//                 right: circle.right,
//                 bottom: circle.bottom,
//                 left: circle.left,
//                 borderRadius: '50%',
//                 background: '#34D399',
//                 opacity: circle.opacity,
//                 pointerEvents: 'none',
//               }}
//             />
//           ))}

//           {/* grid dots overlay */}
//           <div
//             style={{
//               position: 'absolute',
//               inset: 0,
//               opacity: 0.06,
//               backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
//               backgroundSize: '28px 28px',
//               pointerEvents: 'none',
//             }}
//           />

//           <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
//             {/* Live badge */}
//             <div
//               className="hero-badge"
//               style={{
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 gap: 8,
//                 background: 'rgba(52,211,153,0.15)',
//                 border: '1px solid rgba(52,211,153,0.35)',
//                 borderRadius: 999,
//                 padding: '6px 14px',
//                 marginBottom: 20,
//               }}
//             >
//               <span
//                 style={{
//                   width: 7,
//                   height: 7,
//                   borderRadius: '50%',
//                   background: '#34D399',
//                   display: 'inline-block',
//                   animation: 'pulse 2s infinite',
//                 }}
//               />
//               <span style={{ fontSize: 12, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.06em' }}>
//                 {availableCount} TECHNICIANS AVAILABLE NOW
//               </span>
//             </div>

//             <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
//               <div>
//                 <h1
//                   style={{
//                     margin: 0,
//                     fontSize: 'clamp(2rem, 5vw, 3.5rem)',
//                     fontWeight: 900,
//                     color: '#fff',
//                     letterSpacing: '-1.5px',
//                     lineHeight: 1.1,
//                   }}
//                 >
//                   Find Expert
//                   <br />
//                   <span style={{ color: '#34D399' }}>Water Technicians</span>
//                 </h1>
//                 <p style={{ margin: '16px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.65)', maxWidth: 460, lineHeight: 1.6 }}>
//                   Browse professionals listed for currently supported service zones. Profiles and availability are loaded from the service directory.
//                 </p>
//               </div>

//               <button
//                 type="button"
//                 onClick={() => router.push('/register/pro?type=technician')}
//                 style={{
//                   display: 'inline-flex',
//                   alignItems: 'center',
//                   gap: 8,
//                   background: '#fff',
//                   color: '#065F46',
//                   fontWeight: 800,
//                   fontSize: 14,
//                   padding: '13px 22px',
//                   borderRadius: 12,
//                   border: 'none',
//                   cursor: 'pointer',
//                   boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
//                   letterSpacing: '-0.2px',
//                   transition: 'all 0.2s',
//                   whiteSpace: 'nowrap',
//                 }}
//                 onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
//                 onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
//               >
//                 <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                   <circle cx="8" cy="6" r="3" stroke="#065F46" strokeWidth="1.5" />
//                   <path d="M2.5 14c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" />
//                 </svg>
//                 Join as Technician
//               </button>
//             </div>

//             {/* Stats row */}
//             <div
//               style={{
//                 display: 'flex',
//                 flexWrap: 'wrap',
//                 gap: 16,
//                 marginTop: 36,
//                 paddingTop: 32,
//                 borderTop: '1px solid rgba(255,255,255,0.1)',
//               }}
//             >
//               {[
//                 { label: 'Active Technicians', value: techs.length },
//                 { label: 'Cities Covered', value: UP_CITIES.length },
//                 { label: 'Service Categories', value: '6' },
//                 { label: 'Service Zones', value: String(UP_CITIES.length) },
//               ].map((stat) => (
//                 <div key={stat.label} style={{ minWidth: 120 }}>
//                   <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{stat.value}</div>
//                   <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: 500 }}>{stat.label}</div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* ── Filter bar ── */}
//         <div style={{ maxWidth: 1200, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 10 }}>
//           <div
//             style={{
//               background: '#fff',
//               borderRadius: 18,
//               border: '1.5px solid #E5E7EB',
//               boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
//               padding: '20px 24px',
//             }}
//           >
//             <div
//               style={{
//                 display: 'grid',
//                 gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
//                 gap: 16,
//                 alignItems: 'end',
//               }}
//             >
//               {/* Search */}
//               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
//                 <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
//                   Search
//                 </label>
//                 <div style={{ position: 'relative' }}>
//                   <svg
//                     style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
//                     width="14" height="14" viewBox="0 0 14 14" fill="none"
//                   >
//                     <circle cx="6" cy="6" r="4.5" stroke="#9CA3AF" strokeWidth="1.4" />
//                     <path d="M10 10L12.5 12.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" />
//                   </svg>
//                   <input
//                     type="text"
//                     placeholder="Name, city or skill..."
//                     value={searchQuery}
//                     onChange={(e) => setSearchQuery(e.target.value)}
//                     style={{
//                       width: '100%',
//                       background: '#fff',
//                       border: '1.5px solid #E5E7EB',
//                       borderRadius: 12,
//                       padding: '10px 14px 10px 34px',
//                       fontSize: 14,
//                       fontWeight: 600,
//                       color: '#111827',
//                       outline: 'none',
//                       transition: 'border-color 0.2s',
//                     }}
//                   />
//                 </div>
//               </div>

//               <FilterSelect
//                 label="Skill"
//                 value={skill}
//                 onChange={setSkill}
//                 options={allSkills}
//                 allLabel="All skills"
//               />

//               <FilterSelect
//                 label="City"
//                 value={city}
//                 onChange={setCity}
//                 options={[...UP_CITIES]}
//                 allLabel="All cities"
//               />

//               {/* Availability toggle */}
//               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
//                 <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
//                   Availability
//                 </label>
//                 <button
//                   type="button"
//                   onClick={() => setOnlyAvailable((v) => !v)}
//                   style={{
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'space-between',
//                     gap: 10,
//                     padding: '10px 14px',
//                     borderRadius: 12,
//                     border: `1.5px solid ${onlyAvailable ? '#0D9B6C' : '#E5E7EB'}`,
//                     background: onlyAvailable ? '#ECFDF5' : '#fff',
//                     color: onlyAvailable ? '#065F46' : '#6B7280',
//                     fontSize: 14,
//                     fontWeight: 700,
//                     cursor: 'pointer',
//                     transition: 'all 0.2s',
//                   }}
//                 >
//                   <span>{onlyAvailable ? 'Available only' : 'Show all'}</span>
//                   {/* Toggle pill */}
//                   <div
//                     style={{
//                       width: 34,
//                       height: 18,
//                       borderRadius: 999,
//                       background: onlyAvailable ? '#0D9B6C' : '#D1D5DB',
//                       position: 'relative',
//                       transition: 'background 0.2s',
//                       flexShrink: 0,
//                     }}
//                   >
//                     <div
//                       style={{
//                         position: 'absolute',
//                         width: 12,
//                         height: 12,
//                         borderRadius: '50%',
//                         background: '#fff',
//                         top: 3,
//                         left: onlyAvailable ? 19 : 3,
//                         transition: 'left 0.2s',
//                         boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
//                       }}
//                     />
//                   </div>
//                 </button>
//               </div>
//             </div>

//             {/* Active filters + result count */}
//             <div
//               style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 justifyContent: 'space-between',
//                 marginTop: 14,
//                 paddingTop: 14,
//                 borderTop: '1px solid #F3F4F6',
//                 flexWrap: 'wrap',
//                 gap: 8,
//               }}
//             >
//               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
//                 <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>Active filters:</span>
//                 {skill !== 'All' && <Badge variant="green">{skill}</Badge>}
//                 {city !== 'All' && <Badge variant="green">{city}</Badge>}
//                 {onlyAvailable && <Badge variant="green">Available now</Badge>}
//                 {searchQuery && <Badge variant="green">"{searchQuery}"</Badge>}
//                 {skill === 'All' && city === 'All' && !onlyAvailable && !searchQuery && (
//                   <span style={{ fontSize: 12, color: '#D1D5DB' }}>None</span>
//                 )}
//               </div>
//               <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
//                 {filtered.length} technician{filtered.length !== 1 ? 's' : ''} found
//               </span>
//             </div>
//           </div>
//         </div>

//         {/* ── Grid ── */}
//         <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px' }}>
//           {listLoading ? (
//             <p style={{ textAlign: 'center', color: '#6B7280', padding: 48 }}>Loading technicians…</p>
//           ) : filtered.length > 0 ? (
//             <div
//               className="card-grid"
//               style={{
//                 display: 'grid',
//                 gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
//                 gap: 22,
//               }}
//             >
//               {filtered.map((t) => (
//                 <TechnicianCard
//                   key={t.id}
//                   t={t}
//                   onBook={(key) => router.push(`/book?service=${encodeURIComponent(key)}`)}
//                 />
//               ))}
//             </div>
//           ) : (
//             <div
//               style={{
//                 textAlign: 'center',
//                 padding: '72px 24px',
//                 background: '#fff',
//                 borderRadius: 20,
//                 border: '1.5px dashed #E5E7EB',
//               }}
//             >
//               <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
//               <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
//                 {techs.length === 0 ? 'No technicians on the platform yet' : 'No technicians found'}
//               </h3>
//               <p style={{ margin: '8px 0 24px', color: '#6B7280', fontSize: 14 }}>
//                 {techs.length === 0
//                   ? 'Approved technicians from Supabase will appear here. Join as a technician from Register.'
//                   : 'Try adjusting your filters or search query.'}
//               </p>
//                 {techs.length === 0 ? (
//                   <a
//                     href="/register"
//                     style={{
//                       background: '#0D9B6C',
//                       color: '#fff',
//                       fontWeight: 800,
//                       fontSize: 14,
//                       padding: '10px 24px',
//                       borderRadius: 12,
//                       textDecoration: 'none',
//                       display: 'inline-block',
//                     }}
//                   >
//                     Become a technician
//                   </a>
//                 ) : (
//               <button
//                 type="button"
//                 onClick={() => { setSkill('All'); setCity('All'); setOnlyAvailable(false); setSearchQuery(''); }}
//                 style={{
//                   background: '#0D9B6C',
//                   color: '#fff',
//                   fontWeight: 800,
//                   fontSize: 14,
//                   padding: '10px 24px',
//                   borderRadius: 12,
//                   border: 'none',
//                   cursor: 'pointer',
//                 }}
//               >
//                 Clear all filters
//               </button>
//                 )}
//             </div>
//           )}
//         </div>

//         {/* ── CTA Banner ── */}
//         <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px' }}>
//           <div
//             style={{
//               borderRadius: 24,
//               background: 'linear-gradient(135deg, #022C22 0%, #065F46 60%, #0D9B6C 100%)',
//               padding: '48px 40px',
//               position: 'relative',
//               overflow: 'hidden',
//             }}
//           >
//             {/* decorative */}
//             <div
//               style={{
//                 position: 'absolute',
//                 inset: 0,
//                 opacity: 0.05,
//                 backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
//                 backgroundSize: '24px 24px',
//                 pointerEvents: 'none',
//               }}
//             />
//             <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: '#34D399', opacity: 0.08, pointerEvents: 'none' }} />

//             <div
//               style={{
//                 position: 'relative',
//                 zIndex: 1,
//                 display: 'flex',
//                 flexWrap: 'wrap',
//                 alignItems: 'center',
//                 justifyContent: 'space-between',
//                 gap: 24,
//               }}
//             >
//               <div>
//                 <div
//                   style={{
//                     display: 'inline-flex',
//                     alignItems: 'center',
//                     gap: 6,
//                     background: 'rgba(52,211,153,0.15)',
//                     border: '1px solid rgba(52,211,153,0.3)',
//                     borderRadius: 999,
//                     padding: '4px 12px',
//                     marginBottom: 12,
//                   }}
//                 >
//                   <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.07em' }}>
//                     🏆 EARN ₹30,000+ / MONTH
//                   </span>
//                 </div>
//                 <h2 style={{ margin: 0, fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
//                   Want to join our expert team?
//                 </h2>
//                 <p style={{ margin: '10px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
//                   Help customers get clean water and reliable repairs. Flexible hours, great pay, and a growing community.
//                 </p>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => router.push('/register/pro?type=technician')}
//                 style={{
//                   background: '#fff',
//                   color: '#065F46',
//                   fontWeight: 800,
//                   fontSize: 15,
//                   padding: '14px 28px',
//                   borderRadius: 14,
//                   border: 'none',
//                   cursor: 'pointer',
//                   boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
//                   whiteSpace: 'nowrap',
//                   display: 'flex',
//                   alignItems: 'center',
//                   gap: 8,
//                   transition: 'all 0.2s',
//                   letterSpacing: '-0.2px',
//                 }}
//                 onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.25)'; }}
//                 onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
//               >
//                 Start Onboarding
//                 <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                   <path d="M3 8h10M9 4l4 4-4 4" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//                 </svg>
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }
