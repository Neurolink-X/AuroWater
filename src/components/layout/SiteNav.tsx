'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const NAV_ITEMS = [
  { href: '/', key: 'nav_home' },
  { href: '/services', key: 'nav_services' },
  { href: '/how-it-works', key: 'nav_how_it_works' },
  { href: '/pricing', key: 'nav_pricing' },
  { href: '/technicians', key: 'nav_technicians' },
  { href: '/about', key: 'nav_about' },
  { href: '/contact', key: 'nav_contact' },
  { href: '/dashboard', key: 'nav_dashboard' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/80 backdrop-blur-md shadow-soft">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16 lg:h-18">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-slate-800 hover:text-emerald-600 transition-colors"
        >
          <span className="text-2xl" aria-hidden>💧</span>
          <span>AuroWater</span>
        </Link>

        {/* Desktop */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, key }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50'
                }`}
                >
                  {t(key)}
              </Link>
            );
          })}
          <Link
            href="/book"
            className="ml-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 transition-colors"
          >
            {t('nav_book_now')}
          </Link>
          <LanguageToggle />
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white/95 backdrop-blur-md px-4 py-4 shadow-card">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium ${
                  pathname === href ? 'text-emerald-600 bg-emerald-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t(key)}
              </Link>
            ))}
            <Link
              href="/book"
              onClick={() => setMobileOpen(false)}
              className="mt-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold text-center"
            >
              {t('nav_book_now')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
