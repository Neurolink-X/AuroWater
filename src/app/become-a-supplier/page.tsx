import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

/**
 * src/app/become-a-supplier/page.tsx: public, indexable recruitment page.
 *
 * SEO: unique title and description, canonical URL, Open Graph and Twitter tags, one H1,
 * semantic headings, crawlable FAQ and JSON-LD (WebPage, BreadcrumbList, FAQPage). Fully static,
 * so it is served from the CDN and loads fast on low-end phones.
 *
 * Set NEXT_PUBLIC_SITE_URL so canonical and JSON-LD URLs are absolute. Add an
 * opengraph-image.png next to this file for rich link previews.
 *
 * Copy only states what the portal does today (orders, inventory, dispatch availability,
 * earnings, account review). Do not add commission, pricing or payout promises unless the
 * business has confirmed them.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
const PATH = '/become-a-supplier';
const TITLE = 'Become a Water Can Supplier Partner | AuroTap';
const DESCRIPTION =
  'Join AuroTap as a water can supplier. Receive delivery orders, manage live inventory and dispatch availability, and track earnings from one dashboard.';

export const metadata: Metadata = {
  ...(SITE ? { metadataBase: new URL(SITE) } : {}),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ['water can supplier', 'water can delivery', 'RO water supplier', '20 litre water can', 'water distributor', 'supplier partner'],
  alternates: { canonical: PATH },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: PATH, siteName: 'AuroTap', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' } },
};

export const revalidate = 86400;

const FEATURES = [
  { emoji: '📦', title: 'Delivery orders', text: 'See the water can orders sent to you and manage each delivery from start to finish.' },
  { emoji: '🧊', title: 'Live inventory', text: 'Keep your stock up to date so you only take the orders you can fulfil.' },
  { emoji: '🚚', title: 'Dispatch availability', text: 'Control when you are available to dispatch, and pause when you need to.' },
  { emoji: '💰', title: 'Earnings in one place', text: 'Track what you have earned from completed deliveries without keeping paper records.' },
];

const STEPS = [
  { title: 'Sign in and create your supplier account', text: 'Use your phone number to get started.' },
  { title: 'Share your business details', text: 'Tell us about your plant or distribution business and where you deliver.' },
  { title: 'Wait for account review', text: 'Our team reviews new supplier accounts before they go live.' },
  { title: 'Go live and start delivering', text: 'Once approved, set your inventory and availability, and orders can reach you.' },
];

const FAQS = [
  { q: 'Who can join AuroTap as a supplier?', a: 'Businesses that supply and deliver water cans, such as RO plants and distributors, can apply.' },
  { q: 'Do new accounts go live straight away?', a: 'No. New supplier accounts are reviewed by our team first, and you can start once your account is approved.' },
  { q: 'How do I receive orders?', a: 'Orders appear in your supplier portal. You manage deliveries, inventory and availability from the same place.' },
  { q: 'Can I pause when I am out of stock or busy?', a: 'Yes. You can manage your dispatch availability and keep your inventory up to date in the portal.' },
  { q: 'Where can I see what I have earned?', a: 'The Earnings section of the portal shows your earnings from completed deliveries.' },
];

const abs = (path: string) => `${SITE}${path}`;
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${abs(PATH)}#webpage`,
      url: abs(PATH),
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'en-IN',
      isPartOf: SITE ? { '@type': 'WebSite', url: SITE, name: 'AuroTap' } : undefined,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE ? `${SITE}/` : '/' },
        { '@type': 'ListItem', position: 2, name: 'Become a supplier', item: abs(PATH) },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};

const cta =
  'inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2';

export default function BecomeSupplierPage() {
  return (
    <main className="bg-[#F4FAF7] text-slate-900">
      <script
        type="application/ld+json"
        // Escape "<" so content can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      <section className="relative isolate overflow-hidden border-b border-emerald-100 bg-gradient-to-b from-emerald-50 via-[#F4FAF7] to-[#F4FAF7]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_85%_0%,rgba(20,184,166,0.16),transparent),radial-gradient(40%_50%_at_10%_0%,rgba(251,191,36,0.10),transparent)]"
        />
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
            <ol className="flex items-center gap-2">
              <li><Link href="/" className="hover:text-slate-800 hover:underline">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-slate-700">Become a supplier</li>
            </ol>
          </nav>
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Grow your water can business with AuroTap.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Receive delivery orders, keep live inventory and manage your dispatch availability from one simple, mobile-friendly supplier portal.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/login" className={`${cta} bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700`}>Sign in to get started</Link>
            <a href="#how-it-works" className={`${cta} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>See how it works</a>
          </div>
        </div>
      </section>

      {/* Real locally hosted service imagery; no remote stock photo request,
          custom image proxy, or layout shift. All images come from the
          existing service asset pipeline and use responsive Next.js sizes. */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16"
        aria-labelledby="supplier-operations-title">
        <div className="mb-7 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">
            Built around daily operations
          </p>
          <h2 id="supplier-operations-title"
            className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Clear orders. Reliable stock information. Better dispatch control.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Use the supplier portal to receive eligible orders, manage water-can
            inventory and update availability. Coverage and account approval are
            verified before you start receiving assignments.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              src: '/images/water_can.webp',
              alt: '20 litre drinking water cans prepared for customer delivery',
              title: '20L water can delivery',
              detail: 'Manage quantities and stock availability for water-can orders.',
            },
            {
              src: '/images/water_tanker.webp',
              alt: 'Water tanker used for bulk water delivery services',
              title: 'Bulk water requests',
              detail: 'Understand coverage and keep your service offerings accurate.',
            },
            {
              src: '/images/ro_service.webp',
              alt: 'Water purifier maintenance and RO service equipment',
              title: 'Service coordination',
              detail: 'Separate available services from unsupported requests.',
            },
          ].map((service) => (
            <article key={service.title}
              className="group min-w-0 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm
                transition-shadow hover:shadow-md">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-emerald-50">
                <Image src={service.src} alt={service.alt} fill
                  sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 48vw, 310px"
                  quality={82} loading="lazy"
                  className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]" />
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold leading-6 text-slate-950">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {service.detail}
                </p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Service images are illustrative; available work depends on your
          registration, service coverage and operational approval.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6" aria-labelledby="features-title">
        <h2 id="features-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Everything you need to run deliveries</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-2xl" aria-hidden="true">{f.emoji}</span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="how-it-works" className="scroll-mt-4 border-y border-emerald-100 bg-white" aria-labelledby="how-title">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="how-title" className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-[#F4FAF7] p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                {f.q}
                <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Ready to deliver with AuroTap?</h2>
            <p className="mt-1 text-emerald-50">Sign in, share your business details and get reviewed.</p>
          </div>
          <Link href="/auth/login" className={`${cta} bg-white text-emerald-800 hover:bg-emerald-50`}>Sign in to get started</Link>
        </div>
      </section>
    </main>
  );
}
