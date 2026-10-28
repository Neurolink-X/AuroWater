'use client';

/**
 * src/components/supplier/SupplierNav.tsx   (overwrite wherever your current SupplierNav lives)
 *
 * Supplier portal navigation. Drop-in: `<SupplierNav />` works exactly as before.
 *
 *  - Phones: brand + language toggle on top, one swipeable row of tabs below (never wraps)
 *  - Laptops (≥1024px): ONE row, brand | tabs | language toggle, saving ~48px of height
 *  - Edge fades show when more tabs are off-screen; the active tab is centred without moving the page
 *  - Instant tap feedback (spinner while the next page loads) + idle prefetch of every tab
 *  - Notch / safe-area aware, 44px touch targets on touch devices, reduced-motion and
 *    forced-colors (high-contrast) friendly, full keyboard focus styles
 *  - Optional live badges: <SupplierNav badges={{ '/supplier/orders': pendingCount }} />
 *  - Publishes --supplier-nav-h (its real height) so sticky headers below can offset themselves
 *  - Labels are per-language objects: add a language by adding a key (falls back to English)
 */

import { useEffect, useRef } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type Label = { en: string } & Record<string, string>;
interface NavItem { href: string; label: Label; priority?: boolean }

const BRAND = 'AuroTap · Supplier';

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/supplier/dashboard', label: { en: 'Overview', hi: 'डैशबोर्ड' } },
  { href: '/supplier/orders', label: { en: 'Orders', hi: 'ऑर्डर' }, priority: true },
  { href: '/supplier/coverage', label: { en: 'Service Areas', hi: 'सेवा क्षेत्र' } },
  { href: '/supplier/inventory', label: { en: 'Inventory', hi: 'स्टॉक' } },
  { href: '/supplier/earnings', label: { en: 'Earnings', hi: 'कमाई' } },
  { href: '/supplier/settings', label: { en: 'Dispatch', hi: 'डिस्पैच' } },
  { href: '/supplier/profile', label: { en: 'My Profile', hi: 'मेरी प्रोफ़ाइल' } },
  { href: '/supplier/analytics', label: { en: 'Performance', hi: 'प्रदर्शन' } },
  { href: '/supplier/support', label: { en: 'Support', hi: 'सहायता' } },
];

export interface SupplierNavProps {
  /** Optional counts per route, e.g. { '/supplier/orders': 3 }. Hidden when 0 or missing. */
  badges?: Readonly<Record<string, number | undefined>>;
}

