'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Compact single-row portal navigation.
//  - never wraps (was stacking into 3 rows on phones)
//  - scrolls sideways on small screens, keeps the active tab in view
//  - sticky at the top; the dashboard header sits right under it
const links = [
  { href: '/supplier/dashboard', label: 'Overview' },
  { href: '/supplier/orders', label: 'Orders' },
  { href: '/supplier/inventory', label: 'Inventory' },
  { href: '/supplier/earnings', label: 'Earnings' },
  { href: '/supplier/settings', label: 'Dispatch' },
  { href: '/supplier/profile', label: 'My Profile' },
  { href: '/supplier/analytics', label: 'Performance' },
  { href: '/supplier/support', label: 'Support' },
];

export default function SupplierNav() {
  const pathname = usePathname() ?? '';
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <>
      <style>{`
        .snav { position: sticky; top: 0; z-index: 60; height: 48px; background: rgba(7,17,28,.92);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(148,163,184,.14); }
        .snav-row { height: 100%; max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 6px;
          padding: 0 clamp(12px,4vw,24px); overflow-x: auto; overflow-y: hidden; white-space: nowrap;
          scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; }
        .snav-row::-webkit-scrollbar { display: none; }
        .snav-link { flex: 0 0 auto; scroll-snap-align: center; color: #9fb4c7; text-decoration: none; font-size: 13px;
          font-weight: 700; padding: 7px 13px; border-radius: 999px; border: 1px solid transparent;
          transition: background .18s, color .18s; }
        .snav-link:hover { color: #ecfdf5; background: rgba(255,255,255,.05); }
        .snav-link:focus-visible { outline: 2px solid #34d399; outline-offset: 2px; }
        .snav-link[aria-current='page'] { color: #ecfdf5; border-color: rgba(52,211,153,.5);
          background: linear-gradient(135deg,rgba(5,150,105,.35),rgba(13,148,136,.15)); }
      `}</style>
      <nav className="snav" aria-label="Supplier portal navigation">
        <div className="snav-row">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={active ? activeRef : undefined}
                aria-current={active ? 'page' : undefined}
                className="snav-link"
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
