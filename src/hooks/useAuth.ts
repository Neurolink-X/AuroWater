'use client';

/**
 * AuroWater — Production Authentication Hook
 * Place at: src/hooks/useAuth.ts
 *
 * Responsibilities:
 * - Client authentication state and hydration
 * - Session TTL / expiry handling
 * - Cross-tab session synchronization
 * - Role + account-status + operational-state helpers
 * - Permission helpers for UI gating
 * - Central logout / session update helpers
 * - Backward-compatible exports for existing code
 *
 * IMPORTANT:
 * This hook is NOT the security boundary.
 * API routes, Supabase RLS, middleware/server authorization, and resource
 * ownership checks must independently enforce authentication and permissions.
 *
 * Authentication architecture:
 *   Supabase Auth / server auth
 *          ↓
 *   public.profiles (role/status/verification)
 *          ↓
 *   server/API authorization + RLS
 *          ↓
 *   useAuth() — client UI state
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { clearToken, setToken } from '@/lib/api-client';
import {
  clearAuthGateCookies,
  setAuthGateCookies,
} from '@/lib/auth/client-gate-cookies';
import { safeGet, safeRemove, safeSet } from '@/lib/storage';

/* ═══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */

export type AuthRole =
  | 'customer'
  | 'technician'
  | 'supplier'
  | 'admin';

export type AccountStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'banned'
  | 'rejected';

export type VerificationStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected';

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

export interface Session {
  /** User's full name */
  name: string;

  /** User's email address */
  email: string;

  /** Platform role */
  role: AuthRole;

  /** Whether this local session is marked as logged in */
  loggedIn: boolean;

  /** Unix ms timestamp of login */
  loginTime: number;

  /** AuroWater unique customer/user identifier */
  aurotapId?: string;

  /** Supabase/profile UUID */
  userId?: string;

  /** User phone */
  phone?: string;

  /** Avatar URL */
  avatarUrl?: string;

  /**
   * Account lifecycle status.
   *
   * Existing login flows may omit this temporarily for backward
   * compatibility. Supplier/technician operational access will remain
   * disabled until a trusted active/approved state is supplied.
   */
  accountStatus?: AccountStatus;

  /**
   * Supplier/technician verification state.
   * Admin/customer normally use not_required.
   */
  verificationStatus?: VerificationStatus;

  /**
   * Explicit operational flag from a trusted server response.
   * Never use this field as the only server-side authorization check.
   */
  operational?: boolean;

  /**
   * Optional cached Supabase access token used by the existing API client.
   *
   * SECURITY:
   * Prefer the Supabase-managed/server auth session for sensitive
   * authentication. Do not treat this local value as proof of identity.
   */
  accessToken?: string;

  /**
   * Deprecated compatibility field.
   * Do not add new code that stores refresh tokens in this custom session.
   */
  refreshToken?: string;
}

export interface UseAuthReturn {
  /* ── Session ── */
  session: Session | null;
  name: string | null;
  fullName: string | null;
  email: string | null;
  role: AuthRole | null;
  aurotapId: string | null;
  userId: string | null;
  phone: string | null;
  avatarUrl: string | null;

  user: {
  email?: string;
  full_name: string;
  phone?: string;
} | null;

  /* ── Lifecycle ── */
  accountStatus: AccountStatus | null;
  verificationStatus: VerificationStatus | null;
  isActive: boolean;
  isApproved: boolean;
  isOperational: boolean;

  /* ── Hydration ── */
  loading: boolean;
  hydrated: boolean;
  isLoggedIn: boolean;

  /* ── Roles ── */
  isCustomer: boolean;
  isTechnician: boolean;
  isSupplier: boolean;
  isAdmin: boolean;

  /** Legacy aliases */
  isSeller: boolean;
  isAgent: boolean;

  /* ── Authorization helpers ── */
  can: (action: PermissionKey) => boolean;

  /* ── Actions ── */
  logout: (options?: {
    redirectTo?: string;
    silent?: boolean;
  }) => void;

  updateSession: (
    patch: Partial<Omit<Session, 'loggedIn' | 'loginTime'>>
  ) => void;

  refreshSession: () => void;

  redirectToDashboard: () => void;

  requireAuth: (options?: {
    redirectTo?: string;
  }) => boolean;

  requireRole: (
    role: AuthRole | AuthRole[],
    options?: {
      unauthorizedPath?: string;
    }
  ) => boolean;

