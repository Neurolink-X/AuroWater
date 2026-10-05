'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, getUser, logout, verifyToken } from '@/lib/api-client';
import type { User } from '@/types';

const NAV = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: '/admin/dashboard/users',
    label: 'Approvals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="4" strokeWidth="1.8" />
        <path
          d="m17 11 2 2 4-4"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/dashboard/waitlist',
    label: 'Waitlist',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
        <path
          d="M12 7v5l3 2"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/finance',
    label: 'Finance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="2.5" y="5" width="19" height="14" rx="2" strokeWidth="1.8" />
        <path d="M2.5 10h19" strokeWidth="1.8" />
        <path
          d="M7 15h4"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M6 2.8h12v18.4H6z"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 7h6M9 11h6M9 15h4"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="9" cy="7" r="4" strokeWidth="1.8" />
        <path
          d="M19 8v6M22 11h-6"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          strokeWidth="1.8"
        />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.54v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.12 15a1.7 1.7 0 0 0-1.56-1.03H6V11.4h.1A1.7 1.7 0 0 0 7.66 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06A1.7 1.7 0 0 0 11 6.66 1.7 1.7 0 0 0 12.03 5.1V5h2.54v.1A1.7 1.7 0 0 0 15.6 6.66a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06A1.7 1.7 0 0 0 18.94 10a1.7 1.7 0 0 0 1.56 1.03h.1v2.54h-.1A1.7 1.7 0 0 0 19.4 15Z"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M4 6h16M4 12h16M4 18h16"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M10 17l5-5-5-5M15 12H3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Desktop sidebar state.
  const [collapsed, setCollapsed] = useState(false);

  // Mobile drawer state.
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthRoute = useMemo(
    () =>
      pathname === '/admin/login' ||
      pathname === '/admin/register',
    [pathname],
  );

  const currentPage = useMemo(() => {
    const exact = NAV.find((item) => item.href === pathname);

    if (exact) {
      return exact.label;
    }

    const nested = NAV.find((item) =>
      pathname.startsWith(`${item.href}/`),
    );

    return nested?.label || 'Workspace';
  }, [pathname]);

  /*
   * Authentication / authorization check.
   *
   * The server remains the source of truth for the
   * current user's role and active status.
   */
  useEffect(() => {
    const run = async () => {
      if (isAuthRoute) {
        setChecking(false);
        return;
      }

      const token = await getToken();
      const localUser = getUser();

      if (!token || !localUser) {
        router.replace(
          `/auth/login?returnTo=${encodeURIComponent(
            pathname || '/admin/dashboard',
          )}`,
        );
        return;
      }

      try {
        const verified = await verifyToken();

        if (
          !verified?.user ||
          verified.user.role !== 'ADMIN'
        ) {
          logout();

          router.replace(
            `/auth/login?returnTo=${encodeURIComponent(
              pathname || '/admin/dashboard',
            )}`,
          );

          return;
        }

        setUser(verified.user);
      } catch {
        logout();

        router.replace(
          `/auth/login?returnTo=${encodeURIComponent(
            pathname || '/admin/dashboard',
          )}`,
        );

        return;
      } finally {
        setChecking(false);
      }
    };

    run();
  }, [isAuthRoute, pathname, router]);

  /*
   * Close the mobile drawer whenever navigation changes.
   */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /*
   * Lock page scrolling while the mobile drawer is open.
   */
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  /*
   * Escape key closes the mobile drawer.
   */
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-400/20">
            <span className="text-2xl">💧</span>
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">
              AuroWater Admin
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Verifying secure session…
            </p>
          </div>

          <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-400" />
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/auth/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* =========================================================
          MOBILE BACKDROP
         ========================================================= */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      />

      {/* =========================================================
          MOBILE SIDEBAR / DRAWER
         ========================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col border-r border-white/10 bg-[#06101f] shadow-2xl shadow-black/50 transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
        aria-label="Mobile admin navigation"
      >
        {/* Mobile drawer header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Link
            href="/admin/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 items-center gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl shadow-lg shadow-cyan-500/20">
              💧
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                AuroWater
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
                Admin Control
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close admin menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Mobile navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>

          <div className="space-y-1">
            {NAV.map((item) => {
              const active = isNavActive(
                pathname,
                item.href,
              );

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all ${
                    active
                      ? 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-sm shadow-cyan-500/5'
                      : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active
                        ? 'bg-cyan-400/10 text-cyan-300'
                        : 'text-slate-500 group-hover:text-slate-200'
                    }`}
                  >
                    <span className="h-5 w-5">
                      {item.icon}
                    </span>
                  </span>

                  <span className="truncate">
                    {item.label}
                  </span>

                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Mobile user area */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-200 ring-1 ring-cyan-400/20">
                {(user?.full_name || 'Admin')
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Signed in as
                </p>

                <p className="truncate text-sm font-semibold text-slate-100">
                  {user?.full_name || 'Admin'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-200"
            >
              <LogoutIcon />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================
          DESKTOP SIDEBAR
         ========================================================= */}
      <div className="flex min-h-screen">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
            collapsed ? 'w-20' : 'w-72'
          }`}
        >
          {/* Desktop sidebar header */}
          <div
            className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
              collapsed
                ? 'justify-center px-2'
                : 'justify-between px-4'
            }`}
          >
            <Link
              href="/admin/dashboard"
              className={`flex min-w-0 items-center gap-3 ${
                collapsed ? 'justify-center' : ''
              }`}
              title={
                collapsed
                  ? 'AuroWater Admin'
                  : undefined
              }
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl shadow-lg shadow-cyan-500/20">
                💧
              </span>

              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    AuroWater
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
                    Admin Control
                  </p>
                </div>
              )}
            </Link>

            {!collapsed && (
              <button
                type="button"
                onClick={() =>
                  setCollapsed((value) => !value)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <MenuIcon />
              </button>
            )}

            {collapsed && (
              <button
                type="button"
                onClick={() =>
                  setCollapsed((value) => !value)
                }
                className="absolute right-[-18px] top-5 z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-400 shadow-lg transition hover:bg-slate-800 hover:text-white xl:flex"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <MenuIcon />
              </button>
            )}
          </div>

          {/* Desktop navigation */}
          <nav
            className={`flex-1 overflow-y-auto ${
              collapsed ? 'p-2' : 'p-3'
            }`}
          >
            {!collapsed && (
              <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </p>
            )}

            <div className="space-y-1">
              {NAV.map((item) => {
                const active = isNavActive(
                  pathname,
                  item.href,
                );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={
                      collapsed
                        ? item.label
                        : undefined
                    }
                    className={`group relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-all ${
                      collapsed
                        ? 'justify-center px-2'
                        : 'gap-3 px-3'
                    } ${
                      active
                        ? 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-sm shadow-cyan-500/5'
                        : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
                    )}

                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-cyan-400/10 text-cyan-300'
                          : 'text-slate-500 group-hover:text-slate-200'
                      }`}
                    >
                      <span className="h-5 w-5">
                        {item.icon}
                      </span>
                    </span>

                    {!collapsed && (
                      <>
                        <span className="truncate">
                          {item.label}
                        </span>

                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Desktop user area */}
          <div className="shrink-0 border-t border-white/10 p-3">
            <div
              className={`rounded-2xl border border-white/10 bg-white/[0.035] ${
                collapsed ? 'p-2' : 'p-3'
              }`}
            >
              <div
                className={`flex items-center ${
                  collapsed
                    ? 'justify-center'
                    : 'gap-3'
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-200 ring-1 ring-cyan-400/20"
                  title={
                    collapsed
                      ? user?.full_name || 'Admin'
                      : undefined
                  }
                >
                  {(user?.full_name || 'Admin')
                    .charAt(0)
                    .toUpperCase()}
                </div>

                {!collapsed && (
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Signed in as
                    </p>

                    <p className="truncate text-sm font-semibold text-slate-100">
                      {user?.full_name || 'Admin'}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title={
                  collapsed
                    ? 'Logout'
                    : undefined
                }
                className={`mt-3 flex rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-slate-300 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-200 ${
                  collapsed
                    ? 'h-10 w-full items-center justify-center'
                    : 'w-full items-center justify-center gap-2 px-3 py-2.5'
                }`}
              >
                <LogoutIcon />
                {!collapsed && 'Logout'}
              </button>
            </div>
          </div>
        </aside>

        {/* =======================================================
            MAIN APPLICATION AREA
           ======================================================= */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-3 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              {/* Mobile menu */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Open admin menu"
                aria-expanded={mobileOpen}
              >
                <MenuIcon />
              </button>

              {/* Mobile brand */}
              <div className="flex shrink-0 items-center lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg shadow-lg shadow-cyan-500/20">
                  💧
                </span>
              </div>

              {/* Breadcrumb */}
              <div className="min-w-0 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="hidden text-slate-500 sm:inline">
                    Admin Control Center
                  </span>

                  <span className="hidden text-slate-700 sm:inline">
                    /
                  </span>

                  <span className="truncate font-medium text-slate-200">
                    {currentPage}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Status */}
              <div className="hidden items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/5 px-3 py-1.5 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-[11px] font-medium text-emerald-300">
                  System Online
                </span>
              </div>

              <Link
                href="/"
                className="hidden text-sm font-medium text-slate-300 transition hover:text-white sm:block"
                title="Back to AuroWater website"
              >
                View site →
              </Link>
            </div>
          </header>

          {/* Page content */}
          <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-3 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
