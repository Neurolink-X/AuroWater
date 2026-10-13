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
      'Explore 20-litre RO water delivery and home plumbing services in Lucknow through AuroTap.',
  },
  kanpur: {
    name: 'Kanpur',
    slug: 'kanpur',
    region: 'Uttar Pradesh',
    description:
      'Explore 20-litre RO water delivery and home plumbing services in Kanpur through AuroTap.',
  },
  gorakhpur: {
    name: 'Gorakhpur',
    slug: 'gorakhpur',
    region: 'Uttar Pradesh',
    description:
      'Explore 20-litre RO water delivery and home plumbing services in Gorakhpur through AuroTap.',
  },
};

export const dynamicParams = false;

export function generateStaticParams(): Array<{ city: string }> {
  return Object.keys(CITIES).map((city) => ({ city }));
}

type CityPageProps = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const { city: rawCity } = await params;
  const city = CITIES[rawCity.toLowerCase()];

  if (!city) {
    return {
      title: 'City not found | AuroTap',
      robots: { index: false, follow: false },
    };
  }

  const title = `RO Water Delivery & Plumbing in ${city.name} | AuroTap`;

  return {
    title,
    description: city.description,
    alternates: {
      canonical: `/cities/${city.slug}`,
    },
    openGraph: {
      title,
      description: city.description,
      url: `https://aurotap.in/cities/${city.slug}`,
      type: 'website',
      siteName: 'AuroTap',
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { city: rawCity } = await params;
  const city = CITIES[rawCity.toLowerCase()];

  if (!city) {
    notFound();
  }

  const pageUrl = `https://aurotap.in/cities/${city.slug}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Water delivery and plumbing information for ${city.name}`,
    description: city.description,
    url: pageUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'AuroTap',
      url: 'https://aurotap.in',
    },
    about: {
      '@type': 'Service',
      name: 'Water delivery and home plumbing services',
      areaServed: {
        '@type': 'City',
        name: city.name,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: city.region,
        },
      },
      provider: {
        '@type': 'Organization',
        name: 'AuroTap',
        url: 'https://aurotap.in',
      },
    },
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />

      <header className="border-b border-slate-100 bg-white">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8"
        >
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-700 text-2xl text-white">
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
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:border-cyan-200 hover:bg-cyan-50"
          >
            Home
          </Link>
        </nav>
      </header>

      <section className="relative isolate overflow-hidden border-b border-cyan-100 bg-gradient-to-b from-cyan-50 via-white to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-cyan-100/70 blur-3xl"
        />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Local services in {city.name}
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Water delivered.
              <span className="mt-2 block text-cyan-700">
                Water problems solved.
              </span>
              <span className="mt-2 block text-slate-800">
                In {city.name}.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              {city.description} Choose the service you need and check
              availability for your address before placing an order.
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
              Service availability and delivery times depend on your address
              and local provider coverage.
            </p>
          </div>

          <div className="rounded-[2rem] border border-cyan-100 bg-white p-5 shadow-xl shadow-cyan-950/5 sm:p-7">
            <div className="rounded-3xl bg-gradient-to-br from-cyan-700 to-blue-950 p-7 text-white sm:p-9">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold tracking-wider">
                  EVERYDAY WATER
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
                  aria-hidden="true"
                  className="flex h-28 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-5xl"
                >
                  💧
                </div>
              </div>

              <div className="mt-6 border-t border-white/20 pt-5 text-sm text-cyan-50">
                Chilled RO water · ₹25 per 20L can
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-2xl" aria-hidden="true">
                  🚰
                </span>
                <h2 className="mt-2 font-bold">Water delivery</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Everyday water for your home.
                </p>
              </article>

              <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-2xl" aria-hidden="true">
                  🛠️
                </span>
                <h2 className="mt-2 font-bold">Plumbing help</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Explore options for home water problems.
                </p>
              </article>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              Availability in {city.name} must be confirmed for your address.
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
            Find water delivery and home water-related services in one place.
            Review the details, confirm availability and check the final price
            before placing an order.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 p-6 transition hover:border-cyan-200 hover:shadow-md">
            <span className="text-sm font-extrabold text-cyan-700">01</span>
            <h3 className="mt-4 text-lg font-bold">Choose your service</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start with RO water delivery or explore plumbing support.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 p-6 transition hover:border-cyan-200 hover:shadow-md">
            <span className="text-sm font-extrabold text-cyan-700">02</span>
            <h3 className="mt-4 text-lg font-bold">Confirm your address</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Check your service location and provider availability.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 p-6 transition hover:border-cyan-200 hover:shadow-md">
            <span className="text-sm font-extrabold text-cyan-700">03</span>
            <h3 className="mt-4 text-lg font-bold">Review before ordering</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Confirm the final amount, delivery details and service terms.
            </p>
          </article>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">
              Need water at home in {city.name}?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Visit AuroTap to explore services and check what is available
              for your address.
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
