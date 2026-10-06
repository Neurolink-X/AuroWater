import Link from 'next/link';
import type { Metadata } from 'next';

/**
 * SEO for a 404 page:
 * - noindex  -> Google should NOT list this page in search results
 * - follow   -> Google can still follow the links on it
 * Next.js automatically sends a real HTTP 404 status for this file.
 */
export const metadata: Metadata = {
  title: 'Page Not Found',
  description:
    'This page could not be found. Book fresh drinking water delivery in Gorakhpur, Kanpur and Lucknow.',
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

/* ---------- Easy-to-edit data (change links here only) ---------- */

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? ''; // e.g. 919876543210
const SUPPORT_EMAIL = 'team@neurolinkxtech.com';

const QUICK_LINKS = [
  {
    href: '/book',
    title: 'Book Water Delivery',
    desc: 'Order fresh water in a few taps',
    icon: 'M12 2.5C8 7.5 5.5 10.5 5.5 14a6.5 6.5 0 0 0 13 0c0-3.5-2.5-6.5-6.5-11.5z',
  },

  {
    href: '/',
    title: 'Go to Home',
    desc: 'See services, pricing and cities',
    icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z',
  },
];

const CITIES = ['Gorakhpur', 'Kanpur', 'Lucknow'];

/* ---------- Page ---------- */

export default function NotFound() {
  const whatsappHref = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
        'Hi, I could not find a page on your website.'
      )}`
    : null;

  return (
    <main
      className="relative isolate min-h-[100svh] overflow-hidden bg-[#0A1628] px-5 py-16 text-white flex items-center justify-center"
      style={{ fontFamily: 'var(--font-dm-sans, "DM Sans"), system-ui, sans-serif' }}
    >
      {/* Background glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <section

        aria-labelledby="nf-title"
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-7 text-center shadow-2xl backdrop-blur-xl sm:p-12"
      >
        {/* Animated water drop */}
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
          <span className="absolute inset-3 animate-pulse rounded-full bg-cyan-400/20" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/30 bg-[#0F2240]">
            <svg viewBox="0 0 64 64" width="44" height="44" fill="none" aria-hidden="true" className="animate-bounce">
              <path d="M32 8C20 22 12 30 12 40a20 20 0 0 0 40 0c0-10-8-18-20-32z" fill="#22D3EE" />
              <path d="M32 16C24 26 19 32 19 40a13 13 0 0 0 26 0c0-8-5-14-13-24z" fill="#0A1628" fillOpacity="0.45" />
              <path d="M24 42a8 8 0 0 0 6 7" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Error 404</p>

        <h1
          id="nf-title"
          className="mt-3 text-3xl font-black leading-tight sm:text-5xl"
          style={{ fontFamily: 'var(--font-syne, Syne), system-ui, sans-serif' }}
        >
          This page{' '}
          <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">
            dried up.
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm text-slate-300 sm:text-base">
          The link may be old or typed wrong. No worries, fresh water is still one tap away.
        </p>


        {/* Primary actions */}
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          {QUICK_LINKS.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                i === 0
                  ? 'group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 p-4 font-semibold text-[#0A1628] shadow-lg shadow-cyan-500/20 transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200'
                  : 'group flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 font-semibold text-white transition hover:scale-[1.02] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300'
              }
            >
              <span
                className={
                  i === 0
                    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A1628]/15'
                    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10'
                }
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
              </span>
              <span>
                <span className="block text-base leading-tight">{item.title}</span>
                <span className={i === 0 ? 'block text-xs font-medium opacity-75' : 'block text-xs font-normal text-slate-400'}>
                  {item.desc}
                </span>
              </span>
            </Link>
          ))}

        </div>

        {/* Cities */}
        <div
