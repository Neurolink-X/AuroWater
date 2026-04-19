'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, getUser, logout, verifyToken } from '@/lib/api-client';
import type { User } from '@/types';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/finance', label: 'Finance' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const isAuthRoute = useMemo(() => pathname === '/admin/login' || pathname === '/admin/register', [pathname]);

  useEffect(() => {
    const run = async () => {
      if (isAuthRoute) {
        setChecking(false);
        return;
      }

      const token = getToken();
      const localUser = getUser();

      if (!token || !localUser) {
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname || '/admin/dashboard')}`);
        return;
      }

      // Verify token against server to ensure role + is_active are current.
      try {
        const verified = await verifyToken();
        if (!verified?.user || verified.user.role !== 'ADMIN') {
          logout();
          router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname || '/admin/dashboard')}`);
          return;
        }
        setUser(verified.user);
      } catch {
        logout();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname || '/admin/dashboard')}`);
        return;
      } finally {
        setChecking(false);
      }
    };

    run();
  }, [isAuthRoute, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-section">
        <p className="text-slate-500">Loading admin…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`sticky top-0 h-screen border-r border-white/10 bg-slate-950/60 backdrop-blur-xl ${
            collapsed ? 'w-20' : 'w-72'
          } transition-all duration-200`}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            <Link href="/admin/dashboard" className="flex items-center gap-2 font-bold">
              <span className="text-xl">💧</span>
              {!collapsed && <span>AuroWater Admin</span>}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="p-2 rounded-lg hover:bg-white/5"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <nav className="p-3">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto p-3 border-t border-white/10">
            <div className="px-3 py-2 rounded-xl bg-white/5">
              {!collapsed && (
                <>
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold text-slate-100 truncate">{user?.full_name || 'Admin'}</p>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace('/auth/login');
                }}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium"
              >
                {!collapsed ? 'Logout' : '⎋'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <header className="h-16 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl flex items-center justify-between px-4 sm:px-6">
            <div className="text-sm text-slate-300">
              <span className="text-slate-500">Admin Control Center</span>
              <span className="mx-2 text-slate-700">/</span>
              <span className="text-slate-200">{(NAV.find((n) => n.href === pathname)?.label) || 'Workspace'}</span>
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-300 hover:text-white"
              title="Back to site"
            >
              View site →
            </Link>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

