'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';

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

export default function SiteNav({ offsetPx = 0 }: { offsetPx?: number }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();
  const { checked, isLoggedIn, role, user, logout } = useAuth();
  const [avatarOpen, setAvatarOpen] = useState(false);

  const initials = typeof user === 'string' && user.trim().length
    ? user
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : 'A';

  const roleLabel =
    role === 'technician' ? 'Technician'
      : role === 'supplier' ? 'Supplier'
      : role === 'admin' ? 'Admin'
      : 'Customer';

  const dashboardHref =
    role === 'technician' ? '/technician/dashboard'
      : role === 'supplier' ? '/supplier/dashboard'
      : role === 'admin' ? '/admin'
      : '/dashboard';

  return (
    <header
      className="sticky z-50 w-full border-b border-white/10 bg-white/80 backdrop-blur-md shadow-soft"
      style={{ top: offsetPx }}
    >
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

          {!checked ? null : isLoggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAvatarOpen((v) => !v)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] text-white font-extrabold"
                aria-label="Open account menu"
              >
                {initials}
              </button>
              {avatarOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-white border border-slate-100 shadow-card z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="text-xs text-slate-500">Role</div>
                    <div className="text-sm font-extrabold text-slate-900">{roleLabel}</div>
                  </div>
                  <div className="flex flex-col p-2 gap-1">
                    <Link
                      href={dashboardHref}
                      onClick={() => setAvatarOpen(false)}
                      className="px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    >
                      🏠 My Dashboard
                    </Link>
                    <Link
                      href="/dashboard?tab=profile"
                      onClick={() => setAvatarOpen(false)}
                      className="px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-semibold text-slate-700"
                    >
                      👤 My Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarOpen(false);
                        logout();
                      }}
                      className="px-3 py-2 rounded-xl hover:bg-slate-50 text-sm font-extrabold text-rose-700 text-left"
                    >
                      🚪 Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link
                href="/auth/login"
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                Register
              </Link>
            </div>
          )}

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

            {!checked ? null : isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-extrabold text-slate-700"
                >
                  🏠 My Dashboard
                </Link>
                <Link
                  href="/dashboard?tab=profile"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-extrabold text-slate-700"
                >
                  👤 My Profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="mt-2 px-4 py-3 rounded-xl hover:bg-slate-50 text-sm font-extrabold text-rose-700 text-left"
                >
                  🚪 Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors text-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold text-center"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
