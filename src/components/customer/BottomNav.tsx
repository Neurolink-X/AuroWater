'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  key: 'home' | 'order' | 'track' | 'account';
  label: string;
  href: string;
  icon: (active: boolean) => React.ReactElement;
  isActive: (pathname: string) => boolean;
  badge?: boolean;
};

const on = '#0284C7';
const off = '#94A3B8';

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z"
        stroke={active ? on : off}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={active ? on : off} strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke={active ? on : off} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconList({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" stroke={active ? on : off} strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.2" fill={active ? on : off} />
      <circle cx="4" cy="12" r="1.2" fill={active ? on : off} />
      <circle cx="4" cy="18" r="1.2" fill={active ? on : off} />
    </svg>
  );
}

function IconUser({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" stroke={active ? on : off} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="4" stroke={active ? on : off} strokeWidth="2" />
    </svg>
  );
}

/**
 * Mobile: full-width bar pinned to the bottom (safe-area aware).
 * Desktop (md+): floating centered pill so it never looks like a stretched phone bar.
 */
export default function BottomNav({ activeOrderId }: { activeOrderId?: string | null } = {}) {
  const pathname = usePathname() ?? '';

  const items: NavItem[] = [
    {
      key: 'home',
      label: 'Home',
      href: '/customer/home',
      icon: (a) => <IconHome active={a} />,
      isActive: (p) => p === '/customer/home',
    },
    {
      key: 'order',
      label: 'Book',
      href: '/book',
      icon: (a) => <IconPlus active={a} />,
      isActive: (p) => p.startsWith('/book'),
    },
    {
      key: 'track',
      label: activeOrderId ? 'Track' : 'Orders',
      href: activeOrderId ? `/customer/track/${activeOrderId}` : '/customer/history',
      icon: (a) => <IconList active={a} />,
      isActive: (p) => p.startsWith('/customer/track') || p.startsWith('/customer/history'),
      badge: Boolean(activeOrderId),
    },
    {
      key: 'account',
      label: 'Account',
      href: '/customer/account',
      icon: (a) => <IconUser active={a} />,
      isActive: (p) => p.startsWith('/customer/account'),
    },
  ];

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:inset-x-auto md:bottom-4 md:left-1/2 md:w-[440px] md:-translate-x-1/2 md:rounded-2xl md:border md:shadow-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid h-16 grid-cols-4">
        {items.map((it) => {
          const active = it.isActive(pathname);
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-1 rounded-xl transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span className="relative">
                {it.icon(active)}
                {it.badge ? (
                  <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                ) : null}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: active ? on : off }}>
                {it.label}
              </span>
              {active ? <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-sky-600" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}











// 'use client';

// import type React from 'react';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';

// type NavItem = {
//   key: 'home' | 'order' | 'track' | 'account';
//   label: string;
//   href: string;
//   icon: (active: boolean) => React.ReactElement;
//   isActive: (pathname: string) => boolean;
// };

// function IconHome({ active }: { active: boolean }) {
//   return (
//     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path
//         d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z"
//         stroke={active ? '#2563EB' : '#9CA3AF'}
//         strokeWidth="2"
//         strokeLinejoin="round"
//       />
//     </svg>
//   );
// }

// function IconBag({ active }: { active: boolean }) {
//   return (
//     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path
//         d="M7 7V6a5 5 0 0 1 10 0v1"
//         stroke={active ? '#2563EB' : '#9CA3AF'}
//         strokeWidth="2"
//         strokeLinecap="round"
//       />
//       <path
//         d="M6 7h12l1 14H5L6 7z"
//         stroke={active ? '#2563EB' : '#9CA3AF'}
//         strokeWidth="2"
//         strokeLinejoin="round"
//       />
//     </svg>
//   );
// }

// function IconPin({ active }: { active: boolean }) {
//   return (
//     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path
//         d="M12 22s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z"
//         stroke={active ? '#2563EB' : '#9CA3AF'}
//         strokeWidth="2"
//         strokeLinejoin="round"
//       />
//       <circle cx="12" cy="10" r="2.5" stroke={active ? '#2563EB' : '#9CA3AF'} strokeWidth="2" />
//     </svg>
//   );
// }

// function IconUser({ active }: { active: boolean }) {
//   return (
//     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path
//         d="M20 21a8 8 0 0 0-16 0"
//         stroke={active ? '#2563EB' : '#9CA3AF'}
//         strokeWidth="2"
//         strokeLinecap="round"
//       />
//       <circle cx="12" cy="8" r="4" stroke={active ? '#2563EB' : '#9CA3AF'} strokeWidth="2" />
//     </svg>
//   );
// }

// export default function BottomNav({ activeOrderId }: { activeOrderId?: string | null } = {}) {
//   const pathname = usePathname() ?? '';

//   const items: NavItem[] = [
//     {
//       key: 'home',
//       label: 'Home',
//       href: '/customer/home',
//       icon: (active) => <IconHome active={active} />,
//       isActive: (p) => p === '/customer/home',
//     },
//     {
//       key: 'order',
//       label: 'Order',
//       href: '/book',
//       icon: (active) => <IconBag active={active} />,
//       isActive: (p) => p.startsWith('/book'),
//     },
//     {
//       key: 'track',
//       label: 'Track',
//       href: activeOrderId ? `/customer/track/${activeOrderId}` : '/customer/history',
//       icon: (active) => <IconPin active={active} />,
//       isActive: (p) => p.startsWith('/customer/track') || p.startsWith('/customer/history'),
//     },
//     {
//       key: 'account',
//       label: 'Account',
//       href: '/customer/account',
//       icon: (active) => <IconUser active={active} />,
//       isActive: (p) => p.startsWith('/customer/account'),
//     },
//   ];

//   return (
//     <nav className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200">
//       <div
//         className="mx-auto max-w-3xl"
//         style={{
//           height: 64,
//           paddingBottom: 'env(safe-area-inset-bottom)',
//         }}
//       >
//         <div className="h-full grid grid-cols-4">
//           {items.map((it) => {
//             const active = it.isActive(pathname);
//             return (
//               <Link
//                 key={it.key}
//                 href={it.href}
//                 className="relative flex flex-col items-center justify-center gap-1"
//                 style={{ textDecoration: 'none' }}
//               >
//                 <span className="relative">
//                   {active ? (
//                     <span
//                       className="absolute -top-2 left-1/2 -translate-x-1/2 h-[3px] w-[3px] rounded-full"
//                       style={{ background: '#2563EB' }}
//                       aria-hidden="true"
//                     />
//                   ) : null}
//                   {it.icon(active)}
//                 </span>
//                 <span
//                   className="text-[11px] font-semibold"
//                   style={{ color: active ? '#2563EB' : '#9CA3AF' }}
//                 >
//                   {it.label}
//                 </span>
//               </Link>
//             );
//           })}
//         </div>
//       </div>
//     </nav>
//   );
// }

