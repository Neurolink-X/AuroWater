import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

type ServiceDetail = {
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  startingPrice: string;
  unit: string;
  icon: string;
  accent: string;
  benefits: string[];
  process: string[];
  faqs: { question: string; answer: string }[];
};

const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  water_can: {
    key: 'water_can', title: '20L Water Can Delivery', eyebrow: 'Daily drinking water',
    description: 'Order sealed drinking-water cans for home or workplace with clear pricing and delivery details before you confirm.',
    startingPrice: '₹10', unit: 'per can (indicative)', icon: '💧', accent: '#0284c7',
    benefits: ['Order when you need it; no subscription required', 'Choose your delivery address and available slot', 'Review the final amount before confirming', 'Track your order from your account'],
    process: ['Choose your quantity', 'Confirm address and available slot', 'Review price and place your order'],
    faqs: [
      { question: 'Can I order without a subscription?', answer: 'Yes. Choose a one-time booking in the booking flow when available.' },
      { question: 'When is the final price shown?', answer: 'The booking flow should show the applicable price and charges before you confirm.' },
    ],
  },
  water_tanker: {
    key: 'water_tanker', title: 'Water Tanker Delivery', eyebrow: 'Bulk water supply',
    description: 'Request bulk water delivery for homes, apartments, offices, construction sites and events. Availability depends on your delivery location and capacity needs.',
    startingPrice: '₹299', unit: 'indicative starting rate', icon: '🚚', accent: '#0284c7',
    benefits: ['Share the volume you need', 'Confirm delivery access and location', 'See available options before confirming', 'Keep booking details in one account'],
    process: ['Choose tanker service and volume', 'Provide delivery address and timing', 'Confirm the available quote and booking'],
    faqs: [{ question: 'Is every tanker size available everywhere?', answer: 'No. Available volume and delivery options depend on the location and supplier.' }],
  },
  ro_service: {
    key: 'ro_service', title: 'RO Service & Repair', eyebrow: 'Water purifier care',
    description: 'Request water-purifier diagnostics, filter service or repairs. The technician can assess the unit and confirm any parts or additional work before proceeding.',
    startingPrice: '₹199', unit: 'indicative starting visit rate', icon: '🛠️', accent: '#0369a1',
    benefits: ['Describe your purifier issue', 'Request diagnostics and filter service', 'Confirm repair scope before work', 'Keep service history with your account'],
    process: ['Choose the RO issue or service type', 'Select address and a suitable slot', 'Review the visit details and confirm'],
    faqs: [{ question: 'Are filters included in the starting rate?', answer: 'Replacement parts may cost extra. Confirm the itemised estimate before approving repairs.' }],
  },
  plumbing: {
    key: 'plumbing', title: 'Plumbing Services', eyebrow: 'Home water systems',
    description: 'Book help for leaking taps, pipe issues, fittings, blockages and routine plumbing work, subject to local service availability.',
    startingPrice: '₹149', unit: 'indicative starting visit rate', icon: '🔧', accent: '#1e40af',
    benefits: ['Describe the issue before the visit', 'Request help with common household plumbing', 'Review any additional work estimate', 'Keep booking updates in one place'],
    process: ['Select the issue and add details', 'Choose your address and available slot', 'Review the estimate and confirm'],
    faqs: [{ question: 'Does the visit price include materials?', answer: 'Materials and additional work may be charged separately. Confirm the estimate with the service professional.' }],
  },
  borewell: {
    key: 'borewell', title: 'Borewell Services', eyebrow: 'Borewell installation and repair',
    description: 'Submit a request for borewell inspection, repair or installation. The scope, equipment and final quote depend on the site and job requirements.',
    startingPrice: '₹499', unit: 'indicative starting rate', icon: '⛏️', accent: '#1d4ed8',
    benefits: ['Explain the site and issue in advance', 'Request inspection or repair support', 'Confirm scope before major work', 'Access booking details after confirmation'],
    process: ['Choose inspection, repair or installation', 'Share site location and job details', 'Confirm feasibility, scope and quote'],
    faqs: [{ question: 'Can installation be quoted from the website alone?', answer: 'Complex jobs usually require site details or an inspection before a reliable quote can be confirmed.' }],
  },
  motor_pump: {
    key: 'motor_pump', title: 'Motor & Submersible Pump Repair', eyebrow: 'Water pump support',
    description: 'Request inspection or repair for household motors and submersible pumps. Final work and parts depend on the diagnosis.',
    startingPrice: '₹249', unit: 'indicative starting visit rate', icon: '⚙️', accent: '#2563eb',
    benefits: ['Describe the motor or pump symptoms', 'Request a diagnostic visit', 'Confirm parts and repair charges before work', 'Keep the service request accessible in your account'],
    process: ['Select the pump problem', 'Share address and preferred timing', 'Review the visit details and confirm'],
    faqs: [{ question: 'Are spare parts included?', answer: 'Parts are generally quoted separately after diagnosis. Confirm any warranty terms before approving work.' }],
  },
  tank_cleaning: {
    key: 'tank_cleaning', title: 'Water Tank Cleaning', eyebrow: 'Tank hygiene',
    description: 'Request cleaning and sanitation for household or commercial water tanks. Confirm tank size, access and the service scope before booking.',
    startingPrice: '₹349', unit: 'indicative starting rate', icon: '🪣', accent: '#075985',
    benefits: ['Specify tank type and approximate capacity', 'Arrange an appropriate service slot', 'Confirm the cleaning scope before work', 'Keep booking information in your account'],
    process: ['Share tank type and capacity', 'Choose address and available timing', 'Confirm scope and final price'],
    faqs: [{ question: 'Does price depend on tank size?', answer: 'It can. Confirm the final rate for your tank capacity and access requirements before confirming.' }],
  },
};