  requirePermission: (
    permission: PermissionKey,
    options?: {
      unauthorizedPath?: string;
    }
  ) => boolean;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */

export const SESSION_KEY = 'aurowater_session';

/** Default client session TTL: 7 days */
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DASHBOARD_PATHS: Record<AuthRole, string> = {
  customer: '/customer',
  technician: '/technician',
  supplier: '/supplier',
  admin: '/admin',
};

const ROLE_PERMISSIONS: Record<AuthRole, PermissionKey[]> = {
  admin: [
    'view:admin_dashboard',
    'view:supplier_dashboard',
    'view:technician_dashboard',
    'view:customer_dashboard',
    'manage:settings',
    'manage:users',
    'manage:orders',
    'manage:finance',
    'create:order',
    'cancel:order',
    'view:earnings',
    'request:payout',
    'accept:job',
    'update:job_status',
  ],

  supplier: [
    'view:supplier_dashboard',
    'view:earnings',
    'request:payout',
    'manage:orders',
  ],

  technician: [
    'view:technician_dashboard',
    'accept:job',
    'update:job_status',
    'view:earnings',
  ],

  customer: [
    'view:customer_dashboard',
    'create:order',
    'cancel:order',
  ],
};

/**
 * Permissions that require the account to be operational.
 *
 * This is a CLIENT UI guard only. The API must enforce the same policy.
 */
const OPERATIONAL_PERMISSIONS = new Set<PermissionKey>([
  'manage:orders',
  'request:payout',
  'accept:job',
  'update:job_status',
]);

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */

/** Parse JSON without throwing. */
export function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Get first name from a full name. */
function firstName(
  fullName: string | null | undefined
): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}

/**
 * Validate the local cached session.
 *
 * This proves only that the local cache looks valid.
 * It does NOT prove that the Supabase account is currently valid.
 */
export function isSessionValid(
  session: Session | null,
  ttlMs: number = DEFAULT_TTL_MS
): boolean {
  if (!session?.loggedIn) return false;

  if (!session.email?.trim()) return false;
  if (!session.name?.trim()) return false;

  if (!isAuthRole(session.role)) return false;

  if (!Number.isFinite(session.loginTime)) return false;

  if (ttlMs <= 0) return false;

  const age = Date.now() - session.loginTime;

  return age >= 0 && age < ttlMs;
}

function isAuthRole(value: unknown): value is AuthRole {
  return (
    value === 'customer' ||
    value === 'technician' ||
    value === 'supplier' ||
    value === 'admin'
  );
}

function isAccountStatus(
  value: unknown
): value is AccountStatus {
  return (
    value === 'pending' ||
    value === 'active' ||
    value === 'suspended' ||
    value === 'banned' ||
    value === 'rejected'
  );
}

function isVerificationStatus(
  value: unknown
): value is VerificationStatus {
  return (
    value === 'not_required' ||
    value === 'pending' ||
    value === 'approved' ||
    value === 'rejected'
  );
}

/**
 * Determine whether a role can operate the platform.
 *
 * Customers/admins only need an active account.
 * Suppliers/technicians additionally require approved verification.
 *
 * If an older cached supplier/technician session has no status data,
 * it is deliberately NOT considered operational.
 */
export function isSessionOperational(
  session: Session | null
): boolean {
  if (!session?.loggedIn) return false;

  if (session.accountStatus !== 'active') {
    return false;
  }

  if (session.role === 'supplier' || session.role === 'technician') {
    return session.verificationStatus === 'approved';
  }

  return session.role === 'customer' || session.role === 'admin';
}

/**
 * Check whether a permission exists for a role.
 *
 * UI helper only. Never use this as the API security boundary.
 */
