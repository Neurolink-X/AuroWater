// PATH: replace your existing Footer component file (same location, same default export)
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUp, Mail, MapPin, MessageCircle } from 'lucide-react';

import type { City } from '@/lib/cities';
import { FALLBACK_CITIES } from '@/lib/cities';
import { mergePublicCityDirectory } from '@/lib/public-city-directory';
import { getFooterSocialProfiles, type FooterSocialPlatform } from '@/lib/footer-social-links';

/**
 * Public footer: brand + actions + discoverability, without a second full
 * marketing page at the end of every route.
 *
 * City truth: /api/cities (admin-managed). A city's status describes a market,
 * not guaranteed coverage at every address, so booking checks always win.
 * Visual handoff: --footer-prev-bg is provided by RootChrome per public route.
 */

const SUPPORT_EMAIL = 'support.aurotap@gmail.com';
const WHATSAPP_URL = 'https://wa.me/919889305803?text=' + encodeURIComponent('Hi AuroTap, I need help with…');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');

const QUICK_LINKS = [
  { href: '/how-it-works', title: 'How it works' },
  { href: '/pricing', title: 'Pricing' },
  { href: '/service-areas', title: 'Service areas' },
  { href: '/about', title: 'About us' },
  { href: '/blog', title: 'Guides & updates' },
  { href: '/contact', title: 'Contact' },
  { href: '/careers', title: 'Careers' },
  { href: '/technicians', title: 'Find a technician' },
] as const;

const SERVICES = [
  { href: '/book?service=water_can', title: '20L RO water' },
  { href: '/book?service=plumbing', title: 'Plumber service' },
  { href: '/book?service=tank_cleaning', title: 'Tank cleaning' },
  { href: '/book?service=ro_service', title: 'RO installation & care' },
  { href: '/book?service=water_tanker', title: 'Water tanker' },
  { href: '/book?service=motor_pump', title: 'Motor & pump' },
  { href: '/book?service=borewell', title: 'Borewell support' },
  { href: '/services', title: 'All services' },
] as const;

const LEGAL = [
  { href: '/privacy', title: 'Privacy' },
  { href: '/terms', title: 'Terms' },
  { href: '/cookies', title: 'Cookies' },
  { href: '/security', title: 'Security' },
] as const;

const UP_SLUGS: readonly string[] = [
  'gorakhpur', 'kanpur', 'lucknow', 'varanasi', 'agra', 'prayagraj',
  'meerut', 'mathura', 'bareilly', 'aligarh', 'noida',
];

/** Platforms without a verified AuroTap profile fall back to the platform homepage, clearly labelled as such. */
const GENERIC_PLATFORMS: { platform: FooterSocialPlatform; href: string; label: string }[] = [
  { platform: 'instagram', href: 'https://www.instagram.com/', label: 'Instagram' },
  { platform: 'facebook', href: 'https://www.facebook.com/', label: 'Facebook' },
];

const SOCIALS = getFooterSocialProfiles();

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300';
const linkClass = `inline-flex min-h-10 items-center rounded-md py-1 text-sm leading-5 text-slate-200 transition-colors hover:text-white ${FOCUS}`;
const iconLinkClass = `inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.055] text-slate-200 transition-colors hover:border-sky-300/60 hover:bg-sky-400/15 hover:text-white ${FOCUS}`;

/**
 * Brand marks are tiny native SVGs: current lucide-react releases ship no brand logos
 * (importing them fails the production build), and this avoids an extra icon package.
 */
function SocialIcon({ platform }: { platform: FooterSocialPlatform }) {
  if (platform === 'instagram') {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.4" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.9" cy="6.2" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (platform === 'facebook') {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <path d="M14.2 21v-8.1H17l.45-3.6h-3.25V7.2c0-1.06.28-1.78 1.9-1.78H17.6V2.25C17.1 2.1 16.25 2 15.25 2c-3.14 0-4.92 1.75-4.92 4.97V9.3H7.45v3.6h2.88V21h3.87Z" />
      </svg>
    );
  }
  if (platform === 'linkedin') {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <rect x="2" y="8.4" width="4.1" height="13" rx=".5" />
        <circle cx="4.05" cy="4.35" r="2.1" />
        <path d="M9.15 8.4h4v1.8c.72-1.25 2.01-2.2 4.06-2.2 3.2 0 4.79 2.05 4.79 5.76V21h-4.18v-6.55c0-1.7-.61-2.55-1.92-2.55-1.51 0-2.53 1.03-2.53 2.58V21H9.15V8.4Z" />
      </svg>
    );
  }
  if (platform === 'google') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M21.35 12.25c0-.75-.07-1.47-.19-2.16H12v4.08h5.23a4.47 4.47 0 0 1-1.94 2.93v2.44h3.15c1.84-1.69 2.91-4.19 2.91-7.29Z" fill="#4285F4" />
        <path d="M12 21.75c2.63 0 4.83-.87 6.44-2.21l-3.15-2.44c-.87.58-1.99.93-3.29.93-2.53 0-4.68-1.71-5.45-4.01H3.3v2.52A9.75 9.75 0 0 0 12 21.75Z" fill="#34A853" />
        <path d="M6.55 14.02a5.86 5.86 0 0 1 0-3.74V7.76H3.3a9.75 9.75 0 0 0 0 8.78l3.25-2.52Z" fill="#FBBC05" />
        <path d="M12 6.27c1.43 0 2.71.49 3.72 1.46l2.79-2.79A9.32 9.32 0 0 0 12 2.25a9.75 9.75 0 0 0-8.7 5.51l3.25 2.52c.77-2.3 2.92-4.01 5.45-4.01Z" fill="#EA4335" />
      </svg>
    );
  }
  return (
    <svg width="20" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M21.6 7.15a2.75 2.75 0 0 0-1.94-1.94C17.95 4.76 12 4.76 12 4.76s-5.95 0-7.66.45A2.75 2.75 0 0 0 2.4 7.15a28.6 28.6 0 0 0-.4 4.85c0 1.64.13 3.26.4 4.85a2.75 2.75 0 0 0 1.94 1.94c1.71.45 7.66.45 7.66.45s5.95 0 7.66-.45a2.75 2.75 0 0 0 1.94-1.94c.27-1.59.4-3.21.4-4.85s-.13-3.26-.4-4.85ZM10 15.55v-7.1L16.25 12 10 15.55Z" />
    </svg>
  );
}

