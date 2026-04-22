// import { createClient as createJsClient, type SupabaseClient } from '@supabase/supabase-js';

// import { createClient as createBrowserClientFromUtils } from '@/utils/supabase/client';
// import { createClient as createServerClientFromUtils, createServiceClient } from '@/utils/supabase/server';
// import { cookies } from 'next/headers';

// const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// const anon =
//   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// /** True when both public Supabase env vars are non-empty. */
// export function isSupabaseConfigured(): boolean {
//   return Boolean(url && anon);
// }

// /**
//  * Server client for Route Handlers / Server Components (cookie session).
//  * Prefer Bearer-token user client in API routes if the app stores the session in localStorage.
//  */
// export async function createSupabaseServerClient(): Promise<SupabaseClient> {
//   const store = await cookies();
//   return createServerClientFromUtils(store);
// }

// let browserSingleton: SupabaseClient | null = null;

// /** Browser client (singleton) — Client Components only. */
// export function supabaseBrowser(): SupabaseClient {
//   if (typeof window === 'undefined') {
//     throw new Error('supabaseBrowser() is only available in the browser');
//   }
//   if (!browserSingleton) {
//     if (!isSupabaseConfigured()) {
//       throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)');
//     }
//     browserSingleton = createBrowserClientFromUtils();
//   }
//   return browserSingleton;
// }

// /**
//  * User-scoped client: passes JWT so Postgres RLS sees auth.uid().
//  * Use in API routes when the client sends `Authorization: Bearer <access_token>`.
//  */
// export function createSupabaseUserClient(accessToken: string): SupabaseClient {
//   if (!isSupabaseConfigured()) {
//     throw new Error('Supabase is not configured');
//   }
//   return createJsClient(url, anon, {
//     auth: {
//       persistSession: false,
//       autoRefreshToken: false,
//       detectSessionInUrl: false,
//     },
//     global: {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     },
//   });
// }

// /**
//  * Admin / migration only — never import in Client Components.
//  * Requires `SUPABASE_SERVICE_ROLE_KEY` (see `instrumentation.ts` startup log if missing).
//  */
// export function supabaseAdmin(): SupabaseClient {
//   return createServiceClient();
// }

// /** Anonymous server-side client (no user) — public inserts that RLS allows. */
// export function createSupabaseAnonClient(): SupabaseClient {
//   if (!isSupabaseConfigured()) {
//     throw new Error('Supabase is not configured');
//   }
//   return createJsClient(url, anon, {
//     auth: { persistSession: false, autoRefreshToken: false },
//   });
// }



/**
 * src/lib/supabase.ts
 *
 * Single source of truth for all Supabase clients in AuroWater.
 * Import from here — do NOT import directly from @supabase/supabase-js
 * or @/utils/supabase/* in app code (those are implementation details).
 *
 * Client map:
 *   supabaseBrowser()          → Client Components (singleton, localStorage session)
 *   createSupabaseUserClient() → API routes with Bearer JWT (RLS sees auth.uid())
 *   createSupabaseServerClient() → Server Components / Route Handlers (cookie session)
 *   supabaseAdmin()            → Server-only: service role, bypasses RLS
 *   createSupabaseBrowserAuthed() → Browser-only realtime with known access token
 *   isSupabaseConfigured()     → guard before any client creation
 */

import {
  createClient as createJsClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { createClient as createBrowserClientUtil } from '@/utils/supabase/client';
import { createClient as createServerClientUtil, createServiceClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

/* ── Env ── */
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  '';
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ?? // some hosting aliases
  '';

/* ══════════════════════════════════════════════════
   GUARDS
══════════════════════════════════════════════════ */

/** Returns `true` when the minimum public env vars are set. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon);
}

/** Throws a clear error if public env vars are missing. */
function assertConfigured(caller: string): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `[AuroWater] Supabase is not configured. ` +
        `${caller} requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. ` +
        `Copy .env.example → .env.local and fill in the values.`,
    );
  }
}

/* ══════════════════════════════════════════════════
   BROWSER CLIENT  (Client Components)
══════════════════════════════════════════════════ */

let _browserSingleton: SupabaseClient | null = null;

/**
 * Browser-only Supabase client.
 * Stores the session in `localStorage` and auto-refreshes the JWT.
 * Returns the same instance on every call (singleton).
 *
 * @throws if called outside the browser or env vars are missing.
 *
 * @example
 * const { data, error } = await supabaseBrowser().from('service_types').select();
 */
