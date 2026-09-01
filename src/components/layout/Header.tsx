'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FALLBACK_CITIES, type City } from '@/lib/cities';
import { safeGet, safeSet } from '@/lib/storage';

const NAV_LINKS = [
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Technicians', href: '/technicians' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const CITY_KEY = 'aw_city';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [city, setCity] = useState<string>('Gorakhpur');
  const [cities, setCities] = useState<City[]>(FALLBACK_CITIES.filter((c) => c.status !== 'waitlist'));
  const pathname = usePathname();
  const { user, role, isLoggedIn } = useAuth();

  useEffect(() => {
    const stored = safeGet(CITY_KEY);
    if (stored) setCity(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/cities')
      .then(async (r) => (r.ok ? ((await r.json()) as City[]) : FALLBACK_CITIES))
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const listed = data.filter((c) => c.status === 'active' || c.status === 'coming_soon');
        setCities(listed.length ? listed : FALLBACK_CITIES.filter((c) => c.status !== 'waitlist'));
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const dashboardHref =
    role === 'admin'
      ? '/admin/dashboard'
      : role === 'supplier'
        ? '/supplier/dashboard'
        : role === 'technician'
          ? '/technician/dashboard'
          : '/customer/home';

  const onCity = (value: string) => {
    setCity(value);
    safeSet(CITY_KEY, value);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0A1628]/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20'
            : 'bg-[#0A1628]'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-110">
              <span className="text-xs font-black text-white">AW</span>
            </div>
            <span className="hidden text-lg font-bold tracking-tight text-white sm:block">
              Auro<span className="text-cyan-400">Water</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                  pathname === link.href
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 md:flex">
              <span className="text-xs text-cyan-400" aria-hidden>
                📍
              </span>
              <label className="sr-only" htmlFor="header-city">
                City
              </label>
              <select
                id="header-city"
                value={city}
                onChange={(e) => onCity(e.target.value)}
                className="cursor-pointer bg-transparent pr-1 text-xs font-medium text-white outline-none"
              >
                {cities.every((c) => c.name !== city) ? (
                  <option value={city} className="bg-[#0A1628]">
                    {city}
                  </option>
                ) : null}
                {cities.map((c) => (
                  <option key={c.id} value={c.name} className="bg-[#0A1628]">
                    {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
                  </option>
                ))}
              </select>
            </div>

            {isLoggedIn && user ? (
              <Link
                href={dashboardHref}
                className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-cyan-500/30 sm:flex"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20">
                  <span className="text-[10px] font-bold text-cyan-400">
                    {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden text-sm text-neutral-400 transition-colors hover:text-white sm:block"
              >
                Sign In
              </Link>
            )}

            <Link
              href="/book"
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-150 hover:opacity-90 active:scale-95"
            >
              <span className="hidden sm:block">Book Water</span>
              <span className="sm:hidden">Book</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/5 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 transform border-l border-white/5 bg-[#0A1628] transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex items-center justify-between">
            <span className="font-bold text-white">Menu</span>
            <button type="button" onClick={() => setMobileOpen(false)} className="text-xl text-neutral-400 hover:text-white" aria-label="Close menu">
              ✕
            </button>
          </div>

          <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <span className="text-cyan-400" aria-hidden>📍</span>
            <select
              value={city}
              onChange={(e) => onCity(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-white outline-none"
            >
              {cities.map((c) => (
                  <option key={c.id} value={c.name} className="bg-[#0A1628]">
                    {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
                  </option>
                ))}
            </select>
          </div>

          <nav className="flex-1 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-xl px-4 py-3 text-sm transition-colors ${
                  pathname === link.href
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="space-y-2 border-t border-white/5 pt-6">
            {isLoggedIn ? (
              <Link
                href={dashboardHref}
                className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
              >
                My Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="block w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
