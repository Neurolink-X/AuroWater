// 'use client';

// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';
// import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
// import { clearSession, useAuth } from '@/hooks/useAuth';
// import { authLogout, getToken } from '@/lib/api-client';
// import { createClient } from '@/utils/supabase/client';
// import { FALLBACK_CITIES, type City } from '@/lib/cities';
// import { safeGet, safeSet } from '@/lib/storage';
// import Image from "next/image";

// /* ───────────── Navigation data ───────────── */

// /** "Services" is rendered separately (link + quick-book menu). */
// const PRIMARY_LINKS = [
//   { label: 'How it works', href: '/how-it-works' },
//   { label: 'Pricing', href: '/pricing' },
// ];

// const MORE_LINKS = [
//   { label: 'Technicians', href: '/technicians', hint: 'Verified service professionals' },
//   { label: 'About', href: '/about', hint: 'Who we are' },
//   { label: 'Contact', href: '/contact', hint: 'Talk to our team' },
//   { label: 'Become a partner', href: '/register/pro', hint: 'Supplier and technician signup' },
// ];

// /**
//  * Quick-book shortcuts: open the booking wizard with the service preselected.
//  * After the service-page SEO audit you can point these at each service's own page.
//  */
// const SERVICES = [
//   { key: 'water_can', label: 'Water cans', hint: 'Fresh cans at your door', icon: '💧' },
//   { key: 'water_tanker', label: 'Water tanker', hint: 'Bulk water delivery', icon: '🚚' },
//   { key: 'ro_service', label: 'RO service', hint: 'Service & filters', icon: '🔧' },
//   { key: 'plumbing', label: 'Plumbing', hint: 'Leaks, taps, fittings', icon: '🛠️' },
//   { key: 'borewell', label: 'Borewell', hint: 'Repair & maintenance', icon: '⛏️' },
//   { key: 'motor_pump', label: 'Motor & pump', hint: 'Repair & install', icon: '⚙️' },
//   { key: 'tank_cleaning', label: 'Tank cleaning', hint: 'Safe, hygienic', icon: '✨' },
// ] as const;

// const bookHref = (key: string) => `/book?service=${encodeURIComponent(key)}`;

// const ORDER_LABEL: Record<string, string> = {
//   PENDING: 'Finding supplier',
//   ASSIGNED: 'Supplier assigned',
//   IN_PROGRESS: 'On the way',
// };

// const WHATSAPP_HREF = 'https://wa.me/919889305803?text=Hi%20AuroWater%2C%20I%20need%20help';

// const CITY_KEY = 'aw_city';
// const DEFAULT_CITY = 'Kanpur';
// const CITIES_CACHE_KEY = 'aw_cities_v2';
// const CITIES_TTL_MS = 10 * 60 * 1000;

// type BeforeInstallPromptEvent = Event & {
//   prompt: () => Promise<void>;
//   userChoice: Promise<{
//     outcome: 'accepted' | 'dismissed';
//     platform: string;
//   }>;
// };

// function isStandaloneDisplayMode(): boolean {
//   if (typeof window === 'undefined') return false;
//   return (
//     window.matchMedia('(display-mode: standalone)').matches ||
//     window.matchMedia('(display-mode: fullscreen)').matches ||
//     (window.navigator as Navigator & { standalone?: boolean }).standalone === true
//   );
// }

// function isIosDevice(): boolean {
//   if (typeof window === 'undefined') return false;
//   return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
// }

// /* ───────────── Small helpers (kept local so this file has no hidden dependencies) ───────────── */

// function Chevron({ open }: { open: boolean }) {
//   return (
//     <svg
//       className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       strokeWidth={2.5}
//       aria-hidden="true"
//     >
//       <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
//     </svg>
//   );
// }

// /** Accepts a bare array or the API envelope `{ data: [...] }`; keeps live and coming-soon cities. */
// function usableCities(data: unknown): City[] {
//   const list: unknown[] = Array.isArray(data)
//     ? data
//     : data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)
//       ? (data as { data: unknown[] }).data
//       : [];
//   return (list as City[]).filter(
//     (c) =>
//       !!c &&
//       typeof c.name === 'string' &&
//       (c.status === 'active' || c.status === 'coming_soon')
//   );
// }

// function readCitiesCache(): City[] {
//   try {
//     const raw = safeGet(CITIES_CACHE_KEY);
//     if (!raw) return [];
//     const parsed = JSON.parse(raw) as { t?: number; v?: unknown };
//     if (!parsed || typeof parsed.t !== 'number' || Date.now() - parsed.t > CITIES_TTL_MS) return [];
//     return usableCities(parsed.v);
//   } catch {
//     return [];
//   }
// }

// function writeCitiesCache(list: City[]) {
//   try {
//     safeSet(CITIES_CACHE_KEY, JSON.stringify({ t: Date.now(), v: list }));
//   } catch {
//     /* storage unavailable or full: caching is optional */
//   }
// }

// /** Run work after first paint so it never slows page load. Returns a cancel function. */
// function whenIdle(cb: () => void): () => void {
//   if (typeof window === 'undefined') return () => undefined;
//   if ('requestIdleCallback' in window) {
//     const id = window.requestIdleCallback(() => cb(), { timeout: 2000 });
//     return () => window.cancelIdleCallback(id);
//   }
//   const t = setTimeout(cb, 400);
//   return () => clearTimeout(t);
// }

// /** Close a dropdown on outside click/tap or Escape. */
// function useDismiss(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
//   useEffect(() => {
//     if (!open) return;
//     const onDown = (e: MouseEvent | TouchEvent) => {
//       if (ref.current && !ref.current.contains(e.target as Node)) onClose();
//     };
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === 'Escape') onClose();
//     };
//     document.addEventListener('mousedown', onDown);
//     document.addEventListener('touchstart', onDown, { passive: true });
//     document.addEventListener('keydown', onKey);
//     return () => {
//       document.removeEventListener('mousedown', onDown);
//       document.removeEventListener('touchstart', onDown);
//       document.removeEventListener('keydown', onKey);
//     };
//   }, [open, onClose, ref]);
// }

// type ActiveOrder = { id: string; status: string };

// /**
//  * "Is an order in progress?" for signed-in customers. Runs after first paint, refreshes every
//  * minute and when the tab becomes visible, and never redirects: any auth problem hides the pill.
//  */
// function useActiveOrder(enabled: boolean): ActiveOrder | null {
//   const [order, setOrder] = useState<ActiveOrder | null>(null);

//   useEffect(() => {
//     if (!enabled) {
//       setOrder(null);
//       return;
//     }
//     let stopped = false;
//     const controller = new AbortController();

//     const run = async () => {
//       if (stopped || document.visibilityState !== 'visible') return;
//       try {
//         const token = await getToken();
//         if (!token || stopped) return;
//         const res = await fetch('/api/customer/orders?status=PENDING,ASSIGNED,IN_PROGRESS&limit=1', {
//           headers: { Authorization: `Bearer ${token}` },
//           signal: controller.signal,
//         });
//         if (res.status === 401 || res.status === 403) {
//           stopped = true;
//           setOrder(null);
//           return;
//         }
//         if (!res.ok) return;
//         const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
//         const list = json && Array.isArray(json.data) ? (json.data as { id?: string; status?: string }[]) : [];
//         const row = list[0];
//         if (!stopped) setOrder(row?.id ? { id: String(row.id), status: String(row.status ?? '') } : null);
//       } catch {
//         /* offline or request cancelled: keep the last known state */
//       }
//     };

//     const cancelIdle = whenIdle(() => {
//       void run();
//     });
//     const timer = window.setInterval(() => void run(), 60_000);
//     const onVisible = () => {
//       if (document.visibilityState === 'visible') void run();
//     };
//     document.addEventListener('visibilitychange', onVisible);

//     return () => {
//       stopped = true;
//       controller.abort();
//       cancelIdle();
//       window.clearInterval(timer);
//       document.removeEventListener('visibilitychange', onVisible);
//     };
//   }, [enabled]);

//   return order;
// }

// /* ───────────── Component ───────────── */

// export default function Header() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const { user, role, isLoggedIn, hydrated } = useAuth();

//   const [scrolled, setScrolled] = useState(false);
//   const [mobileOpen, setMobileOpen] = useState(false);
//   const [servicesOpen, setServicesOpen] = useState(false);
//   const [moreOpen, setMoreOpen] = useState(false);
//   const [menuOpen, setMenuOpen] = useState(false);
//   const [signingOut, setSigningOut] = useState(false);
//   const [city, setCity] = useState<string>(DEFAULT_CITY);
//   const [cityReady, setCityReady] = useState(false);
//   const [cities, setCities] = useState<City[]>(() =>
//     FALLBACK_CITIES.filter((c) => c.status !== 'waitlist')
//   );

//   const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
//   const [installHelpOpen, setInstallHelpOpen] = useState(false);
//   const [installStatus, setInstallStatus] = useState<
//     'checking' | 'available' | 'fallback' | 'installed'
//   >('checking');

//   const servicesRef = useRef<HTMLDivElement | null>(null);
//   const moreRef = useRef<HTMLDivElement | null>(null);
//   const menuRef = useRef<HTMLDivElement | null>(null);
//   const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

//   const current = pathname ?? '';
//   const isActive = useCallback(
//     (href: string) => current === href || current.startsWith(`${href}/`),
//     [current]
//   );

//   const closeServices = useCallback(() => setServicesOpen(false), []);
//   const closeMore = useCallback(() => setMoreOpen(false), []);
//   const closeMenu = useCallback(() => setMenuOpen(false), []);
//   useDismiss(servicesOpen, closeServices, servicesRef);
//   useDismiss(moreOpen, closeMore, moreRef);
//   useDismiss(menuOpen, closeMenu, menuRef);

//   const isCustomer = isLoggedIn && role === 'customer';
//   const activeOrder = useActiveOrder(Boolean(hydrated && isCustomer));

//   const dashboardHref = useMemo(() => {
//     if (role === 'admin') return '/admin/dashboard';
//     if (role === 'supplier') return '/supplier/dashboard';
//     if (role === 'technician') return '/technician/dashboard';
//     return '/customer/home';
//   }, [role]);

//   // Remember the city the customer picked (other pages read the same key).
//   useEffect(() => {
//     const stored = safeGet(CITY_KEY);
//     if (stored) setCity(stored);
//     setCityReady(true);
//   }, []);

//   const onCityChange = useCallback((value: string) => {
//     setCity(value);
//     safeSet(CITY_KEY, value);
//   }, []);

//   // City list: cached for 10 minutes, fetched after first paint.
//   useEffect(() => {
//     const cached = readCitiesCache();
//     if (cached.length) {
//       setCities(cached);
//       return;
//     }
//     const controller = new AbortController();
//     const cancel = whenIdle(() => {
//       void fetch('/api/cities', { signal: controller.signal })
//         .then(async (res) => (res.ok ? ((await res.json()) as unknown) : null))
//         .then((data) => {
//           if (controller.signal.aborted) return;
//           const list = usableCities(data);
//           if (list.length) {
//             setCities(list);
//             writeCitiesCache(list);
//           }
//         })
//         .catch(() => {
//           /* keep the built-in list */
//         });
//     });
//     return () => {
//       controller.abort();
//       cancel();
//     };

