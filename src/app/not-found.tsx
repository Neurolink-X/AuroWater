import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found | AuroWater',
  description:
    'The page you are looking for could not be found. Book water delivery or explore AuroWater services in Gorakhpur, Kanpur and Lucknow.',
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
};

const SUPPORT_WHATSAPP =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';

const SUPPORT_EMAIL = 'team@neurolinkxtech.com';

const QUICK_LINKS = [
  {
    href: '/book',
    title: 'Book Water Delivery',
    description: 'Order fresh water in a few taps',
    icon: 'M12 2.5C8 7.5 5.5 10.5 5.5 14a6.5 6.5 0 0 0 13 0c0-3.5-2.5-6.5-6.5-11.5z',
    primary: true,
  },
  {
    href: '/',
    title: 'Explore AuroWater',
    description: 'Home, services, pricing and cities',
    icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
    primary: false,
  },
];

const CITIES = [
  {
    name: 'Gorakhpur',
    href: '/cities/gorakhpur',
  },
  {
    name: 'Kanpur',
    href: '/cities/kanpur',
  },
  {
    name: 'Lucknow',
    href: '/cities/lucknow',
  },
];

export default function NotFound() {
  const whatsappHref = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
        'Hi AuroWater Support, I could not find the page I was looking for.'
      )}`
    : null;

  return (
    <main
      className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#071525] px-4 py-10 text-white sm:px-6 sm:py-16"
      style={{
        fontFamily:
          'var(--font-dm-sans, "DM Sans"), system-ui, sans-serif',
      }}
    >
      {/* =========================================================
          BACKGROUND
      ========================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="absolute bottom-[-10rem] right-[-8rem] h-[30rem] w-[30rem] rounded-full bg-sky-600/10 blur-3xl" />

        <div className="absolute left-[-10rem] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* =========================================================
          CONTENT
      ========================================================== */}

      <section
        aria-labelledby="not-found-title"
        className="w-full max-w-3xl"
      >
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-2xl">
          {/* =====================================================
              HEADER / BRAND
          ====================================================== */}

          <div className="border-b border-white/10 px-6 pb-6 pt-7 sm:px-10 sm:pt-9">
            <Link
              href="/"
              aria-label="AuroWater home"
              className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-500 shadow-lg shadow-cyan-500/20">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2.5C8.4 7.2 5.5 10.8 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10.8 15.6 7.2 12 2.5Z"
                    fill="white"
                  />
                  <path
                    d="M9.2 15.5a3.6 3.6 0 0 0 2.8 2.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className="text-cyan-700"
                  />
                </svg>
              </span>

              <span className="text-lg font-extrabold tracking-tight">
                Auro<span className="text-cyan-300">Water</span>
              </span>
            </Link>
          </div>

          {/* =====================================================
              ERROR HERO
          ====================================================== */}

          <div className="px-6 pb-8 pt-10 text-center sm:px-10 sm:pb-10 sm:pt-12">
            {/* Animated water drop */}
            <div
              className="relative mx-auto mb-7 flex h-28 w-28 items-center justify-center"
              aria-hidden="true"
            >
              <span className="absolute inset-0 rounded-full bg-cyan-400/10 blur-md" />
              <span className="absolute inset-1 rounded-full border border-cyan-300/10" />
              <span className="absolute inset-4 rounded-full border border-cyan-300/10" />

              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/20 bg-[#0D223D] shadow-xl shadow-cyan-500/10">
                <svg
                  viewBox="0 0 64 64"
                  width="48"
                  height="48"
                  fill="none"
                >
                  <path
                    d="M32 7C20.5 21 12 30.4 12 40.5a20 20 0 0 0 40 0C52 30.4 43.5 21 32 7Z"
                    fill="#22D3EE"
                  />
                  <path
                    d="M32 16C24.2 26 19 32.5 19 40a13 13 0 0 0 26 0c0-7.5-5.2-14-13-24Z"
                    fill="#0A1628"
                    fillOpacity="0.42"
                  />
                  <path
                    d="M23.5 40.5c.4 3.8 2.8 6.7 6.2 8"
                    stroke="white"
                    strokeOpacity="0.7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <div className="inline-flex items-center rounded-full border border-cyan-300/15 bg-cyan-300/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
              Error 404
            </div>

            <h1
              id="not-found-title"
              className="mx-auto mt-5 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl"
              style={{
                fontFamily:
                  'var(--font-syne, Syne), system-ui, sans-serif',
              }}
            >
              Looks like this page
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-400 bg-clip-text text-transparent">
                dried up.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              The page may have moved, the link may be outdated, or the
              address may have been entered incorrectly.
            </p>

            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              But your water delivery is still only a few taps away.
            </p>

            {/* =================================================
                PRIMARY ACTIONS
            ================================================== */}

            <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.primary
                      ? 'group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 p-4 text-left font-semibold text-[#061526] shadow-lg shadow-cyan-500/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071525]'
                      : 'group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071525]'
                  }
                >
                  <span
                    className={
                      item.primary
                        ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#061526]/10'
                        : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300'
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="21"
                      height="21"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d={item.icon} />
                    </svg>
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-bold sm:text-base">
                      {item.title}
                    </span>

                    <span
                      className={
                        item.primary
                          ? 'mt-0.5 block text-xs font-medium opacity-75'
                          : 'mt-0.5 block text-xs font-normal text-slate-400'
                      }
                    >
                      {item.description}
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="ml-auto text-lg opacity-50 transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* =====================================================
              SERVICE CITIES
          ====================================================== */}

          <div className="border-t border-white/10 px-6 py-7 sm:px-10">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                Currently serving
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                {CITIES.map((city) => (
                  <Link
                    key={city.name}
                    href={city.href}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/20 hover:bg-cyan-300/5 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* =====================================================
              TRUST / RECOVERY
          ====================================================== */}

          <div className="border-t border-white/10 bg-black/10 px-6 py-6 sm:px-10">
            <div className="grid gap-4 text-center sm:grid-cols-3">
              <div>
                <div className="text-sm font-bold text-white">
                  Fresh Water
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  Convenient home delivery
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-white">
                  Easy Booking
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  Simple and transparent flow
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-white">
                  Local Service
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  Available in selected cities
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              SUPPORT
          ====================================================== */}

          <div className="border-t border-white/10 px-6 py-7 text-center sm:px-10">
            <p className="text-sm font-semibold text-slate-200">
              Still can't find what you need?
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Our support team can help you find the right service.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  WhatsApp Support
                </a>
              )}

              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Email Support
              </a>
            </div>
          </div>
        </div>

        {/* Small footer */}
        <p className="mt-5 text-center text-xs text-slate-600">
          AuroWater · Water delivery made simple
        </p>
      </section>
    </main>
  );
}
