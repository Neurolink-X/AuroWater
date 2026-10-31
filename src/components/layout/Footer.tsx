'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Facebook, Instagram, Linkedin, Mail, MapPin,
  MessageCircle, Phone, Youtube,
} from 'lucide-react';

import type { City } from '@/lib/cities';
import { FALLBACK_CITIES } from '@/lib/cities';
import {
  cityAvailabilityLabel,
  mergePublicCityDirectory,
  selectFooterCities,
} from '@/lib/public-city-directory';
import {
  getFooterSocialProfiles,
  type FooterSocialPlatform,
} from '@/lib/footer-social-links';

/**
 * Public footer: brand + actions + discoverability, without a second full
 * marketing page at the end of every route.
 *
 * Source of city truth: /api/cities, backed by the admin-managed cities table.
 * City status describes a market, not guaranteed coverage at every address.
 * Keep the display bounded as AuroTap expands.
 *
 * Visual handoff: --footer-prev-bg is provided by RootChrome for each public
 * route. The 12px blend replaces a tall disconnected CTA/wave section.
 */
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

const SOCIALS = getFooterSocialProfiles();

const linkClass = [
  'inline-flex min-h-9 items-center rounded-lg py-1 text-[13px] leading-5',
  'text-slate-300 transition-colors hover:text-white',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'focus-visible:outline-sky-300',
].join(' ');

const iconLinkClass = [
  'inline-flex size-10 shrink-0 items-center justify-center rounded-xl',
  'border border-white/15 bg-white/[0.055] text-slate-200',
  'transition-colors hover:border-sky-300/60 hover:bg-sky-400/15 hover:text-white',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'focus-visible:outline-sky-300',
].join(' ');

type GroupedCities = ReturnType<typeof selectFooterCities>;

function SocialIcon({ platform }: { platform: FooterSocialPlatform }) {
  if (platform === 'instagram') return <Instagram size={18} strokeWidth={1.8} aria-hidden="true" />;
  if (platform === 'facebook') return <Facebook size={18} strokeWidth={1.8} aria-hidden="true" />;
  if (platform === 'linkedin') return <Linkedin size={18} strokeWidth={1.8} aria-hidden="true" />;
  return <Youtube size={18} strokeWidth={1.8} aria-hidden="true" />;
}