function SocialChannels() {
  const missing = GENERIC_PLATFORMS.filter((g) => !SOCIALS.some((s) => s.platform === g.platform));
  return (
    <div className="mt-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">Connect with AuroTap</h2>
      <div className="flex flex-wrap items-center gap-2">
        <a className={iconLinkClass} href={WHATSAPP_URL} title="WhatsApp" target="_blank" rel="noopener noreferrer">
          <MessageCircle size={19} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Contact AuroTap on WhatsApp (opens in a new tab)</span>
        </a>
        {SOCIALS.map((p) => (
          <a key={p.platform} className={iconLinkClass} href={p.href} title={p.label} target="_blank" rel="noopener noreferrer">
            <SocialIcon platform={p.platform} />
            <span className="sr-only">AuroTap on {p.label} (opens in a new tab)</span>
          </a>
        ))}
        {/* Generic shortcuts are navigation aids, never presented as official AuroTap accounts. */}
        {missing.map((g) => (
          <a key={g.platform} className={iconLinkClass} href={g.href} title={`${g.label} website`} target="_blank" rel="noopener noreferrer">
            <SocialIcon platform={g.platform} />
            <span className="sr-only">Open {g.label} website, not an official AuroTap profile (opens in a new tab)</span>
          </a>
        ))}
        <a className={iconLinkClass} href={`mailto:${SUPPORT_EMAIL}`} title="Email support">
          <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Email AuroTap support</span>
        </a>
      </div>
    </div>
  );
}