export function supabaseBrowser(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error(
      '[AuroWater] supabaseBrowser() must only be called in the browser. ' +
        'Use createSupabaseServerClient() in Server Components / Route Handlers.',
    );
  }
  assertConfigured('supabaseBrowser()');
  if (!_browserSingleton) {
    _browserSingleton = createBrowserClientUtil();
  }
  return _browserSingleton;
}

/* ══════════════════════════════════════════════════
   BROWSER — AUTHED WITH KNOWN ACCESS TOKEN
   (for Realtime subscriptions in Client Components
    when the session is stored in localStorage by useAuth)
══════════════════════════════════════════════════ */

/**
 * Creates a browser-side Supabase client authenticated with `accessToken`.
 * Use when you need Realtime with a specific user JWT and do not want
 * the singleton (e.g. customer track page subscriptions).
 *
 * Returns `null` when any parameter is missing so callers can bail out gracefully.
 *
 * @example
 * const client = createSupabaseBrowserAuthed(token);
 * if (!client) return;
 * client.channel('order-' + orderId).on('postgres_changes', ...).subscribe();
 */
export function createSupabaseBrowserAuthed(accessToken: string): SupabaseClient | null {
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

/* ══════════════════════════════════════════════════
   SERVER CLIENT  (Server Components / Route Handlers)
══════════════════════════════════════════════════ */

/**
 * Server-side Supabase client that reads the session from cookies.
 * For use in Server Components and Route Handlers.
 *
 * In API routes that receive `Authorization: Bearer` from the client,
 * prefer `createSupabaseUserClient(token)` instead — it is faster
 * (no cookie round-trip) and more explicit about which user is acting.
 *
 * @example
 * // In a Server Component:
 * const supabase = await createSupabaseServerClient();
 * const { data } = await supabase.from('profiles').select('*').single();
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClientUtil(store);
}

/* ══════════════════════════════════════════════════
   USER CLIENT  (API Routes — Bearer JWT)
══════════════════════════════════════════════════ */

/**
 * Creates a Supabase client that sends the user's JWT on every request.
 * Postgres RLS evaluates `auth.uid()` correctly when this client is used.
 *
 * Use this in every `POST /api/customer/*`, `GET /api/supplier/*`, etc.
 * after verifying the token with `requireSupabaseAuth()`.
 *
 * @example
 * const supabase = createSupabaseUserClient(accessToken);
 * const { data, error } = await supabase.from('orders').select().eq('customer_id', userId);
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  assertConfigured('createSupabaseUserClient()');
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

/* ══════════════════════════════════════════════════
   ADMIN CLIENT  (Service Role — Server Only)
══════════════════════════════════════════════════ */

/**
 * Returns a Supabase client that uses the **service role** key.
 * Bypasses RLS entirely. Use only for:
 *   - ensureProfileForUser() (profile bootstrap on register)
 *   - Server-side notification inserts
 *   - Admin API routes
 *   - SQL migration helpers
 *
 * ⚠ NEVER import or call this from Client Components or expose the key to the browser.
 *
 * @throws if SUPABASE_SERVICE_ROLE_KEY is not set (returns a clear actionable message).
 *
 * @example
 * const admin = supabaseAdmin();
 * await admin.from('profiles').upsert({ id, email, role: 'customer' });
 */
export function supabaseAdmin(): SupabaseClient {
  if (!serviceRole) {
    throw new Error(
      '[AuroWater] SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
        '  1. Open https://supabase.com/dashboard/project/mwfcwhxdlnqldciigicl/settings/api\n' +
        '  2. Copy the "service_role" secret key.\n' +
        '  3. Add SUPABASE_SERVICE_ROLE_KEY=<key> to .env.local\n' +
        '  4. Restart: npm run dev\n',
    );
  }
  return createServiceClient();
}

/** Alias kept for backward compat with older imports. @deprecated Use supabaseAdmin() */
export const createSupabaseServiceClient = supabaseAdmin;

/* ══════════════════════════════════════════════════
   ANON CLIENT  (public read — no user)
══════════════════════════════════════════════════ */

/**
 * Anonymous server-side client.
 * For public reads that RLS allows without a user (e.g. GET /api/settings, GET /api/services).
 * Falls back to this when service role is not set.
 */
export function createSupabaseAnonClient(): SupabaseClient {
  assertConfigured('createSupabaseAnonClient()');
  return createJsClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}