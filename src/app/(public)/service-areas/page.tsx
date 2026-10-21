import type { Metadata } from 'next';
import Link from 'next/link';
import { NCR_EXPANSION_REGIONS } from '@/lib/expansion-regions';

export const metadata: Metadata = {
  title: 'Delhi NCR Service Areas — Expansion Waitlist | AuroTap',
  description:
    'Explore AuroTap expansion areas across Delhi, Noida, Greater Noida and Ghaziabad. Join the waitlist while local service coverage is being validated.',
  alternates: { canonical: 'https://www.aurotap.in/service-areas' },
  robots: { index: true, follow: true },
};

export default function ServiceAreasPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-black tracking-tight text-cyan-800">AuroTap</Link>
          <Link href="/" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            Back to home
          </Link>
        </nav>
      </header>

      <section className="bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 px-5 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">Expansion roadmap</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Delhi NCR is on our expansion roadmap.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            We are mapping neighbourhoods and sectors across Delhi, Noida, Greater Noida and Ghaziabad
            before opening bookings. A listed area is an expansion target, not a live delivery or
            technician guarantee.
          </p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">
            <span aria-hidden="true">●</span> NCR launch preparation — waitlist only
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Areas being mapped</h2>
          <p className="mt-3 leading-7 text-slate-600">
            We will enable each area only after supplier/technician capacity, address-level serviceability,
            pricing, and dispatch coverage are checked.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {NCR_EXPANSION_REGIONS.map((region) => (
            <article key={region.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-cyan-800">{region.state}</p>
                  <h3 className="mt-1 text-xl font-extrabold">{region.name}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                  Waitlist
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">{region.coverageLabel}</p>
              <ul className="mt-4 space-y-3">
                {region.areas.map((area) => (
                  <li key={area} className="flex gap-3 text-sm leading-6 text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" aria-hidden="true" />
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{region.notes}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold">Need a service today?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Current booking availability is still checked against supported live service zones.
            </p>
          </div>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl bg-cyan-800 px-5 py-3 font-bold text-white transition hover:bg-cyan-900">
            Check current availability <span className="ml-2" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
