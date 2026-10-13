/**
 * src/lib/db/supabase.ts
 *
 * Central Supabase client factory for AuroWater.
 * All app code imports from here — never directly from @supabase/supabase-js
 * or @/utils/supabase/* (those are implementation details).
 *
 * Client map:
 *   isSupabaseConfigured()       → guard before any client creation
 *   supabaseBrowser()            → Client Components (singleton, localStorage session)
 *   createSupabaseBrowserAuthed()→ Client Components with known access token (Realtime)
 *   createSupabaseServerClient() → Server Components / Route Handlers (cookie session)
 *   createSupabaseUserClient()   → API routes with Bearer JWT (RLS sees auth.uid())
 *   createSupabaseAnonClient()   → Public API routes (no user, no cookies)
 *   supabaseAdmin()              → Server-only: service role, bypasses RLS
 */

// import {
//   createClient as createJsClient,
//   type SupabaseClient,
// } from '@supabase/supabase-js';
// import { createClient as createBrowserClientUtil } from '@/utils/supabase/client';
// import {
//   createClient as createServerClientUtil,
//   createServiceClient,
//   createAnonClient,
//   createUserClient,
// } from '@/utils/supabase/server';
// import { cookies } from 'next/headers';
// import { getSupabaseUrl } from '@/lib/env';

import { createClient as createBrowserClientUtil } from '@/utils/supabase/client';
import { getSupabaseUrl } from '@/lib/env';

// ─── Env (lazy helpers — no module-level crash) ───────────────────────────────

function getUrl(): string {
  try {
    return getSupabaseUrl();
  } catch {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim() ||
      ''
    );
  }
}

function getAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    ''
  );
}

// ─── Guards ───────────────────────────────────────────────────────────────────

/** Returns true when the minimum public env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(getUrl() && getAnonKey());
}

function assertConfigured(caller: string): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `[AuroWater] Supabase is not configured. ${caller} requires:\n` +
      `  NEXT_PUBLIC_SUPABASE_URL\n` +
      `  NEXT_PUBLIC_SUPABASE_ANON_KEY\n` +
      `  Copy .env.example → .env.local and fill in the values,\n` +
      `  or add them to Vercel → auro-water → Environment Variables.`
    );
  }
}

// ─── Browser client (Client Components) ──────────────────────────────────────

let _browserSingleton: SupabaseClient | null = null;

/**
 * Browser-only Supabase client (singleton).
 * Stores session in localStorage and auto-refreshes JWT.
 * @throws if called server-side or env vars are missing.
 */
export function supabaseBrowser(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error(
      '[AuroWater] supabaseBrowser() must only be called in the browser. ' +
      'Use createSupabaseServerClient() in Server Components / Route Handlers.'
    );
  }
  assertConfigured('supabaseBrowser()');
  if (!_browserSingleton) {
    _browserSingleton = createBrowserClientUtil();
  }
  return _browserSingleton;
}

// ─── Browser authed client (Realtime with known token) ────────────────────────

/**
 * Browser-side client with explicit access token.
 * Use for Realtime subscriptions when session is in localStorage.
 * Returns null if any parameter is missing — callers can bail safely.
 */
export function createSupabaseBrowserAuthed(
  accessToken: string
): SupabaseClient | null {
  const url = getUrl();
  const anon = getAnonKey();
  if (!url || !anon || !accessToken) return null;
  return createJsClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

// ─── Server client (cookie session) ──────────────────────────────────────────

/**
 * Cookie-based server client for Server Components and Route Handlers.
 * For API routes receiving Authorization: Bearer, use createSupabaseUserClient().
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClientUtil(store);
}

// ─── User client (Bearer JWT, RLS-aware) ─────────────────────────────────────

/**
 * API-route client scoped to a user JWT.
 * RLS evaluates auth.uid() correctly.
 * Use after requireSupabaseAuth() in every customer/supplier/technician route.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  assertConfigured('createSupabaseUserClient()');
  return createUserClient(accessToken);
}

// ─── Anon client (public reads, no user) ─────────────────────────────────────

/**
 * Anonymous server-side client.
 * For public routes: GET /api/settings, GET /api/services, GET /api/stats.
 * No cookies, no JWT — respects RLS policies for anon role.
 */
export function createSupabaseAnonClient(): SupabaseClient {
  assertConfigured('createSupabaseAnonClient()');
  return createAnonClient();
}

// ─── Admin client (service role, bypasses RLS) ────────────────────────────────

/**
 * Service-role client. Bypasses RLS entirely.
 * Use only for: profile bootstrap, notification inserts, admin routes.
 * NEVER import in Client Components.
 * @throws if SUPABASE_SERVICE_ROLE_KEY is not set.
 */
export function supabaseAdmin(): SupabaseClient {
  return createServiceClient();
}

/** @deprecated Use supabaseAdmin() */
export const createSupabaseServiceClient = supabaseAdmin;