export function roleHasPermission(
  role: AuthRole | null | undefined,
  action: PermissionKey
): boolean {
  if (!role) return false;

  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

/* ═══════════════════════════════════════════════════════════════
   STORAGE
══════════════════════════════════════════════════════════════ */

function readSession(ttlMs: number): Session | null {
  const raw = safeGet(SESSION_KEY);
  const parsed = safeParseJSON<Session>(raw);

  if (!isSessionValid(parsed, ttlMs)) {
    return null;
  }

  return parsed;
}

/**
 * Persist a session after a trusted login response.
 *
 * IMPORTANT:
 * The login API must determine role/status/verification from trusted
 * server-side data. Never accept role/status supplied only by the browser.
 */
export function writeSession(
  data: Omit<Session, 'loggedIn' | 'loginTime'> & {
    loginTime?: number;
  }
): Session {
  const session: Session = {
    ...data,
    loggedIn: true,
    loginTime: data.loginTime ?? Date.now(),
  };

  if (typeof window !== 'undefined') {
    safeSet(SESSION_KEY, JSON.stringify(session));

    if (session.accessToken) {
      setToken(session.accessToken);
    } else {
      clearToken();
    }

    setAuthGateCookies(session.role);
  }

  return session;
}

/**
 * Clear every client-side auth artifact managed by this module.
 *
 * Server-side/Supabase auth should also be signed out by the appropriate
 * auth provider/API layer when required.
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;

  safeRemove(SESSION_KEY);
  clearToken();
  clearAuthGateCookies();

  /**
   * Broadcast logout/update to other tabs.
   * StorageEvent is automatically fired in other documents when
   * localStorage changes, so no custom BroadcastChannel is required.
   */
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
══════════════════════════════════════════════════════════════ */

export function useAuth(
  ttlMs: number = DEFAULT_TTL_MS
): UseAuthReturn {
  const router = useRouter();

  const [session, setSession] =
    React.useState<Session | null>(null);

  const [hydrated, setHydrated] =
    React.useState(false);

  const redirectingRef = React.useRef(false);

  /* ── Hydrate local cache ── */
  React.useEffect(() => {
    let cancelled = false;

    const cached = readSession(ttlMs);

    if (!cancelled) {
      setSession(cached);
      setHydrated(true);
    }

    return () => {
      cancelled = true;
    };
  }, [ttlMs]);

  /* ── Auto-expiry ── */
  React.useEffect(() => {
    if (!hydrated || !session) return;

    const remaining =
      session.loginTime + ttlMs - Date.now();

    if (remaining <= 0) {
      clearSession();
      setSession(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearSession();
      setSession(null);

      if (!redirectingRef.current) {
        redirectingRef.current = true;

        toast.error(
          'Your session has expired. Please sign in again.'
        );

        router.replace('/auth/login');
      }
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hydrated, session, ttlMs, router]);

  /* ── Cross-tab synchronization ── */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent): void => {
      if (event.key !== SESSION_KEY) return;

      if (!event.newValue) {
        setSession(null);
        return;
      }

      const incoming =
        safeParseJSON<Session>(event.newValue);

      if (!isSessionValid(incoming, ttlMs)) {
        setSession(null);
        return;
      }

      setSession(incoming);
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [ttlMs]);

  /* ── Refresh local session from storage ── */
  const refreshSession = React.useCallback((): void => {
    const next = readSession(ttlMs);
    setSession(next);
  }, [ttlMs]);

  /* ── Logout ── */
  const logout = React.useCallback(
    (
      options: {
        redirectTo?: string;
        silent?: boolean;
      } = {}
    ): void => {
      clearSession();
      setSession(null);

      if (!options.silent) {
        toast.success('Signed out successfully.');
      }

      router.replace(options.redirectTo ?? '/');
    },
    [router]
  );

  /* ── Update session ── */
  const updateSession = React.useCallback(
    (
      patch: Partial<
        Omit<Session, 'loggedIn' | 'loginTime'>
      >
    ): void => {
      setSession((previous) => {
        if (!previous) return null;

        const next: Session = {
          ...previous,
          ...patch,
        };

        if (typeof window !== 'undefined') {
          safeSet(
            SESSION_KEY,
            JSON.stringify(next)
          );

          if (next.accessToken) {
            setToken(next.accessToken);
          }

          setAuthGateCookies(next.role);
        }

        return next;
      });
    },
    []
  );

  /* ── Dashboard redirect ── */
  const redirectToDashboard = React.useCallback((): void => {
    const path = dashboardPath(session?.role);
    router.replace(path);
  }, [session?.role, router]);

  /* ── Require authentication ── */
  const requireAuth = React.useCallback(
    (
      options: {
        redirectTo?: string;
      } = {}
    ): boolean => {
      if (!hydrated) return false;

      if (!isSessionValid(session, ttlMs)) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace(
            options.redirectTo ?? '/auth/login'
          );
        }

        return false;
      }

      return true;
    },
    [hydrated, session, ttlMs, router]
  );

  /* ── Require role ── */
  const requireRole = React.useCallback(
    (
      requiredRole: AuthRole | AuthRole[],
      options: {
        unauthorizedPath?: string;
      } = {}
    ): boolean => {
      if (!hydrated) return false;

      if (!isSessionValid(session, ttlMs)) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace('/auth/login');
        }

        return false;
      }

      const allowed = Array.isArray(requiredRole)
        ? requiredRole
        : [requiredRole];

      if (!session?.role || !allowed.includes(session.role)) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace(
            options.unauthorizedPath ?? '/'
          );
        }

        return false;
      }

      return true;
    },
    [hydrated, session, ttlMs, router]
  );

  /* ── Permission check ── */
  const can = React.useCallback(
    (action: PermissionKey): boolean => {
      if (!isSessionValid(session, ttlMs)) {
        return false;
      }

      if (!roleHasPermission(session.role, action)) {
        return false;
      }

      /**
       * Operational permissions are intentionally blocked for:
       * - pending accounts
       * - suspended accounts
       * - banned accounts
       * - rejected accounts
       * - unverified suppliers
       * - unverified technicians
       */
      if (OPERATIONAL_PERMISSIONS.has(action)) {
        return isSessionOperational(session);
      }

      return true;
    },
    [session, ttlMs]
  );

  /* ── Require permission ── */
  const requirePermission = React.useCallback(
    (
      permission: PermissionKey,
      options: {
        unauthorizedPath?: string;
      } = {}
    ): boolean => {
      if (!hydrated) return false;

      if (!isSessionValid(session, ttlMs)) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace('/auth/login');
        }

        return false;
      }

      if (!roleHasPermission(session?.role, permission)) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace(
            options.unauthorizedPath ?? '/'
          );
        }

        return false;
      }

      if (
        OPERATIONAL_PERMISSIONS.has(permission) &&
        !isSessionOperational(session)
      ) {
        if (!redirectingRef.current) {
          redirectingRef.current = true;

          const role = session?.role;

          if (role === 'supplier') {
            router.replace('/supplier');
          } else if (role === 'technician') {
            router.replace('/technician');
          } else {
            router.replace(
              options.unauthorizedPath ?? '/'
            );
          }
        }

        return false;
      }

      return true;
    },
    [hydrated, session, ttlMs, router]
  );

  /* ── Derived state ── */
  const isLoggedIn =
    hydrated && isSessionValid(session, ttlMs);

  const role: AuthRole | null =
    isLoggedIn ? session?.role ?? null : null;

  const accountStatus: AccountStatus | null =
    isLoggedIn && session?.accountStatus
      ? session.accountStatus
      : null;

  const verificationStatus:
    | VerificationStatus
    | null =
    isLoggedIn && session?.verificationStatus
      ? session.verificationStatus
      : null;

  const isActive =
    isLoggedIn &&
    session?.accountStatus === 'active';

  const isApproved =
    isLoggedIn &&
    (
      role === 'customer' ||
      role === 'admin' ||
      session?.verificationStatus === 'approved'
    );

  const isOperational =
    isLoggedIn &&
    isSessionOperational(session);

  const isCustomer = role === 'customer';
  const isTechnician = role === 'technician';
  const isSupplier = role === 'supplier';
  const isAdmin = role === 'admin';

  return {
    session: isLoggedIn ? session : null,

    name: isLoggedIn
      ? firstName(session?.name)
      : null,

    fullName: isLoggedIn
      ? session?.name ?? null
      : null,

    email: isLoggedIn
      ? session?.email ?? null
      : null,

    role,

    aurotapId: isLoggedIn
      ? session?.aurotapId ?? null
      : null,

    userId: isLoggedIn
      ? session?.userId ?? null
      : null,

    phone: isLoggedIn
      ? session?.phone ?? null
      : null,

    avatarUrl: isLoggedIn
      ? session?.avatarUrl ?? null
      : null,

    accountStatus,
    verificationStatus,
    isActive,
    isApproved,
    isOperational,

    user:
  isLoggedIn && session
    ? {
        email: session.email,
        full_name: session.name,
        phone: session.phone,
      }
    : null,
    
    hydrated,
    loading: !hydrated,
    isLoggedIn,

    isCustomer,
    isTechnician,
    isSupplier,
    isAdmin,

    /* Legacy compatibility */
    isSeller: isSupplier,
    isAgent: isTechnician,

    can,

    logout,
    updateSession,
    refreshSession,
    redirectToDashboard,
    requireAuth,
    requireRole,
    requirePermission,
  };
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
══════════════════════════════════════════════════════════════ */