//   }, []);

//   // PWA install: keep the browser prompt available for our own UI instead of relying on a one-time popup.
//   useEffect(() => {
//     if (isStandaloneDisplayMode()) {
//       setInstallStatus('installed');
//       return;
//     }

//     const isTouchLayout =
//       window.matchMedia('(pointer: coarse)').matches ||
//       window.matchMedia('(max-width: 1023px)').matches;

//     setInstallStatus(isIosDevice() || isTouchLayout ? 'fallback' : 'checking');

//     const onBeforeInstallPrompt = (event: Event) => {
//       event.preventDefault();
//       setInstallPrompt(event as BeforeInstallPromptEvent);
//       setInstallStatus('available');
//     };

//     const onAppInstalled = () => {
//       setInstallPrompt(null);
//       setInstallHelpOpen(false);
//       setInstallStatus('installed');
//       safeSet('aw_pwa_installed', '1');
//     };

//     window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
//     window.addEventListener('appinstalled', onAppInstalled);

//     return () => {
//       window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
//       window.removeEventListener('appinstalled', onAppInstalled);
//     };
//   }, []);

//   const installAvailable =
//     installStatus === 'available' || installStatus === 'fallback';

//   const handleInstallApp = useCallback(async () => {
//     if (isStandaloneDisplayMode()) {
//       setInstallStatus('installed');
//       return;
//     }

//     if (!installPrompt) {
//       setInstallHelpOpen(true);
//       return;
//     }

//     try {
//       await installPrompt.prompt();
//       const choice = await installPrompt.userChoice;
//       setInstallPrompt(null);

//       if (choice.outcome === 'accepted') {
//         setInstallStatus('installed');
//         safeSet('aw_pwa_installed', '1');
//       } else {
//         // The native prompt is one-shot. Keep a useful manual fallback instead of a dead button.
//         setInstallStatus('fallback');
//       }
//     } catch {
//       setInstallPrompt(null);
//       setInstallStatus('fallback');
//     }
//   }, [installPrompt]);

//   useEffect(() => {
//     if (!installHelpOpen) return;

//     const onKey = (event: KeyboardEvent) => {
//       if (event.key === 'Escape') setInstallHelpOpen(false);
//     };

//     document.addEventListener('keydown', onKey);
//     return () => document.removeEventListener('keydown', onKey);
//   }, [installHelpOpen]);

//   // Glass effect after scrolling (one state change, not one per scroll event).
//   useEffect(() => {
//     let ticking = false;
//     const update = () => {
//       setScrolled(window.scrollY > 12);
//       ticking = false;
//     };
//     const onScroll = () => {
//       if (ticking) return;
//       ticking = true;
//       window.requestAnimationFrame(update);
//     };
//     update();
//     window.addEventListener('scroll', onScroll, { passive: true });
//     return () => window.removeEventListener('scroll', onScroll);
//   }, []);

//   // Close every menu when the page changes.
//   useEffect(() => {
//     setMobileOpen(false);
//     setServicesOpen(false);
//     setMoreOpen(false);
//     setMenuOpen(false);
//   }, [pathname]);

//   // Mobile drawer: lock page scroll, close with Escape, focus the close button.
//   useEffect(() => {
//     if (!mobileOpen) return;
//     const previous = document.body.style.overflow;
//     document.body.style.overflow = 'hidden';
//     const onKey = (event: KeyboardEvent) => {
//       if (event.key === 'Escape') setMobileOpen(false);
//     };
//     document.addEventListener('keydown', onKey);
//     drawerCloseRef.current?.focus();
//     return () => {
//       document.body.style.overflow = previous;
//       document.removeEventListener('keydown', onKey);
//     };
//   }, [mobileOpen]);

//   /** Real sign out: server cookies, Supabase session, local state, then home. */
//   const signOut = useCallback(async () => {
//     if (signingOut) return;
//     setSigningOut(true);
//     setMenuOpen(false);
//     setMobileOpen(false);
//     try {
//       await authLogout();
//     } catch {
//       /* continue: local sign-out below still happens */
//     }
//     try {
//       await createClient().auth.signOut();
//     } catch {
//       /* session may already be gone */
//     }
//     clearSession();
//     setSigningOut(false);
//     router.replace('/');
//     router.refresh();
//   }, [signingOut, router]);

//   const initial = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

//   const linkClass = (active: boolean) =>
//     `relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
//       active
//         ? 'text-cyan-300 after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-cyan-400'
//         : 'text-neutral-300 hover:bg-white/5 hover:text-white'
//     }`;

//   const menuItem =
//     'block rounded-xl px-3 py-2.5 text-sm text-neutral-200 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none';

//   const cityOptions = cities.some((c) => c.name === city) ? cities : [{ id: '__current', name: city, status: 'active' } as City, ...cities];

//   return (
//     <>
//       <header
//         className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
//           scrolled
//             ? 'border-white/5 bg-[#0A1628]/95 shadow-lg shadow-black/20 md:bg-[#0A1628]/85 md:backdrop-blur-xl'
//             : 'border-transparent bg-[#0A1628]'
//         }`}
//       >
//         <div
//           aria-hidden="true"
//           className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent transition-opacity duration-300 ${
//             scrolled ? 'opacity-100' : 'opacity-0'
//           }`}
//         />

//       <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        
//  <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="AuroWater home">
//   <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-105">
//     <Image
//       src="/aurotap-mark.svg"
//       alt=""
//       width={40}
//       height={40}
//       className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(56,189,248,0.25)]"
//       priority
//       unoptimized
//     />
//   </span>

//     <span className="hidden whitespace-nowrap text-[1.05rem] font-extrabold tracking-tight text-white sm:block">
//       Auro<span className="text-cyan-400">Water</span>
//     </span>
//   </Link>

//           <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main">
//             {/* Services: a real link (good for SEO) plus a quick-book menu */}
//             <div ref={servicesRef} className="relative flex items-center">
//               <Link
//                 href="/services"
//                 aria-current={isActive('/services') ? 'page' : undefined}
//                 className={linkClass(isActive('/services'))}
//               >
//                 Services
//               </Link>
//               <button
//                 type="button"
//                 onClick={() => {
//                   setServicesOpen((o) => !o);
//                   setMoreOpen(false);
//                 }}
//                 aria-haspopup="menu"
//                 aria-expanded={servicesOpen}
//                 aria-label="Quick book a service"
//                 className="-ml-1.5 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
//               >
//                 <Chevron open={servicesOpen} />
//               </button>
//               {servicesOpen && (
//                 <div
//                   role="menu"
//                   aria-label="Book a service"
//                   className="absolute left-0 top-full mt-2 w-[22rem] rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
//                 >
//                   <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
//                     Book in a minute
//                   </p>
//                   <div className="grid grid-cols-2 gap-1">
//                     {SERVICES.map((s) => (
//                       <Link
//                         key={s.key}
//                         role="menuitem"
//                         href={bookHref(s.key)}
//                         prefetch={false}
//                         className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
//                       >
//                         <span className="mt-0.5 text-base" aria-hidden="true">
//                           {s.icon}
//                         </span>
//                         <span className="min-w-0">
//                           <span className="block text-sm font-semibold text-white">{s.label}</span>
//                           <span className="block truncate text-[11px] text-neutral-400">{s.hint}</span>
//                         </span>
//                       </Link>
//                     ))}
//                   </div>
//                   <Link
//                     role="menuitem"
//                     href="/services"
//                     className="mt-1 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-cyan-300 transition-colors hover:bg-white/5"
//                   >
//                     View all services →
//                   </Link>
//                 </div>
//               )}
//             </div>

//             {PRIMARY_LINKS.map((link) => (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 aria-current={isActive(link.href) ? 'page' : undefined}
//                 className={linkClass(isActive(link.href))}
//               >
//                 {link.label}
//               </Link>
//             ))}

//             <div ref={moreRef} className="relative">
//               <button
//                 type="button"
//                 onClick={() => {
//                   setMoreOpen((o) => !o);
//                   setServicesOpen(false);
//                 }}
//                 aria-haspopup="menu"
//                 aria-expanded={moreOpen}
//                 className={`flex items-center gap-1.5 ${linkClass(MORE_LINKS.some((l) => isActive(l.href)))}`}
//               >
//                 More <Chevron open={moreOpen} />
//               </button>
//               {moreOpen && (
//                 <div
//                   role="menu"
//                   aria-label="More"
//                   className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
//                 >
//                   {MORE_LINKS.map((link) => (
//                     <Link
//                       key={link.href}
//                       href={link.href}
//                       role="menuitem"
//                       prefetch={false}
//                       className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
//                     >
//                       <span className="block text-sm font-semibold text-white">{link.label}</span>
//                       <span className="block text-xs text-neutral-400">{link.hint}</span>
//                     </Link>
//                   ))}
//                 </div>
//               )}
//             </div>
//           </nav>

//           <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2.5">
//             {activeOrder ? (
//               <Link
//                 href={`/customer/track/${activeOrder.id}`}
//                 aria-label="Track your active order"
//                 className="hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20 xl:flex"
//               >
//                 <span className="relative flex h-2 w-2" aria-hidden="true">
//                   <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
//                   <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
//                 </span>
//                 <span className="whitespace-nowrap">{ORDER_LABEL[activeOrder.status] ?? 'Track order'}</span>
//               </Link>
//             ) : null}

//             {installAvailable ? (
//               <button
//                 type="button"
//                 onClick={() => void handleInstallApp()}
//                 aria-label="Install AuroTap app"
//                 className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-sm font-bold text-cyan-100 shadow-sm shadow-cyan-950/20 transition-all hover:border-cyan-300/35 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-[0.98] md:flex"
//               >
//                 <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-300/10" aria-hidden="true">
//                   <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                     <path d="M12 3v11" />
//                     <path d="m8 10 4 4 4-4" />
//                     <path d="M5 21h14" />
//                   </svg>
//                 </span>
//                 <span className="hidden xl:inline">Install AuroTap</span>
//                 <span className="xl:hidden">Install</span>
//               </button>
//             ) : null}

//             {/* City: a native select. It opens the phone's own picker, so it can never be clipped. */}
//             <div
//               className={`relative min-w-0 transition-opacity duration-150 ${cityReady ? 'opacity-100' : 'opacity-0'}`}
//             >
//               <svg
//                 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth={2}
//                 aria-hidden="true"
//               >
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
//                 <circle cx="12" cy="10" r="2.5" />
//               </svg>
//               <label htmlFor="header-city" className="sr-only">
//                 Delivery city
//               </label>
//               <select
//                 id="header-city"
//                 value={city}
//                 onChange={(e) => onCityChange(e.target.value)}
//                 className="h-10 w-full max-w-[8.5rem] cursor-pointer appearance-none truncate rounded-xl border border-white/10 bg-white/5 pl-8 pr-7 text-sm font-medium text-white outline-none transition-colors hover:border-cyan-500/30 focus-visible:ring-2 focus-visible:ring-cyan-400 sm:max-w-[10rem]"
//               >
//                 {cityOptions.map((c) => (
//                   <option key={c.id ?? c.name} value={c.name} className="bg-[#0A1628] text-white">
//                     {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
//                   </option>
//                 ))}
//               </select>
//               <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
//                 <Chevron open={false} />
//               </span>
//             </div>

