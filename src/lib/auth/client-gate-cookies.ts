/**
 * Decision: Edge middleware cannot read localStorage/Bearer tokens.
 * After login/register we mirror `profiles.role` into first-party cookies so
 * `src/middleware.ts` can gate routes without a DB round-trip.
 * These are not secrets — API routes still enforce Supabase RLS + Bearer auth.
 */

export const AUTH_ROLE_COOKIE = 'aw_role';
export const AUTH_SESSION_COOKIE = 'aw_session';

const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days — aligned with useAuth default TTL

export function setAuthGateCookies(role: string): void {
  if (typeof document === 'undefined') return;
  const safe = encodeURIComponent(role);
  document.cookie = `${AUTH_ROLE_COOKIE}=${safe}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
  document.cookie = `${AUTH_SESSION_COOKIE}=1; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
}

export function clearAuthGateCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${AUTH_ROLE_COOKIE}=; path=/; max-age=0`;
}