const AuthContext =
  React.createContext<UseAuthReturn | null>(null);

/**
 * Wrap a shared layout/provider with AuthProvider.
 */
export function AuthProvider({
  children,
  ttlMs,
}: {
  children: React.ReactNode;
  ttlMs?: number;
}): React.ReactElement {
  const value = useAuth(ttlMs);

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

/**
 * Consume the shared auth state.
 */
export function useAuthContext(): UseAuthReturn {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuthContext must be called inside <AuthProvider>. ' +
        'Wrap the relevant layout with <AuthProvider>, ' +
        'or call useAuth() directly.'
    );
  }

  return context;
}

/* ═══════════════════════════════════════════════════════════════
   STANDALONE UTILITIES
══════════════════════════════════════════════════════════════ */

/**
 * Get dashboard path for a role.
 */
export function dashboardPath(
  role: AuthRole | null | undefined
): string {
  return role
    ? DASHBOARD_PATHS[role] ?? '/'
    : '/';
}

/**
 * Read the client-side cached session.
 *
 * CLIENT ONLY:
 * localStorage is never a server/middleware security source.
 */
export function getSessionFromStorage(
  ttlMs = DEFAULT_TTL_MS
): Session | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return readSession(ttlMs);
}

/**
 * Get user initials.
 */
