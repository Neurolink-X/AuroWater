'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Your original nav, unchanged in look. Only two additions:
//  1. active state also matches sub-routes (/supplier/orders/123 keeps "Orders" lit)
//  2. aria-current="page" for screen readers + a skip-link target is in layout.tsx
const links = [
  { href: '/supplier/dashboard', label: 'Overview' },
  { href: '/supplier/orders', label: 'Orders' },
  { href: '/supplier/inventory', label: 'Inventory' },
  { href: '/supplier/earnings', label: 'Earnings & payouts' },
  { href: '/supplier/settings', label: 'Dispatch settings' },
  { href: '/supplier/analytics', label: 'Performance' },
  { href: '/supplier/support', label: 'Support' },
];

export default function SupplierNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Supplier portal navigation"
      style={{
        position: 'relative',
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '12px clamp(12px, 4vw, 64px)',
        background: '#07111c',
        borderBottom: '1px solid rgba(148,163,184,.16)',
      }}
    >
      {links.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            style={{
              color: active ? '#ecfdf5' : '#d7e7f3',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 750,
              padding: '10px 14px',
              borderRadius: 11,
              border: active ? '1px solid rgba(52,211,153,.65)' : '1px solid rgba(148,163,184,.18)',
              background: active
                ? 'linear-gradient(135deg,rgba(5,150,105,.35),rgba(13,148,136,.15))'
                : 'rgba(255,255,255,.035)',
              boxShadow: active ? '0 6px 22px rgba(5,150,105,.12)' : 'none',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