/** Must render INSIDE <Link>: shows a small spinner while that link's page is loading. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="snav-spin" aria-hidden="true" /> : null;
}

export default function SupplierNav({ badges }: SupplierNavProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { language } = useLanguage();

  const shellRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  /* Centre the active tab inside the row (scrolls only the row, never the page) */
  useEffect(() => {
    const row = rowRef.current;
    const el = activeRef.current;
    if (!row || !el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollTo({ left: Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2), behavior: reduce ? 'auto' : 'smooth' });
  }, [pathname, language]);

  /* Edge fades + publish the nav height as a CSS variable */
  useEffect(() => {
    const row = rowRef.current;
    const shell = shellRef.current;
    if (!row || !shell) return;
    let raf = 0;
    const edges = () => {
      raf = 0;
      const max = row.scrollWidth - row.clientWidth;
      row.dataset.fl = row.scrollLeft > 2 ? '1' : '0';
      row.dataset.fr = row.scrollLeft < max - 2 ? '1' : '0';
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(edges); };
    const publishHeight = () => document.documentElement.style.setProperty('--supplier-nav-h', `${shell.offsetHeight}px`);
    edges();
    publishHeight();
    row.addEventListener('scroll', schedule, { passive: true });
    const ro = new ResizeObserver(() => { schedule(); publishHeight(); });
    ro.observe(row);
    ro.observe(shell);
    return () => {
      row.removeEventListener('scroll', schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty('--supplier-nav-h');
    };
  }, []);

  /* Prefetch every tab when the browser is idle (skipped on Data Saver) so tab switches feel instant */
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const run = () => NAV_ITEMS.forEach((i) => router.prefetch(i.href));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <>
      <style>{`
        .snav{position:sticky;top:0;z-index:60;padding-top:env(safe-area-inset-top,0px);color-scheme:dark;
          background:rgba(7,17,28,.96);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
          border-bottom:1px solid rgba(148,163,184,.14)}
        .snav-inner{max-width:1200px;margin:0 auto;display:grid;align-items:center;column-gap:12px;
          grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"brand tools" "nav nav";
          padding-left:max(clamp(12px,4vw,24px),env(safe-area-inset-left,0px));
          padding-right:max(clamp(12px,4vw,24px),env(safe-area-inset-right,0px))}
        .snav-brand{grid-area:brand;min-width:0;min-height:44px;display:flex;align-items:center;color:#ecfdf5;
          font-size:12px;font-weight:800;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .snav-tools{grid-area:tools;display:flex;align-items:center}
        .snav-row{grid-area:nav;position:relative;min-width:0;height:48px;display:flex;align-items:center;gap:6px;
          overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;
          -webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scroll-snap-type:x proximity;
          --fl:0px;--fr:0px;
          -webkit-mask-image:linear-gradient(to right,transparent 0,#000 var(--fl),#000 calc(100% - var(--fr)),transparent 100%);
          mask-image:linear-gradient(to right,transparent 0,#000 var(--fl),#000 calc(100% - var(--fr)),transparent 100%)}
        .snav-row[data-fl='1']{--fl:28px}
        .snav-row[data-fr='1']{--fr:28px}
        .snav-row::-webkit-scrollbar{display:none}
        .snav-link{flex:0 0 auto;scroll-snap-align:center;display:inline-flex;align-items:center;gap:6px;min-height:38px;
          color:#9fb4c7;text-decoration:none;font-size:13px;font-weight:700;line-height:1.2;padding:7px 14px;
          border-radius:999px;border:1px solid transparent;-webkit-tap-highlight-color:transparent;
          transition:background .18s,color .18s,border-color .18s}
        .snav-link[data-priority='true']{color:#ecfdf5;background:rgba(5,150,105,.22);border-color:rgba(52,211,153,.38)}
        .snav-link:hover{color:#ecfdf5;background:rgba(255,255,255,.06)}
        .snav-link:active{background:rgba(255,255,255,.1)}
        .snav-link:focus-visible{outline:2px solid #34d399;outline-offset:2px}
        .snav-link[aria-current='page']{color:#ecfdf5;border-color:rgba(52,211,153,.5);
          background:linear-gradient(135deg,rgba(5,150,105,.35),rgba(13,148,136,.15))}
        .snav-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#34d399;color:#06281d;
          font-size:11px;font-weight:800;line-height:18px;text-align:center}
        .snav-spin{width:12px;height:12px;border-radius:50%;border:2px solid rgba(236,253,245,.25);
          border-top-color:#34d399;animation:snav-rot .7s linear infinite}
        @keyframes snav-rot{to{transform:rotate(360deg)}}
        @media (pointer:coarse){.snav-link{min-height:44px;padding:9px 16px}.snav-row{height:56px}}
        @media (min-width:1024px){
          .snav-inner{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"brand nav tools";column-gap:20px}
          .snav-row{height:56px}
          .snav-link:first-child{margin-left:auto}
          .snav-link:last-child{margin-right:auto}
        }
        @media (prefers-reduced-motion:reduce){.snav-link{transition:none}.snav-spin{animation:none;border-top-color:rgba(236,253,245,.25);background:#34d399}}
        @media (forced-colors:active){.snav-link[aria-current='page']{border:2px solid Highlight}.snav-link:focus-visible{outline-color:Highlight}}
      `}</style>

      <div className="snav" ref={shellRef}>
        <div className="snav-inner">
          <span className="snav-brand">{BRAND}</span>
          <div className="snav-tools"><LanguageToggle /></div>
          <nav aria-label="Supplier portal navigation" className="snav-row" ref={rowRef}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const count = badges?.[item.href] ?? 0;
              const text = item.label[language] ?? item.label.en;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={active ? activeRef : undefined}
                  aria-current={active ? 'page' : undefined}
                  className="snav-link"
                  data-priority={item.priority ? 'true' : undefined}
                >
                  {text}
                  {count > 0 && <span className="snav-badge" aria-label={`${count} new`}>{count > 99 ? '99+' : count}</span>}
                  <Pending />
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}










