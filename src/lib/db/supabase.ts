
/**
 * src/lib/db/supabase.ts
 *
 * Browser-safe Supabase helpers for AuroWater / AuroTap.
 *
 * IMPORTANT:
 * - Never import next/headers or server-only modules here.
 * - Never create a service-role client here.
 * - Server-side helpers live in ./supabase-server.ts.
 *
 * Client map:
 *   isSupabaseConfigured()        -> safe configuration check
 *   supabaseBrowser()             -> browser singleton with persisted session
 *   createSupabaseBrowserAuthed() -> browser client with explicit JWT for Realtime
 *
 * Server-only exports:
 *   createSupabaseServerClient()
 *   createSupabaseUserClient()
 *   createSupabaseAnonClient()
 *   supabaseAdmin()
 *
 * Import server-only exports from:
 *   @/lib/db/supabase-server
 */

import {
  createClient as createJsClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

import { createClient as createBrowserClientUtil } from '@/utils/supabase/client';
import { getSupabaseUrl } from '@/lib/env';

// ─── Public environment helpers ──────────────────────────────────────────────

/**
 * Only use public environment variables in browser-reachable code.
 * The URL fallback supports the existing server-side environment convention,
 * but browser builds should configure NEXT_PUBLIC_SUPABASE_URL.
 */
function getUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (publicUrl) {
    try {
      return getSupabaseUrl();
    } catch {
      return publicUrl;
    }
  }

  // SUPABASE_URL is server-only. Do not rely on it in a browser.
  if (typeof window === 'undefined') {
    try {
      return getSupabaseUrl();
    } catch {
      return process.env.SUPABASE_URL?.trim() || '';
    }
  }

  return '';
}

/**
 * Browser clients must use a public anon/publishable key.
 * Never use SUPABASE_SERVICE_ROLE_KEY in browser code.
 */
function getAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ''
  );
}

// ─── Configuration guard ────────────────────────────────────────────────────

/**
 * Returns true when the public Supabase URL and key are available.
 * Safe to call before creating a client.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(getUrl() && getAnonKey());
}

function assertConfigured(caller: string): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `[AuroWater] Supabase is not configured. ${caller} requires:\n` +
        '  NEXT_PUBLIC_SUPABASE_URL\n' +
        '  NEXT_PUBLIC_SUPABASE_ANON_KEY or ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\n' +
        'Configure these in .env.local or Vercel Environment Variables.'
    );
  }
}

// ─── Browser client: singleton ───────────────────────────────────────────────

let _browserSingleton: SupabaseClient | null = null;

/**
 * Browser-only Supabase client.
 *
 * Uses the existing browser client factory to preserve the project's
 * current authentication/session configuration.
 *
 * @throws when called on the server or when public env vars are missing.
 */
export function supabaseBrowser(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error(
      '[AuroWater] supabaseBrowser() must only be called in the browser. ' +
        'Use @/lib/db/supabase-server in server-side code.'
    );
  }

  assertConfigured('supabaseBrowser()');

  if (!_browserSingleton) {
    _browserSingleton = createBrowserClientUtil();
  }

  return _browserSingleton;
}

// ─── Browser client: explicit access token / Realtime ─────────────────────────

/**
 * Creates a browser client using an existing access token.
 *
 * Intended for browser-side Realtime subscriptions that need an explicit JWT.
 * Returns null if configuration or the token is missing.
 *
 * This client does not persist or refresh its own session. The caller is
 * responsible for supplying a valid, current access token.
 */
export function createSupabaseBrowserAuthed(
  accessToken: string
): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = getUrl();
  const anonKey = getAnonKey();
  const token = accessToken?.trim();

  if (!url || !anonKey || !token) {
    return null;
  }

  return createJsClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
