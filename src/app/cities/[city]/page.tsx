```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type CityInfo = {
  name: string;
  slug: string;
  region: string;
  description: string;
};

const CITIES: Record<string, CityInfo> = {
  lucknow: {
    name: 'Lucknow',
    slug: 'lucknow',
    region: 'Uttar Pradesh',
    description:
      'Order 20-litre RO water cans and explore home plumbing services in Lucknow through AuroTap.',
  },
  kanpur: {
    name: 'Kanpur',
    slug: 'kanpur',
    region: 'Uttar Pradesh',
    description:
      'Find everyday RO water delivery and plumbing service options in Kanpur through AuroTap.',
  },
  gorakhpur: {
    name: 'Gorakhpur',
    slug: 'gorakhpur',
    region: 'Uttar Pradesh',
    description:
      'Explore 20-litre water-can delivery and home plumbing services in Gorakhpur with AuroTap.',
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(CITIES).map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: rawCity } = await params;
  const city = CITIES[rawCity.toLowerCase()];

  if (!city) {
    return { title: 'City not found | AuroTap' };
  }

  return {
    title: `RO Water Can Delivery & Plumbing in ${city.name} | AuroTap`,
    description: city.description,
    alternates: {
      canonical: `/cities/${city.slug}`,
    },
    openGraph: {
      title: `Water Delivery & Plumbing in ${city.name} | AuroTap`,
      description: city.description,
      type: 'website',
      siteName: 'AuroTap',
    },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: rawCity } = await params;
  const city = CITIES[rawCity.toLowerCase()];

  if (!city) notFound();

  const siteUrl = 'https://aurotap.in';
  const pageUrl = `${siteUrl}/cities/${city.slug}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Water delivery and plumbing services in ${city.name}`,
    description: city.description,
    url: pageUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'AuroTap',
      url: siteUrl,
    },
    areaServed: {
      '@type': 'City',
      name: city.name,
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: city.region,
      },
    },
  };

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />

      <header className="border-b border-slate-100 bg-white">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"
        >
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-700 text-xl text-white">
              💧
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">
                AuroTap
              </span>
              <span className="block text-xs text-slate-500">
                Water. Home. Sorted.
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            Home
          </Link>
        </nav>
      </header>

      <section className="relative isolate border-b border-cyan-100 bg-gradient-to-b from-cyan-50/80 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-20 -z-10 h-80 w-80 rounded-full bg-cyan-100/70 blur-3xl"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Local services · {city.name}
            </p>

            <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Water delivered.
              <span className="mt-2 block text-cyan-700">
                Home problems solved.
              </span>
              <span className="mt-2 block text-slate-800">
                In {city.name}.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              {city.description} Explore the available options, review the
              details and choose the service you need.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-cyan-700 px-6 py-3.5 font-bold text-white shadow-lg shadow-cyan-900/10 transition hover:bg-cyan-800"
              >
                Order RO Water
                <span className="ml-2" aria-hidden="true">
                  →
                </span>
              </Link>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-bold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50"
              >
                Find a Plumber
              </Link>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Availability and delivery times depend on your service address
              and local provider coverage.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-cyan-100 bg-white p-5 shadow-xl shadow-cyan-950/5 sm:p-7">
              <div className="rounded-3xl bg-gradient-to-br from-cyan-700 to-blue-950 p-7 text-white sm:p-9">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                    YOUR DAILY WATER
                  </span>
                  <span className="text-2xl" aria-hidden="true">
                    ✦
                  </span>
                </div>

                <div className="mt-9 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-cyan-100">Normal RO water</p>
                    <p className="mt-2 text-5xl font-extrabold">₹20</p>
                    <p className="mt-2 text-sm text-cyan-100">
                      Per 20L can
                    </p>
                  </div>
                  <div
                    className="flex h-28 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-5xl"
                    aria-hidden="true"
                  >
                    💧
                  </div>
                </div>

                <div className="mt-6 border-t border-white/20 pt-5 text-sm text-cyan-50">
                  Chilled RO water: ₹25 per 20L can
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-xl" aria-hidden="true">
                    🚰
                  </span>
                  <p className="mt-2 font-bold">Water delivery</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Everyday water for your home.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-xl" aria-hidden="true">
                    🛠️
                  </span>
                  <p className="mt-2 font-bold">Plumbing help</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Find options for home water problems.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              Serving eligible addresses in {city.name}, subject to availability.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-cyan-700">
            The AuroTap experience
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everyday water service, made simpler.
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            AuroTap brings water delivery and home water-related services
            together in one place, helping customers discover suitable options
            without unnecessary complexity.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              number: '01',
              title: 'Choose your service',
              text: 'Start with RO water delivery or explore plumbing support.',
            },
            {
              number: '02',
              title: 'Confirm your address',
              text: 'Check your location and the service availability for it.',
            },
            {
              number: '03',
              title: 'Review before ordering',
              text: 'Confirm the final price, delivery details and service terms.',
            },
          ].map((item) => (
            <article
              key={item.number}
              className="rounded-2xl border border-slate-200 p-6 transition hover:border-cyan-200 hover:shadow-md"
            >
              <span className="text-sm font-extrabold text-cyan-700">
                {item.number}
              </span>
              <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">
              Need water at home in {city.name}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start from AuroTap and check which services are available at
              your address.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-cyan-700 px-6 py-3.5 font-bold text-white transition hover:bg-cyan-800"
          >
            Explore AuroTap
            <span className="ml-2" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-6 text-sm text-slate-500 sm:px-8">
          <p>© {new Date().getFullYear()} AuroTap</p>
          <Link href="/" className="font-semibold hover:text-cyan-700">
            Visit AuroTap
          </Link>
        </div>
      </footer>
    </main>
  );
}
```
