'use client';

/**
 * src/components/supplier/SupplierNav.tsx
 *
 * - Desktop: sticky frosted top bar with pill links.
 * - Mobile: compact top bar plus a thumb-friendly bottom tab bar that respects the iPhone home
 *   indicator. More than 5 items automatically move the extras into a "More" sheet.
 * - Active link uses aria-current, the offline state is announced, and links prefetch by default.
 *
 * EDIT NAV_ITEMS to match your real supplier routes. Everything else adapts automatically.
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PackageCheck,
  Boxes,
  Truck,
  IndianRupee,
  MoreHorizontal,
  WifiOff,
  LogIn,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type IconType = React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/supplier', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/supplier/orders', label: 'Orders', icon: PackageCheck },
  { href: '/supplier/inventory', label: 'Inventory', icon: Boxes },
  { href: '/supplier/availability', label: 'Dispatch', icon: Truck },
  { href: '/supplier/earnings', label: 'Earnings', icon: IndianRupee },
];

const MAX_MOBILE_TABS = 5;
const LOGIN_HREF = '/auth/login';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/supplier') return pathname === '/supplier';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

function Brand() {
  return (
    <Link href="/supplier" className={`group flex items-center gap-2.5 rounded-xl ${focusRing}`} aria-label="AuroTap Supplier home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/30 transition-transform group-hover:scale-105 motion-reduce:transition-none">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.5c3.6 4.3 6.5 7.6 6.5 11.1a6.5 6.5 0 1 1-13 0C5.5 10.1 8.4 6.8 12 2.5Z" fill="currentColor" />
          <path d="M9 14.2a3 3 0 0 0 2.6 2.9" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold tracking-tight text-slate-900">AuroTap</span>
        <span className="block text-[11px] font-medium text-emerald-700">Supplier portal</span>
      </span>
    </Link>
  );
}

export default function SupplierNav() {
  const pathname = usePathname();
  const online = useOnline();
  const { hydrated, isLoggedIn } = useAuth();
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null);
const moreOpen = Boolean(pathname && moreOpenPath === pathname);
  const moreId = useId();
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const overflow = NAV_ITEMS.length > MAX_MOBILE_TABS;
  const mobilePrimary = overflow ? NAV_ITEMS.slice(0, MAX_MOBILE_TABS - 1) : NAV_ITEMS;
  const mobileMore = overflow ? NAV_ITEMS.slice(MAX_MOBILE_TABS - 1) : [];
  const moreActive = mobileMore.some((i) => isActivePath(pathname, i.href));
  const showSignIn = hydrated && !isLoggedIn;

  // const closeMore = useCallback(() => {
  //   setMoreOpen(false);
  //   moreButtonRef.current?.focus();
  // }, []);

  const closeMore = useCallback(() => {
  setMoreOpenPath(null);
  moreButtonRef.current?.focus();
}, []);

  // Close the sheet when the route changes.
  useEffect(() => {
    setMoreOpenPath(null);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMore();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen, closeMore]);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-3 sm:px-6 lg:px-8">
          <Brand />

          <nav aria-label="Supplier sections" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                    active ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} aria-hidden className={active ? 'text-emerald-600' : 'text-slate-400'} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                online ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-300'
              }`}
            >
              {online ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> : <WifiOff size={12} aria-hidden />}
              <span className="hidden sm:inline">{online ? 'Connected' : 'Offline'}</span>
              <span className="sr-only sm:hidden">{online ? 'Connected' : 'Offline'}</span>
            </span>

            {showSignIn && (
              <Link
                href={LOGIN_HREF}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700 ${focusRing}`}
              >
                <LogIn size={14} aria-hidden /> Sign in
              </Link>
            )}
          </div>
        </div>

        {!online && (
          <div role="status" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
            You’re offline. What you see may be out of date until you reconnect.
          </div>
        )}
      </header>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Supplier sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-900/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {moreOpen && (
          <>
            <button type="button" tabIndex={-1} aria-label="Close menu" className="fixed inset-0 -z-10 cursor-default bg-slate-900/25" onClick={closeMore} />
            <div id={moreId} className="absolute inset-x-3 bottom-[calc(100%+8px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">More</p>
                <button type="button" onClick={closeMore} aria-label="Close" className={`rounded-lg p-1 text-slate-400 hover:text-slate-700 ${focusRing}`}>
                  <X size={16} aria-hidden />
                </button>
              </div>
              {mobileMore.map(({ href, label, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${focusRing} ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Icon size={18} aria-hidden className={active ? 'text-emerald-600' : 'text-slate-400'} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <ul className="mx-auto flex max-w-xl">
          {mobilePrimary.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${focusRing} ${
                    active ? 'text-emerald-700' : 'text-slate-500 active:text-slate-800'
                  }`}
                >
                  {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-emerald-500" aria-hidden="true" />}
                  <Icon size={20} aria-hidden className={active ? 'text-emerald-600' : 'text-slate-400'} />
                  {label}
                </Link>
              </li>
            );
          })}
          {overflow && (
            <li className="flex-1">
              <button
                ref={moreButtonRef}
                type="button"
                aria-expanded={moreOpen}
                aria-controls={moreOpen ? moreId : undefined}
               onClick={() =>
  setMoreOpenPath((current) =>
    current === pathname ? null : pathname
  )
}
                className={`relative flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${focusRing} ${
                  moreActive || moreOpen ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {moreActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-emerald-500" aria-hidden="true" />}
                <MoreHorizontal size={20} aria-hidden />
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}










// 'use client';

// import Link from 'next/link';
// import { usePathname } from 'next/navigation';

// // Your original nav, unchanged in look. Only two additions:
// //  1. active state also matches sub-routes (/supplier/orders/123 keeps "Orders" lit)
// //  2. aria-current="page" for screen readers + a skip-link target is in layout.tsx
// const links = [
//   { href: '/supplier/dashboard', label: 'Overview' },
//   { href: '/supplier/orders', label: 'Orders' },
//   { href: '/supplier/inventory', label: 'Inventory' },
//   { href: '/supplier/earnings', label: 'Earnings & payouts' },
//   { href: '/supplier/settings', label: 'Dispatch settings' },
//   { href: '/supplier/analytics', label: 'Performance' },
//   { href: '/supplier/support', label: 'Support' },
// ];

// export default function SupplierNav() {
//   const pathname = usePathname() ?? '';

//   return (
//     <nav
//       aria-label="Supplier portal navigation"
//       style={{
//         position: 'relative',
//         zIndex: 20,
//         display: 'flex',
//         flexWrap: 'wrap',
//         gap: 8,
//         padding: '12px clamp(12px, 4vw, 64px)',
//         background: '#07111c',
//         borderBottom: '1px solid rgba(148,163,184,.16)',
//       }}
//     >
//       {links.map((item) => {
//         const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
//         return (
//           <Link
//             key={item.href}
//             href={item.href}
//             aria-current={active ? 'page' : undefined}
//             style={{
//               color: active ? '#ecfdf5' : '#d7e7f3',
//               textDecoration: 'none',
//               fontSize: 13,
//               fontWeight: 750,
//               padding: '10px 14px',
//               borderRadius: 11,
//               border: active ? '1px solid rgba(52,211,153,.65)' : '1px solid rgba(148,163,184,.18)',
//               background: active
//                 ? 'linear-gradient(135deg,rgba(5,150,105,.35),rgba(13,148,136,.15))'
//                 : 'rgba(255,255,255,.035)',
//               boxShadow: active ? '0 6px 22px rgba(5,150,105,.12)' : 'none',
//             }}
//           >
//             {item.label}
//           </Link>
//         );
//       })}
//     </nav>
//   );
// }