function SocialChannels() {
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Connect with AuroTap
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <a className={iconLinkClass} href="https://wa.me/919889305803"
          aria-label="Contact AuroTap on WhatsApp" title="WhatsApp"
          target="_blank" rel="noopener noreferrer">
          <MessageCircle size={19} strokeWidth={1.8} aria-hidden="true" />
        </a>
        {SOCIALS.map((profile) => (
          <a key={profile.platform} className={iconLinkClass} href={profile.href}
            aria-label={`AuroTap on ${profile.label}`}
            title={profile.label}
            target="_blank" rel="noopener noreferrer">
            <SocialIcon platform={profile.platform} />
          </a>
        ))}
        <a className={iconLinkClass} href="mailto:support.aurotap@gmail.com"
          aria-label="Email AuroTap support" title="Email support">
          <Mail size={18} strokeWidth={1.8} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function CompactCityList({ groups }: { groups: GroupedCities }) {
  return (
    <div aria-label="Service city directory" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {groups.active.map((city) => (
          <Link key={city.slug} href="/service-areas"
            title={`Check serviceability for your address in ${city.name}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full
              border border-emerald-400/30 bg-emerald-400/10 px-3 py-1
              text-xs font-semibold text-emerald-100 transition-colors
              hover:border-emerald-300/70 hover:bg-emerald-400/20
              focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-sky-300">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-400" />
            {city.name}
          </Link>
        ))}
        {groups.upcoming.map((city) => (
          <Link key={city.slug} href="/service-areas#upcoming-areas"
            title={`${city.name}: ${cityAvailabilityLabel(city)}`}
            className="inline-flex min-h-9 items-center rounded-full border border-slate-600/80
              bg-white/[0.055] px-3 py-1 text-xs font-medium text-slate-200
              hover:border-slate-400 hover:text-white
              focus-visible:outline focus-visible:outline-2
              focus-visible:outline-offset-2 focus-visible:outline-sky-300">
            {city.name} · Soon
          </Link>
        ))}
      </div>
      <p className="text-xs leading-5 text-slate-400">
        Coverage is checked by address, service and available partner.
        {groups.remaining > 0 ? ` ${groups.remaining} more areas listed online.` : ''}
      </p>
      <Link href="/service-areas"
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold
          text-sky-300 hover:text-white focus-visible:outline
          focus-visible:outline-2 focus-visible:outline-offset-2">
        <MapPin size={15} aria-hidden="true" />
        Explore all cities <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function Footer() {
  const [cities, setCities] = useState<City[]>(() =>
    mergePublicCityDirectory([], FALLBACK_CITIES),
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let inFlight = false;
    let lastRequestedAt = 0;

    const load = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      // The endpoint caches for 30 seconds. Avoid excessive repeated fetches
      // while keeping persistent SPA footer state up to date after admin changes.
      if (Date.now() - lastRequestedAt < 90_000) return;
      lastRequestedAt = Date.now();
      inFlight = true;
      try {
        const response = await fetch('/api/cities', {
          signal: controller.signal,
          cache: 'default',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('City directory unavailable');
        const data: unknown = await response.json();
        if (active) setCities(mergePublicCityDirectory(data, FALLBACK_CITIES));
      } catch {
        // Keep last-known cities if offline, but never bypass booking checks.
      } finally {
        inFlight = false;
      }
    };

    const onReturn = () => { if (document.visibilityState === 'visible') void load(); };
    void load();
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn, { passive: true });
    return () => {
      active = false;
      controller.abort();
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);

  const groupedCities = useMemo(() => selectFooterCities(cities, 6, 2), [cities]);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none h-3 w-full"
        style={{
          background: 'linear-gradient(180deg, var(--footer-prev-bg, #f8fafc), #081321)',
        }} />
      <footer className="relative isolate w-full min-w-0 overflow-hidden
        bg-[#081321] text-slate-100" aria-label="AuroTap site footer"
        style={{
          backgroundImage: 'radial-gradient(ellipse 55% 80% at 6% 8%, rgba(14,165,233,0.10), transparent 75%), radial-gradient(ellipse 55% 80% at 95% 90%, rgba(16,185,129,0.045), transparent 70%)',
        }}>
        <div aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px
            bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-6 pt-8
          sm:px-6 sm:pb-7 sm:pt-10 lg:px-8">
          <div className="grid min-w-0 gap-x-6 gap-y-7
            sm:grid-cols-2 lg:grid-cols-[1.2fr_0.82fr_0.82fr_1.08fr] lg:gap-x-9">
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <Link href="/" aria-label="AuroTap home"
                className="inline-flex min-h-11 items-center gap-2.5 rounded-lg
                  focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                <Image src="/aurotap-mark.svg" width={39} height={39} alt=""
                  className="size-10 shrink-0 rounded-xl bg-white/10 p-0.5" />
                <span className="text-[22px] font-extrabold tracking-tight text-white">
                  AuroTap
                </span>
              </Link>
              <p className="mt-2 max-w-[21rem] text-[13px] leading-6 text-slate-300">
                Water delivered. Water problems solved.
                Order water and book trusted home water services in supported areas.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/book?service=water_can"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5
                    rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400
                    px-4 py-2 text-sm font-bold text-[#081321]
                    shadow-[0_6px_16px_rgba(14,165,233,0.16)]
                    transition-colors hover:from-sky-400 hover:to-cyan-300
                    focus-visible:outline focus-visible:outline-2
                    focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                  Order water <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link href="/book?service=plumbing"
                  className="inline-flex min-h-11 items-center justify-center
                    rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2
                    text-sm font-semibold text-white transition-colors
                    hover:border-white/40 hover:bg-white/10
                    focus-visible:outline focus-visible:outline-2
                    focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                  Find a plumber
                </Link>
              </div>
              <SocialChannels />
            </div>

            <nav aria-label="Our services" className="min-w-0">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-white">
                Services
              </h2>
              <div className="grid gap-x-2 gap-y-0.5">
                {SERVICES.map((item) => (
                  <Link key={item.href} className={linkClass} href={item.href}>
                    {item.title}
                  </Link>
                ))}
              </div>
            </nav>

            <nav aria-label="Footer navigation" className="min-w-0">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-white">
                Explore AuroTap
              </h2>
              <div className="grid gap-x-2 gap-y-0.5">
                {QUICK_LINKS.map((item) => (
                  <Link key={item.href} className={linkClass} href={item.href}>
                    {item.title}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <h2 className="mb-3 text-sm font-bold tracking-wide text-white">
                Where we operate
              </h2>
              <CompactCityList groups={groupedCities} />
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href="/become-a-supplier" className={linkClass}>
                  Become a supplier
                </Link>
                <Link href="/register/pro?type=technician" className={linkClass}>
                  Join as technician
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5
            border-t border-white/10 pt-3.5 text-sm text-slate-300">
            <a href="tel:+919889305803"
              className="inline-flex min-h-9 items-center gap-1.5 hover:text-white
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <Phone size={15} aria-hidden="true" />
              +91 98893 05803
            </a>
            <a href="mailto:support.aurotap@gmail.com"
              className="inline-flex min-h-9 max-w-full items-center gap-1.5
                break-all hover:text-white focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2">
              <Mail size={15} className="shrink-0" aria-hidden="true" />
              support.aurotap@gmail.com
            </a>
            <Link href="/contact" className={linkClass}>Contact us</Link>
          </div>

          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-4
            text-xs leading-5 text-slate-400 sm:flex-row sm:items-center
            sm:justify-between">
            <p suppressHydrationWarning>
              © {new Date().getFullYear()} AuroTap. All rights reserved.
            </p>
            <nav aria-label="Policies"
              className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {LEGAL.map((item) => (
                <Link key={item.href} href={item.href}
                  className="inline-flex min-h-8 items-center text-slate-300
                    hover:text-white focus-visible:outline focus-visible:outline-2
                    focus-visible:outline-offset-2 focus-visible:outline-sky-300">
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
