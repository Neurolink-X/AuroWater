'use client';

/**
 * AuroWater — Authentication Hook
 * Place at: src/hooks/useAuth.ts
 *
 * Features:
 *   • Synchronous first render (no flicker — cache read in useState initialiser)
 *   • Session expiry: configurable TTL, auto-logout on expiry
 *   • Cross-tab sync via StorageEvent
 *   • Role-based permission helpers (isAdmin, can, requireRole)
 *   • writeSession — typed helper to create/update the session anywhere
 *   • clearSession — typed helper for programmatic logout without redirect
 *   • Auth context provider + useAuthContext for shared state
 *   • Server-side rendering safe (typeof window guards)
 *   • Zero JSX — valid plain .ts file
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clearToken, setToken } from '@/lib/api-client';
import { clearAuthGateCookies, setAuthGateCookies } from '@/lib/auth/client-gate-cookies';

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

export type AuthRole = 'customer' | 'technician' | 'supplier' | 'admin';

/** Stored in localStorage under SESSION_KEY */
export interface Session {
  /** User's full name */
  name:      string;
  /** User's email address */
  email:     string;
  /** Platform role */
  role:      AuthRole;
  /** Must be true for the session to be considered valid */
  loggedIn:  boolean;
  /** Unix ms timestamp of login — used for TTL checks */
  loginTime: number;
  /** AuroWater unique user ID */
  aurotapId?: string;
  /** Optional: user's phone number */
  phone?:     string;
  /** Optional: URL to avatar image */
  avatarUrl?: string;
  /** Supabase access token — forwarded to API routes as Bearer */
  accessToken?: string;
  refreshToken?: string;
  /** Supabase profile UUID */
  userId?: string;
}

/** Granular action keys for permission checking */
export type PermissionKey =
  | 'view:admin_dashboard'
  | 'view:supplier_dashboard'
  | 'view:technician_dashboard'
  | 'view:customer_dashboard'
  | 'manage:settings'
  | 'manage:users'
  | 'manage:orders'
  | 'manage:finance'
  | 'create:order'
  | 'cancel:order'
  | 'view:earnings'
  | 'request:payout'
  | 'accept:job'
  | 'update:job_status';

/** Everything useAuth returns */
export interface UseAuthReturn {
  /* ── Session data ── */
  session:    Session | null;
  /** First name only, or null if not logged in */
  name:       string | null;
  /** Full name, or null if not logged in */
  fullName:   string | null;
  email:      string | null;
  role:       AuthRole | null;
  aurotapId:  string | null;
  phone:      string | null;
  avatarUrl:  string | null;

  /* ── Status ── */
  /** true once localStorage has been read (prevents SSR/client mismatch) */
  hydrated:   boolean;
  isLoggedIn: boolean;

  /* ── Role booleans ── */
  isCustomer:   boolean;
  isTechnician: boolean;
  isSupplier:   boolean;
  isAdmin:      boolean;

  /* ── Permission check ── */
  /**
   * Check if the current user has a specific permission.
   * @example if (can('manage:settings')) { ... }
   */
  can: (action: PermissionKey) => boolean;

  /* ── Actions ── */
  /**
   * Sign out: clears storage, shows toast, redirects to `redirectTo` (default: '/').
   */
  logout: (options?: { redirectTo?: string; silent?: boolean }) => void;

  /**
   * Update fields in the active session without a full re-login.
   * Only the provided fields are changed; others remain as-is.
   */
  updateSession: (patch: Partial<Omit<Session, 'loggedIn' | 'loginTime'>>) => void;

  /**
   * Redirect the user to their role-appropriate dashboard.
   * Call this after a successful login.
   */
  redirectToDashboard: () => void;

  /**
   * Require authentication. If the user is not logged in (after hydration),
   * redirects to `redirectTo` (default: '/auth/login').
   * Returns true if the user IS authenticated (safe to render page content).
   */
  requireAuth: (options?: { redirectTo?: string }) => boolean;