export function generateStaticParams() {
  return Object.keys(SERVICE_DETAILS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = SERVICE_DETAILS[slug];
  if (!service) return { title: 'Service not found | AuroWater' };
  return {
    title: `${service.title} in Kanpur and nearby cities | AuroWater`,
    description: service.description,
    alternates: { canonical: `/services/${service.key}` },
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = SERVICE_DETAILS[slug];
  if (!service) notFound();

  const bookingHref = `/book?service=${encodeURIComponent(service.key)}`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 px-5 py-16 text-white sm:py-24">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: service.accent }} />
        <div className="relative mx-auto max-w-6xl">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-slate-300">
            <Link href="/" className="hover:text-white">Home</Link><span className="mx-2">/</span>
            <Link href="/services" className="hover:text-white">Services</Link><span className="mx-2">/</span>
            <span aria-current="page" className="text-white">{service.title}</span>
          </nav>
          <div className="grid items-center gap-10 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#7dd3fc' }}>{service.eyebrow}</p>
              <div className="mb-5 text-5xl" aria-hidden="true">{service.icon}</div>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">{service.title}</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">{service.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={bookingHref} className="inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 font-bold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" style={{ background: service.accent }}>
                  Book this service <span className="ml-2" aria-hidden="true">→</span>
                </Link>
                <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/10">View pricing</Link>
              </div>
            </div>
            <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur">
              <p className="text-sm font-semibold text-slate-300">Indicative starting price</p>
              <p className="mt-2 text-4xl font-black">{service.startingPrice}</p>
              <p className="mt-1 text-sm text-slate-400">{service.unit}</p>
              <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">Your address, service scope and availability can affect the final quote. Review the applicable amount in the booking flow before confirming.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: service.accent }}>Designed around your needs</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A clearer way to arrange {service.title.toLowerCase()}</h2>
          <p className="mt-4 leading-7 text-slate-600">Get the key details in one place and confirm the work only after reviewing the booking information.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {service.benefits.map((benefit, index) => (
            <article key={benefit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black" style={{ background: `${service.accent}15`, color: service.accent }}>{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-4 font-bold">{benefit}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight">How booking works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {service.process.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-2xl bg-slate-50 p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black text-white" style={{ background: service.accent }}>{index + 1}</span>
                <p className="pt-1 font-semibold leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
        <h2 className="text-3xl font-black tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {service.faqs.map((faq) => (
            <details key={faq.question} className="group rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer list-none pr-5 font-bold marker:hidden focus-visible:outline-none">
                {faq.question}
                <span className="float-right ml-3 text-slate-400 transition group-open:rotate-45" aria-hidden="true">＋</span>
              </summary>
              <p className="mt-3 leading-7 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 rounded-3xl bg-slate-950 p-7 text-white sm:p-10">
          <h2 className="text-2xl font-black sm:text-3xl">Ready to get started?</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">Check service availability for your address and review the booking details before you confirm.</p>
          <Link href={bookingHref} className="mt-6 inline-flex min-h-12 items-center rounded-xl px-6 py-3 font-bold text-white transition hover:brightness-110" style={{ background: service.accent }}>Continue to booking →</Link>
        </div>
      </section>
    </main>
  );
}