//             {!hydrated ? (
//               /* Reserve the space so nothing jumps when the session loads */
//               <div className="hidden h-10 w-[72px] sm:block" aria-hidden="true" />
//             ) : isLoggedIn && user ? (
//               <div ref={menuRef} className="relative hidden sm:block">
//                 <button
//                   type="button"
//                   onClick={() => setMenuOpen((o) => !o)}
//                   aria-haspopup="menu"
//                   aria-expanded={menuOpen}
//                   aria-label="Account menu"
//                   className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 pl-2 pr-3 text-white transition-colors hover:border-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
//                 >
//                   <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-bold text-cyan-300">
//                     {initial}
//                   </span>
//                   <Chevron open={menuOpen} />
//                 </button>
//                 {menuOpen && (
//                   <div
//                     role="menu"
//                     aria-label="Account"
//                     className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
//                   >
//                     <div className="px-3 pb-2 pt-1.5">
//                       <p className="truncate text-sm font-semibold text-white">{user.full_name || 'Your account'}</p>
//                       {user.email ? <p className="truncate text-xs text-neutral-400">{user.email}</p> : null}
//                     </div>
//                     <div className="my-1 h-px bg-white/5" />
//                     {activeOrder ? (
//                       <Link
//                         role="menuitem"
//                         href={`/customer/track/${activeOrder.id}`}
//                         className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-white/5"
//                       >
//                         ● Track active order
//                       </Link>
//                     ) : null}
//                     <Link role="menuitem" href={dashboardHref} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5">
//                       Dashboard
//                     </Link>
//                     {role === 'admin' && (
//                       <Link role="menuitem" href="/admin/zones" prefetch={false} className={menuItem}>
//                         Service zones
//                       </Link>
//                     )}
//                     {isCustomer && (
//                       <>
//                         <Link role="menuitem" href="/customer/history" prefetch={false} className={menuItem}>
//                           My orders
//                         </Link>
//                         <Link role="menuitem" href="/customer/addresses" prefetch={false} className={menuItem}>
//                           Saved addresses
//                         </Link>
//                         <Link role="menuitem" href="/customer/account" prefetch={false} className={menuItem}>
//                           Account
//                         </Link>
//                       </>
//                     )}
//                     <div className="my-1 h-px bg-white/5" />
//                     <button
//                       type="button"
//                       role="menuitem"
//                       onClick={() => void signOut()}
//                       disabled={signingOut}
//                       className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
//                     >
//                       {signingOut ? 'Signing out…' : 'Sign out'}
//                     </button>
//                   </div>
//                 )}
//               </div>
//             ) : (
//               <Link
//                 href="/auth/login"
//                 className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white sm:block"
//               >
//                 Sign in
//               </Link>
//             )}

//             <Link
//               href="/book"
//               className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-150 hover:opacity-95 hover:shadow-cyan-500/40 active:scale-95"
//             >
//               <span className="hidden sm:inline">Book water</span>
//               <span className="sm:hidden">Book</span>
//               <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
//                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
//               </svg>
//             </Link>

//             <button
//               type="button"
//               onClick={() => setMobileOpen((o) => !o)}
//               className="relative flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:border-cyan-400/20 hover:bg-white/[0.07] lg:hidden"
//               aria-label="Toggle menu"
//               aria-expanded={mobileOpen}
//               aria-controls="mobile-menu"
//             >
//               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
//               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
//               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
//               {activeOrder && !mobileOpen ? (
//                 <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0A1628]" aria-hidden="true" />
//               ) : null}
//             </button>
//           </div>
//         </div>
//       </header>

//       <div
//         className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
//           mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
//         }`}
//         onClick={() => setMobileOpen(false)}
//         aria-hidden="true"
//       />

//       <div
//         id="mobile-menu"
//         role="dialog"
//         aria-modal="true"
//         aria-label="Menu"
//         className={`fixed right-0 top-0 z-50 h-full w-80 max-w-[88vw] border-l border-white/5 bg-[#0A1628] transition-[transform,visibility] duration-300 ease-out lg:hidden ${
//           mobileOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
//         }`}
//       >
//         <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
//           <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0A1628]/95 px-5 pb-4 pt-4 backdrop-blur-xl">
//             <div className="flex items-center justify-between">
//               <Link
//                 href="/"
//                 onClick={() => setMobileOpen(false)}
//                 className="flex items-center gap-3"
//                 aria-label="AuroWater home"
//               >
//                 <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-cyan-500/20 ring-1 ring-white/10">
//                   <Image
//                     src="/aurotap-mark.svg"
//                     alt=""
//                     width={40}
//                     height={40}
//                     className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(56,189,248,0.25)]"
//                     unoptimized
//                   />
//                 </span>
//                 <span>
//                   <span className="block text-sm font-extrabold tracking-tight text-white">
//                     Auro<span className="text-cyan-400">Water</span>
//                   </span>
//                   <span className="block text-[11px] font-medium text-white/40">
//                     Water & home services
//                   </span>
//                 </span>
//               </Link>

//               <button
//                 ref={drawerCloseRef}
//                 type="button"
//                 onClick={() => setMobileOpen(false)}
//                 className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
//                 aria-label="Close menu"
//               >
//                 ✕
//               </button>
//             </div>

//             <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.035] px-3 py-2.5">
//               <div className="min-w-0">
//                 <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
//                   Delivering to
//                 </p>
//                 <p className="mt-0.5 truncate text-sm font-bold text-white">
//                   {city}
//                 </p>
//               </div>
//               <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
//                 {cityReady ? 'Available' : 'Loading'}
//               </span>
//             </div>
//           </div>

//           <div className="flex-1 px-5 py-5">
//             {activeOrder ? (
//               <Link
//                 href={`/customer/track/${activeOrder.id}`}
//                 onClick={() => setMobileOpen(false)}
//                 className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-400/25 bg-gradient-to-r from-emerald-400/10 to-cyan-400/[0.04] px-4 py-3.5 shadow-lg shadow-emerald-950/10 transition-colors hover:border-emerald-300/40"
//               >
//                 <span className="min-w-0">
//                   <span className="flex items-center gap-2 text-sm font-bold text-emerald-300">
//                     <span className="relative flex h-2 w-2" aria-hidden="true">
//                       <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
//                       <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
//                     </span>
//                     {ORDER_LABEL[activeOrder.status] ?? 'Order in progress'}
//                   </span>
//                   <span className="mt-1 block text-xs text-emerald-100/55">
//                     Track your active order
//                   </span>
//                 </span>
//                 <span className="text-lg text-emerald-300" aria-hidden="true">
//                   →
//                 </span>
//               </Link>
//             ) : null}

//             <div className="mb-5">
//               <div className="mb-2 flex items-center justify-between px-1">
//                 <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
//                   Book a service
//                 </p>
//                 <Link
//                   href="/services"
//                   onClick={() => setMobileOpen(false)}
//                   className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
//                 >
//                   View all
//                 </Link>
//               </div>

//               <div className="grid grid-cols-2 gap-2">
//                 {SERVICES.map((s) => (
//                   <Link
//                     key={s.key}
//                     href={bookHref(s.key)}
//                     prefetch={false}
//                     onClick={() => setMobileOpen(false)}
//                     className="group flex min-h-[3.45rem] items-center gap-2.5 rounded-2xl border border-white/7 bg-white/[0.045] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:border-cyan-400/25 hover:bg-cyan-400/[0.06] active:scale-[0.98]"
//                   >
//                     <span
//                       className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-base"
//                       aria-hidden="true"
//                     >
//                       {s.icon}
//                     </span>
//                     <span className="truncate">{s.label}</span>
//                   </Link>
//                 ))}
//               </div>
//             </div>

//             {installAvailable ? (
//               <button
//                 type="button"
//                 onClick={() => void handleInstallApp()}
//                 className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-400/12 to-blue-500/10 px-4 py-3.5 text-left shadow-lg shadow-cyan-950/10 transition-all hover:border-cyan-300/35 hover:bg-cyan-400/15 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
//               >
//                 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200" aria-hidden="true">
//                   <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                     <path d="M12 3v11" />
//                     <path d="m8 10 4 4 4-4" />
//                     <path d="M5 21h14" />
//                   </svg>
//                 </span>
//                 <span className="min-w-0 flex-1">
//                   <span className="block text-sm font-extrabold text-white">
//                     Install AuroTap
//                   </span>
//                   <span className="mt-0.5 block text-xs leading-5 text-white/45">
//                     {installStatus === 'fallback'
//                       ? 'Add AuroTap to your home screen'
//                       : 'Faster access from your home screen'}
//                   </span>
//                 </span>
//                 <span className="text-cyan-300" aria-hidden="true">→</span>
//               </button>
//             ) : null}

//             <nav className="space-y-1" aria-label="Mobile">
//               <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
//                 Explore AuroWater
//               </p>

//               {[{ label: 'All services', href: '/services' }, ...PRIMARY_LINKS, ...MORE_LINKS].map((link) => (
//                 <Link
//                   key={link.href}
//                   href={link.href}
//                   prefetch={false}
//                   onClick={() => setMobileOpen(false)}
//                   aria-current={isActive(link.href) ? 'page' : undefined}
//                   className={`flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
//                     isActive(link.href)
//                       ? 'bg-cyan-500/10 text-cyan-300'
//                       : 'text-neutral-300 hover:bg-white/5 hover:text-white'
//                   }`}
//                 >
//                   <span>{link.label}</span>
//                   <span className="text-white/20" aria-hidden="true">›</span>
//                 </Link>
//               ))}

//               <a
//                 href={WHATSAPP_HREF}
//                 target="_blank"
//                 rel="noreferrer"
//                 className="mt-2 flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/10"
//               >
//                 <span>💬 Chat with us on WhatsApp</span>
//                 <span className="text-emerald-300/60" aria-hidden="true">↗</span>
//               </a>
//             </nav>
//           </div>