  /**
   * Require a specific role. If the user does not have the role (after hydration),
   * redirects to `unauthorizedPath` (default: '/').
   * Returns true if the user HAS the role.
   */
  requireRole: (role: AuthRole | AuthRole[], options?: { unauthorizedPath?: string }) => boolean;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */

const SESSION_KEY = 'aurowater_session';

/** Default session TTL: 7 days in ms */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Role → home dashboard path */
const DASHBOARD_PATHS: Record<AuthRole, string> = {
  customer:   '/customer',
  technician: '/technician',
  supplier:   '/supplier',
  admin:      '/admin',
};

/** Granular permissions per role */
const ROLE_PERMISSIONS: Record<AuthRole, PermissionKey[]> = {
  admin: [
    'view:admin_dashboard', 'view:supplier_dashboard', 'view:technician_dashboard',
    'view:customer_dashboard', 'manage:settings', 'manage:users', 'manage:orders',
    'manage:finance', 'create:order', 'cancel:order', 'view:earnings',
    'request:payout', 'accept:job', 'update:job_status',
  ],
  supplier: [
    'view:supplier_dashboard', 'view:earnings', 'request:payout',
    'manage:orders',
  ],
  technician: [
    'view:technician_dashboard', 'accept:job', 'update:job_status',
    'view:earnings',
  ],
  customer: [
    'view:customer_dashboard', 'create:order', 'cancel:order',
  ],
};

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS  (no React deps — independently testable)
═══════════════════════════════════════════════════════════════ */

/** Parse JSON without throwing */
export function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

/** Check whether a session is non-expired and fully valid */
export function isSessionValid(
  s: Session | null,
  ttlMs: number = DEFAULT_TTL_MS
): boolean {
  if (!s?.loggedIn || !s.email || !s.name || !s.role) return false;
  if (!Number.isFinite(s.loginTime)) return false;
  return Date.now() - s.loginTime < ttlMs;
}

/** Get first name from full name */
function firstName(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

/* ═══════════════════════════════════════════════════════════════
   STORAGE HELPERS
═══════════════════════════════════════════════════════════════ */

function readSession(ttlMs: number): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  const parsed = safeParseJSON<Session>(raw);
  return isSessionValid(parsed, ttlMs) ? parsed : null;
}

/**
 * Write (or update) a session to localStorage.
 * Call this from your login flow after a successful API response.
 *
 * @example
 * writeSession({ name: 'Arjun', email: 'arjun@example.com', role: 'admin' });
 */
export function writeSession(
  data: Omit<Session, 'loggedIn' | 'loginTime'> & {
    loginTime?: number;
  }
): Session {
  const session: Session = {
    ...data,
    loggedIn:  true,
    loginTime: data.loginTime ?? Date.now(),
  };
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* quota */ }
    if (session.accessToken) {
      setToken(session.accessToken);
    }
    // Decision: mirror role for Edge middleware (see client-gate-cookies.ts).
    if (session.role) {
      setAuthGateCookies(session.role);
    }
  }
  return session;
}

/**
 * Clear the session from localStorage without any redirect.
 * Use this for programmatic logout (e.g. after an API 401).
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  clearToken();
  clearAuthGateCookies();
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */

export function useAuth(ttlMs: number = DEFAULT_TTL_MS): UseAuthReturn {
  const router = useRouter();

  /**
   * Synchronous initialiser — reads localStorage before first render.
   * Prevents the flash of "logged out" state on page load.
   */
  const [session, setSession] = React.useState<Session | null>(() => readSession(ttlMs));
  const [hydrated, setHydrated] = React.useState<boolean>(() => typeof window !== 'undefined');

  /* ── Hydrate on mount (SSR → client handoff) ── */
  React.useEffect(() => {
    const s = readSession(ttlMs);
    setSession(s);
    setHydrated(true);
  }, [ttlMs]);

  /* ── Auto-logout when session expires ── */
  React.useEffect(() => {
    if (!session) return;
    const remaining = session.loginTime + ttlMs - Date.now();
    if (remaining <= 0) {
      clearSession();
      setSession(null);
      return;
    }
    const id = window.setTimeout(() => {
      clearSession();
      setSession(null);
      toast.error('Your session has expired. Please sign in again.');
      router.push('/auth/login');
    }, remaining);
    return () => window.clearTimeout(id);
  }, [session, ttlMs, router]);

  /* ── Cross-tab sync ── */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== SESSION_KEY) return;
      if (!e.newValue) {
        // Logged out in another tab
        setSession(null);
        return;
      }
      const incoming = safeParseJSON<Session>(e.newValue);
      setSession(isSessionValid(incoming, ttlMs) ? incoming : null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [ttlMs]);

  /* ── Actions ── */
  const logout = React.useCallback(
    (options: { redirectTo?: string; silent?: boolean } = {}): void => {
      clearSession();
      setSession(null);
      if (!options.silent) {
        toast.success('Signed out. See you soon! 👋');
      }
      router.push(options.redirectTo ?? '/');
    },
    [router]
  );

  const updateSession = React.useCallback(
    (patch: Partial<Omit<Session, 'loggedIn' | 'loginTime'>>): void => {
      setSession(prev => {
        if (!prev) return null;
        const next: Session = { ...prev, ...patch };
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_KEY, JSON.stringify(next));
          }
        } catch { /* quota */ }
        return next;
      });
    },
    []
  );

  const redirectToDashboard = React.useCallback((): void => {
    const path = session?.role ? DASHBOARD_PATHS[session.role] : '/';
    router.push(path);
  }, [session?.role, router]);

  const requireAuth = React.useCallback(
    (options: { redirectTo?: string } = {}): boolean => {
      if (!hydrated) return false;
      if (!session?.loggedIn) {
        router.push(options.redirectTo ?? '/auth/login');
        return false;
      }
      return true;
    },
    [hydrated, session, router]
  );

  const requireRole = React.useCallback(
    (
      requiredRole: AuthRole | AuthRole[],
      options: { unauthorizedPath?: string } = {}
    ): boolean => {
      if (!hydrated) return false;
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!session?.loggedIn || !allowed.includes(session.role)) {
        router.push(options.unauthorizedPath ?? '/');
        return false;
      }
      return true;
    },
    [hydrated, session, router]
  );

  /* ── Permission check ── */
  const can = React.useCallback(
    (action: PermissionKey): boolean => {
      if (!session?.role) return false;
      return ROLE_PERMISSIONS[session.role].includes(action);
    },
    [session?.role]
  );

  /* ── Derived ── */
  const isLoggedIn   = isSessionValid(session, ttlMs);
  const role         = isLoggedIn ? (session?.role ?? null) : null;
  const isCustomer   = role === 'customer';
  const isTechnician = role === 'technician';
  const isSupplier   = role === 'supplier';
  const isAdmin      = role === 'admin';

  return {
    session:    isLoggedIn ? session : null,
    name:       isLoggedIn ? firstName(session?.name) : null,
    fullName:   isLoggedIn ? (session?.name ?? null) : null,
    email:      isLoggedIn ? (session?.email ?? null) : null,
    role,
    aurotapId:  isLoggedIn ? (session?.aurotapId ?? null) : null,
    phone:      isLoggedIn ? (session?.phone ?? null) : null,
    avatarUrl:  isLoggedIn ? (session?.avatarUrl ?? null) : null,
    hydrated,
    isLoggedIn,
    isCustomer,
    isTechnician,
    isSupplier,
    isAdmin,
    can,
    logout,
    updateSession,
    redirectToDashboard,
    requireAuth,
    requireRole,
  };
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT  — share one auth state across many components
═══════════════════════════════════════════════════════════════ */

