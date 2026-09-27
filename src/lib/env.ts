/**
 * Central environment configuration.
 *
 * RULES:
 * - NEVER use NEXT_PUBLIC_APP_URL for browser fetch() URLs.
 * - Browser API calls must always be same-origin relative paths (/api/...).
 * - NEXT_PUBLIC_APP_URL is metadata-only (sitemap, OG, canonical URLs).
 * - NEXT_PUBLIC_API_URL is deprecated — do not use for fetch base URLs.
 */

const DEFAULT_SITE_URL = 'https://aurotap.in';

/** Canonical public site URL (server/metadata only). */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    DEFAULT_SITE_URL;

  if (!raw) return DEFAULT_SITE_URL;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

/** True when running a local dev server URL in env (misconfiguration guard). */
export function isLocalhostSiteUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Live AuroWater project. Do not use any other ref. */
export const CANONICAL_SUPABASE_REF = 'mwfcwhxdlnqldciigicl';
const WRONG_SUPABASE_REF = 'nozizhfliljitspkgjix';

export function getSupabaseUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (url.includes(WRONG_SUPABASE_REF)) {
    console.error(
      `[AuroWater] Env points at the wrong Supabase project (${WRONG_SUPABASE_REF}). ` +
        `Using https://${CANONICAL_SUPABASE_REF}.supabase.co — update Vercel/.env keys to match.`
    );
    url = url.replace(WRONG_SUPABASE_REF, CANONICAL_SUPABASE_REF);
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return key;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

/** Validates required env vars at startup (server-side). */
export function validateEnv(): void {
  const serverRequired: Array<[string, string]> = [
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key (server only)'],
  ];

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push('  NEXT_PUBLIC_SUPABASE_URL — Supabase project URL');
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  ) {
    missing.push('  NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon/publishable key');
  }
  if (typeof window === 'undefined') {
    for (const [key, label] of serverRequired) {
      if (!process.env[key]?.trim()) {
        missing.push(`  ${key} — ${label}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `[AuroWater] Missing required environment variables:\n${missing.join('\n')}\n\n` +
        'Copy .env.example to .env.local and fill in the values.'
    );
  }
}

export function getOptionalEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function getAdminInviteCode(): string {
  const code = process.env.ADMIN_INVITE_CODE?.trim();
  if (!code) {
    console.warn('[AuroWater] ADMIN_INVITE_CODE not set — admin registration disabled');
    return '';
  }
  return code;
}

/** Node environment label. */
export function getNodeEnv(): string {
  return process.env.NODE_ENV ?? 'development';
}

export function isProduction(): boolean {
  return getNodeEnv() === 'production';
}