//           <div className="border-t border-white/5 bg-[#091525]/80 px-5 pb-5 pt-4">
//             {!hydrated ? null : isLoggedIn ? (
//               <>
//                 <Link
//                   href={dashboardHref}
//                   onClick={() => setMobileOpen(false)}
//                   className="mb-2 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-bold text-white transition-colors hover:border-cyan-400/25 hover:bg-white/[0.06]"
//                 >
//                   My dashboard
//                 </Link>
//                 {isCustomer ? (
//                   <Link
//                     href="/customer/history"
//                     prefetch={false}
//                     onClick={() => setMobileOpen(false)}
//                     className="mb-2 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-bold text-white transition-colors hover:border-cyan-400/25 hover:bg-white/[0.06]"
//                   >
//                     My orders
//                   </Link>
//                 ) : null}
//                 <button
//                   type="button"
//                   onClick={() => void signOut()}
//                   disabled={signingOut}
//                   className="flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
//                 >
//                   {signingOut ? 'Signing out…' : 'Sign out'}
//                 </button>
//               </>
//             ) : (
//               <div className="grid grid-cols-2 gap-2">
//                 <Link
//                   href="/auth/login"
//                   onClick={() => setMobileOpen(false)}
//                   className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-3 text-sm font-bold text-white transition-colors hover:border-cyan-400/25 hover:bg-white/[0.06]"
//                 >
//                   Sign in
//                 </Link>
//                 <Link
//                   href="/auth/register"
//                   onClick={() => setMobileOpen(false)}
//                   className="flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-950/20 transition-opacity hover:opacity-90"
//                 >
//                   Create account
//                 </Link>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {installHelpOpen ? (
//         <div
//           className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
//           role="presentation"
//           onMouseDown={(event) => {
//             if (event.target === event.currentTarget) setInstallHelpOpen(false);
//           }}
//         >
//           <section
//             role="dialog"
//             aria-modal="true"
//             aria-labelledby="install-aurotap-title"
//             className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0F1D33] p-5 shadow-2xl shadow-black/50"
//           >
//             <div className="flex items-start gap-3">
//               <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-cyan-950/20">
//                 <Image
//                   src="/icons/icon-192x192.png"
//                   alt=""
//                   width={44}
//                   height={44}
//                   className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(56,189,248,0.25)]"
//                   unoptimized
//                 />
//               </span>
//               <div className="min-w-0 flex-1">
//                 <h2 id="install-aurotap-title" className="text-base font-extrabold text-white">
//                   Install AuroTap
//                 </h2>
//                 <p className="mt-1 text-xs leading-5 text-white/45">
//                   Keep AuroTap one tap away for faster access.
//                 </p>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => setInstallHelpOpen(false)}
//                 className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-white/45 hover:bg-white/5 hover:text-white"
//                 aria-label="Close install instructions"
//               >
//                 ✕
//               </button>
//             </div>

//             <div className="mt-5 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
//               <p className="text-sm font-bold text-cyan-100">
//                 {isIosDevice() ? 'On iPhone or iPad' : 'Use your browser menu'}
//               </p>
//               <ol className="mt-3 space-y-2.5 text-sm leading-5 text-white/65">
//                 {isIosDevice() ? (
//                   <>
//                     <li><span className="font-bold text-white">1.</span> Tap the browser <span className="font-semibold text-white">Share</span> button.</li>
//                     <li><span className="font-bold text-white">2.</span> Choose <span className="font-semibold text-white">Add to Home Screen</span>.</li>
//                     <li><span className="font-bold text-white">3.</span> Confirm by tapping <span className="font-semibold text-white">Add</span>.</li>
//                   </>
//                 ) : (
//                   <>
//                     <li><span className="font-bold text-white">1.</span> Open your browser menu.</li>
//                     <li><span className="font-bold text-white">2.</span> Choose <span className="font-semibold text-white">Install app</span> or <span className="font-semibold text-white">Add to Home screen</span>.</li>
//                     <li><span className="font-bold text-white">3.</span> Confirm the installation.</li>
//                   </>
//                 )}
//               </ol>
//             </div>

//             <button
//               type="button"
//               onClick={() => setInstallHelpOpen(false)}
//               className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-950/20 transition-opacity hover:opacity-90"
//             >
//               Got it
//             </button>
//           </section>
//         </div>
//       ) : null}

//     </>
//   );
// }













'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { clearSession, useAuth } from '@/hooks/useAuth';
import { authLogout, getToken } from '@/lib/api-client';
import { createClient } from '@/utils/supabase/client';
import { FALLBACK_CITIES, type City } from '@/lib/cities';
import { safeGet, safeSet } from '@/lib/storage';

/* ───────────── Navigation data ───────────── */

/** "Services" is rendered separately (link + quick-book menu). */
const PRIMARY_LINKS = [
  { label: 'How it works', href: '/how-it-works', hint: 'Order in three steps' },
  { label: 'Pricing', href: '/pricing', hint: 'Clear, upfront rates' },
];

const MORE_LINKS = [
  { label: 'Technicians', href: '/technicians', hint: 'Verified service professionals' },
  { label: 'About', href: '/about', hint: 'Who we are' },
  { label: 'Contact', href: '/contact', hint: 'Talk to our team' },
  { label: 'Become a partner', href: '/register/pro', hint: 'Supplier and technician signup' },
];

/**
 * Quick-book shortcuts: open the booking wizard with the service preselected.
 */
const SERVICES = [
  { key: 'water_can', label: 'Water cans', hint: 'Fresh cans at your door', icon: '💧' },
  { key: 'water_tanker', label: 'Water tanker', hint: 'Bulk water delivery', icon: '🚚' },
  { key: 'ro_service', label: 'RO service', hint: 'Service & filters', icon: '🔧' },
  { key: 'plumbing', label: 'Plumbing', hint: 'Leaks, taps, fittings', icon: '🛠️' },
  { key: 'borewell', label: 'Borewell', hint: 'Repair & maintenance', icon: '⛏️' },
  { key: 'motor_pump', label: 'Motor & pump', hint: 'Repair & install', icon: '⚙️' },
  { key: 'tank_cleaning', label: 'Tank cleaning', hint: 'Safe, hygienic', icon: '✨' },
] as const;

const bookHref = (key: string) => `/book?service=${encodeURIComponent(key)}`;

const ORDER_LABEL: Record<string, string> = {
  PENDING: 'Finding supplier',
  ASSIGNED: 'Supplier assigned',
  IN_PROGRESS: 'On the way',
};

const WHATSAPP_HREF = 'https://wa.me/919889305803?text=Hi%20AuroWater%2C%20I%20need%20help';

const CITY_KEY = 'aw_city';
const DEFAULT_CITY = 'Kanpur';
const CITIES_CACHE_KEY = 'aw_cities_v2';
const CITIES_TTL_MS = 10 * 60 * 1000;

/* ───────────── Install app (PWA) store ─────────────
 * The browser fires `beforeinstallprompt` only once and often BEFORE React mounts.
 * We capture it at module load so it is never missed, then expose it to any component.
 * If the event never fires (iOS, in-app browsers, already dismissed), the button still
 * works and opens step-by-step instructions instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const installListeners = new Set<() => void>();

function notifyInstall() {
  installListeners.forEach((fn) => fn());
}

function subscribeInstall(fn: () => void) {
  installListeners.add(fn);
  return () => {
    installListeners.delete(fn);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appInstalled = true;
    notifyInstall();
  });
}

type Platform = 'ios' | 'android' | 'desktop';

/** Returns 'native' when the browser's own install dialog was shown, 'manual' when we need to show steps. */
async function triggerInstall(): Promise<'native' | 'manual'> {
  const evt = deferredPrompt;
  if (!evt) return 'manual';
  // An event can only be used once, so clear it first.
  deferredPrompt = null;
  notifyInstall();
  try {
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') return 'native';
    return 'native';
  } catch {
    return 'manual';
  }
}

function useInstall() {
  const nativePrompt = useSyncExternalStore(
    subscribeInstall,
    () => deferredPrompt,
    () => null
  );
  const installedEvent = useSyncExternalStore(
    subscribeInstall,
    () => appInstalled,
    () => false
  );
  const [env, setEnv] = useState<{ ready: boolean; standalone: boolean; platform: Platform }>({
    ready: false,
    standalone: false,
    platform: 'desktop',
  });

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      nav.standalone === true;
    const ua = nav.userAgent || '';
    const isIPadOS = /Macintosh/i.test(ua) && (nav.maxTouchPoints || 0) > 1;
    const platform: Platform = /iPhone|iPad|iPod/i.test(ua) || isIPadOS
      ? 'ios'
      : /Android/i.test(ua)
        ? 'android'
        : 'desktop';
    setEnv({ ready: true, standalone, platform });
  }, []);

  return {
    visible: env.ready && !env.standalone && !installedEvent,
    platform: env.platform,
    hasNativePrompt: Boolean(nativePrompt),
  };
}

/* ───────────── Small helpers ───────────── */

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

function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  );
}

function ShareIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12L8 7m4-4l4 4M6 11H5a1 1 0 00-1 1v7a1 1 0 001 1h14a1 1 0 001-1v-7a1 1 0 00-1-1h-1" />
    </svg>
  );
}

function PlusSquareIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path strokeLinecap="round" d="M12 8v8M8 12h8" />
    </svg>
  );
}

function DotsIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function PhoneIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path strokeLinecap="round" d="M11 18.5h2" />
    </svg>
  );
}

/** Accepts a bare array or the API envelope `{ data: [...] }`; keeps live and coming-soon cities. */
function usableCities(data: unknown): City[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : [];
  return (list as City[]).filter(
    (c) =>
      !!c &&
      typeof c.name === 'string' &&
      (c.status === 'active' || c.status === 'coming_soon')
  );
}

function readCitiesCache(): City[] {
  try {
    const raw = safeGet(CITIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { t?: number; v?: unknown };
    if (!parsed || typeof parsed.t !== 'number' || Date.now() - parsed.t > CITIES_TTL_MS) return [];
    return usableCities(parsed.v);
  } catch {
    return [];
  }
}

function writeCitiesCache(list: City[]) {
  try {
    safeSet(CITIES_CACHE_KEY, JSON.stringify({ t: Date.now(), v: list }));
  } catch {
    /* storage unavailable or full: caching is optional */
  }
}

/** Run work after first paint so it never slows page load. Returns a cancel function. */
function whenIdle(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => cb(), { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const t = setTimeout(cb, 400);
  return () => clearTimeout(t);
}

/** Close a dropdown on outside click/tap or Escape. */
function useDismiss(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, ref]);
}

/** Page scroll lock that is safe when more than one overlay is open at the same time. */
let lockCount = 0;
let previousOverflow = '';
function useBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}

/** Keeps Tab focus inside a dialog while it is open. */
function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;
      const nodes = containerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, containerRef]);
}

type ActiveOrder = { id: string; status: string };

/**
 * "Is an order in progress?" for signed-in customers. Runs after first paint, refreshes every
 * minute and when the tab becomes visible, and never redirects: any auth problem hides the pill.
 */
