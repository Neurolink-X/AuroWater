import Link from 'next/link';
import type { ReactNode } from 'react';

const links = [
  { href: '/supplier/dashboard', label: 'Overview' },
  { href: '/supplier/orders', label: 'Orders' },
  { href: '/supplier/inventory', label: 'Inventory' },
  { href: '/supplier/earnings', label: 'Earnings & payouts' },
  { href: '/supplier/settings', label: 'Dispatch settings' },
  { href: '/supplier/analytics', label: 'Performance' },
  { href: '/supplier/support', label: 'Support' },
];

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav aria-label="Supplier portal navigation" style={{
        position: 'relative', zIndex: 20, display: 'flex', flexWrap: 'wrap',
        gap: 8, padding: '12px clamp(12px, 4vw, 64px)',
        background: '#07111c', borderBottom: '1px solid rgba(148,163,184,.16)',
      }}>
        {links.map((item) => (
          <Link key={item.href} href={item.href} style={{
            color: '#d7e7f3', textDecoration: 'none', fontSize: 13,
            fontWeight: 700, padding: '9px 13px', borderRadius: 10,
            border: '1px solid rgba(148,163,184,.18)', background: 'rgba(255,255,255,.035)',
          }}>{item.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
