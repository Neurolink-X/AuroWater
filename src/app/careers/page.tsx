import Link from 'next/link';

import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Careers at AuroWater | Delivery Partners & Technician Jobs',
  'Join AuroWater as a delivery partner or technician in Gorakhpur, Kanpur and Lucknow. Apply to work with AuroWater and grow with a technology-driven water services platform.',
  '/careers',
);

const roles = [
  {
    title: 'Delivery Partner',
    description:
      'Deliver water orders locally and build your own earning opportunity with AuroWater.',
    points: [
      'Flexible local operations',
      'Water delivery orders',
      'Digital order management',
      'Transparent order tracking',
    ],
  },
  {
    title: 'Technician',
    description:
      'Provide professional plumbing, borewell, motor pump, RO and related water-service solutions.',
    points: [
      'Service-based jobs',
      'Digital job assignment',
      'Customer location details',
      'Verified technician network',
    ],
  },
];

const cities = [
  'Kanpur',
  'Lucknow',
  'Gorakhpur',
];

const whatsappUrl =
  'https://wa.me/919889305803?text=Hi%20AuroWater%2C%20I%20want%20to%20join%20as%20a%20partner%20or%20technician.';

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
              Join AuroWater
            </span>

            <h1 className="mt-5 font-[Syne] text-4xl font-black tracking-tight text-[#0A1628] sm:text-5xl">
              Build your career with AuroWater
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Join our growing network of delivery partners and
              service technicians helping customers get reliable
              water and essential water-related services at home.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-sm transition hover:bg-cyan-400"
              >
                Apply on WhatsApp
              </a>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Explore AuroWater
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-cyan-600">
            Opportunities
          </p>

          <h2 className="mt-2 font-[Syne] text-3xl font-black text-[#0A1628]">
            Choose how you want to work with us
          </h2>

          <p className="mt-3 text-slate-600">
            We are building a local network of reliable partners
            and skilled professionals.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {roles.map((role) => (
            <article
              key={role.title}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
            >
              <h3 className="font-[Syne] text-2xl font-black text-[#0A1628]">
                {role.title}
              </h3>

              <p className="mt-3 leading-7 text-slate-600">
                {role.description}
              </p>

              <ul className="mt-6 space-y-3">
                {role.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-3 text-sm text-slate-700"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-black text-cyan-700"
                    >
                      ✓
                    </span>

                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex text-sm font-extrabold text-cyan-700 hover:text-cyan-800"
              >
                Apply for this opportunity →
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Locations */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-cyan-600">
                Current locations
              </p>

              <h2 className="mt-2 font-[Syne] text-2xl font-black text-[#0A1628]">
                Opportunities across Uttar Pradesh
              </h2>

              <p className="mt-3 max-w-2xl text-slate-600">
                We currently operate in these cities and are
                continuing to expand our local network.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {cities.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-cyan-600">
            How it works
          </p>

          <h2 className="mt-2 font-[Syne] text-3xl font-black text-[#0A1628]">
            Simple application process
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['01', 'Apply', 'Send us your basic details.'],
            ['02', 'Review', 'Our team reviews your application.'],
            ['03', 'Verify', 'Required documents and details are verified.'],
            ['04', 'Start', 'Approved partners can begin onboarding.'],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <span className="text-sm font-black text-cyan-600">
                {number}
              </span>

              <h3 className="mt-3 font-[Syne] text-lg font-black text-[#0A1628]">
                {title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#0A1628] px-6 py-12 text-center sm:px-10">
          <h2 className="font-[Syne] text-3xl font-black text-white">
            Interested in joining AuroWater?
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Tell us about yourself, your city and the type of
            work you are interested in.
          </p>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex rounded-xl bg-cyan-500 px-7 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-400"
          >
            Start your application
          </a>

          <p className="mt-4 text-xs text-slate-400">
            Applications are subject to review and verification.
          </p>
        </div>
      </section>
    </main>
  );
}
