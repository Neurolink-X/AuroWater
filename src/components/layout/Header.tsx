'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FALLBACK_CITIES, type City } from '@/lib/cities';
import { safeGet, safeSet } from '@/lib/storage';
import HeaderLocation from './HeaderLocation';
import { readCache, useDismiss, whenIdle, writeCache } from './header-utils';

/* ───────────── Navigation ───────────── */

const PRIMARY_LINKS = [
  { label: 'Services', href: '/services' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
];

const MORE_LINKS = [
  { label: 'Technicians', href: '/technicians', hint: 'Verified service professionals' },
  { label: 'About', href: '/about', hint: 'Who we are' },
  { label: 'Contact', href: '/contact', hint: 'Talk to our team' },
  { label: 'Become a partner', href: '/register/pro', hint: 'Supplier and technician signup' },
];

const CITY_KEY = 'aw_city';
const CITIES_CACHE_KEY = 'aw_cities_v1';
const CITIES_TTL_MS = 10 * 60 * 1000;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Only keep cities customers can see (live or coming soon). */
function usableCities(data: unknown): City[] {
  if (!Array.isArray(data)) return [];
  return (data as City[]).filter(
    (c) =>
      !!c &&
      typeof c.name === 'string' &&
      (c.status === 'active' || c.status === 'coming_soon')
  );
}

export default function Header() {
  const pathname = usePathname();
  const { user, role, isLoggedIn } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [city, setCity] = useState<string>('Gorakhpur');
  const [cities, setCities] = useState<City[]>(() =>
    FALLBACK_CITIES.filter((c) => c.status !== 'waitlist')
  );

  const moreRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

  const current = pathname ?? '';
  const isActive = useCallback(
    (href: string) => current === href || current.startsWith(`${href}/`),
    [current]
  );

  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(moreOpen, closeMore, moreRef);
  useDismiss(menuOpen, closeMenu, menuRef);

  const isCustomer = isLoggedIn && role === 'customer';

  const dashboardHref = useMemo(() => {
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'supplier') return '/supplier/dashboard';
    if (role === 'technician') return '/technician/dashboard';
    return '/customer/home';
  }, [role]);

  // Remember the city the customer picked (other pages read the same key).
  useEffect(() => {
    const stored = safeGet(CITY_KEY);
    if (stored) setCity(stored);
  }, []);

  const onCityChange = useCallback((value: string) => {
    setCity(value);
    safeSet(CITY_KEY, value);
  }, []);

  // City list: cached for 10 minutes and fetched after first paint, so it never slows page load.
  useEffect(() => {
    const cached = usableCities(readCache<unknown>(CITIES_CACHE_KEY, CITIES_TTL_MS));
    if (cached.length) {
      setCities(cached);
      return;
    }
    const controller = new AbortController();
    const cancel = whenIdle(() => {
      void fetch('/api/cities', { signal: controller.signal })
        .then(async (res) => (res.ok ? ((await res.json()) as unknown) : null))
        .then((data) => {
          if (controller.signal.aborted) return;
          const list = usableCities(data);
          if (list.length) {
            setCities(list);
            writeCache(CITIES_CACHE_KEY, list);
          }
        })
        .catch(() => {
          /* keep the built-in list */
        });
    });
    return () => {
      controller.abort();
      cancel();
    };
  }, []);

  // Glass effect after scrolling (one state change, not one per scroll event).
  useEffect(() => {
    let ticking = false;
    const update = () => {
      setScrolled(window.scrollY > 12);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close every menu when the page changes.
  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Mobile drawer: lock page scroll, close with Escape, focus the close button.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    drawerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const initial = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  const linkClass = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      active ? 'bg-cyan-500/10 text-cyan-400' : 'text-neutral-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled
            ? 'border-white/5 bg-[#0A1628]/95 shadow-lg shadow-black/20 md:bg-[#0A1628]/85 md:backdrop-blur-xl'
            : 'border-transparent bg-[#0A1628]'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="AuroWater home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-105">
              <span className="text-xs font-black text-white">AW</span>
            </span>
            <span className="hidden whitespace-nowrap text-lg font-bold tracking-tight text-white sm:block">
              Auro<span className="text-cyan-400">Water</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main">
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={linkClass(isActive(link.href))}
              >
                {link.label}
              </Link>
            ))}

            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className={`flex items-center gap-1.5 ${linkClass(MORE_LINKS.some((l) => isActive(l.href)))}`}
              >
                More <Chevron open={moreOpen} />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  aria-label="More"
                  className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
                >
                  {MORE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      prefetch={false}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5"
                    >
                      <span className="block text-sm font-semibold text-white">{link.label}</span>
                      <span className="block text-xs text-neutral-400">{link.hint}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <HeaderLocation
              city={city}
              cities={cities}
              onCityChange={onCityChange}
              signedInCustomer={isCustomer}
            />

            {isLoggedIn && user ? (
              <div ref={menuRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Account menu"
                  className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 pl-2 pr-3 text-white transition-colors hover:border-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-bold text-cyan-300">
                    {initial}
                  </span>
                  <Chevron open={menuOpen} />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Account"
                    className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
                  >
                    <Link role="menuitem" href={dashboardHref} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/5">
                      Dashboard
                    </Link>
                    {isCustomer && (
                      <>
                        <Link role="menuitem" href="/customer/history" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/5">
                          My orders
                        </Link>
                        <Link role="menuitem" href="/customer/addresses" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/5">
                          Saved addresses
                        </Link>
                        <Link role="menuitem" href="/customer/account" prefetch={false} className="block rounded-xl px-3 py-2.5 text-sm text-neutral-200 hover:bg-white/5">
                          Account
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white sm:block"
              >
                Sign in
              </Link>
            )}

            <Link
              href="/book"
              className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-150 hover:opacity-90 active:scale-95"
            >
              <span className="hidden sm:inline">Book water</span>
              <span className="sm:hidden">Book</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/5 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed right-0 top-0 z-50 h-full w-72 border-l border-white/5 bg-[#0A1628] transition-[transform,visibility] duration-300 ease-out lg:hidden ${
          mobileOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <span className="font-bold text-white">Menu</span>
            <button
              ref={drawerCloseRef}
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-neutral-400 hover:bg-white/5 hover:text-white"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 space-y-1" aria-label="Mobile">
            {[...PRIMARY_LINKS, ...MORE_LINKS].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`block rounded-xl px-4 py-3 text-sm transition-colors ${
                  isActive(link.href)
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
              <>
                <Link
                  href={dashboardHref}
                  className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
                >
                  My dashboard
                </Link>
                {isCustomer && (
                  <Link
                    href="/customer/history"
                    prefetch={false}
                    className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
                  >
                    My orders
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="block w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}









// 'use client';

// import { useEffect, useState } from 'react';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';
// import { useAuth } from '@/hooks/useAuth';
// import { FALLBACK_CITIES, type City } from '@/lib/cities';
// import { safeGet, safeSet } from '@/lib/storage';

// const NAV_LINKS = [
//   { label: 'Services', href: '/services' },
//   { label: 'How It Works', href: '/how-it-works' },
//   { label: 'Pricing', href: '/pricing' },
//   { label: 'Technicians', href: '/technicians' },
//   { label: 'About', href: '/about' },
//   { label: 'Contact', href: '/contact' },
// ];

// const CITY_KEY = 'aw_city';

// export default function Header() {
//   const [scrolled, setScrolled] = useState(false);
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [city, setCity] = useState<string>('Gorakhpur');
//   const [cities, setCities] = useState<City[]>(FALLBACK_CITIES.filter((c) => c.status !== 'waitlist'));
//   const pathname = usePathname();
//   const { user, role, isLoggedIn } = useAuth();

//   useEffect(() => {
//     const stored = safeGet(CITY_KEY);
//     if (stored) setCity(stored);
//   }, []);

//   useEffect(() => {
//     let cancelled = false;
//     void fetch('/api/cities')
//       .then(async (r) => (r.ok ? ((await r.json()) as City[]) : FALLBACK_CITIES))
//       .then((data) => {
//         if (cancelled || !Array.isArray(data)) return;
//         const listed = data.filter((c) => c.status === 'active' || c.status === 'coming_soon');
//         setCities(listed.length ? listed : FALLBACK_CITIES.filter((c) => c.status !== 'waitlist'));
//       })
//       .catch(() => {
//         /* keep fallback */
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   useEffect(() => {
//     const fn = () => setScrolled(window.scrollY > 20);
//     window.addEventListener('scroll', fn, { passive: true });
//     return () => window.removeEventListener('scroll', fn);
//   }, []);

//   useEffect(() => setMobileOpen(false), [pathname]);

//   useEffect(() => {
//     document.body.style.overflow = mobileOpen ? 'hidden' : '';
//     return () => {
//       document.body.style.overflow = '';
//     };
//   }, [mobileOpen]);

//   const dashboardHref =
//     role === 'admin'
//       ? '/admin/dashboard'
//       : role === 'supplier'
//         ? '/supplier/dashboard'
//         : role === 'technician'
//           ? '/technician/dashboard'
//           : '/customer/home';

//   const onCity = (value: string) => {
//     setCity(value);
//     safeSet(CITY_KEY, value);
//   };

//   return (
//     <>
//       <header
//         className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
//           scrolled
//             ? 'bg-[#0A1628]/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20'
//             : 'bg-[#0A1628]'
//         }`}
//       >
//         <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
//           <Link href="/" className="group flex shrink-0 items-center gap-2.5">
//             <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-110">
//               <span className="text-xs font-black text-white">AW</span>
//             </div>
//             <span className="hidden text-lg font-bold tracking-tight text-white sm:block">
//               Auro<span className="text-cyan-400">Water</span>
//             </span>
//           </Link>

//           <nav className="hidden items-center gap-1 lg:flex">
//             {NAV_LINKS.map((link) => (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 className={`rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
//                   pathname === link.href
//                     ? 'bg-cyan-500/10 text-cyan-400'
//                     : 'text-neutral-400 hover:bg-white/5 hover:text-white'
//                 }`}
//               >
//                 {link.label}
//               </Link>
//             ))}
//           </nav>

//           <div className="flex items-center gap-2 sm:gap-3">
//             <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 md:flex">
//               <span className="text-xs text-cyan-400" aria-hidden>
//                 📍
//               </span>
//               <label className="sr-only" htmlFor="header-city">
//                 City
//               </label>
//               <select
//                 id="header-city"
//                 value={city}
//                 onChange={(e) => onCity(e.target.value)}
//                 className="cursor-pointer bg-transparent pr-1 text-xs font-medium text-white outline-none"
//               >
//                 {cities.every((c) => c.name !== city) ? (
//                   <option value={city} className="bg-[#0A1628]">
//                     {city}
//                   </option>
//                 ) : null}
//                 {cities.map((c) => (
//                   <option key={c.id} value={c.name} className="bg-[#0A1628]">
//                     {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="hidden items-center gap-1 xl:flex">
//               <Link
//                 href="/auth/register"
//                 title="Customer"
//                 className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-cyan-400"
//                 aria-label="Customer signup"
//               >
//                 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
//                 </svg>
//               </Link>
//               <Link
//                 href="/technicians"
//                 title="Technician"
//                 className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-cyan-400"
//                 aria-label="Technicians"
//               >
//                 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 00-1.4 0l-8 8a1 1 0 000 1.4l3 3a1 1 0 001.4 0l8-8a1 1 0 000-1.4l-3-3z" />
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M5 19l3-3" />
//                 </svg>
//               </Link>
//               <Link
//                 href="/auth/register?role=supplier"
//                 title="Supplier"
//                 className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5 hover:text-cyan-400"
//                 aria-label="Supplier signup"
//               >
//                 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
//                   <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M5 7l2 12h10l2-12M9 11v4M15 11v4" />
//                 </svg>
//               </Link>
//             </div>

//             {isLoggedIn && user ? (
//               <Link
//                 href={dashboardHref}
//                 className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-cyan-500/30 sm:flex"
//               >
//                 <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20">
//                   <span className="text-[10px] font-bold text-cyan-400">
//                     {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
//                   </span>
//                 </div>
//                 Dashboard
//               </Link>
//             ) : (
//               <Link
//                 href="/auth/login"
//                 className="hidden text-sm text-neutral-400 transition-colors hover:text-white sm:block"
//               >
//                 Sign In
//               </Link>
//             )}

//             <Link
//               href="/book"
//               className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-150 hover:opacity-90 active:scale-95"
//             >
//               <span className="hidden sm:block">Book Water</span>
//               <span className="sm:hidden">Book</span>
//               <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
//                 <path d="M5 12h14M12 5l7 7-7 7" />
//               </svg>
//             </Link>

//             <button
//               type="button"
//               onClick={() => setMobileOpen((o) => !o)}
//               className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/5 lg:hidden"
//               aria-label="Toggle menu"
//               aria-expanded={mobileOpen}
//             >
//               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
//               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
//               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
//             </button>
//           </div>
//         </div>
//       </header>

//       <div
//         className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
//           mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
//         }`}
//         onClick={() => setMobileOpen(false)}
//         aria-hidden
//       />

//       <div
//         className={`fixed top-0 right-0 z-50 h-full w-72 transform border-l border-white/5 bg-[#0A1628] transition-transform duration-300 ease-out lg:hidden ${
//           mobileOpen ? 'translate-x-0' : 'translate-x-full'
//         }`}
//       >
//         <div className="flex h-full flex-col p-6">
//           <div className="mb-8 flex items-center justify-between">
//             <span className="font-bold text-white">Menu</span>
//             <button type="button" onClick={() => setMobileOpen(false)} className="text-xl text-neutral-400 hover:text-white" aria-label="Close menu">
//               ✕
//             </button>
//           </div>

//           <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
//             <span className="text-cyan-400" aria-hidden>📍</span>
//             <select
//               value={city}
//               onChange={(e) => onCity(e.target.value)}
//               className="flex-1 bg-transparent text-sm font-medium text-white outline-none"
//             >
//               {cities.map((c) => (
//                   <option key={c.id} value={c.name} className="bg-[#0A1628]">
//                     {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
//                   </option>
//                 ))}
//             </select>
//           </div>

//           <nav className="flex-1 space-y-1">
//             {NAV_LINKS.map((link) => (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 className={`block rounded-xl px-4 py-3 text-sm transition-colors ${
//                   pathname === link.href
//                     ? 'bg-cyan-500/10 text-cyan-400'
//                     : 'text-neutral-300 hover:bg-white/5 hover:text-white'
//                 }`}
//               >
//                 {link.label}
//               </Link>
//             ))}
//           </nav>

//           <div className="space-y-2 border-t border-white/5 pt-6">
//             {isLoggedIn ? (
//               <Link
//                 href={dashboardHref}
//                 className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
//               >
//                 My Dashboard
//               </Link>
//             ) : (
//               <>
//                 <Link
//                   href="/login"
//                   className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
//                 >
//                   Sign In
//                 </Link>
//                 <Link
//                   href="/register"
//                   className="block w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
//                 >
//                   Create Account
//                 </Link>
//               </>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }
