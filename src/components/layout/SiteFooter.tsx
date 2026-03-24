'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const FOOTER_LINKS = [
  { href: '/services', key: 'nav_services' },
  { href: '/pricing', key: 'nav_pricing' },
  { href: '/how-it-works', key: 'nav_how_it_works' },
  { href: '/technicians', key: 'nav_technicians' },
  { href: '/about', key: 'nav_about' },
  { href: '/contact', key: 'nav_contact' },
];

export default function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-slate-200 bg-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <span className="text-2xl">💧</span>
            AuroWater
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-slate-600 hover:text-emerald-600 transition-colors"
              >
                {t(key)}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          © {new Date().getFullYear()} AuroWater. Premium water supply and services.
        </p>
      </div>
    </footer>
  );
}