// 'use client';

// import { useEffect, useRef } from 'react';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';
// import LanguageToggle from '@/components/LanguageToggle';
// import { useLanguage } from '@/lib/i18n/LanguageContext';

// // Compact single-row portal navigation.
// //  - never wraps (was stacking into 3 rows on phones)
// //  - scrolls sideways on small screens, keeps the active tab in view
// //  - sticky at the top; the dashboard header sits right under it
// const links = [
//   { href: '/supplier/dashboard', label: 'Overview' },
//   { href: '/supplier/orders', label: 'Orders', priority: true },
//   { href: '/supplier/coverage', label: 'Service Areas' },
//   { href: '/supplier/inventory', label: 'Inventory' },
//   { href: '/supplier/earnings', label: 'Earnings' },
//   { href: '/supplier/settings', label: 'Dispatch' },
//   { href: '/supplier/profile', label: 'My Profile' },
//   { href: '/supplier/analytics', label: 'Performance' },
//   { href: '/supplier/support', label: 'Support' },
// ];

// export default function SupplierNav() {
//   const pathname = usePathname() ?? '';
//   const { language } = useLanguage();
//   const labels: Record<string, string> = language === 'hi' ? {
//     Overview: 'डैशबोर्ड', Orders: 'ऑर्डर', Inventory: 'स्टॉक', Earnings: 'कमाई', Dispatch: 'डिस्पैच', 'Service Areas': 'सेवा क्षेत्र', 'My Profile': 'मेरी प्रोफ़ाइल', Performance: 'प्रदर्शन', Support: 'सहायता',
//   } : {};
//   const activeRef = useRef<HTMLAnchorElement | null>(null);

//   useEffect(() => {
//     activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
//   }, [pathname]);

//   return (
//     <>
//       <style>{`
//         .snav { position: sticky; top: 0; z-index: 60; background: rgba(7,17,28,.96);
//           backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
//           border-bottom: 1px solid rgba(148,163,184,.14); }
//         .snav-toolbar { min-height: 44px; max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px clamp(12px,4vw,24px); }
//         .snav-brand { min-width: 0; color: #ecfdf5; font-size: 12px; font-weight: 800; letter-spacing: .02em; }
//         .snav-row { height: 48px; max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 6px;
//           padding: 0 clamp(12px,4vw,24px); overflow-x: auto; overflow-y: hidden; white-space: nowrap;
//           scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; }
//         .snav-row::-webkit-scrollbar { display: none; }
//         .snav-link { flex: 0 0 auto; scroll-snap-align: center; color: #9fb4c7; text-decoration: none; font-size: 13px;
//           font-weight: 700; padding: 7px 13px; border-radius: 999px; border: 1px solid transparent;
//           transition: background .18s, color .18s; }
//         .snav-link[data-priority='true'] { color: #ecfdf5; background: rgba(5,150,105,.22); border-color: rgba(52,211,153,.38); }
//         .snav-link:hover { color: #ecfdf5; background: rgba(255,255,255,.05); }
//         .snav-link:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }
//         .snav-link[aria-current='page'] { color: #ecfdf5; border-color: rgba(52,211,153,.5);
//           background: linear-gradient(135deg,rgba(5,150,105,.35),rgba(13,148,136,.15)); }
//       `}</style>
//       <div className="snav">
//         <div className="snav-toolbar"><span className="snav-brand">AuroTap · Supplier</span><LanguageToggle /></div>
//         <nav aria-label="Supplier portal navigation" className="snav-row">
//           {links.map((item) => {
//             const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
//             return (
//               <Link
//                 key={item.href}
//                 href={item.href}
//                 ref={active ? activeRef : undefined}
//                 aria-current={active ? 'page' : undefined}
//                 className="snav-link"
//                 data-priority={'priority' in item && item.priority ? 'true' : undefined}
//               >
//                 {labels[item.label] ?? item.label}
//               </Link>
//             );
//           })}
//         </nav>
//       </div>
//     </>
//   );
// }
