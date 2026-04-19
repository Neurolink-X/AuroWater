'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';

/* ─────────────────────────────────────────────
   ICONS
───────────────────────────────────────────── */
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="4" y1="7"  x2="20" y2="7"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <line x1="4" y1="17" x2="20" y2="17"/>
  </svg>
);
const IconX = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="6" y1="6" x2="18" y2="18"/>
    <line x1="18" y1="6" x2="6" y2="18"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transition: 'transform 0.22s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} aria-hidden="true">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconDashboard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);
const IconArrow = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const NAV_ITEMS = [
  { href: '/',           key: 'nav_home' },
  { href: '/services',   key: 'nav_services' },
  { href: '/how-it-works', key: 'nav_how_it_works' },
  { href: '/pricing',    key: 'nav_pricing' },
  { href: '/technicians', key: 'nav_technicians' },
  { href: '/about',      key: 'nav_about' },
  { href: '/contact',    key: 'nav_contact' },
  { href: '/dashboard',  key: 'nav_dashboard' },
];

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function SiteNav({ offsetPx = 0 }: { offsetPx?: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { hydrated, isLoggedIn, role, fullName, logout } = useAuth();

  const [mobileOpen, setMobileOpen]   = useState(false);
  const [avatarOpen, setAvatarOpen]   = useState(false);
  const [scrolled,   setScrolled]     = useState(false);
  /** After dismiss event, force sticky top to 0 before parent re-render propagates */
  const [announcementTopPx, setAnnouncementTopPx] = useState<number | null>(null);

  const avatarRef = useRef<HTMLDivElement>(null);

  /* close avatar dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* scroll shadow */
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  /* close mobile on route change */
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (
        localStorage.getItem('aw_announcement_dismissed') === '1' ||
        localStorage.getItem('aurowater_bar_dismissed') === '1'
      ) {
        setAnnouncementTopPx(0);
      }
    } catch {
      /* ignore */
    }
    const onDismiss = () => setAnnouncementTopPx(0);
    window.addEventListener('aw:announcement:dismissed', onDismiss);
    return () => window.removeEventListener('aw:announcement:dismissed', onDismiss);
  }, []);

  useEffect(() => {
    if (offsetPx === 0) {
      setAnnouncementTopPx(null);
    }
  }, [offsetPx]);

  const navTopOffset =
    announcementTopPx !== null ? announcementTopPx : offsetPx;

  /* derived */
  const initials =
    fullName && fullName.trim().length > 0
      ? fullName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((p) => p[0])
          .join('')
          .toUpperCase()
      : 'A';

  const roleLabel =
    role === 'technician' ? 'Technician'
    : role === 'supplier'   ? 'Supplier'
    : role === 'admin'      ? 'Admin'
    : 'Customer';

  const roleBadgeColor =
    role === 'admin'      ? { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' }
    : role === 'technician' ? { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }
    : role === 'supplier'   ? { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' }
    : { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' };

  const dashboardHref =
    role === 'technician' ? '/technician/dashboard'
    : role === 'supplier'   ? '/supplier/dashboard'
    : role === 'admin'      ? '/admin'
    : '/dashboard';

  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* ── Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        .nav-root {
          font-family: 'DM Sans', sans-serif;
          position: sticky;
          top: 0;
          z-index: 50;
          width: 100%;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.25s, background 0.25s;
        }
        .nav-root.nav-scrolled {
          background: rgba(255,255,255,0.96);
          box-shadow: 0 2px 20px rgba(37,99,235,0.07), 0 1px 4px rgba(0,0,0,0.05);
        }

        /* ── Inner bar ── */
        .nav-bar {
          max-width: 1200px; margin: 0 auto;
          display: flex; align-items: center;
          padding: 0 24px; height: 66px; gap: 6px;
        }

        /* ── Logo ── */
        .nav-logo {
          display: flex; align-items: center; gap: 9px;
          text-decoration: none; flex-shrink: 0; margin-right: 10px;
          transition: opacity 0.15s;
        }
        .nav-logo:hover { opacity: 0.85; }
        .nav-logo-wordmark {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 1.2rem; color: #0A1628;
          letter-spacing: -0.5px; line-height: 1;
        }
        .nav-logo-wordmark span { color: #2563EB; }

        /* ── Desktop nav links ── */
        .nav-links {
          display: flex; align-items: center; gap: 2px;
          flex: 1 1 auto;
          min-width: 0;
          overflow-x: auto;
          overflow-y: visible;
        }
        .nav-links::-webkit-scrollbar { display: none; }

        .nav-link {
          position: relative;
          display: inline-flex; align-items: center;
          flex-shrink: 0;
          padding: 7px 10px; border-radius: 9px;
          font-size: 13px; font-weight: 600;
          color: #4B5563; text-decoration: none;
          transition: color 0.15s, background 0.15s;
          white-space: nowrap;
          overflow: visible;
        }
        .nav-link:hover { color: #2563EB; background: #EFF6FF; }
        .nav-link.active { color: #2563EB; background: #EFF6FF; }

        /* Animated underline dot for active */
        .nav-link.active::after {
          content: '';
          position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%;
          background: #2563EB;
        }

        /* ── Right side ── */
        .nav-right {
          display: flex; align-items: center; gap: 8px;
          flex-shrink: 0; margin-left: 8px;
        }

        /* Book Now pill */
        .nav-book-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 18px; border-radius: 11px;
          background: #2563EB; color: #fff;
          font-family: 'DM Sans', sans-serif; font-weight: 700;
          font-size: 13px; text-decoration: none; border: none;
          cursor: pointer; white-space: nowrap;
          box-shadow: 0 3px 12px rgba(37,99,235,0.3);
          transition: all 0.18s; letter-spacing: -0.1px;
        }
        .nav-book-btn:hover {
          background: #1D4ED8;
          box-shadow: 0 6px 18px rgba(37,99,235,0.38);
          transform: translateY(-1px);
        }
        .nav-book-btn:active { transform: scale(0.97); }

        /* Auth pill buttons */
        .nav-auth-outline {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 14px; border-radius: 10px;
          border: 1.5px solid #E5E7EB; background: transparent;
          color: #374151; font-family: 'DM Sans', sans-serif;
          font-weight: 600; font-size: 13px; text-decoration: none;
          transition: all 0.15s; white-space: nowrap;
        }
        .nav-auth-outline:hover { border-color: #93C5FD; color: #2563EB; background: #EFF6FF; }

        /* Avatar button */
        .nav-avatar-btn {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #2563EB, #0EA5E9);
          color: #fff; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 900; font-size: 12px;
          transition: all 0.18s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.3);
          letter-spacing: 0;
        }
        .nav-avatar-btn:hover { transform: scale(1.06); box-shadow: 0 4px 14px rgba(37,99,235,0.4); }

        /* Dropdown */
        .nav-dropdown {
          position: absolute; top: calc(100% + 10px); right: 0;
          width: 228px; border-radius: 18px;
          background: #fff;
          border: 1px solid #E8EEFF;
          box-shadow: 0 4px 6px rgba(0,0,0,0.04), 0 16px 48px rgba(37,99,235,0.12);
          z-index: 100;
          animation: dropIn 0.2s cubic-bezier(0.4,0,0.2,1) both;
          overflow: hidden;
        }
        @keyframes dropIn {
          from { opacity:0; transform:translateY(-8px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)   scale(1); }
        }

        .nav-dropdown-header {
          padding: 14px 16px 12px;
          border-bottom: 1px solid #F0F4FF;
          display: flex; align-items: center; gap: 10px;
        }
        .nav-dropdown-avatar {
          width: 34px; height: 34px; border-radius: 9px;
          background: linear-gradient(135deg, #2563EB, #0EA5E9);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 900; font-size: 11px;
          flex-shrink: 0;
        }
        .nav-dropdown-name {
          font-size: 13px; font-weight: 700; color: #0A1628;
          letter-spacing: -0.2px; line-height: 1.2;
        }

        .nav-dropdown-body { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
        .nav-dropdown-item {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 10px; border-radius: 10px;
          font-size: 13px; font-weight: 600; color: #374151;
          text-decoration: none; cursor: pointer; border: none;
          background: transparent; width: 100%; text-align: left;
          transition: background 0.12s, color 0.12s;
        }
        .nav-dropdown-item:hover { background: #F5F8FF; color: #2563EB; }
        .nav-dropdown-item svg { color: #9CA3AF; flex-shrink: 0; }
        .nav-dropdown-item:hover svg { color: #2563EB; }

        .nav-dropdown-item.danger { color: #DC2626; }
        .nav-dropdown-item.danger:hover { background: #FEF2F2; }
        .nav-dropdown-item.danger svg { color: #FCA5A5; }
        .nav-dropdown-item.danger:hover svg { color: #DC2626; }

        .nav-dropdown-divider { height: 1px; background: #F0F4FF; margin: 4px 8px; }

        /* ── Mobile toggle ── */
        .nav-mobile-toggle {
          display: none;
          padding: 8px; border-radius: 10px; background: transparent;
          border: 1.5px solid #E5E7EB; color: #4B5563;
          cursor: pointer; transition: all 0.15s; margin-left: auto;
        }
        .nav-mobile-toggle:hover { background: #F5F8FF; border-color: #93C5FD; color: #2563EB; }

        /* ── Mobile drawer ── */
        .nav-mobile-drawer {
          border-top: 1px solid #EEF2FF;
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(12px);
          animation: drawerDown 0.22s ease both;
          max-height: 85vh; overflow-y: auto;
        }
        @keyframes drawerDown {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .nav-mobile-inner { padding: 14px 16px 20px; display: flex; flex-direction: column; gap: 4px; }

        .nav-mobile-link {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-radius: 12px;
          font-size: 14px; font-weight: 600; color: #374151;
          text-decoration: none; transition: all 0.14s;
        }
        .nav-mobile-link:hover { background: #F5F8FF; color: #2563EB; }
        .nav-mobile-link.active { background: #EFF6FF; color: #2563EB; }

        .nav-mobile-divider { height: 1px; background: #EEF2FF; margin: 8px 0; }

        .nav-mobile-book {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px; border-radius: 13px;
          background: #2563EB; color: #fff;
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 14px;
          text-decoration: none; margin-top: 4px;
          box-shadow: 0 4px 14px rgba(37,99,235,0.30);
          transition: all 0.18s;
        }
        .nav-mobile-book:active { transform: scale(0.97); }

        .nav-mobile-auth-row {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;
        }
        .nav-mobile-auth-btn {
          display: flex; align-items: center; justify-content: center;
          padding: 12px; border-radius: 12px;
          font-size: 13px; font-weight: 700; text-decoration: none;
          transition: all 0.14s;
        }
        .nav-mobile-auth-btn.outline {
          border: 1.5px solid #E5E7EB; color: #374151;
        }
        .nav-mobile-auth-btn.outline:hover { border-color: #93C5FD; color: #2563EB; background: #EFF6FF; }
        .nav-mobile-auth-btn.fill {
          background: #2563EB; color: #fff;
          box-shadow: 0 3px 10px rgba(37,99,235,0.25);
        }

        .nav-mobile-user-card {
          display: flex; align-items: center; gap: 11px;
          background: #F5F8FF; border: 1px solid #DBEAFE;
          border-radius: 13px; padding: 12px 14px; margin-top: 4px;
        }
        .nav-mobile-user-avatar {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #2563EB, #0EA5E9);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 900; font-size: 13px;
          flex-shrink: 0;
        }
        .nav-mobile-user-name { font-size: 13px; font-weight: 700; color: #0A1628; }
        .nav-mobile-signout {
          display: flex; align-items: center; gap: 9px;
          padding: 12px 14px; border-radius: 12px;
          font-size: 13px; font-weight: 700; color: #DC2626;
          background: transparent; border: none; cursor: pointer;
          width: 100%; text-align: left; transition: background 0.13s;
          font-family: 'DM Sans', sans-serif;
        }
        .nav-mobile-signout:hover { background: #FEF2F2; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .nav-links { display: none; }
          .nav-right  { display: none; }
          .nav-mobile-toggle { display: flex; }
          .nav-bar { height: 60px; }
        }
        @media (max-width: 400px) {
          .nav-bar { padding: 0 16px; }
          .nav-logo-wordmark { font-size: 1.05rem; }
        }
      `}</style>

      <header
        className={`nav-root${scrolled ? ' nav-scrolled' : ''}`}
        style={{ top: navTopOffset }}
        role="banner"
      >
        {/* ── Desktop navbar ── */}
        <div className="nav-bar">

          {/* Logo */}
          <Link href="/" className="nav-logo" aria-label="AuroWater home">
            <img
              src="/favicon.svg"
              alt=""
              width={32}
              height={32}
              className="shrink-0 rounded-[10px] shadow-sm"
              decoding="async"
            />
            <span className="nav-logo-wordmark">
              Auro<span>Water</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="nav-links" aria-label="Main navigation">
            {NAV_ITEMS.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link${isActive(href) ? ' active' : ''}`}
                aria-current={isActive(href) ? 'page' : undefined}
              >
                {t(key)}
              </Link>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="nav-right">
            {/* Language toggle */}
            <LanguageToggle />

            {/* Book Now */}
            <Link href="/book" className="nav-book-btn">
              Book Now
              <IconArrow />
            </Link>

            {/* Auth */}
            {!hydrated ? null : isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={avatarRef}>
                <button
                  type="button"
                  className="nav-avatar-btn"
                  onClick={() => setAvatarOpen((v) => !v)}
                  aria-expanded={avatarOpen}
                  aria-haspopup="true"
                  aria-label="Open account menu"
                >
                  {initials}
                </button>

                {avatarOpen && (
                  <div className="nav-dropdown" role="menu">
                    {/* Header */}
                    <div className="nav-dropdown-header">
                      <div className="nav-dropdown-avatar">{initials}</div>
                      <div>
                        <div className="nav-dropdown-name">
                          {fullName?.trim() ? fullName : 'My Account'}
                        </div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center',
                          marginTop: 3, padding: '2px 7px', borderRadius: 5,
                          fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          background: roleBadgeColor.bg,
                          color: roleBadgeColor.text,
                          border: `1px solid ${roleBadgeColor.border}`,
                        }}>
                          {roleLabel}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="nav-dropdown-body">
                      <Link
                        href={dashboardHref}
                        className="nav-dropdown-item"
                        onClick={() => setAvatarOpen(false)}
                        role="menuitem"
                      >
                        <IconDashboard /> My Dashboard
                      </Link>
                      <Link
                        href="/dashboard?tab=profile"
                        className="nav-dropdown-item"
                        onClick={() => setAvatarOpen(false)}
                        role="menuitem"
                      >
                        <IconUser /> My Profile
                      </Link>

                      <div className="nav-dropdown-divider" />

                      <button
                        type="button"
                        className="nav-dropdown-item danger"
                        onClick={() => { setAvatarOpen(false); logout(); }}
                        role="menuitem"
                      >
                        <IconLogout /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="nav-auth-outline">
                  Sign In
                </Link>
                <Link href="/auth/register" className="nav-book-btn" style={{ background: '#0A1628', boxShadow: '0 3px 12px rgba(10,22,40,0.2)' }}>
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <IconX /> : <IconMenu />}
          </button>
        </div>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="nav-mobile-drawer" id="mobile-menu" role="navigation" aria-label="Mobile navigation">
            <div className="nav-mobile-inner">

              {/* Nav links */}
              {NAV_ITEMS.map(({ href, key }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-mobile-link${isActive(href) ? ' active' : ''}`}
                  aria-current={isActive(href) ? 'page' : undefined}
                >
                  <span>{t(key)}</span>
                  {isActive(href) && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                  )}
                </Link>
              ))}

              <div className="nav-mobile-divider" />

              {/* Book Now */}
              <Link href="/book" className="nav-mobile-book">
                Book a Service Now
                <IconArrow />
              </Link>

              {/* Auth */}
              {!hydrated ? null : isLoggedIn ? (
                <>
                  <div className="nav-mobile-user-card">
                    <div className="nav-mobile-user-avatar">{initials}</div>
                    <div>
                      <div className="nav-mobile-user-name">
                        {fullName?.trim() ? fullName : 'My Account'}
                      </div>
                      <div style={{
                        display: 'inline-flex', marginTop: 3, padding: '2px 7px', borderRadius: 5,
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                        background: roleBadgeColor.bg, color: roleBadgeColor.text,
                        border: `1px solid ${roleBadgeColor.border}`,
                      }}>
                        {roleLabel}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={dashboardHref}
                    className="nav-mobile-link"
                    style={{ color: '#2563EB' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <IconDashboard /> My Dashboard
                    </span>
                  </Link>
                  <Link
                    href="/dashboard?tab=profile"
                    className="nav-mobile-link"
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <IconUser /> My Profile
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="nav-mobile-signout"
                    onClick={() => { setMobileOpen(false); logout(); }}
                  >
                    <IconLogout /> Sign Out
                  </button>
                </>
              ) : (
                <div className="nav-mobile-auth-row">
                  <Link href="/auth/login"    className="nav-mobile-auth-btn outline">Sign In</Link>
                  <Link href="/auth/register" className="nav-mobile-auth-btn fill">Register</Link>
                </div>
              )}

              {/* Language toggle */}
              <div style={{ paddingTop: 8, borderTop: '1px solid #EEF2FF', marginTop: 4 }}>
                <LanguageToggle />
              </div>

            </div>
          </div>
        )}
      </header>
    </>
  );
}