function CompactRegionList({ cities }: { cities: City[] }) {
  const upLive = cities.some((c) => c.status === 'active' && UP_SLUGS.includes(c.slug));
  const delhiLive = cities.some((c) => c.slug === 'delhi' && c.status === 'active');
  const liveCount = cities.filter((c) => c.status === 'active').length;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {[{ name: 'Uttar Pradesh', live: upLive }, { name: 'Delhi', live: delhiLive }].map((r) => (
          <Link key={r.name} href="/service-areas"
            className={`inline-flex min-h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 text-xs font-semibold text-slate-100 transition-colors hover:border-sky-300/60 ${FOCUS}`}>
            <span aria-hidden="true" className={`size-1.5 rounded-full ${r.live ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            {r.name}{r.live ? '' : ' · Coming soon'}
          </Link>
        ))}
      </div>
      {liveCount > 0 && <p className="text-xs font-semibold text-emerald-300">{liveCount} {liveCount === 1 ? 'city' : 'cities'} live and growing</p>}
      <p className="text-xs leading-5 text-slate-400">Availability varies by city, address, service and partner. Check your address before booking.</p>
      <Link href="/service-areas" className={`inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-semibold text-sky-300 hover:text-white ${FOCUS}`}>
        <MapPin size={15} aria-hidden="true" /> Check coverage <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

const REFRESH_MS = 90_000;
const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 600_000;

/**
 * Live city directory with self-healing refresh:
 * throttled while healthy, exponential backoff while failing, instant retry when the
 * device comes back online, and the last-known list is always kept (never blank).
 */
function useCityDirectory(): City[] {
  const [cities, setCities] = useState<City[]>(() => mergePublicCityDirectory([], FALLBACK_CITIES));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let inFlight = false;
    let nextAllowedAt = 0;
    let failures = 0;

    const load = async (force = false) => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      if (!force && Date.now() < nextAllowedAt) return;
      inFlight = true;
      try {
        const res = await fetch('/api/cities', { signal: controller.signal, cache: 'default', headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('City directory unavailable');
        const data: unknown = await res.json();
        if (!active) return;
        setCities(mergePublicCityDirectory(data, FALLBACK_CITIES));
        failures = 0;
        nextAllowedAt = Date.now() + REFRESH_MS;
      } catch {
        if (!active) return;
        failures = Math.min(failures + 1, 6);
        nextAllowedAt = Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
      } finally { inFlight = false; }
    };

    const onReturn = () => { if (document.visibilityState === 'visible') void load(); };
    const onOnline = () => void load(true);
    void load();
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn, { passive: true });
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      controller.abort();
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return cities;
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return (
    <button type="button" onClick={() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }} className={`inline-flex min-h-8 items-center gap-1.5 rounded-md text-slate-300 hover:text-white ${FOCUS}`}>
      <ArrowUp size={14} aria-hidden="true" /> Back to top
    </button>
  );
}

export default function Footer() {
  const cities = useCityDirectory();
  const pathname = usePathname();

  // Organization data helps search engines show the right name, logo and verified profiles.
  const jsonLd = useMemo(() => JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AuroTap',
    ...(SITE_URL ? { url: SITE_URL, logo: `${SITE_URL}/aurotap-mark.svg` } : {}),
    email: SUPPORT_EMAIL,
    sameAs: SOCIALS.map((s) => s.href),
  }).replace(/</g, '\\u003c'), []);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <div aria-hidden="true" className="pointer-events-none h-3 w-full"
        style={{ background: 'linear-gradient(180deg, var(--footer-prev-bg, #f8fafc), #081321)' }} />
      <footer className="relative isolate w-full min-w-0 overflow-hidden bg-[#081321] text-slate-100" aria-label="AuroTap site footer"
        style={{ backgroundImage: 'radial-gradient(ellipse 55% 80% at 6% 8%, rgba(14,165,233,0.10), transparent 75%), radial-gradient(ellipse 55% 80% at 95% 90%, rgba(16,185,129,0.045), transparent 70%)' }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-6 lg:px-8">
          <div className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.82fr_0.82fr_1.08fr] lg:gap-x-5">
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <Link href="/" aria-label="AuroTap home" className={`inline-flex min-h-11 items-center gap-2.5 rounded-lg ${FOCUS}`}>
                <Image src="/aurotap-mark.svg" width={40} height={40} alt="" className="size-10 shrink-0 rounded-xl bg-white/10 p-0.5" />
                <span className="text-[22px] font-extrabold tracking-tight text-white">AuroTap</span>
              </Link>
              <p className="mt-2 max-w-[21rem] text-[13px] leading-6 text-slate-300">
                Water delivered. Water problems solved. Order water and book trusted home water services in supported areas.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/book?service=water_can"
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2 text-sm font-bold text-[#081321] shadow-[0_6px_16px_rgba(14,165,233,0.16)] transition-colors hover:from-sky-400 hover:to-cyan-300 ${FOCUS}`}>
                  Order water <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link href="/book?service=plumbing"
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10 ${FOCUS}`}>
                  Find a plumber
                </Link>
              </div>
              <SocialChannels />
            </div>

            <nav aria-label="Our services" className="min-w-0">
              <h2 className="mb-1 text-sm font-bold tracking-wide text-white">Services</h2>
              <div className="grid grid-cols-1 gap-y-0">
                {SERVICES.map((item) => <Link key={item.href} className={linkClass} href={item.href}>{item.title}</Link>)}
              </div>
            </nav>

            <nav aria-label="Footer navigation" className="min-w-0">
              <h2 className="mb-1 text-sm font-bold tracking-wide text-white">Explore AuroTap</h2>
              <div className="grid grid-cols-1 gap-y-1">
                {QUICK_LINKS.map((item) => (
                  <Link key={item.href} className={linkClass} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
                    {item.title}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="col-span-2 min-w-0 lg:col-span-1">
              <h2 className="mb-3 text-sm font-bold tracking-wide text-white">Where we operate</h2>
              <CompactRegionList cities={cities} />
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href="/become-a-supplier" className={linkClass}>Become a supplier</Link>
                <Link href="/register/pro?type=technician" className={linkClass}>Join as technician</Link>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-2 text-sm text-slate-300">
            <a href={`mailto:${SUPPORT_EMAIL}`} className={`inline-flex min-h-9 max-w-full items-center gap-1.5 break-all rounded-md hover:text-white ${FOCUS}`}>
              <Mail size={15} className="shrink-0" aria-hidden="true" /> {SUPPORT_EMAIL}
            </a>
            <Link href="/contact" className={linkClass}>Contact us</Link>
            <Link href="/account-help" className={linkClass}>Can’t sign in?</Link>
          </div>

          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p suppressHydrationWarning>© {new Date().getFullYear()} AuroTap. All rights reserved.</p>
            <nav aria-label="Policies" className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {LEGAL.map((item) => (
                <Link key={item.href} href={item.href}
                  className={`inline-flex min-h-8 items-center rounded-md text-slate-300 hover:text-white ${FOCUS}`}>{item.title}</Link>
              ))}
              <BackToTop />
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
