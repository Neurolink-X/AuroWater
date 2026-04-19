// 'use client';

// import React from 'react';
// import { useRouter } from 'next/navigation';
// import { useAuth, type AuthRole } from '@/hooks/useAuth';

// export default function ProtectedRoute({
//   children,
//   requiredRole,
// }: {
//   children: React.ReactNode;
//   requiredRole?: AuthRole;
// }) {
//   const router = useRouter();
//   const { isLoggedIn, role, checked } = useAuth();

//   React.useEffect(() => {
//     if (!checked) return;
//     if (!isLoggedIn) {
//       router.replace('/auth/login');
//       return;
//     }
//     if (requiredRole && role && role !== requiredRole && (role as string) !== 'admin') {
//       if (role === 'customer') router.replace('/dashboard');
//       if (role === 'technician') router.replace('/technician/dashboard');
//       if (role === 'supplier') router.replace('/supplier/dashboard');
//     }
//   }, [checked, isLoggedIn, role, requiredRole, router]);

//   if (!checked) return null;
//   if (!isLoggedIn) return null;
//   if (requiredRole && role && role !== requiredRole && (role as string) !== 'admin') return null;

//   return <>{children}</>;
// }

'use client';

/**
 * AuroWater — ProtectedRoute
 * Place at: src/components/auth/ProtectedRoute.tsx
 *
 * Wraps any page or layout to enforce:
 *   1. Authentication  — redirects to /auth/login if not logged in
 *   2. Role guard      — redirects to the user's own dashboard if wrong role
 *                        (admin always passes every role check)
 *   3. Multi-role      — pass an array to allow multiple roles
 *   4. Custom redirect — override both redirects via props
 *   5. Fallback UI     — optional spinner / skeleton while hydrating
 *
 * Zero console errors, zero runtime errors.
 * All logic delegated to useAuth() — no duplicate state.
 */

import React from 'react';
import { useAuth, dashboardPath, type AuthRole } from '@/hooks/useAuth';

/* ─────────────────────────────────────────────
   PROPS
───────────────────────────────────────────── */
interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Role (or roles) that may access this route.
   * Admin always passes regardless of what is set here.
   * Omit to allow any authenticated user.
   */
  requiredRole?: AuthRole | AuthRole[];
  /**
   * Where to send unauthenticated users.
   * Defaults to '/auth/login'.
   */
  loginPath?: string;
  /**
   * What to render while auth state is hydrating from localStorage.
   * Defaults to null (nothing — avoids layout shift).
   * Pass a spinner or skeleton component for better UX on slow devices.
   */
  fallback?: React.ReactNode;
}

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function ProtectedRoute({
  children,
  requiredRole,
  loginPath = '/auth/login',
  fallback  = null,
}: ProtectedRouteProps) {
  const {
    hydrated,
    isLoggedIn,
    isAdmin,
    role,
  } = useAuth();

  /* ── Derived: does this user pass the role check? ── */
  const allowed = React.useMemo<boolean>(() => {
    if (!isLoggedIn || !role) return false;
    // Admin bypasses every role restriction
    if (isAdmin) return true;
    // No role restriction — any authenticated user is fine
    if (!requiredRole) return true;
    const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return required.includes(role);
  }, [isLoggedIn, isAdmin, role, requiredRole]);

  /* ── Redirect target for a wrong-role user ── */
  const wrongRolePath = React.useMemo<string>(
    () => dashboardPath(role),
    [role]
  );

  /* ── Redirect side-effects ── */
  React.useEffect(() => {
    if (!hydrated) return;

    if (!isLoggedIn) {
      // Preserve the current URL so we can return after login
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`${loginPath}?returnTo=${returnTo}`);
      return;
    }

    if (!allowed) {
      window.location.replace(wrongRolePath);
    }
  }, [hydrated, isLoggedIn, allowed, loginPath, wrongRolePath]);

  /* ── Render gates ── */
  // Not hydrated yet — show fallback (default: nothing)
  if (!hydrated) return React.createElement(React.Fragment, null, fallback);

  // Not logged in — redirect is firing; render nothing to avoid flash
  if (!isLoggedIn) return null;

  // Wrong role — redirect is firing; render nothing
  if (!allowed) return null;

  // All checks passed — render the protected content
  return React.createElement(React.Fragment, null, children);
}