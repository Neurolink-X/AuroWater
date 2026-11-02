// src/components/ScrollReveal.tsx
'use client';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { usePathname } from 'next/navigation';

const NON_MARKETING_PREFIXES = [
  '/admin', '/customer', '/supplier', '/technician', '/agent',
  '/seller', '/dashboard', '/auth', '/plumber', '/settings',
];

export default function ScrollReveal() {
  const pathname = usePathname() ?? '';
  // Private role dashboards mutate frequently. Skip marketing-only DOM observers.
  const enabled = !NON_MARKETING_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  useScrollAnimation({ enabled });
  return null;
}

// src/app/layout.tsx → <body><ScrollReveal />{children}</body>
