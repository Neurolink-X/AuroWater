// src/app/admin/AdminShell.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, getUser, logout, verifyToken } from '@/lib/api-client';
import type { User } from '@/types';

/* =============================================================
   NAVIGATION (same pages as before)
   ============================================================= */
const NAV = [
  {
    href: '/admin/verification',
    label: 'Verification Center',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M8 3h8l4 4v14H4V3h4Z" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 12h8M8 16h5M14 3v5h6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m8 9 1.5 1.5L12 8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
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
        <path d="M7 15h4" strokeWidth="1.8" strokeLinecap="round" />
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
    href: '/admin/dispatch',
    label: 'Dispatch',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 5h16v14H4z" strokeWidth="1.8" strokeLinejoin="round" />
        <path
          d="M8 9h8M8 12h5M8 15h8"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/coverage-requests',
    label: 'Coverage',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M12 22s8-4.5 8-12V5l-8-3-8 3v5c0 7.5 8 12 8 12Z"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m8.5 12 2.2 2.2 4.8-5"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/pricing',
    label: 'Pricing & Fees',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
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

type NavItemType = (typeof NAV)[number];

type PaletteItem = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  href?: string;
  run: () => void;
};

/* =============================================================
   SETTINGS
   ============================================================= */
const SIDEBAR_KEY = 'aurowater-admin-sidebar-collapsed';

// Re-check the session quietly in the background (not on every click).
const RECHECK_MS = 3 * 60 * 1000;

/* =============================================================
   HELPERS
   ============================================================= */
function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Picks ONE active menu item: the longest matching link.
 * Example: on /admin/dashboard/users only "Approvals" lights up,
 * not "Dashboard" as well.
 */
function getActiveHref(pathname: string) {
  let best = '';

  for (const item of NAV) {
    if (isNavActive(pathname, item.href) && item.href.length > best.length) {
      best = item.href;
    }
  }

  return best;
}

/* =============================================================
   ICONS
   ============================================================= */
function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round" />
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
      <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />
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

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M12 3v8" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6.3 6.8a8 8 0 1 0 11.4 0"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* =============================================================
   WATER ANIMATIONS (CSS only, prefixed "ash-" so they never
   clash with the loading.tsx animations)
   ============================================================= */
const SHELL_CSS = `
  @keyframes ash-wave   { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
  @keyframes ash-rise   { 0% { transform: translate3d(0,78%,0); } 100% { transform: translate3d(0,22%,0); } }
  @keyframes ash-ripple { 0% { transform: scale(.8); opacity: .6; } 100% { transform: scale(1.7); opacity: 0; } }
  @keyframes ash-bubble { 0% { transform: translate3d(0,0,0) scale(.6); opacity: 0; } 20% { opacity: .8; } 100% { transform: translate3d(0,-90px,0) scale(1); opacity: 0; } }
  @keyframes ash-float  { 0%,100% { transform: translate3d(0,-2px,0); } 50% { transform: translate3d(0,3px,0); } }
  @keyframes ash-step   { 0%,100% { opacity: .3; } 15%,50% { opacity: 1; } }
  @keyframes ash-flow   { 0% { transform: translate3d(-100%,0,0); } 100% { transform: translate3d(250%,0,0); } }
  @keyframes ash-pop    { from { opacity: 0; transform: translate3d(0,-8px,0) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes ash-glow   { 0%,100% { opacity: .5; } 50% { opacity: 1; } }

  .ash-wave        { animation: ash-wave 5s linear infinite; will-change: transform; }
  .ash-wave-rev    { animation: ash-wave 7s linear infinite reverse; will-change: transform; }
  .ash-liquid      { animation: ash-rise 3.2s ease-in-out infinite alternate; will-change: transform; }
  .ash-ripple      { animation: ash-ripple 2.6s ease-out infinite; }
  .ash-bubble      { animation: ash-bubble 3s ease-in infinite; }
  .ash-float       { animation: ash-float 2s ease-in-out infinite; }
  .ash-step        { animation: ash-step 3s ease-in-out infinite; }
  .ash-flow        { animation: ash-flow 1.2s linear infinite; will-change: transform; }
  .ash-pop         { animation: ash-pop .16s ease-out both; }
  .ash-glow        { animation: ash-glow 4s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .ash-wave, .ash-wave-rev, .ash-liquid, .ash-ripple, .ash-bubble,
    .ash-float, .ash-step, .ash-flow, .ash-pop, .ash-glow { animation: none !important; }
    .ash-liquid { transform: translate3d(0,45%,0); }
  }
`;

const WAVE_PATH =
  'M0 20 Q150 0 300 20 T600 20 T900 20 T1200 20 V40 H0 Z';

/* =============================================================
   SESSION LOADER: a glass orb that fills with water
   ============================================================= */
function SessionLoader() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950"
      role="status"
      aria-live="polite"
      aria-label="Verifying secure admin session"
    >
      <style>{SHELL_CSS}</style>

      {/* Ambient glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="ash-glow absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div
          className="ash-glow absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl"
          style={{ animationDelay: '1.5s' }}
        />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        {/* Orb */}
        <div className="relative h-32 w-32" aria-hidden="true">
          <span className="ash-ripple absolute inset-0 rounded-full border border-cyan-400/40" />
          <span
            className="ash-ripple absolute inset-0 rounded-full border border-cyan-400/30"
            style={{ animationDelay: '0.9s' }}
          />
          <span
            className="ash-ripple absolute inset-0 rounded-full border border-blue-400/30"
            style={{ animationDelay: '1.8s' }}
          />

          <div className="absolute inset-0 overflow-hidden rounded-full border border-cyan-300/30 bg-slate-900/80 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
            {/* Water that keeps filling and draining */}
            <div className="ash-liquid absolute inset-0 opacity-80">
              <svg
                viewBox="0 0 1200 40"
                preserveAspectRatio="none"
                className="ash-wave-rev absolute left-0 -top-[18px] h-[19px] w-[200%] text-blue-500"
              >
                <path d={WAVE_PATH} fill="currentColor" />
              </svg>
              <svg
                viewBox="0 0 1200 40"
                preserveAspectRatio="none"
                className="ash-wave absolute left-0 -top-[12px] h-[13px] w-[200%] text-cyan-400"
              >
                <path d={WAVE_PATH} fill="currentColor" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-400 to-blue-600" />
            </div>

            {/* Bubbles inside the orb */}
            {[
              { left: '28%', delay: '0s' },
              { left: '48%', delay: '0.9s' },
              { left: '66%', delay: '1.7s' },
              { left: '38%', delay: '2.3s' },
            ].map((bubble, index) => (
              <span
                key={index}
                className="ash-bubble absolute bottom-3 h-2 w-2 rounded-full border border-white/50 bg-white/20"
                style={{ left: bubble.left, animationDelay: bubble.delay }}
              />
            ))}

            {/* Droplet */}
            <span className="ash-float absolute inset-0 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="h-12 w-12 drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
              >
                <path
                  d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5Z"
                  fill="rgba(255,255,255,0.92)"
                />
                <path
                  d="M9 14.5a3 3 0 0 0 2.2 2.9"
                  stroke="rgba(37,99,235,0.7)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>

            {/* Glass shine */}
            <span className="absolute left-4 top-3 h-8 w-3 rotate-[20deg] rounded-full bg-white/20 blur-[1px]" />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-100">
            AuroWater Admin
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Verifying secure session…
          </p>
        </div>

        {/* Steps light up one after another */}
        <ul className="space-y-1.5 text-left text-xs text-slate-400" aria-hidden="true">
          {[
            'Securing your session',
            'Checking admin access',
            'Preparing control center',
          ].map((label, index) => (
            <li
              key={label}
              className="ash-step flex items-center gap-2"
              style={{ animationDelay: `${index}s` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              {label}
            </li>
          ))}
        </ul>

        {/* Flowing water line */}
        <div
          className="h-1 w-40 overflow-hidden rounded-full bg-white/10"
          aria-hidden="true"
        >
          <div className="ash-flow h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        </div>
      </div>

      <span className="sr-only">
        Verifying your secure admin session, please wait.
      </span>
    </div>
  );
}

/* =============================================================
   NAV LINK (one component used by desktop and mobile)
   ============================================================= */
function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItemType;
  active: boolean;
  collapsed: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        // Ctrl/Cmd/Shift click opens a new tab, so no loading bar then.
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }

        onNavigate(item.href);
      }}
      className={`group relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-all ${
        collapsed ? 'justify-center px-2' : 'gap-3 px-3'
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
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active
            ? 'bg-cyan-400/10 text-cyan-300'
            : 'text-slate-500 group-hover:text-slate-200'
        }`}
      >
        <span className="block h-5 w-5 [&>svg]:h-full [&>svg]:w-full">
          {item.icon}
        </span>
      </span>

      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>

          {active && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
          )}
        </>
      )}
    </Link>
  );
}