export function getInitials(
  name: string | null | undefined
): string {
  return (
    (name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) =>
        part[0]?.toUpperCase() ?? ''
      )
      .join('') || 'U'
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEGACY COMPATIBILITY
══════════════════════════════════════════════════════════════ */

/**
 * @deprecated Use writeSession().
 */
export function saveSession(
  data: Omit<Session, 'loggedIn' | 'loginTime'>
): void {
  writeSession(data);
}

/**
 * @deprecated Use clearSession().
 */
export function removeSession(): void {
  clearSession();
}

/**
 * @deprecated Use hydrated instead of checked.
 */
export function useAuthLegacy(
  ttlMs?: number
) {
  const auth = useAuth(ttlMs);

  return {
    ...auth,
    checked: auth.hydrated,
  };
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY NOTES
══════════════════════════════════════════════════════════════
1. localStorage is a client cache, NOT an authorization boundary.
2. API routes must verify the authenticated Supabase user.
3. Supabase RLS must enforce row ownership.
4. Server code must derive role/status from trusted profile data.
5. Supplier/technician approval must be enforced server-side.
6. Never trust role/status/operational fields sent by the browser.
7. Never authorize an order/job solely because its ID exists in the UI.
8. Financial actions must have independent server authorization.
9. Prefer HttpOnly/server-managed authentication for sensitive sessions.
10. Do not introduce new refresh-token storage in this custom session.
*/










// 'use client';

// /**
//  * AuroWater — Authentication Hook
//  * Place at: src/hooks/useAuth.ts
//  *
//  * Features:
//  *   • Synchronous first render (no flicker — cache read in useState initialiser)
//  *   • Session expiry: configurable TTL, auto-logout on expiry
//  *   • Cross-tab sync via StorageEvent
//  *   • Role-based permission helpers (isAdmin, can, requireRole)
//  *   • writeSession — typed helper to create/update the session anywhere
//  *   • clearSession — typed helper for programmatic logout without redirect
//  *   • Auth context provider + useAuthContext for shared state
//  *   • Server-side rendering safe (typeof window guards)
//  *   • Zero JSX — valid plain .ts file
//  */

// import React from 'react';
// import { useRouter } from 'next/navigation';
// import { toast } from 'sonner';
// import { clearToken, setToken } from '@/lib/api-client';
// import { clearAuthGateCookies, setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
// import { safeGet, safeRemove, safeSet } from '@/lib/storage';

// /* ═══════════════════════════════════════════════════════════════
//    TYPES
// ═══════════════════════════════════════════════════════════════ */

// export type AuthRole = 'customer' | 'technician' | 'supplier' | 'admin';

// /** Stored in localStorage under SESSION_KEY */
// export interface Session {
//   /** User's full name */
//   name:      string;
//   /** User's email address */
//   email:     string;
//   /** Platform role */
//   role:      AuthRole;
//   /** Must be true for the session to be considered valid */
//   loggedIn:  boolean;
//   /** Unix ms timestamp of login — used for TTL checks */
//   loginTime: number;
//   /** AuroWater unique user ID */
//   aurotapId?: string;
//   /** Optional: user's phone number */
//   phone?:     string;
//   /** Optional: URL to avatar image */
//   avatarUrl?: string;
//   /** Supabase access token — forwarded to API routes as Bearer */
//   accessToken?: string;
//   refreshToken?: string;
//   /** Supabase profile UUID */
//   userId?: string;
// }

// /** Granular action keys for permission checking */
// export type PermissionKey =
//   | 'view:admin_dashboard'
//   | 'view:supplier_dashboard'
//   | 'view:technician_dashboard'
//   | 'view:customer_dashboard'
//   | 'manage:settings'
//   | 'manage:users'
//   | 'manage:orders'
//   | 'manage:finance'
//   | 'create:order'
//   | 'cancel:order'
//   | 'view:earnings'
//   | 'request:payout'
//   | 'accept:job'
//   | 'update:job_status';

// /** Everything useAuth returns */
// export interface UseAuthReturn {
//   /* ── Session data ── */
//   session:    Session | null;
//   /** First name only, or null if not logged in */
//   name:       string | null;
//   /** Full name, or null if not logged in */
//   fullName:   string | null;
//   email:      string | null;
//   role:       AuthRole | null;
//   aurotapId:  string | null;
//   phone:      string | null;
//   avatarUrl:  string | null;
//   /** Alias for header / new screens */
//   user: {
//     email?: string;
//     full_name: string;
//     phone?: string;
//   } | null;
//   loading: boolean;

//   /* ── Status ── */
//   /** true once localStorage has been read (prevents SSR/client mismatch) */
//   hydrated:   boolean;
//   isLoggedIn: boolean;

//   /* ── Role booleans ── */
//   isCustomer:   boolean;
//   isTechnician: boolean;
//   isSupplier:   boolean;
//   isAdmin:      boolean;
//   isSeller:     boolean;
//   isAgent:      boolean;

//   /* ── Permission check ── */
//   /**
//    * Check if the current user has a specific permission.
//    * @example if (can('manage:settings')) { ... }
//    */
//   can: (action: PermissionKey) => boolean;

//   /* ── Actions ── */
//   /**
//    * Sign out: clears storage, shows toast, redirects to `redirectTo` (default: '/').
//    */
//   logout: (options?: { redirectTo?: string; silent?: boolean }) => void;

//   /**
//    * Update fields in the active session without a full re-login.
//    * Only the provided fields are changed; others remain as-is.
//    */
//   updateSession: (patch: Partial<Omit<Session, 'loggedIn' | 'loginTime'>>) => void;

//   /**
//    * Redirect the user to their role-appropriate dashboard.
//    * Call this after a successful login.
//    */
//   redirectToDashboard: () => void;

//   /**
//    * Require authentication. If the user is not logged in (after hydration),
//    * redirects to `redirectTo` (default: '/auth/login').
//    * Returns true if the user IS authenticated (safe to render page content).
//    */
//   requireAuth: (options?: { redirectTo?: string }) => boolean;

//   /**
//    * Require a specific role. If the user does not have the role (after hydration),
//    * redirects to `unauthorizedPath` (default: '/').
//    * Returns true if the user HAS the role.
//    */
//   requireRole: (role: AuthRole | AuthRole[], options?: { unauthorizedPath?: string }) => boolean;
// }

// /* ═══════════════════════════════════════════════════════════════
//    CONSTANTS
// ═══════════════════════════════════════════════════════════════ */

// const SESSION_KEY = 'aurowater_session';

// /** Default session TTL: 7 days in ms */
// const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// /** Role → home dashboard path */
// const DASHBOARD_PATHS: Record<AuthRole, string> = {
//   customer:   '/customer',
//   technician: '/technician',
//   supplier:   '/supplier',
//   admin:      '/admin',
// };

// /** Granular permissions per role */
// const ROLE_PERMISSIONS: Record<AuthRole, PermissionKey[]> = {
//   admin: [
//     'view:admin_dashboard', 'view:supplier_dashboard', 'view:technician_dashboard',
//     'view:customer_dashboard', 'manage:settings', 'manage:users', 'manage:orders',
//     'manage:finance', 'create:order', 'cancel:order', 'view:earnings',
//     'request:payout', 'accept:job', 'update:job_status',
//   ],
//   supplier: [
//     'view:supplier_dashboard', 'view:earnings', 'request:payout',
//     'manage:orders',
//   ],
//   technician: [
//     'view:technician_dashboard', 'accept:job', 'update:job_status',
//     'view:earnings',
//   ],
//   customer: [
//     'view:customer_dashboard', 'create:order', 'cancel:order',
//   ],
// };

// /* ═══════════════════════════════════════════════════════════════
//    PURE HELPERS  (no React deps — independently testable)
// ═══════════════════════════════════════════════════════════════ */

// /** Parse JSON without throwing */
// export function safeParseJSON<T>(raw: string | null): T | null {
//   if (!raw) return null;
//   try { return JSON.parse(raw) as T; } catch { return null; }
// }

// /** Check whether a session is non-expired and fully valid */
// export function isSessionValid(
//   s: Session | null,
//   ttlMs: number = DEFAULT_TTL_MS
// ): boolean {
//   if (!s?.loggedIn || !s.email || !s.name || !s.role) return false;
//   if (!Number.isFinite(s.loginTime)) return false;
//   return Date.now() - s.loginTime < ttlMs;
// }

// /** Get first name from full name */
// function firstName(fullName: string | null | undefined): string | null {
//   if (!fullName?.trim()) return null;
//   return fullName.trim().split(/\s+/)[0];
// }

// /* ═══════════════════════════════════════════════════════════════
//    STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════ */

// function readSession(ttlMs: number): Session | null {
//   const raw = safeGet(SESSION_KEY);
//   const parsed = safeParseJSON<Session>(raw);
//   return isSessionValid(parsed, ttlMs) ? parsed : null;
// }

// /**
//  * Write (or update) a session to localStorage.
//  * Call this from your login flow after a successful API response.
//  *
//  * @example
//  * writeSession({ name: 'Arjun', email: 'arjun@example.com', role: 'admin' });
//  */
// export function writeSession(
//   data: Omit<Session, 'loggedIn' | 'loginTime'> & {
//     loginTime?: number;
//   }
// ): Session {
//   const session: Session = {
//     ...data,
//     loggedIn:  true,
//     loginTime: data.loginTime ?? Date.now(),
//   };
//   if (typeof window !== 'undefined') {
//     safeSet(SESSION_KEY, JSON.stringify(session));
//     if (session.accessToken) {
//       setToken(session.accessToken);
//     }
//     // Decision: mirror role for Edge middleware (see client-gate-cookies.ts).
//     if (session.role) {
//       setAuthGateCookies(session.role);
//     }
//   }
//   return session;
// }

// /**
//  * Clear the session from localStorage without any redirect.
//  * Use this for programmatic logout (e.g. after an API 401).
//  */
// export function clearSession(): void {
//   if (typeof window === 'undefined') return;
//   safeRemove(SESSION_KEY);
//   clearToken();
//   clearAuthGateCookies();
// }

// /* ═══════════════════════════════════════════════════════════════
//    HOOK
// ═══════════════════════════════════════════════════════════════ */

// export function useAuth(ttlMs: number = DEFAULT_TTL_MS): UseAuthReturn {
//   const router = useRouter();

//   /** Start empty so SSR HTML matches the first client render (hydration #418). */
//   const [session, setSession] = React.useState<Session | null>(null);
//   const [hydrated, setHydrated] = React.useState(false);

//   /* ── Hydrate on mount (SSR → client handoff) ── */
//   React.useEffect(() => {
//     const s = readSession(ttlMs);
//     setSession(s);
//     setHydrated(true);
//   }, [ttlMs]);

//   /* ── Auto-logout when session expires ── */
//   React.useEffect(() => {
//     if (!session) return;
//     const remaining = session.loginTime + ttlMs - Date.now();
//     if (remaining <= 0) {
//       clearSession();
//       setSession(null);
//       return;
//     }
//     const id = window.setTimeout(() => {
//       clearSession();
//       setSession(null);
//       toast.error('Your session has expired. Please sign in again.');
//       router.push('/auth/login');
//     }, remaining);
//     return () => window.clearTimeout(id);
//   }, [session, ttlMs, router]);

//   /* ── Cross-tab sync ── */
//   React.useEffect(() => {
//     if (typeof window === 'undefined') return;
//     const onStorage = (e: StorageEvent): void => {
//       if (e.key !== SESSION_KEY) return;
//       if (!e.newValue) {
//         // Logged out in another tab
//         setSession(null);
//         return;
//       }
//       const incoming = safeParseJSON<Session>(e.newValue);
//       setSession(isSessionValid(incoming, ttlMs) ? incoming : null);
//     };
//     window.addEventListener('storage', onStorage);
//     return () => window.removeEventListener('storage', onStorage);
//   }, [ttlMs]);

//   /* ── Actions ── */
//   const logout = React.useCallback(
//     (options: { redirectTo?: string; silent?: boolean } = {}): void => {
//       clearSession();
//       setSession(null);
//       if (!options.silent) {
//         toast.success('Signed out. See you soon! 👋');
//       }
//       router.push(options.redirectTo ?? '/');
//     },
//     [router]
//   );

//   const updateSession = React.useCallback(
//     (patch: Partial<Omit<Session, 'loggedIn' | 'loginTime'>>): void => {
//       setSession(prev => {
//         if (!prev) return null;
//         const next: Session = { ...prev, ...patch };
//         safeSet(SESSION_KEY, JSON.stringify(next));
//         return next;
//       });
//     },
//     []
//   );

//   const redirectToDashboard = React.useCallback((): void => {
//     const path = session?.role ? DASHBOARD_PATHS[session.role] : '/';
//     router.push(path);
//   }, [session?.role, router]);

//   const requireAuth = React.useCallback(
//     (options: { redirectTo?: string } = {}): boolean => {
//       if (!hydrated) return false;
//       if (!session?.loggedIn) {
//         router.push(options.redirectTo ?? '/auth/login');
//         return false;
//       }
//       return true;
//     },
//     [hydrated, session, router]
//   );

//   const requireRole = React.useCallback(
//     (
//       requiredRole: AuthRole | AuthRole[],
//       options: { unauthorizedPath?: string } = {}
//     ): boolean => {
//       if (!hydrated) return false;
//       const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
//       if (!session?.loggedIn || !allowed.includes(session.role)) {
//         router.push(options.unauthorizedPath ?? '/');
//         return false;
//       }
//       return true;
//     },
//     [hydrated, session, router]
//   );

//   /* ── Permission check ── */
//   const can = React.useCallback(
//     (action: PermissionKey): boolean => {
//       if (!session?.role) return false;
//       return ROLE_PERMISSIONS[session.role].includes(action);
//     },
//     [session?.role]
//   );

//   /* ── Derived ── */
//   const isLoggedIn   = isSessionValid(session, ttlMs);
//   const role         = isLoggedIn ? (session?.role ?? null) : null;
//   const isCustomer   = role === 'customer';
//   const isTechnician = role === 'technician';
//   const isSupplier   = role === 'supplier';
//   const isAdmin      = role === 'admin';

//   return {
//     session:    isLoggedIn ? session : null,
//     name:       isLoggedIn ? firstName(session?.name) : null,
//     fullName:   isLoggedIn ? (session?.name ?? null) : null,
//     email:      isLoggedIn ? (session?.email ?? null) : null,
//     role,
//     aurotapId:  isLoggedIn ? (session?.aurotapId ?? null) : null,
//     phone:      isLoggedIn ? (session?.phone ?? null) : null,
//     avatarUrl:  isLoggedIn ? (session?.avatarUrl ?? null) : null,
//     hydrated,
//     isLoggedIn,
//     isCustomer,
//     isTechnician,
//     isSupplier,
//     isAdmin,
//     isSeller: isSupplier,
//     isAgent: isTechnician,
//     user: isLoggedIn && session
//       ? { email: session.email, full_name: session.name, phone: session.phone }
//       : null,
//     loading: !hydrated,
//     can,
//     logout,
//     updateSession,
//     redirectToDashboard,
//     requireAuth,
//     requireRole,
//   };
// }

// /* ═══════════════════════════════════════════════════════════════
//    CONTEXT  — share one auth state across many components
// ═══════════════════════════════════════════════════════════════ */

// const AuthContext = React.createContext<UseAuthReturn | null>(null);

// /**
//  * Wrap your root layout with <AuthProvider> to share auth state
//  * across all components without extra hook calls.
//  *
//  * @example
//  * // app/layout.tsx
//  * export default function RootLayout({ children }) {
//  *   return <AuthProvider>{children}</AuthProvider>;
//  * }
//  */
// export function AuthProvider({
//   children,
//   ttlMs,
// }: {
//   children: React.ReactNode;
//   ttlMs?: number;
// }): React.ReactElement {
//   const value = useAuth(ttlMs);
//   return React.createElement(AuthContext.Provider, { value }, children);
// }

// /**
//  * Consume auth state shared by <AuthProvider>.
//  * Throws if called outside <AuthProvider>.
//  *
//  * @example
//  * const { isLoggedIn, role, can, logout } = useAuthContext();
//  */
// export function useAuthContext(): UseAuthReturn {
//   const ctx = React.useContext(AuthContext);
//   if (!ctx) {
//     throw new Error(
//       'useAuthContext must be called inside <AuthProvider>. ' +
//       'Either wrap your layout with <AuthProvider>, or call useAuth() directly.'
//     );
//   }
//   return ctx;
// }

// /* ═══════════════════════════════════════════════════════════════
//    STANDALONE UTILITIES  (no React — use anywhere)
// ═══════════════════════════════════════════════════════════════ */

// /**
//  * Get the dashboard path for a given role.
//  * @example dashboardPath('admin') → '/admin'
//  */
// export function dashboardPath(role: AuthRole | null | undefined): string {
//   return role ? (DASHBOARD_PATHS[role] ?? '/') : '/';
// }

// /**
//  * Check if a stored session is still valid without mounting a hook.
//  * Useful in middleware or server utilities.
//  */
// export function getSessionFromStorage(ttlMs = DEFAULT_TTL_MS): Session | null {
//   const raw = safeGet(SESSION_KEY);
//   const s   = safeParseJSON<Session>(raw);
//   return isSessionValid(s, ttlMs) ? s : null;
// }

// /**
//  * Get user initials from a full name string.
//  * @example getInitials('Arjun Kumar') → 'AK'
//  */
// export function getInitials(name: string | null | undefined): string {
//   return (name ?? '')
//     .trim()
//     .split(/\s+/)
//     .slice(0, 2)
//     .map(p => p[0]?.toUpperCase() ?? '')
//     .join('') || 'U';
// }

// /* ═══════════════════════════════════════════════════════════════
//    LEGACY COMPATIBILITY  — keeps existing import paths working
// ═══════════════════════════════════════════════════════════════ */

// /**
//  * @deprecated Use writeSession() instead.
//  * Kept so existing login flows don't break.
//  */
// export function saveSession(data: Omit<Session, 'loggedIn' | 'loginTime'>): void {
//   writeSession(data);
// }

// /**
//  * @deprecated Use clearSession() instead.
//  */
// export function removeSession(): void {
//   clearSession();
// }

// /**
//  * @deprecated The `checked` field is now called `hydrated`.
//  * This re-exports the hook with the old field name for backward compat.
//  */
// export function useAuthLegacy(ttlMs?: number) {
//   const auth = useAuth(ttlMs);
//   return { ...auth, checked: auth.hydrated };
// }