function useActiveOrder(enabled: boolean): ActiveOrder | null {
  const [order, setOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    if (!enabled) {
      setOrder(null);
      return;
    }
    let stopped = false;
    const controller = new AbortController();

    const run = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const token = await getToken();
        if (!token || stopped) return;
        const res = await fetch('/api/customer/orders?status=PENDING,ASSIGNED,IN_PROGRESS&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          stopped = true;
          setOrder(null);
          return;
        }
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
        const list = json && Array.isArray(json.data) ? (json.data as { id?: string; status?: string }[]) : [];
        const row = list[0];
        if (!stopped) setOrder(row?.id ? { id: String(row.id), status: String(row.status ?? '') } : null);
      } catch {
        /* offline or request cancelled: keep the last known state */
      }
    };

    const cancelIdle = whenIdle(() => {
      void run();
    });
    const timer = window.setInterval(() => void run(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      controller.abort();
      cancelIdle();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return order;
}

/* ───────────── Install help sheet ───────────── */

function InstallSheet({
  open,
  platform,
  onClose,
}: {
  open: boolean;
  platform: Platform;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useBodyLock(open);
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const steps =
    platform === 'ios'
      ? [
          { icon: <ShareIcon />, title: 'Tap the Share button', body: 'It is in the bottom bar of Safari (or next to the address bar on iPad).' },
          { icon: <PlusSquareIcon />, title: 'Choose “Add to Home Screen”', body: 'Scroll down in the share sheet if you do not see it.' },
          { icon: <DownloadIcon className="h-5 w-5" />, title: 'Tap “Add”', body: 'AuroWater now opens from your home screen like any other app.' },
        ]
      : platform === 'android'
        ? [
            { icon: <DotsIcon />, title: 'Open the browser menu', body: 'Tap the three dots at the top right of Chrome.' },
            { icon: <DownloadIcon className="h-5 w-5" />, title: 'Tap “Install Aurotap”', body: 'Some phones label it “Add to Home screen”.' },
            { icon: <PlusSquareIcon />, title: 'Confirm', body: 'AuroWater appears on your home screen and app drawer.' },
          ]
        : [
            { icon: <DownloadIcon className="h-5 w-5" />, title: 'Look at the address bar', body: 'Click the install icon at the right end of the address bar.' },
            { icon: <DotsIcon />, title: 'Or open the browser menu', body: 'Choose “Install AuroWater” (Chrome, Edge) from the menu.' },
            { icon: <PlusSquareIcon />, title: 'Click Install', body: 'AuroWater opens in its own window and pins to your taskbar.' },
          ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-sheet-title"
        className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0F1D33] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 sm:rounded-3xl sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible">
            <Image src="/aurotap-mark.svg" alt="" width={40} height={40} className="h-10 w-10 object-contain drop-shadow-[0_4px_12px_rgba(56,189,248,0.25)]" unoptimized />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="install-sheet-title" className="text-base font-bold text-white">
              Install AuroWater
            </h2>
            <p className="text-sm text-neutral-400">Faster booking, live order tracking and one-tap access.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-neutral-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            ✕
          </button>
        </div>

        <ol className="mt-5 space-y-2.5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-xs leading-relaxed text-neutral-400">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs leading-relaxed text-neutral-500">
          Opened from Instagram, Facebook or another in-app browser? Open this page in{' '}
          {platform === 'ios' ? 'Safari' : 'Chrome'} first, then follow the steps above.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/* ───────────── Component ───────────── */

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoggedIn, hydrated } = useAuth();
  const install = useInstall();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const [cityReady, setCityReady] = useState(false);
  const [cities, setCities] = useState<City[]>(() =>
    FALLBACK_CITIES.filter((c) => c.status !== 'waitlist')
  );

  const servicesRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

  const current = pathname ?? '';
  const isActive = useCallback(
    (href: string) => current === href || current.startsWith(`${href}/`),
    [current]
  );

  const closeServices = useCallback(() => setServicesOpen(false), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeInstallHelp = useCallback(() => setInstallHelpOpen(false), []);
  useDismiss(servicesOpen, closeServices, servicesRef);
  useDismiss(moreOpen, closeMore, moreRef);
  useDismiss(menuOpen, closeMenu, menuRef);

  const isCustomer = isLoggedIn && role === 'customer';
  const activeOrder = useActiveOrder(Boolean(hydrated && isCustomer));

  const dashboardHref = useMemo(() => {
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'supplier') return '/supplier/dashboard';
    if (role === 'technician') return '/technician/dashboard';
    return '/customer/home';
  }, [role]);

  // One handler for every "Install app" button: native dialog if available, otherwise step-by-step help.
  const onInstallClick = useCallback(async () => {
    setMobileOpen(false);
    setMenuOpen(false);
    const result = await triggerInstall();
    if (result === 'manual') setInstallHelpOpen(true);
  }, []);

  // Remember the city the customer picked (other pages read the same key).
  useEffect(() => {
    const stored = safeGet(CITY_KEY);
    if (stored) setCity(stored);
    setCityReady(true);
  }, []);

  const onCityChange = useCallback((value: string) => {
    setCity(value);
    safeSet(CITY_KEY, value);
  }, []);

  // City list: cached for 10 minutes, fetched after first paint.
  useEffect(() => {
    const cached = readCitiesCache();
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
            writeCitiesCache(list);
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
    setServicesOpen(false);
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // Close the drawer if the screen grows into desktop layout (e.g. tablet rotation).
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mobile drawer: lock page scroll, trap focus, close with Escape, focus the close button.
  useBodyLock(mobileOpen);
  useFocusTrap(mobileOpen, drawerRef);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    drawerCloseRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  /** Real sign out: server cookies, Supabase session, local state, then home. */
  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    setMobileOpen(false);
    try {
      await authLogout();
    } catch {
      /* continue: local sign-out below still happens */
    }
    try {
      await createClient().auth.signOut();
    } catch {
      /* session may already be gone */
    }
    clearSession();
    clearSession();
    // A hard navigation clears any stale App Router/PWA view after sign-out.
    window.location.replace('/');
  }, [signingOut, router]);

  const initial = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  const linkClass = (active: boolean) =>
    `relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      active
        ? 'text-cyan-300 after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-cyan-400'
        : 'text-neutral-300 hover:bg-white/5 hover:text-white'
    }`;

  const menuItem =
    'block rounded-xl px-3 py-2.5 text-sm text-neutral-200 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none';

  const cityOptions = cities.some((c) => c.name === city)
    ? cities
    : [{ id: '__current', name: city, status: 'active' } as City, ...cities];

  const drawerLinks = [{ label: 'All services', href: '/services', hint: 'Everything we offer' }, ...PRIMARY_LINKS, ...MORE_LINKS];

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
          scrolled
            ? 'border-white/5 bg-[#0A1628]/95 shadow-lg shadow-black/20 md:bg-[#0A1628]/85 md:backdrop-blur-xl'
            : 'border-transparent bg-[#0A1628]'
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent transition-opacity duration-300 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="AuroWater home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/aurotap-mark.svg"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(56,189,248,0.25)]"
                priority
                unoptimized
              />
            </span>
            <span className="hidden whitespace-nowrap text-lg font-bold tracking-tight text-white min-[400px]:block">
              Auro<span className="text-cyan-400">Water</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main">
            {/* Services: a real link (good for SEO) plus a quick-book menu */}
            <div ref={servicesRef} className="relative flex items-center">
              <Link
                href="/services"
                aria-current={isActive('/services') ? 'page' : undefined}
                className={linkClass(isActive('/services'))}
              >
                Services
              </Link>
              <button
                type="button"
                onClick={() => {
                  setServicesOpen((o) => !o);
                  setMoreOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={servicesOpen}
                aria-label="Quick book a service"
                className="-ml-1.5 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Chevron open={servicesOpen} />
              </button>
              {servicesOpen && (
                <div
                  role="menu"
                  aria-label="Book a service"
                  className="absolute left-0 top-full mt-2 w-[22rem] rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
                >
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Book in a minute
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {SERVICES.map((s) => (
                      <Link
                        key={s.key}
                        role="menuitem"
                        href={bookHref(s.key)}
                        prefetch={false}
                        className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                      >
                        <span className="mt-0.5 text-base" aria-hidden="true">
                          {s.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">{s.label}</span>
                          <span className="block truncate text-[11px] text-neutral-400">{s.hint}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    role="menuitem"
                    href="/services"
                    className="mt-1 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-cyan-300 transition-colors hover:bg-white/5"
                  >
                    View all services →
                  </Link>
                </div>
              )}
            </div>

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
                onClick={() => {
                  setMoreOpen((o) => !o);
                  setServicesOpen(false);
                }}
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
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
                    >
                      <span className="block text-sm font-semibold text-white">{link.label}</span>
                      <span className="block text-xs text-neutral-400">{link.hint}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
            {activeOrder ? (
              <Link
                href={`/customer/track/${activeOrder.id}`}
                aria-label="Track your active order"
                className="hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20 xl:flex"
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="whitespace-nowrap">{ORDER_LABEL[activeOrder.status] ?? 'Track order'}</span>
              </Link>
            ) : null}

            {/* Install app: always reachable. Works even if the browser popup was missed or dismissed. */}
            {install.visible ? (
              <button
                type="button"
                onClick={() => void onInstallClick()}
                aria-label="Install AuroWater app"
                title="Install AuroWater app"
                className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:flex"
              >
                <DownloadIcon className="h-4 w-4" />
                <span className="hidden xl:inline">Install Aurotap</span>
              </button>
            ) : null}

            {/* City: a native select. It opens the phone's own picker, so it can never be clipped. */}
            <div
              className={`relative min-w-0 transition-opacity duration-150 ${cityReady ? 'opacity-100' : 'opacity-0'}`}
            >
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <label htmlFor="header-city" className="sr-only">
                Delivery city
              </label>
              <select
                id="header-city"
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                className="h-10 w-full max-w-[6.75rem] cursor-pointer appearance-none truncate rounded-xl border border-white/10 bg-white/5 pl-8 pr-6 text-[13px] font-medium text-white outline-none transition-colors hover:border-cyan-500/30 focus-visible:ring-2 focus-visible:ring-cyan-400 min-[400px]:max-w-[8rem] sm:max-w-[10rem] sm:pr-7 sm:text-sm"
              >
                {cityOptions.map((c) => (
                  <option key={c.id ?? c.name} value={c.name} className="bg-[#0A1628] text-white">
                    {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 sm:right-2.5">
                <Chevron open={false} />
              </span>
            </div>

            {!hydrated ? (
              /* Reserve the space so nothing jumps when the session loads */
              <div className="hidden h-10 w-[72px] sm:block" aria-hidden="true" />
            ) : isLoggedIn && user ? (
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
                    className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
                  >
                    <div className="px-3 pb-2 pt-1.5">
                      <p className="truncate text-sm font-semibold text-white">{user.full_name || 'Your account'}</p>
                      {user.email ? <p className="truncate text-xs text-neutral-400">{user.email}</p> : null}
                    </div>
                    <div className="my-1 h-px bg-white/5" />
                    {activeOrder ? (
                      <Link
                        role="menuitem"
                        href={`/customer/track/${activeOrder.id}`}
                        className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-white/5"
                      >
                        ● Track active order
                      </Link>
                    ) : null}
                    <Link role="menuitem" href={dashboardHref} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5">
                      Dashboard
                    </Link>
                    {role === 'admin' && (
                      <Link role="menuitem" href="/admin/zones" prefetch={false} className={menuItem}>
                        Service zones
                      </Link>
                    )}
                    {isCustomer && (
                      <>
                        <Link role="menuitem" href="/customer/history" prefetch={false} className={menuItem}>
                          My orders
                        </Link>
                        <Link role="menuitem" href="/customer/addresses" prefetch={false} className={menuItem}>
                          Saved addresses
                        </Link>
                        <Link role="menuitem" href="/customer/account" prefetch={false} className={menuItem}>
                          Account
                        </Link>
                      </>
                    )}
                    {install.visible ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void onInstallClick()}
                        className={`${menuItem} w-full text-left`}
                      >
                        Install Aurotap
                      </button>
                    ) : null}
                    <div className="my-1 h-px bg-white/5" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void signOut()}
                      disabled={signingOut}
                      className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
                    >
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
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
              className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-150 hover:opacity-95 hover:shadow-cyan-500/40 active:scale-95 sm:px-4"
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
              className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              <span className={`h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
              <span className={`h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
              {activeOrder && !mobileOpen ? (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A1628]" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!mobileOpen}
        className={`fixed right-0 top-0 z-[70] flex h-[100dvh] w-[22rem] max-w-[92vw] flex-col border-l border-white/10 bg-[#0A1628] shadow-2xl shadow-black/60 transition-[transform,visibility] duration-300 ease-out sm:w-[26rem] lg:hidden ${
          mobileOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        {/* Drawer top bar */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-4">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center overflow-visible">
              <Image src="/aurotap-mark.svg" alt="" width={32} height={32} className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(56,189,248,0.25)]" unoptimized />
            </span>
            <span className="text-base font-bold tracking-tight text-white">
              Auro<span className="text-cyan-400">Water</span>
            </span>
          </span>
          <button
            ref={drawerCloseRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5">
          {hydrated && isLoggedIn && user ? (
            <Link
              href={dashboardHref}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-cyan-500/30"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-base font-bold text-cyan-300">
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{user.full_name || 'Your account'}</span>
                <span className="block truncate text-xs text-neutral-400">{user.email || 'Open your dashboard'}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-neutral-500" />
            </Link>
          ) : null}

          {activeOrder ? (
            <Link
              href={`/customer/track/${activeOrder.id}`}
              className="flex items-center justify-between rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-emerald-300">
                    {ORDER_LABEL[activeOrder.status] ?? 'Order in progress'}
                  </span>
                  <span className="block text-xs text-emerald-200/70">Tap to track your order</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-emerald-300" />
            </Link>
          ) : null}

          {/* Install card */}
          {install.visible ? (
            <button
              type="button"
              onClick={() => void onInstallClick()}
              className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/15 to-blue-600/10 p-3.5 text-left transition-colors hover:border-cyan-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                <PhoneIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">Get the AuroWater app</span>
                <span className="block text-xs text-neutral-400">Faster booking and live tracking</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
                <DownloadIcon className="h-3.5 w-3.5" />
                Install
              </span>
            </button>
          ) : null}

          <section aria-labelledby="drawer-book">
            <h2 id="drawer-book" className="mb-2 px-1 text-xs font-semibold text-neutral-500">
              Book a service
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map((s) => (
                <Link
                  key={s.key}
                  href={bookHref(s.key)}
                  prefetch={false}
                  className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/5 px-3 py-3 text-sm font-medium text-white transition-colors hover:border-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <span className="text-lg" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span className="min-w-0 truncate">{s.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <nav aria-label="Mobile">
            <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
              {drawerLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:bg-white/5 ${
                        active ? 'bg-cyan-500/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${active ? 'text-cyan-300' : 'text-white'}`}>
                          {link.label}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">{link.hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-600" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <span aria-hidden="true">💬</span>
            Chat with us on WhatsApp
          </a>
        </div>

        {/* Sticky footer actions */}
        <div className="shrink-0 space-y-2 border-t border-white/5 bg-[#0A1628] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {!hydrated ? null : isLoggedIn ? (
            <>
              <div className={`grid gap-2 ${isCustomer ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Link
                  href={dashboardHref}
                  className="block rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white transition-colors hover:border-cyan-500/30"
                >
                  Dashboard
                </Link>
                {isCustomer && (
                  <Link
                    href="/customer/history"
                    prefetch={false}
                    className="block rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white transition-colors hover:border-cyan-500/30"
                  >
                    My orders
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="block w-full rounded-xl py-2.5 text-center text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/auth/login"
                className="block rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white transition-colors hover:border-cyan-500/30"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="block rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>

      <InstallSheet open={installHelpOpen} platform={install.platform} onClose={closeInstallHelp} />
    </>
  );
}








// // 'use client';

// // import Link from 'next/link';
// // import { usePathname, useRouter } from 'next/navigation';
// // import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
// // import { clearSession, useAuth } from '@/hooks/useAuth';
// // import { authLogout, getToken } from '@/lib/api-client';
// // import { createClient } from '@/utils/supabase/client';
// // import { FALLBACK_CITIES, type City } from '@/lib/cities';
// // import { safeGet, safeSet } from '@/lib/storage';
// // import Image from "next/image";

// // /* ───────────── Navigation data ───────────── */

// // /** "Services" is rendered separately (link + quick-book menu). */
// // const PRIMARY_LINKS = [
// //   { label: 'How it works', href: '/how-it-works' },
// //   { label: 'Pricing', href: '/pricing' },
// // ];

// // const MORE_LINKS = [
// //   { label: 'Technicians', href: '/technicians', hint: 'Verified service professionals' },
// //   { label: 'About', href: '/about', hint: 'Who we are' },
// //   { label: 'Contact', href: '/contact', hint: 'Talk to our team' },
// //   { label: 'Become a partner', href: '/register/pro', hint: 'Supplier and technician signup' },
// // ];

// // /**
// //  * Quick-book shortcuts: open the booking wizard with the service preselected.
// //  * After the service-page SEO audit you can point these at each service's own page.
// //  */
// // const SERVICES = [
// //   { key: 'water_can', label: 'Water cans', hint: 'Fresh cans at your door', icon: '💧' },
// //   { key: 'water_tanker', label: 'Water tanker', hint: 'Bulk water delivery', icon: '🚚' },
// //   { key: 'ro_service', label: 'RO service', hint: 'Service & filters', icon: '🔧' },
// //   { key: 'plumbing', label: 'Plumbing', hint: 'Leaks, taps, fittings', icon: '🛠️' },
// //   { key: 'borewell', label: 'Borewell', hint: 'Repair & maintenance', icon: '⛏️' },
// //   { key: 'motor_pump', label: 'Motor & pump', hint: 'Repair & install', icon: '⚙️' },
// //   { key: 'tank_cleaning', label: 'Tank cleaning', hint: 'Safe, hygienic', icon: '✨' },
// // ] as const;

// // const bookHref = (key: string) => `/book?service=${encodeURIComponent(key)}`;

// // const ORDER_LABEL: Record<string, string> = {
// //   PENDING: 'Finding supplier',
// //   ASSIGNED: 'Supplier assigned',
// //   IN_PROGRESS: 'On the way',
// // };

// // const WHATSAPP_HREF = 'https://wa.me/919889305803?text=Hi%20AuroWater%2C%20I%20need%20help';

// // const CITY_KEY = 'aw_city';
// // const DEFAULT_CITY = 'Kanpur';
// // const CITIES_CACHE_KEY = 'aw_cities_v2';
// // const CITIES_TTL_MS = 10 * 60 * 1000;

// // /* ───────────── Small helpers (kept local so this file has no hidden dependencies) ───────────── */

// // function Chevron({ open }: { open: boolean }) {
// //   return (
// //     <svg
// //       className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
// //       viewBox="0 0 24 24"
// //       fill="none"
// //       stroke="currentColor"
// //       strokeWidth={2.5}
// //       aria-hidden="true"
// //     >
// //       <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
// //     </svg>
// //   );
// // }

// // /** Accepts a bare array or the API envelope `{ data: [...] }`; keeps live and coming-soon cities. */
// // function usableCities(data: unknown): City[] {
// //   const list: unknown[] = Array.isArray(data)
// //     ? data
// //     : data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)
// //       ? (data as { data: unknown[] }).data
// //       : [];
// //   return (list as City[]).filter(
// //     (c) =>
// //       !!c &&
// //       typeof c.name === 'string' &&
// //       (c.status === 'active' || c.status === 'coming_soon')
// //   );
// // }

// // function readCitiesCache(): City[] {
// //   try {
// //     const raw = safeGet(CITIES_CACHE_KEY);
// //     if (!raw) return [];
// //     const parsed = JSON.parse(raw) as { t?: number; v?: unknown };
// //     if (!parsed || typeof parsed.t !== 'number' || Date.now() - parsed.t > CITIES_TTL_MS) return [];
// //     return usableCities(parsed.v);
// //   } catch {
// //     return [];
// //   }
// // }

// // function writeCitiesCache(list: City[]) {
// //   try {
// //     safeSet(CITIES_CACHE_KEY, JSON.stringify({ t: Date.now(), v: list }));
// //   } catch {
// //     /* storage unavailable or full: caching is optional */
// //   }
// // }

// // /** Run work after first paint so it never slows page load. Returns a cancel function. */
// // function whenIdle(cb: () => void): () => void {
// //   if (typeof window === 'undefined') return () => undefined;
// //   if ('requestIdleCallback' in window) {
// //     const id = window.requestIdleCallback(() => cb(), { timeout: 2000 });
// //     return () => window.cancelIdleCallback(id);
// //   }
// //   const t = setTimeout(cb, 400);
// //   return () => clearTimeout(t);
// // }

// // /** Close a dropdown on outside click/tap or Escape. */
// // function useDismiss(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
// //   useEffect(() => {
// //     if (!open) return;
// //     const onDown = (e: MouseEvent | TouchEvent) => {
// //       if (ref.current && !ref.current.contains(e.target as Node)) onClose();
// //     };
// //     const onKey = (e: KeyboardEvent) => {
// //       if (e.key === 'Escape') onClose();
// //     };
// //     document.addEventListener('mousedown', onDown);
// //     document.addEventListener('touchstart', onDown, { passive: true });
// //     document.addEventListener('keydown', onKey);
// //     return () => {
// //       document.removeEventListener('mousedown', onDown);
// //       document.removeEventListener('touchstart', onDown);
// //       document.removeEventListener('keydown', onKey);
// //     };
// //   }, [open, onClose, ref]);
// // }

// // type ActiveOrder = { id: string; status: string };

// // /**
// //  * "Is an order in progress?" for signed-in customers. Runs after first paint, refreshes every
// //  * minute and when the tab becomes visible, and never redirects: any auth problem hides the pill.
// //  */
// // function useActiveOrder(enabled: boolean): ActiveOrder | null {
// //   const [order, setOrder] = useState<ActiveOrder | null>(null);

// //   useEffect(() => {
// //     if (!enabled) {
// //       setOrder(null);
// //       return;
// //     }
// //     let stopped = false;
// //     const controller = new AbortController();

// //     const run = async () => {
// //       if (stopped || document.visibilityState !== 'visible') return;
// //       try {
// //         const token = await getToken();
// //         if (!token || stopped) return;
// //         const res = await fetch('/api/customer/orders?status=PENDING,ASSIGNED,IN_PROGRESS&limit=1', {
// //           headers: { Authorization: `Bearer ${token}` },
// //           signal: controller.signal,
// //         });
// //         if (res.status === 401 || res.status === 403) {
// //           stopped = true;
// //           setOrder(null);
// //           return;
// //         }
// //         if (!res.ok) return;
// //         const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
// //         const list = json && Array.isArray(json.data) ? (json.data as { id?: string; status?: string }[]) : [];
// //         const row = list[0];
// //         if (!stopped) setOrder(row?.id ? { id: String(row.id), status: String(row.status ?? '') } : null);
// //       } catch {
// //         /* offline or request cancelled: keep the last known state */
// //       }
// //     };

// //     const cancelIdle = whenIdle(() => {
// //       void run();
// //     });
// //     const timer = window.setInterval(() => void run(), 60_000);
// //     const onVisible = () => {
// //       if (document.visibilityState === 'visible') void run();
// //     };
// //     document.addEventListener('visibilitychange', onVisible);

// //     return () => {
// //       stopped = true;
// //       controller.abort();
// //       cancelIdle();
// //       window.clearInterval(timer);
// //       document.removeEventListener('visibilitychange', onVisible);
// //     };
// //   }, [enabled]);

// //   return order;
// // }

// // /* ───────────── Component ───────────── */

// // export default function Header() {
// //   const pathname = usePathname();
// //   const router = useRouter();
// //   const { user, role, isLoggedIn, hydrated } = useAuth();

// //   const [scrolled, setScrolled] = useState(false);
// //   const [mobileOpen, setMobileOpen] = useState(false);
// //   const [servicesOpen, setServicesOpen] = useState(false);
// //   const [moreOpen, setMoreOpen] = useState(false);
// //   const [menuOpen, setMenuOpen] = useState(false);
// //   const [signingOut, setSigningOut] = useState(false);
// //   const [city, setCity] = useState<string>(DEFAULT_CITY);
// //   const [cityReady, setCityReady] = useState(false);
// //   const [cities, setCities] = useState<City[]>(() =>
// //     FALLBACK_CITIES.filter((c) => c.status !== 'waitlist')
// //   );

// //   const servicesRef = useRef<HTMLDivElement | null>(null);
// //   const moreRef = useRef<HTMLDivElement | null>(null);
// //   const menuRef = useRef<HTMLDivElement | null>(null);
// //   const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

// //   const current = pathname ?? '';
// //   const isActive = useCallback(
// //     (href: string) => current === href || current.startsWith(`${href}/`),
// //     [current]
// //   );

// //   const closeServices = useCallback(() => setServicesOpen(false), []);
// //   const closeMore = useCallback(() => setMoreOpen(false), []);
// //   const closeMenu = useCallback(() => setMenuOpen(false), []);
// //   useDismiss(servicesOpen, closeServices, servicesRef);
// //   useDismiss(moreOpen, closeMore, moreRef);
// //   useDismiss(menuOpen, closeMenu, menuRef);

// //   const isCustomer = isLoggedIn && role === 'customer';
// //   const activeOrder = useActiveOrder(Boolean(hydrated && isCustomer));

// //   const dashboardHref = useMemo(() => {
// //     if (role === 'admin') return '/admin/dashboard';
// //     if (role === 'supplier') return '/supplier/dashboard';
// //     if (role === 'technician') return '/technician/dashboard';
// //     return '/customer/home';
// //   }, [role]);

// //   // Remember the city the customer picked (other pages read the same key).
// //   useEffect(() => {
// //     const stored = safeGet(CITY_KEY);
// //     if (stored) setCity(stored);
// //     setCityReady(true);
// //   }, []);

// //   const onCityChange = useCallback((value: string) => {
// //     setCity(value);
// //     safeSet(CITY_KEY, value);
// //   }, []);

// //   // City list: cached for 10 minutes, fetched after first paint.
// //   useEffect(() => {
// //     const cached = readCitiesCache();
// //     if (cached.length) {
// //       setCities(cached);
// //       return;
// //     }
// //     const controller = new AbortController();
// //     const cancel = whenIdle(() => {
// //       void fetch('/api/cities', { signal: controller.signal })
// //         .then(async (res) => (res.ok ? ((await res.json()) as unknown) : null))
// //         .then((data) => {
// //           if (controller.signal.aborted) return;
// //           const list = usableCities(data);
// //           if (list.length) {
// //             setCities(list);
// //             writeCitiesCache(list);
// //           }
// //         })
// //         .catch(() => {
// //           /* keep the built-in list */
// //         });
// //     });
// //     return () => {
// //       controller.abort();
// //       cancel();
// //     };
// //   }, []);

// //   // Glass effect after scrolling (one state change, not one per scroll event).
// //   useEffect(() => {
// //     let ticking = false;
// //     const update = () => {
// //       setScrolled(window.scrollY > 12);
// //       ticking = false;
// //     };
// //     const onScroll = () => {
// //       if (ticking) return;
// //       ticking = true;
// //       window.requestAnimationFrame(update);
// //     };
// //     update();
// //     window.addEventListener('scroll', onScroll, { passive: true });
// //     return () => window.removeEventListener('scroll', onScroll);
// //   }, []);

// //   // Close every menu when the page changes.
// //   useEffect(() => {
// //     setMobileOpen(false);
// //     setServicesOpen(false);
// //     setMoreOpen(false);
// //     setMenuOpen(false);
// //   }, [pathname]);

// //   // Mobile drawer: lock page scroll, close with Escape, focus the close button.
// //   useEffect(() => {
// //     if (!mobileOpen) return;
// //     const previous = document.body.style.overflow;
// //     document.body.style.overflow = 'hidden';
// //     const onKey = (event: KeyboardEvent) => {
// //       if (event.key === 'Escape') setMobileOpen(false);
// //     };
// //     document.addEventListener('keydown', onKey);
// //     drawerCloseRef.current?.focus();
// //     return () => {
// //       document.body.style.overflow = previous;
// //       document.removeEventListener('keydown', onKey);
// //     };
// //   }, [mobileOpen]);

// //   /** Real sign out: server cookies, Supabase session, local state, then home. */
// //   const signOut = useCallback(async () => {
// //     if (signingOut) return;
// //     setSigningOut(true);
// //     setMenuOpen(false);
// //     setMobileOpen(false);
// //     try {
// //       await authLogout();
// //     } catch {
// //       /* continue: local sign-out below still happens */
// //     }
// //     try {
// //       await createClient().auth.signOut();
// //     } catch {
// //       /* session may already be gone */
// //     }
// //     clearSession();
// //     setSigningOut(false);
// //     router.replace('/');
// //     router.refresh();
// //   }, [signingOut, router]);

// //   const initial = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

// //   const linkClass = (active: boolean) =>
// //     `relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
// //       active
// //         ? 'text-cyan-300 after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-cyan-400'
// //         : 'text-neutral-300 hover:bg-white/5 hover:text-white'
// //     }`;

// //   const menuItem =
// //     'block rounded-xl px-3 py-2.5 text-sm text-neutral-200 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none';

// //   const cityOptions = cities.some((c) => c.name === city) ? cities : [{ id: '__current', name: city, status: 'active' } as City, ...cities];

// //   return (
// //     <>
// //       <header
// //         className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
// //           scrolled
// //             ? 'border-white/5 bg-[#0A1628]/95 shadow-lg shadow-black/20 md:bg-[#0A1628]/85 md:backdrop-blur-xl'
// //             : 'border-transparent bg-[#0A1628]'
// //         }`}
// //       >
// //         <div
// //           aria-hidden="true"
// //           className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent transition-opacity duration-300 ${
// //             scrolled ? 'opacity-100' : 'opacity-0'
// //           }`}
// //         />

// //       <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        
// //  <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="AuroWater home">
// //   <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-cyan-500/20 transition-transform duration-200 group-hover:scale-105">
// //     <Image
// //       src="/aurotap-mark.svg"
// //       alt=""
// //       width={36}
// //       height={36}
// //       className="h-full w-full object-contain drop-shadow-[0_3px_8px_rgba(56,189,248,0.25)]"
// //       priority
// //       unoptimized
// //     />
// //   </span>

// //     <span className="hidden whitespace-nowrap text-lg font-bold tracking-tight text-white sm:block">
// //       Auro<span className="text-cyan-400">Water</span>
// //     </span>
// //   </Link>

// //           <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main">
// //             {/* Services: a real link (good for SEO) plus a quick-book menu */}
// //             <div ref={servicesRef} className="relative flex items-center">
// //               <Link
// //                 href="/services"
// //                 aria-current={isActive('/services') ? 'page' : undefined}
// //                 className={linkClass(isActive('/services'))}
// //               >
// //                 Services
// //               </Link>
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setServicesOpen((o) => !o);
// //                   setMoreOpen(false);
// //                 }}
// //                 aria-haspopup="menu"
// //                 aria-expanded={servicesOpen}
// //                 aria-label="Quick book a service"
// //                 className="-ml-1.5 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
// //               >
// //                 <Chevron open={servicesOpen} />
// //               </button>
// //               {servicesOpen && (
// //                 <div
// //                   role="menu"
// //                   aria-label="Book a service"
// //                   className="absolute left-0 top-full mt-2 w-[22rem] rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
// //                 >
// //                   <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
// //                     Book in a minute
// //                   </p>
// //                   <div className="grid grid-cols-2 gap-1">
// //                     {SERVICES.map((s) => (
// //                       <Link
// //                         key={s.key}
// //                         role="menuitem"
// //                         href={bookHref(s.key)}
// //                         prefetch={false}
// //                         className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
// //                       >
// //                         <span className="mt-0.5 text-base" aria-hidden="true">
// //                           {s.icon}
// //                         </span>
// //                         <span className="min-w-0">
// //                           <span className="block text-sm font-semibold text-white">{s.label}</span>
// //                           <span className="block truncate text-[11px] text-neutral-400">{s.hint}</span>
// //                         </span>
// //                       </Link>
// //                     ))}
// //                   </div>
// //                   <Link
// //                     role="menuitem"
// //                     href="/services"
// //                     className="mt-1 block rounded-xl px-3 py-2 text-center text-xs font-semibold text-cyan-300 transition-colors hover:bg-white/5"
// //                   >
// //                     View all services →
// //                   </Link>
// //                 </div>
// //               )}
// //             </div>

// //             {PRIMARY_LINKS.map((link) => (
// //               <Link
// //                 key={link.href}
// //                 href={link.href}
// //                 aria-current={isActive(link.href) ? 'page' : undefined}
// //                 className={linkClass(isActive(link.href))}
// //               >
// //                 {link.label}
// //               </Link>
// //             ))}

// //             <div ref={moreRef} className="relative">
// //               <button
// //                 type="button"
// //                 onClick={() => {
// //                   setMoreOpen((o) => !o);
// //                   setServicesOpen(false);
// //                 }}
// //                 aria-haspopup="menu"
// //                 aria-expanded={moreOpen}
// //                 className={`flex items-center gap-1.5 ${linkClass(MORE_LINKS.some((l) => isActive(l.href)))}`}
// //               >
// //                 More <Chevron open={moreOpen} />
// //               </button>
// //               {moreOpen && (
// //                 <div
// //                   role="menu"
// //                   aria-label="More"
// //                   className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
// //                 >
// //                   {MORE_LINKS.map((link) => (
// //                     <Link
// //                       key={link.href}
// //                       href={link.href}
// //                       role="menuitem"
// //                       prefetch={false}
// //                       className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none"
// //                     >
// //                       <span className="block text-sm font-semibold text-white">{link.label}</span>
// //                       <span className="block text-xs text-neutral-400">{link.hint}</span>
// //                     </Link>
// //                   ))}
// //                 </div>
// //               )}
// //             </div>
// //           </nav>

// //           <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
// //             {activeOrder ? (
// //               <Link
// //                 href={`/customer/track/${activeOrder.id}`}
// //                 aria-label="Track your active order"
// //                 className="hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20 xl:flex"
// //               >
// //                 <span className="relative flex h-2 w-2" aria-hidden="true">
// //                   <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
// //                   <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
// //                 </span>
// //                 <span className="whitespace-nowrap">{ORDER_LABEL[activeOrder.status] ?? 'Track order'}</span>
// //               </Link>
// //             ) : null}

// //             {/* City: a native select. It opens the phone's own picker, so it can never be clipped. */}
// //             <div
// //               className={`relative min-w-0 transition-opacity duration-150 ${cityReady ? 'opacity-100' : 'opacity-0'}`}
// //             >
// //               <svg
// //                 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400"
// //                 viewBox="0 0 24 24"
// //                 fill="none"
// //                 stroke="currentColor"
// //                 strokeWidth={2}
// //                 aria-hidden="true"
// //               >
// //                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
// //                 <circle cx="12" cy="10" r="2.5" />
// //               </svg>
// //               <label htmlFor="header-city" className="sr-only">
// //                 Delivery city
// //               </label>
// //               <select
// //                 id="header-city"
// //                 value={city}
// //                 onChange={(e) => onCityChange(e.target.value)}
// //                 className="h-10 w-full max-w-[8.5rem] cursor-pointer appearance-none truncate rounded-xl border border-white/10 bg-white/5 pl-8 pr-7 text-sm font-medium text-white outline-none transition-colors hover:border-cyan-500/30 focus-visible:ring-2 focus-visible:ring-cyan-400 sm:max-w-[10rem]"
// //               >
// //                 {cityOptions.map((c) => (
// //                   <option key={c.id ?? c.name} value={c.name} className="bg-[#0A1628] text-white">
// //                     {c.status === 'coming_soon' ? `${c.name} (soon)` : c.name}
// //                   </option>
// //                 ))}
// //               </select>
// //               <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400">
// //                 <Chevron open={false} />
// //               </span>
// //             </div>

// //             {!hydrated ? (
// //               /* Reserve the space so nothing jumps when the session loads */
// //               <div className="hidden h-10 w-[72px] sm:block" aria-hidden="true" />
// //             ) : isLoggedIn && user ? (
// //               <div ref={menuRef} className="relative hidden sm:block">
// //                 <button
// //                   type="button"
// //                   onClick={() => setMenuOpen((o) => !o)}
// //                   aria-haspopup="menu"
// //                   aria-expanded={menuOpen}
// //                   aria-label="Account menu"
// //                   className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 pl-2 pr-3 text-white transition-colors hover:border-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
// //                 >
// //                   <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-bold text-cyan-300">
// //                     {initial}
// //                   </span>
// //                   <Chevron open={menuOpen} />
// //                 </button>
// //                 {menuOpen && (
// //                   <div
// //                     role="menu"
// //                     aria-label="Account"
// //                     className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
// //                   >
// //                     <div className="px-3 pb-2 pt-1.5">
// //                       <p className="truncate text-sm font-semibold text-white">{user.full_name || 'Your account'}</p>
// //                       {user.email ? <p className="truncate text-xs text-neutral-400">{user.email}</p> : null}
// //                     </div>
// //                     <div className="my-1 h-px bg-white/5" />
// //                     {activeOrder ? (
// //                       <Link
// //                         role="menuitem"
// //                         href={`/customer/track/${activeOrder.id}`}
// //                         className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-white/5"
// //                       >
// //                         ● Track active order
// //                       </Link>
// //                     ) : null}
// //                     <Link role="menuitem" href={dashboardHref} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5">
// //                       Dashboard
// //                     </Link>
// //                     {role === 'admin' && (
// //                       <Link role="menuitem" href="/admin/zones" prefetch={false} className={menuItem}>
// //                         Service zones
// //                       </Link>
// //                     )}
// //                     {isCustomer && (
// //                       <>
// //                         <Link role="menuitem" href="/customer/history" prefetch={false} className={menuItem}>
// //                           My orders
// //                         </Link>
// //                         <Link role="menuitem" href="/customer/addresses" prefetch={false} className={menuItem}>
// //                           Saved addresses
// //                         </Link>
// //                         <Link role="menuitem" href="/customer/account" prefetch={false} className={menuItem}>
// //                           Account
// //                         </Link>
// //                       </>
// //                     )}
// //                     <div className="my-1 h-px bg-white/5" />
// //                     <button
// //                       type="button"
// //                       role="menuitem"
// //                       onClick={() => void signOut()}
// //                       disabled={signingOut}
// //                       className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
// //                     >
// //                       {signingOut ? 'Signing out…' : 'Sign out'}
// //                     </button>
// //                   </div>
// //                 )}
// //               </div>
// //             ) : (
// //               <Link
// //                 href="/auth/login"
// //                 className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5 hover:text-white sm:block"
// //               >
// //                 Sign in
// //               </Link>
// //             )}

// //             <Link
// //               href="/book"
// //               className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-150 hover:opacity-95 hover:shadow-cyan-500/40 active:scale-95"
// //             >
// //               <span className="hidden sm:inline">Book water</span>
// //               <span className="sm:hidden">Book</span>
// //               <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
// //                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
// //               </svg>
// //             </Link>

// //             <button
// //               type="button"
// //               onClick={() => setMobileOpen((o) => !o)}
// //               className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-white/5 lg:hidden"
// //               aria-label="Toggle menu"
// //               aria-expanded={mobileOpen}
// //               aria-controls="mobile-menu"
// //             >
// //               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'translate-y-2 rotate-45' : ''}`} />
// //               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
// //               <span className={`h-0.5 w-5 bg-white transition-all duration-200 ${mobileOpen ? '-translate-y-2 -rotate-45' : ''}`} />
// //               {activeOrder && !mobileOpen ? (
// //                 <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0A1628]" aria-hidden="true" />
// //               ) : null}
// //             </button>
// //           </div>
// //         </div>
// //       </header>

// //       <div
// //         className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
// //           mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
// //         }`}
// //         onClick={() => setMobileOpen(false)}
// //         aria-hidden="true"
// //       />

// //       <div
// //         id="mobile-menu"
// //         role="dialog"
// //         aria-modal="true"
// //         aria-label="Menu"
// //         className={`fixed right-0 top-0 z-50 h-full w-80 max-w-[88vw] border-l border-white/5 bg-[#0A1628] transition-[transform,visibility] duration-300 ease-out lg:hidden ${
// //           mobileOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
// //         }`}
// //       >
// //         <div className="flex h-full flex-col overflow-y-auto p-5">
// //           <div className="mb-5 flex items-center justify-between">
// //             <span className="font-bold text-white">Menu</span>
// //             <button
// //               ref={drawerCloseRef}
// //               type="button"
// //               onClick={() => setMobileOpen(false)}
// //               className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-neutral-400 hover:bg-white/5 hover:text-white"
// //               aria-label="Close menu"
// //             >
// //               ✕
// //             </button>
// //           </div>

// //           {activeOrder ? (
// //             <Link
// //               href={`/customer/track/${activeOrder.id}`}
// //               className="mb-5 flex items-center justify-between rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3"
// //             >
// //               <span>
// //                 <span className="block text-sm font-bold text-emerald-300">
// //                   {ORDER_LABEL[activeOrder.status] ?? 'Order in progress'}
// //                 </span>
// //                 <span className="block text-xs text-emerald-200/70">Tap to track your order</span>
// //               </span>
// //               <span className="text-emerald-300" aria-hidden="true">
// //                 →
// //               </span>
// //             </Link>
// //           ) : null}

// //           <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Book a service</p>
// //           <div className="mb-5 grid grid-cols-2 gap-2">
// //             {SERVICES.map((s) => (
// //               <Link
// //                 key={s.key}
// //                 href={bookHref(s.key)}
// //                 prefetch={false}
// //                 className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:border-cyan-500/30"
// //               >
// //                 <span aria-hidden="true">{s.icon}</span>
// //                 <span className="truncate">{s.label}</span>
// //               </Link>
// //             ))}
// //           </div>

// //           <nav className="flex-1 space-y-1" aria-label="Mobile">
// //             {[{ label: 'All services', href: '/services' }, ...PRIMARY_LINKS, ...MORE_LINKS].map((link) => (
// //               <Link
// //                 key={link.href}
// //                 href={link.href}
// //                 prefetch={false}
// //                 aria-current={isActive(link.href) ? 'page' : undefined}
// //                 className={`block rounded-xl px-4 py-3 text-sm transition-colors ${
// //                   isActive(link.href)
// //                     ? 'bg-cyan-500/10 text-cyan-300'
// //                     : 'text-neutral-300 hover:bg-white/5 hover:text-white'
// //                 }`}
// //               >
// //                 {link.label}
// //               </Link>
// //             ))}
// //             <a
// //               href={WHATSAPP_HREF}
// //               target="_blank"
// //               rel="noreferrer"
// //               className="block rounded-xl px-4 py-3 text-sm text-emerald-300 transition-colors hover:bg-emerald-400/10"
// //             >
// //               💬 Chat with us on WhatsApp
// //             </a>
// //           </nav>

// //           <div className="space-y-2 border-t border-white/5 pt-5">
// //             {!hydrated ? null : isLoggedIn ? (
// //               <>
// //                 <Link
// //                   href={dashboardHref}
// //                   className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
// //                 >
// //                   My dashboard
// //                 </Link>
// //                 {isCustomer && (
// //                   <Link
// //                     href="/customer/history"
// //                     prefetch={false}
// //                     className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
// //                   >
// //                     My orders
// //                   </Link>
// //                 )}
// //                 <button
// //                   type="button"
// //                   onClick={() => void signOut()}
// //                   disabled={signingOut}
// //                   className="block w-full rounded-xl py-3 text-center text-sm font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
// //                 >
// //                   {signingOut ? 'Signing out…' : 'Sign out'}
// //                 </button>
// //               </>
// //             ) : (
// //               <>
// //                 <Link
// //                   href="/auth/login"
// //                   className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-white hover:border-cyan-500/30"
// //                 >
// //                   Sign in
// //                 </Link>
// //                 <Link
// //                   href="/auth/register"
// //                   className="block w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
// //                 >
// //                   Create account
// //                 </Link>
// //               </>
// //             )}
// //           </div>
// //         </div>
// //       </div>
// //     </>
// //   );
// // }