const AuthContext = React.createContext<UseAuthReturn | null>(null);

/**
 * Wrap your root layout with <AuthProvider> to share auth state
 * across all components without extra hook calls.
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return <AuthProvider>{children}</AuthProvider>;
 * }
 */
export function AuthProvider({
  children,
  ttlMs,
}: {
  children: React.ReactNode;
  ttlMs?: number;
}): React.ReactElement {
  const value = useAuth(ttlMs);
  return React.createElement(AuthContext.Provider, { value }, children);
}

/**
 * Consume auth state shared by <AuthProvider>.
 * Throws if called outside <AuthProvider>.
 *
 * @example
 * const { isLoggedIn, role, can, logout } = useAuthContext();
 */
export function useAuthContext(): UseAuthReturn {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useAuthContext must be called inside <AuthProvider>. ' +
      'Either wrap your layout with <AuthProvider>, or call useAuth() directly.'
    );
  }
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   STANDALONE UTILITIES  (no React — use anywhere)
═══════════════════════════════════════════════════════════════ */

/**
 * Get the dashboard path for a given role.
 * @example dashboardPath('admin') → '/admin'
 */
export function dashboardPath(role: AuthRole | null | undefined): string {
  return role ? (DASHBOARD_PATHS[role] ?? '/') : '/';
}

/**
 * Check if a stored session is still valid without mounting a hook.
 * Useful in middleware or server utilities.
 */
export function getSessionFromStorage(ttlMs = DEFAULT_TTL_MS): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  const s   = safeParseJSON<Session>(raw);
  return isSessionValid(s, ttlMs) ? s : null;
}

/**
 * Get user initials from a full name string.
 * @example getInitials('Arjun Kumar') → 'AK'
 */
export function getInitials(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';
}

/* ═══════════════════════════════════════════════════════════════
   LEGACY COMPATIBILITY  — keeps existing import paths working
═══════════════════════════════════════════════════════════════ */

/**
 * @deprecated Use writeSession() instead.
 * Kept so existing login flows don't break.
 */
export function saveSession(data: Omit<Session, 'loggedIn' | 'loginTime'>): void {
  writeSession(data);
}

/**
 * @deprecated Use clearSession() instead.
 */
export function removeSession(): void {
  clearSession();
}

/**
 * @deprecated The `checked` field is now called `hydrated`.
 * This re-exports the hook with the old field name for backward compat.
 */
export function useAuthLegacy(ttlMs?: number) {
  const auth = useAuth(ttlMs);
  return { ...auth, checked: auth.hydrated };
}