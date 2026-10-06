import Link from 'next/link';
import type { Metadata } from 'next';

import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta(
  'Water Delivery & Home Water Services in Kanpur | AuroWater',
  'Book water cans, water tankers, RO service, plumbing, borewell and pump services with AuroWater. Check serviceability, choose a slot and track your order online.',
  '/'
);

type IconName =
  | 'drop'
  | 'truck'
  | 'wrench'
  | 'pipe'
  | 'well'
  | 'pump'
  | 'calendar'
  | 'shield'
  | 'route'
  | 'bolt'
  | 'phone'
  | 'arrow';

function Icon({
  name,
  size = 22,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'drop':
      return (
        <svg {...common}>
          <path d="M12 3s6 6.2 6 11a6 6 0 1 1-12 0c0-4.8 6-11 6-11Z" />
          <path d="M9.5 16.5c.5 1 1.4 1.5 2.5 1.7" />
        </svg>
      );
    case 'truck':
      return (
        <svg {...common}>
          <path d="M3 6h11v10H3z" />
          <path d="M14 10h4l3 3v3h-7z" />
          <path d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4.1 4.1 0 0 0-5.3-5v3L7.1 6.6l-3-.1a4.1 4.1 0 0 0 5 5.3l7.7 7.7a2 2 0 1 0 2.8-2.8Z" />
        </svg>
      );
    case 'pipe':
      return (
        <svg {...common}>
          <path d="M4 7h6v4h4v6h6" />
          <path d="M4 7V4m0 3h3M20 17v3m0-3h-3" />
        </svg>
      );
    case 'well':
      return (
        <svg {...common}>
          <path d="M6 4h12" />
          <path d="M7 4v5a5 5 0 0 0 10 0V4" />
          <path d="M12 9v7" />
          <path d="M8 20h8" />
          <path d="M10 16h4" />
        </svg>
      );
    case 'pump':
      return (
        <svg {...common}>
          <path d="M5 8h8v8H5z" />
          <path d="M13 10h3l3 3v3h-6" />
          <path d="M7 5v3m4-3v3" />
          <path d="M3 19h18" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M7 2.5v4m10-4v4M3 9h18" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 19 6v5c0 4.7-3 8.1-7 10-4-1.9-7-5.3-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'route':
      return (
        <svg {...common}>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18c7 0 2-10 8-10" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <path d="M7 3h3l2 5-2 1.5a14 14 0 0 0 4.5 4.5L16 12l5 2v3c0 1.1-.9 2-2 2C10.7 19 5 13.3 5 6c0-1.7.3-3 2-3Z" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
  }
}

const services = [
  {
    icon: 'drop' as const,
    title: '20L Water Cans',
    description: 'Order individual cans, larger quantities or scheduled recurring deliveries.',
    href: '/book?service=water_can',
    tag: 'Everyday',
  },
  {
    icon: 'truck' as const,
    title: 'Water Tankers',
    description: 'Bulk water delivery for homes, sites, offices and other larger requirements.',
    href: '/book?service=water_tanker',
    tag: 'Bulk',
  },
  {
    icon: 'wrench' as const,
    title: 'RO Service',
    description: 'Maintenance, filter change, repair and installation support for water purifiers.',
    href: '/book?service=ro_service',
    tag: 'Home care',
  },
  {
    icon: 'pipe' as const,
    title: 'Plumbing',
    description: 'Book help for leaks, fittings, drainage and everyday plumbing jobs.',
    href: '/book?service=plumbing',
    tag: 'Home care',
  },
  {
    icon: 'well' as const,
    title: 'Borewell Services',
    description: 'Borewell drilling, repair and related water-source support.',
    href: '/book?service=borewell',
    tag: 'Water systems',
  },
  {
    icon: 'pump' as const,
    title: 'Pump & Motor',
    description: 'Submersible, pump and motor installation or repair support.',
    href: '/book?service=motor_pump',
    tag: 'Water systems',
  },
];

const serviceCities = ['Kanpur', 'Gorakhpur', 'Lucknow'];

const benefits = [
  {
    icon: 'route' as const,
    title: 'Serviceability first',
    text: 'We check your delivery address before confirming a service that depends on local coverage.',
  },
  {
    icon: 'shield' as const,
    title: 'Server-validated orders',
    text: 'Your order, address and pricing are validated on the platform before fulfilment.',
  },
  {
    icon: 'bolt' as const,
    title: 'Live order workflow',
    text: 'Assignments, delivery progress and completion move through a central order workflow.',
  },
  {
    icon: 'calendar' as const,
    title: 'Scheduled delivery',
    text: 'Choose an available delivery window or set up recurring water deliveries.',
  },
];

const faqs = [
  {
    q: 'How does AuroWater delivery work?',
    a: 'Choose a service, confirm an eligible address, select a delivery window and place the order. Water orders can then be routed to an available supplier for fulfilment.',
  },
  {
    q: 'Can I order just one water can?',
    a: 'Yes. The water-can booking flow supports small orders as well as larger quantities, subject to the current order limits and serviceability of your address.',
  },
  {
    q: 'Do you offer recurring water delivery?',
    a: 'Yes. AuroWater supports recurring water-can plans with scheduled future deliveries. Each delivery is created as its own order.',
  },
  {
    q: 'Which cities does AuroWater currently serve?',
    a: 'The current active service configuration includes Kanpur, Gorakhpur and Lucknow. Availability is still checked against the delivery address and service.',
  },
  {
    q: 'Can I book an urgent service?',
    a: 'Emergency booking options can be available for eligible services and time windows. The booking flow shows the applicable availability and charges before confirmation.',
  },
  {
    q: 'How can I get help with an order?',
    a: 'Use the support/contact options on the website. Order updates and delivery status are also available from the signed-in customer workspace.',
  },
];

function SectionHeading({
  eyebrow,
  title,
  text,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  text: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p className={`text-xs font-black uppercase tracking-[0.22em] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black tracking-[-0.035em] sm:text-4xl ${dark ? 'text-white' : 'text-slate-950'}`}>
        {title}
      </h2>
      <p className={`mt-4 text-base leading-7 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-[#F6FAF8] text-slate-950">
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_5%,rgba(16,185,129,0.17),transparent_28%),radial-gradient(circle_at_10%_15%,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,#ECFDF8_0%,#F6FAF8_75%,#F6FAF8_100%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3.5 py-2 text-xs font-black text-emerald-800 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Water delivery + essential water services
            </div>

            <h1 className="mt-6 max-w-4xl text-[clamp(2.7rem,6vw,5.7rem)] font-black leading-[0.94] tracking-[-0.06em] text-slate-950">
              Reliable water.
              <span className="block bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-600 bg-clip-text text-transparent">
                Delivered when it matters.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              AuroWater brings water cans, water tankers and everyday water-system services into one
              serviceable, trackable platform for homes, offices and local businesses.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book?service=water_can"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Book water delivery
                <Icon name="arrow" size={17} />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-6 py-3.5 text-sm font-black text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                Explore services
              </Link>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Address check', 'Before confirmation'],
                ['Live workflow', 'Assignment to completion'],
                ['Recurring plans', 'Scheduled water delivery'],
              ].map(([title, sub]) => (
                <div key={title} className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                  <p className="text-sm font-black text-slate-900">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-emerald-300/20 blur-3xl" />
            <div className="rounded-[2rem] border border-white/90 bg-slate-950 p-5 shadow-2xl shadow-slate-950/20 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">AuroWater flow</p>
                  <p className="mt-2 text-xl font-black text-white">From address to delivery</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <Icon name="drop" size={24} />
                </div>
              </div>

              <div className="mt-7 space-y-3">
                {[
                  { n: '01', title: 'Check your address', text: 'Confirm that the requested service is available in your area.' },
                  { n: '02', title: 'Choose the right service', text: 'Water cans, tanker delivery or a home water-system service.' },
                  { n: '03', title: 'Track the order', text: 'Follow the order as it moves through the fulfilment workflow.' },
                ].map((step, i) => (
                  <div key={step.n} className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    {i < 2 ? <div className="absolute left-7 top-[4.4rem] hidden h-3 w-px bg-white/15 sm:block" /> : null}
                    <div className="flex gap-4">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-black text-slate-950">
                        {step.n}
                      </div>
                      <div>
                        <p className="font-black text-white">{step.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{step.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <Icon name="shield" size={19} />
                <span>Pricing, serviceability and fulfilment rules are checked on the platform.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-slate-600">Current service locations</p>
            <div className="flex flex-wrap gap-2">
              {serviceCities.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-700"
                >
                  {city}, Uttar Pradesh
                </span>
              ))}
            </div>
            <Link href="/book?service=water_can" className="text-sm font-black text-emerald-700 hover:text-emerald-800">
              Check my address →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
        <SectionHeading
          eyebrow="One platform"
          title="Water delivery first. Water systems next."
          text="AuroWater is built around the practical jobs that keep a home, office or site supplied, working and moving."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.title}
              href={service.href}
              className="group rounded-[1.65rem] border border-slate-200/90 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_22px_55px_rgba(15,23,42,0.09)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon name={service.icon} size={24} />
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  {service.tag}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-black tracking-[-0.02em] text-slate-900">{service.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
              <div className="mt-5 flex items-center gap-2 text-sm font-black text-emerald-700">
                Book service <Icon name="arrow" size={16} />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-7">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 hover:bg-slate-50"
          >
            View the full service catalogue
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </section>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
          <SectionHeading
            eyebrow="Built for the real world"
            title="Less guesswork. More operational clarity."
            text="The product should make service delivery easier to understand for customers and easier to operate for partners."
            dark
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <Icon name={benefit.icon} size={22} />
                </div>
                <h3 className="mt-5 font-black text-white">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionHeading
              eyebrow="Recurring delivery"
              title="Make water delivery predictable."
              text="For customers with regular water needs, a recurring plan reduces repeated booking work while keeping each delivery visible as its own order."
            />
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800"
              >
                See plans
              </Link>
              <Link
                href="/book?service=water_can&plan=starter"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                Start a water plan
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Choose quantity', 'Set the number of cans for each scheduled delivery.'],
              ['Choose frequency', 'Pick a recurring schedule that fits your requirement.'],
              ['Save your address', 'Keep a verified delivery address for future orders.'],
              ['Track each delivery', 'Every recurring delivery becomes its own operational order.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-black text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-100 bg-emerald-50/60">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Icon name="truck" size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Suppliers</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Grow your local delivery business</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Manage availability, receive eligible delivery offers and operate from a supplier workspace designed around real order status.
            </p>
            <Link href="/contact?subject=Supplier%20Partnership" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-emerald-700">
              Talk about supplier partnership <Icon name="arrow" size={16} />
            </Link>
          </div>

          <div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                <Icon name="wrench" size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Technicians</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Build a service business with the platform</h3>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Find relevant jobs, keep status updates clear and build a verified service profile as the network expands.
            </p>
            <Link href="/technicians" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-sky-700">
              Explore technician network <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 sm:py-24">
        <SectionHeading
          eyebrow="Questions"
          title="What customers usually ask"
          text="Clear answers before you book."
        />
        <div className="mt-8 divide-y divide-slate-200 rounded-[1.5rem] border border-slate-200 bg-white">
          {faqs.map((item) => (
            <details key={item.q} className="group p-5 open:bg-slate-50/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-black text-slate-900">
                <span>{item.q}</span>
                <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl pr-8 text-sm leading-6 text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-7 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Ready when you are</p>
              <h2 className="mt-2 max-w-3xl text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
                Check your area and book the service you actually need.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Start with your delivery address. The booking flow will validate serviceability before you confirm.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href="/book?service=water_can"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-300"
              >
                Book now <Icon name="arrow" size={16} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                <Icon name="phone" size={17} />
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
