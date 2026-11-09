import { SESSION_MAX_AGE_SECONDS } from './session-lifetime';

export function setAuthGateCookies(role: string, maxAge = SESSION_MAX_AGE_SECONDS): void {
  if (typeof window === 'undefined') return;
  const isHttps = window.location.protocol === 'https:';
  const secure = isHttps ? '; Secure' : '';
  const base = `; path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  document.cookie = `aw_session=1${base}`;
  document.cookie = `aw_role=${encodeURIComponent(role)}${base}`;
}

export function clearAuthGateCookies(): void {
  if (typeof window === 'undefined') return;
  document.cookie = 'aw_session=; path=/; Max-Age=0';
  document.cookie = 'aw_role=; path=/; Max-Age=0';
}