/* =============================================================
   MAIN SHELL
   ============================================================= */
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // Desktop sidebar (remembered between visits).
  const [collapsed, setCollapsed] = useState(false);

  // Mobile drawer.
  const [mobileOpen, setMobileOpen] = useState(false);

  // Top water line while a page is opening.
  const [navigating, setNavigating] = useState(false);

  // Internet status.
  const [online, setOnline] = useState(true);

  // Quick search (Ctrl/Cmd + K).
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const verifiedRef = useRef(false);
  const lastVerifiedRef = useRef(0);
  const inflightRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isAuthRoute = useMemo(
    () => pathname === '/admin/login' || pathname === '/admin/register',
    [pathname],
  );

  const activeHref = useMemo(() => getActiveHref(pathname), [pathname]);

  const currentPage = useMemo(() => {
    const match = NAV.find((item) => item.href === activeHref);
    return match?.label || 'Workspace';
  }, [activeHref]);

  /* ---------------------------------------------------------
     Keep the latest path available inside async code.
     --------------------------------------------------------- */
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  /* ---------------------------------------------------------
     SESSION CHECK
     The server stays the source of truth for role + status.
     silent = true is the quiet background re-check.
     --------------------------------------------------------- */
  const verifySession = useCallback(
    async (silent: boolean, isActive: () => boolean = () => true) => {
      const loginHref = () =>
        `/admin/login?returnTo=${encodeURIComponent(
          pathnameRef.current || '/admin/dashboard',
        )}`;

      let redirected = false;

      try {
        if (!silent) {
          const token = await getToken();
          const localUser = getUser();

          if (!isActive()) return;

          if (!token || !localUser) {
            redirected = true;
            router.replace(loginHref());
            return;
          }
        }

        let verified = await verifyToken();
        if (!isActive()) return;

        // Background check: one quick retry so a tiny network blip
        // does not throw an admin out.
        if (silent && !verified?.user) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (!isActive()) return;
          verified = await verifyToken();
          if (!isActive()) return;
        }

        if (
          !verified?.user ||
          String(verified.user.role).toUpperCase() !== 'ADMIN'
        ) {
          redirected = true;
          verifiedRef.current = false;
          logout();
          router.replace(loginHref());
          return;
        }

        verifiedRef.current = true;
        lastVerifiedRef.current = Date.now();
        setUser(verified.user);
      } catch {
        if (!isActive()) return;

        // Background check + network error: stay signed in.
        if (silent) return;

        redirected = true;
        verifiedRef.current = false;
        logout();
        router.replace(loginHref());
      } finally {
        // If we are redirecting, keep the water loader on screen
        // (no flash of the admin shell).
        if (!silent && isActive() && !redirected) {
          setChecking(false);
        }
      }
    },
    [router],
  );

  /*
   * First check happens ONCE, not on every page click.
   * This is the biggest speed gain: moving between admin pages
   * is now instant instead of waiting for the server each time.
   */
  useEffect(() => {
    if (isAuthRoute) {
      verifiedRef.current = false;
      setChecking(false);
      return;
    }

    if (verifiedRef.current) {
      setChecking(false);
      return;
    }

    let active = true;
    setChecking(true);

    void verifySession(false, () => active);

    return () => {
      active = false;
    };
  }, [isAuthRoute, verifySession]);

  /*
   * Quiet re-check: every minute (at most once per 3 minutes),
   * and when the admin comes back to the tab.
   * Example: an admin is removed in the morning, their open tab
   * is signed out within minutes.
   */
  const hasUser = Boolean(user);

  useEffect(() => {
    if (isAuthRoute || !hasUser) return;

    const check = () => {
      if (document.visibilityState === 'hidden') return;
      if (inflightRef.current) return;
      if (Date.now() - lastVerifiedRef.current < RECHECK_MS) return;

      inflightRef.current = true;
      void verifySession(true).finally(() => {
        inflightRef.current = false;
      });
    };

    const interval = window.setInterval(check, 60 * 1000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [isAuthRoute, hasUser, verifySession]);

  /* ---------------------------------------------------------
     When the page changes: close menus, stop loading line.
     --------------------------------------------------------- */
  useEffect(() => {
    setMobileOpen(false);
    setPaletteOpen(false);
    setNavigating(false);
  }, [pathname]);

  // Safety: never leave the loading line stuck.
  useEffect(() => {
    if (!navigating) return;

    const timer = window.setTimeout(() => setNavigating(false), 8000);
    return () => window.clearTimeout(timer);
  }, [navigating]);

  /* ---------------------------------------------------------
     Remember sidebar size.
     --------------------------------------------------------- */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_KEY) === '1') {
        setCollapsed(true);
      }
    } catch {
      /* storage blocked: ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;

      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* storage blocked: ignore */
      }

      return next;
    });
  }, []);

  /* ---------------------------------------------------------
     Internet status.
     --------------------------------------------------------- */
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  /* ---------------------------------------------------------
     Lock page scroll while a drawer / search is open.
     --------------------------------------------------------- */
  useEffect(() => {
    if (!mobileOpen && !paletteOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, paletteOpen]);

  /* ---------------------------------------------------------
     Escape closes the mobile drawer.
     --------------------------------------------------------- */
  useEffect(() => {
    if (!mobileOpen) return;

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

  /* ---------------------------------------------------------
     Ctrl/Cmd + K opens quick search.
     --------------------------------------------------------- */
  useEffect(() => {
    if (isAuthRoute || checking) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(false);
        setPaletteOpen((open) => !open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuthRoute, checking]);

  useEffect(() => {
    if (!paletteOpen) return;

    setQuery('');
    setActiveIdx(0);

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [paletteOpen]);

  /* ---------------------------------------------------------
     Actions
     --------------------------------------------------------- */
  const handleNavigate = useCallback(
    (href: string) => {
      setMobileOpen(false);

      if (href !== pathname) {
        setNavigating(true);
      }
    },
    [pathname],
  );

  const handleLogout = useCallback(() => {
    verifiedRef.current = false;
    setUser(null);
    logout();
    router.replace('/auth/login');
  }, [router]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = NAV.map((item) => ({
      id: item.href,
      label: item.label,
      hint: item.href,
      icon: (
        <span className="block h-5 w-5 [&>svg]:h-full [&>svg]:w-full">
          {item.icon}
        </span>
      ),
      href: item.href,
      run: () => router.push(item.href),
    }));

    return [
      ...pages,
      {
        id: 'view-site',
        label: 'View AuroWater website',
        hint: '/',
        icon: (
          <span className="block h-5 w-5 [&>svg]:h-full [&>svg]:w-full">
            <GlobeIcon />
          </span>
        ),
        href: '/',
        run: () => router.push('/'),
      },
      {
        id: 'logout',
        label: 'Logout',
        hint: 'End this session',
        icon: (
          <span className="block h-5 w-5 [&>svg]:h-full [&>svg]:w-full">
            <PowerIcon />
          </span>
        ),
        run: handleLogout,
      },
    ];
  }, [router, handleLogout]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return paletteItems;

    return paletteItems.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.hint.toLowerCase().includes(term),
    );
  }, [paletteItems, query]);

  const runPaletteItem = useCallback(
    (item: PaletteItem) => {
      setPaletteOpen(false);

      if (item.href && item.href !== pathname) {
        setNavigating(true);
      }

      item.run();
    },
    [pathname],
  );

  /* =========================================================
     RENDER
     (all hooks are above this line)
     ========================================================= */
  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (checking) {
    return <SessionLoader />;
  }

  const displayName = user?.full_name || 'Admin';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <style>{SHELL_CSS}</style>

      {/* Skip link for keyboard users */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-cyan-500 focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
      >
        Skip to content
      </a>

      {/* Water line shown while a page is opening */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px] overflow-hidden transition-opacity duration-200 ${
          navigating ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="ash-flow h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
      </div>

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
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile admin navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Link
            href="/admin/dashboard"
            onClick={() => handleNavigate('/admin/dashboard')}
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

        <nav className="flex-1 overflow-y-auto p-3">
          <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>

          <div className="space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={item.href === activeHref}
                collapsed={false}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-white/10 p-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-200 ring-1 ring-cyan-400/20">
                {initial}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Signed in as
                </p>

                <p className="truncate text-sm font-semibold text-slate-100">
                  {displayName}
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
          DESKTOP SIDEBAR + MAIN AREA
         ========================================================= */}
      <div className="flex min-h-screen">
        <aside
          aria-label="Admin navigation"
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
            collapsed ? 'w-20' : 'w-72'
          }`}
        >
          <div
            className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
              collapsed ? 'justify-center px-2' : 'justify-between px-4'
            }`}
          >
            <Link
              href="/admin/dashboard"
              onClick={() => handleNavigate('/admin/dashboard')}
              className={`flex min-w-0 items-center gap-3 ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'AuroWater Admin' : undefined}
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
                onClick={toggleCollapsed}
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
                onClick={toggleCollapsed}
                className="absolute right-[-18px] top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-400 shadow-lg transition hover:bg-slate-800 hover:text-white"
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <MenuIcon />
              </button>
            )}
          </div>

          <nav className={`flex-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-3'}`}>
            {!collapsed && (
              <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workspace
              </p>
            )}

            <div className="space-y-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                  collapsed={collapsed}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </nav>

          <div className="shrink-0 border-t border-white/10 p-3">
            <div
              className={`rounded-2xl border border-white/10 bg-white/[0.035] ${
                collapsed ? 'p-2' : 'p-3'
              }`}
            >
              <div
                className={`flex items-center ${
                  collapsed ? 'justify-center' : 'gap-3'
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-200 ring-1 ring-cyan-400/20"
                  title={collapsed ? displayName : undefined}
                >
                  {initial}
                </div>

                {!collapsed && (
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Signed in as
                    </p>

                    <p className="truncate text-sm font-semibold text-slate-100">
                      {displayName}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title={collapsed ? 'Logout' : undefined}
                aria-label="Logout"
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
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-3 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Open admin menu"
                aria-expanded={mobileOpen}
              >
                <MenuIcon />
              </button>

              <div className="flex shrink-0 items-center lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg shadow-lg shadow-cyan-500/20">
                  💧
                </span>
              </div>

              <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="hidden text-slate-500 sm:inline">
                    Admin Control Center
                  </span>

                  <span className="hidden text-slate-700 sm:inline">/</span>

                  <span className="truncate font-medium text-slate-200">
                    {currentPage}
                  </span>
                </div>
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Quick search */}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setPaletteOpen(true);
                }}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Open quick search"
                title="Quick search (Ctrl + K)"
              >
                <SearchIcon />
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 md:inline">
                  Ctrl K
                </kbd>
              </button>

              {/* Real connection status */}
              <div
                className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex ${
                  online
                    ? 'border-emerald-400/10 bg-emerald-400/5'
                    : 'border-amber-400/20 bg-amber-400/10'
                }`}
                role="status"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    online
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                  }`}
                />
                <span
                  className={`text-[11px] font-medium ${
                    online ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {online ? 'Connected' : 'Offline'}
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

          {!online && (
            <div
              role="alert"
              className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs font-medium text-amber-200"
            >
              You are offline. Changes may not save until the internet comes
              back.
            </div>
          )}

          {/* Page content */}
          <main
            id="admin-main"
            tabIndex={-1}
            className="relative min-h-[calc(100vh-4rem)] min-w-0 flex-1 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-3 outline-none sm:p-6 lg:p-8"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <div className="ash-glow absolute left-0 top-0 h-64 w-64 rounded-full bg-cyan-500/[0.06] blur-3xl" />
              <div
                className="ash-glow absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/[0.06] blur-3xl"
                style={{ animationDelay: '2s' }}
              />
            </div>

            <div className="relative">{children}</div>
          </main>
        </div>
      </div>

      {/* =========================================================
          QUICK SEARCH (Ctrl/Cmd + K)
         ========================================================= */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Quick search"
        >
          <div
            aria-hidden="true"
            onClick={() => setPaletteOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="ash-pop relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#06101f] shadow-2xl shadow-black/60">
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <span className="text-slate-500">
                <SearchIcon />
              </span>

              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIdx((index) =>
                      Math.min(index + 1, Math.max(filteredItems.length - 1, 0)),
                    );
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIdx((index) => Math.max(index - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    const item = filteredItems[activeIdx];
                    if (item) runPaletteItem(item);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setPaletteOpen(false);
                  }
                }}
                placeholder="Jump to a page or action…"
                className="h-14 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                aria-label="Search pages and actions"
              />

              <kbd className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                Esc
              </kbd>
            </div>

            <ul className="max-h-72 overflow-y-auto p-2" role="listbox">
              {filteredItems.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-500">
                  Nothing found for “{query}”
                </li>
              )}

              {filteredItems.map((item, index) => {
                const selected = index === activeIdx;

                return (
                  <li key={item.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(index)}
                      onClick={() => runPaletteItem(item)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        selected
                          ? 'bg-cyan-400/10 text-cyan-100'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          selected
                            ? 'bg-cyan-400/10 text-cyan-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {item.icon}
                      </span>

                      <span className="min-w-0 flex-1 truncate font-medium">
                        {item.label}
                      </span>

                      <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
                        {item.hint}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
              <span>↑ ↓ to move · Enter to open</span>
              <span>Ctrl K to toggle</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}







// 'use client';

// import React, { useEffect, useMemo, useState } from 'react';
// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';
// import { getToken, getUser, logout, verifyToken } from '@/lib/api-client';
// import type { User } from '@/types';

// const NAV = [
//   {
//     href: '/admin/dashboard',
//     label: 'Dashboard',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
//         <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8" />
//         <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
//         <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8" />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/dashboard/users',
//     label: 'Approvals',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path
//           d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//         />
//         <circle cx="9" cy="7" r="4" strokeWidth="1.8" />
//         <path
//           d="m17 11 2 2 4-4"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/dashboard/waitlist',
//     label: 'Waitlist',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
//         <path
//           d="M12 7v5l3 2"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/finance',
//     label: 'Finance',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <rect x="2.5" y="5" width="19" height="14" rx="2" strokeWidth="1.8" />
//         <path d="M2.5 10h19" strokeWidth="1.8" />
//         <path
//           d="M7 15h4"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//         />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/orders',
//     label: 'Orders',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path
//           d="M6 2.8h12v18.4H6z"
//           strokeWidth="1.8"
//           strokeLinejoin="round"
//         />
//         <path
//           d="M9 7h6M9 11h6M9 15h4"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//         />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/users',
//     label: 'Users',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path
//           d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//         />
//         <circle cx="9" cy="7" r="4" strokeWidth="1.8" />
//         <path
//           d="M19 8v6M22 11h-6"
//           strokeWidth="1.8"
//           strokeLinecap="round"
//         />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/dispatch',
//     label: 'Dispatch',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path d="M4 5h16v14H4z" strokeWidth="1.8" strokeLinejoin="round" />
//         <path d="M8 9h8M8 12h5M8 15h8" strokeWidth="1.8" strokeLinecap="round" />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/coverage-requests',
//     label: 'Coverage',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path d="M12 22s8-4.5 8-12V5l-8-3-8 3v5c0 7.5 8 12 8 12Z" strokeWidth="1.8" strokeLinejoin="round" />
//         <path d="m8.5 12 2.2 2.2 4.8-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/pricing',
//     label: 'Pricing & Fees',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="1.8" strokeLinecap="round" />
//       </svg>
//     ),
//   },
//   {
//     href: '/admin/settings',
//     label: 'Settings',
//     icon: (
//       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//         <path
//           d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
//           strokeWidth="1.8"
//         />
//         <path
//           d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.54v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.12 15a1.7 1.7 0 0 0-1.56-1.03H6V11.4h.1A1.7 1.7 0 0 0 7.66 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06A1.7 1.7 0 0 0 11 6.66 1.7 1.7 0 0 0 12.03 5.1V5h2.54v.1A1.7 1.7 0 0 0 15.6 6.66a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06A1.7 1.7 0 0 0 18.94 10a1.7 1.7 0 0 0 1.56 1.03h.1v2.54h-.1A1.7 1.7 0 0 0 19.4 15Z"
//           strokeWidth="1.5"
//           strokeLinejoin="round"
//         />
//       </svg>
//     ),
//   },
// ] as const;

// function isNavActive(pathname: string, href: string) {
//   return pathname === href || pathname.startsWith(`${href}/`);
// }

// function MenuIcon() {
//   return (
//     <svg
//       className="h-5 w-5"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       aria-hidden="true"
//     >
//       <path
//         d="M4 6h16M4 12h16M4 18h16"
//         strokeWidth="2"
//         strokeLinecap="round"
//       />
//     </svg>
//   );
// }

// function CloseIcon() {
//   return (
//     <svg
//       className="h-5 w-5"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       aria-hidden="true"
//     >
//       <path
//         d="M6 6l12 12M18 6 6 18"
//         strokeWidth="2"
//         strokeLinecap="round"
//       />
//     </svg>
//   );
// }

// function LogoutIcon() {
//   return (
//     <svg
//       className="h-4 w-4"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//       aria-hidden="true"
//     >
//       <path
//         d="M10 17l5-5-5-5M15 12H3"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//       <path
//         d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   );
// }

// export default function AdminShell({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const router = useRouter();
//   const pathname = usePathname();

//   const [user, setUser] = useState<User | null>(null);
//   const [checking, setChecking] = useState(true);

//   // Desktop sidebar state.
//   const [collapsed, setCollapsed] = useState(false);

//   // Mobile drawer state.
//   const [mobileOpen, setMobileOpen] = useState(false);

//   const isAuthRoute = useMemo(
//     () =>
//       pathname === '/admin/login' ||
//       pathname === '/admin/register',
//     [pathname],
//   );

//   const currentPage = useMemo(() => {
//     const exact = NAV.find((item) => item.href === pathname);

//     if (exact) {
//       return exact.label;
//     }

//     const nested = NAV.find((item) =>
//       pathname.startsWith(`${item.href}/`),
//     );

//     return nested?.label || 'Workspace';
//   }, [pathname]);

//   /*
//    * Authentication / authorization check.
//    *
//    * The server remains the source of truth for the
//    * current user's role and active status.
//    */
//   useEffect(() => {
//     let active = true;
//     setChecking(true);

//     const loginHref = () =>
//       `/admin/login?returnTo=${encodeURIComponent(pathname || '/admin/dashboard')}`;

//     const run = async () => {
//       if (isAuthRoute) {
//         if (active) setChecking(false);
//         return;
//       }

//       try {
//         const token = await getToken();
//         const localUser = getUser();

//         if (!active) return;
//         if (!token || !localUser) {
//           router.replace(loginHref());
//           return;
//         }

//         const verified = await verifyToken();
//         if (!active) return;

//         if (!verified?.user || String(verified.user.role).toUpperCase() !== 'ADMIN') {
//           logout();
//           router.replace(loginHref());
//           return;
//         }

//         setUser(verified.user);
//       } catch {
//         if (!active) return;
//         logout();
//         router.replace(loginHref());
//       } finally {
//         if (active) setChecking(false);
//       }
//     };

//     void run();
//     return () => {
//       active = false;
//     };
//   }, [isAuthRoute, pathname, router]);

//   /*
//    * Close the mobile drawer whenever navigation changes.
//    */
//   useEffect(() => {
//     setMobileOpen(false);
//   }, [pathname]);

//   /*
//    * Lock page scrolling while the mobile drawer is open.
//    */
//   useEffect(() => {
//     if (!mobileOpen) {
//       return;
//     }

//     const previousOverflow = document.body.style.overflow;

//     document.body.style.overflow = 'hidden';

//     return () => {
//       document.body.style.overflow = previousOverflow;
//     };
//   }, [mobileOpen]);

//   /*
//    * Escape key closes the mobile drawer.
//    */
//   useEffect(() => {
//     if (!mobileOpen) {
//       return;
//     }

//     const handleKeyDown = (event: KeyboardEvent) => {
//       if (event.key === 'Escape') {
//         setMobileOpen(false);
//       }
//     };

//     window.addEventListener('keydown', handleKeyDown);

//     return () => {
//       window.removeEventListener('keydown', handleKeyDown);
//     };
//   }, [mobileOpen]);

//   if (isAuthRoute) {
//     return <>{children}</>;
//   }

//   if (checking) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-slate-950">
//         <div className="flex flex-col items-center gap-4">
//           <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-400/20">
//             <span className="text-2xl">💧</span>
//           </div>

//           <div className="text-center">
//             <p className="text-sm font-semibold text-slate-200">
//               AuroWater Admin
//             </p>
//             <p className="mt-1 text-xs text-slate-500">
//               Verifying secure session…
//             </p>
//           </div>

//           <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
//             <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-400" />
//           </div>
//         </div>
//       </div>
//     );
//   }

//   const handleLogout = () => {
//     logout();
//     router.replace('/auth/login');
//   };

//   return (
//     <div className="min-h-screen bg-slate-950 text-slate-100">
//       {/* =========================================================
//           MOBILE BACKDROP
//          ========================================================= */}
//       <div
//         aria-hidden="true"
//         onClick={() => setMobileOpen(false)}
//         className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
//           mobileOpen
//             ? 'pointer-events-auto opacity-100'
//             : 'pointer-events-none opacity-0'
//         }`}
//       />

//       {/* =========================================================
//           MOBILE SIDEBAR / DRAWER
//          ========================================================= */}
//       <aside
//         className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col border-r border-white/10 bg-[#06101f] shadow-2xl shadow-black/50 transition-transform duration-200 ease-out lg:hidden ${
//           mobileOpen
//             ? 'translate-x-0'
//             : '-translate-x-full'
//         }`}
//         aria-label="Mobile admin navigation"
//       >
//         {/* Mobile drawer header */}
//         <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
//           <Link
//             href="/admin/dashboard"
//             onClick={() => setMobileOpen(false)}
//             className="flex min-w-0 items-center gap-3"
//           >
//             <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl shadow-lg shadow-cyan-500/20">
//               💧
//             </span>

//             <div className="min-w-0">
//               <p className="truncate text-sm font-bold text-white">
//                 AuroWater
//               </p>
//               <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
//                 Admin Control
//               </p>
//             </div>
//           </Link>

//           <button
//             type="button"
//             onClick={() => setMobileOpen(false)}
//             className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
//             aria-label="Close admin menu"
//           >
//             <CloseIcon />
//           </button>
//         </div>

//         {/* Mobile navigation */}
//         <nav className="flex-1 overflow-y-auto p-3">
//           <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
//             Workspace
//           </p>

//           <div className="space-y-1">
//             {NAV.map((item) => {
//               const active = isNavActive(
//                 pathname,
//                 item.href,
//               );

//               return (
//                 <Link
//                   key={item.href}
//                   href={item.href}
//                   onClick={() => setMobileOpen(false)}
//                   className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all ${
//                     active
//                       ? 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-sm shadow-cyan-500/5'
//                       : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
//                   }`}
//                 >
//                   <span
//                     className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
//                       active
//                         ? 'bg-cyan-400/10 text-cyan-300'
//                         : 'text-slate-500 group-hover:text-slate-200'
//                     }`}
//                   >
//                     <span className="h-5 w-5">
//                       {item.icon}
//                     </span>
//                   </span>

//                   <span className="truncate">
//                     {item.label}
//                   </span>

//                   {active && (
//                     <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
//                   )}
//                 </Link>
//               );
//             })}
//           </div>
//         </nav>

//         {/* Mobile user area */}
//         <div className="shrink-0 border-t border-white/10 p-3">
//           <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
//             <div className="flex items-center gap-3">
//               <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-200 ring-1 ring-cyan-400/20">
//                 {(user?.full_name || 'Admin')
//                   .charAt(0)
//                   .toUpperCase()}
//               </div>

//               <div className="min-w-0">
//                 <p className="text-[10px] uppercase tracking-wider text-slate-500">
//                   Signed in as
//                 </p>

//                 <p className="truncate text-sm font-semibold text-slate-100">
//                   {user?.full_name || 'Admin'}
//                 </p>
//               </div>
//             </div>

//             <button
//               type="button"
//               onClick={handleLogout}
//               className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-200"
//             >
//               <LogoutIcon />
//               Logout
//             </button>
//           </div>
//         </div>
//       </aside>

//       {/* =========================================================
//           DESKTOP SIDEBAR
//          ========================================================= */}
//       <div className="flex min-h-screen">
//         <aside
//           className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
//             collapsed ? 'w-20' : 'w-72'
//           }`}
//         >
//           {/* Desktop sidebar header */}
//           <div
//             className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
//               collapsed
//                 ? 'justify-center px-2'
//                 : 'justify-between px-4'
//             }`}
//           >
//             <Link
//               href="/admin/dashboard"
//               className={`flex min-w-0 items-center gap-3 ${
//                 collapsed ? 'justify-center' : ''
//               }`}
//               title={
//                 collapsed
//                   ? 'AuroWater Admin'
//                   : undefined
//               }
//             >
//               <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl shadow-lg shadow-cyan-500/20">
//                 💧
//               </span>

//               {!collapsed && (
//                 <div className="min-w-0">
//                   <p className="truncate text-sm font-bold text-white">
//                     AuroWater
//                   </p>
//                   <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
//                     Admin Control
//                   </p>
//                 </div>
//               )}
//             </Link>

//             {!collapsed && (
//               <button
//                 type="button"
//                 onClick={() =>
//                   setCollapsed((value) => !value)
//                 }
//                 className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
//                 aria-label="Collapse sidebar"
//                 title="Collapse sidebar"
//               >
//                 <MenuIcon />
//               </button>
//             )}

//             {collapsed && (
//               <button
//                 type="button"
//                 onClick={() =>
//                   setCollapsed((value) => !value)
//                 }
//                 className="absolute right-[-18px] top-5 z-10 hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-400 shadow-lg transition hover:bg-slate-800 hover:text-white xl:flex"
//                 aria-label="Expand sidebar"
//                 title="Expand sidebar"
//               >
//                 <MenuIcon />
//               </button>
//             )}
//           </div>

//           {/* Desktop navigation */}
//           <nav
//             className={`flex-1 overflow-y-auto ${
//               collapsed ? 'p-2' : 'p-3'
//             }`}
//           >
//             {!collapsed && (
//               <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
//                 Workspace
//               </p>
//             )}

//             <div className="space-y-1">
//               {NAV.map((item) => {
//                 const active = isNavActive(
//                   pathname,
//                   item.href,
//                 );

//                 return (
//                   <Link
//                     key={item.href}
//                     href={item.href}
//                     title={
//                       collapsed
//                         ? item.label
//                         : undefined
//                     }
//                     className={`group relative flex min-h-11 items-center rounded-xl text-sm font-medium transition-all ${
//                       collapsed
//                         ? 'justify-center px-2'
//                         : 'gap-3 px-3'
//                     } ${
//                       active
//                         ? 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-sm shadow-cyan-500/5'
//                         : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
//                     }`}
//                   >
//                     {active && (
//                       <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
//                     )}

//                     <span
//                       className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
//                         active
//                           ? 'bg-cyan-400/10 text-cyan-300'
//                           : 'text-slate-500 group-hover:text-slate-200'
//                       }`}
//                     >
//                       <span className="h-5 w-5">
//                         {item.icon}
//                       </span>
//                     </span>

//                     {!collapsed && (
//                       <>
//                         <span className="truncate">
//                           {item.label}
//                         </span>

//                         {active && (
//                           <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
//                         )}
//                       </>
//                     )}
//                   </Link>
//                 );
//               })}
//             </div>
//           </nav>

//           {/* Desktop user area */}
//           <div className="shrink-0 border-t border-white/10 p-3">
//             <div
//               className={`rounded-2xl border border-white/10 bg-white/[0.035] ${
//                 collapsed ? 'p-2' : 'p-3'
//               }`}
//             >
//               <div
//                 className={`flex items-center ${
//                   collapsed
//                     ? 'justify-center'
//                     : 'gap-3'
//                 }`}
//               >
//                 <div
//                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-sm font-bold text-cyan-200 ring-1 ring-cyan-400/20"
//                   title={
//                     collapsed
//                       ? user?.full_name || 'Admin'
//                       : undefined
//                   }
//                 >
//                   {(user?.full_name || 'Admin')
//                     .charAt(0)
//                     .toUpperCase()}
//                 </div>

//                 {!collapsed && (
//                   <div className="min-w-0">
//                     <p className="text-[10px] uppercase tracking-wider text-slate-500">
//                       Signed in as
//                     </p>

//                     <p className="truncate text-sm font-semibold text-slate-100">
//                       {user?.full_name || 'Admin'}
//                     </p>
//                   </div>
//                 )}
//               </div>

//               <button
//                 type="button"
//                 onClick={handleLogout}
//                 title={
//                   collapsed
//                     ? 'Logout'
//                     : undefined
//                 }
//                 className={`mt-3 flex rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-slate-300 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-200 ${
//                   collapsed
//                     ? 'h-10 w-full items-center justify-center'
//                     : 'w-full items-center justify-center gap-2 px-3 py-2.5'
//                 }`}
//               >
//                 <LogoutIcon />
//                 {!collapsed && 'Logout'}
//               </button>
//             </div>
//           </div>
//         </aside>

//         {/* =======================================================
//             MAIN APPLICATION AREA
//            ======================================================= */}
//         <div className="flex min-w-0 flex-1 flex-col">
//           {/* Header */}
//           <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-slate-950/80 px-3 backdrop-blur-xl sm:px-6">
//             <div className="flex min-w-0 items-center gap-3">
//               {/* Mobile menu */}
//               <button
//                 type="button"
//                 onClick={() => setMobileOpen(true)}
//                 className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
//                 aria-label="Open admin menu"
//                 aria-expanded={mobileOpen}
//               >
//                 <MenuIcon />
//               </button>

//               {/* Mobile brand */}
//               <div className="flex shrink-0 items-center lg:hidden">
//                 <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg shadow-lg shadow-cyan-500/20">
//                   💧
//                 </span>
//               </div>

//               {/* Breadcrumb */}
//               <div className="min-w-0 text-sm">
//                 <div className="flex min-w-0 items-center gap-2">
//                   <span className="hidden text-slate-500 sm:inline">
//                     Admin Control Center
//                   </span>

//                   <span className="hidden text-slate-700 sm:inline">
//                     /
//                   </span>

//                   <span className="truncate font-medium text-slate-200">
//                     {currentPage}
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="flex shrink-0 items-center gap-2 sm:gap-3">
//               {/* Status */}
//               <div className="hidden items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/5 px-3 py-1.5 sm:flex">
//                 <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
//                 <span className="text-[11px] font-medium text-emerald-300">
//                   System Online
//                 </span>
//               </div>

//               <Link
//                 href="/"
//                 className="hidden text-sm font-medium text-slate-300 transition hover:text-white sm:block"
//                 title="Back to AuroWater website"
//               >
//                 View site →
//               </Link>
//             </div>
//           </header>

//           {/* Page content */}
//           <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 p-3 sm:p-6 lg:p-8">
//             {children}
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }
