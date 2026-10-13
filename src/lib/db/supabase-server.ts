
/**
 * src/lib/db/supabase-server.ts
 *
 * Server-only Supabase client factory for AuroTap.
 *
 * Responsibilities:
 * - Cookie-session clients for App Router Server Components and Route Handlers.
 * - User-scoped clients for verified Bearer JWTs, with RLS enabled.
 * - Anonymous clients for public operations.
 * - Service-role clients for explicitly authorized privileged operations.
 *
 * SECURITY:
 * - Never import this module into Client Components.
 * - Never expose the service-role key to the browser.
 * - Creating a client does not replace authentication or authorization.
 * - Use the application's existing auth and role guards on protected routes.
 */

import 'server-only';

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createClient as createServerClientUtil,
  createServiceClient,
  createAnonClient,
  createUserClient,
} from '@/utils/supabase/server';

import { isSupabaseConfigured } from '@/lib/db/supabase';

// ─── Configuration guard ─────────────────────────────────────────────────────

/**
 * Check public Supabase configuration before creating anon/user clients.
 * Service-role configuration is validated separately by createServiceClient().
 */
function assertServerSupabaseConfigured(caller: string): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `[AuroTap] Supabase is not configured. ${caller} requires ` +
        'NEXT_PUBLIC_SUPABASE_URL and a public anon/publishable key. ' +
        'Check the Vercel Environment Variables for the correct deployment.'
    );
  }
}

// ─── Cookie-session client ───────────────────────────────────────────────────

/**
 * Create a cookie-session client for App Router server code.
 *
 * Next.js 15+ exposes cookies() as an async API, so it must be awaited.
 * This client can read the request's Supabase session cookies.
 *
 * Note:
 * A valid session is not proof that the caller has permission to perform
 * every operation. Continue to enforce application-level authorization.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  assertServerSupabaseConfigured('createSupabaseServerClient()');

  const cookieStore = await cookies();

  return createServerClientUtil(cookieStore);
}

// ─── Bearer-token user client ─────────────────────────────────────────────────

/**
 * Create a user-scoped Supabase client for a Bearer access token.
 *
 * IMPORTANT:
 * Call the existing authentication guard first. This factory checks that
 * a token was supplied; it does not independently verify the token or role.
 *
 * The underlying client uses the public key and the supplied JWT, allowing
 * Supabase RLS policies to evaluate auth.uid() for that user.
 */
export function createSupabaseUserClient(
  accessToken: string
): SupabaseClient {
  assertServerSupabaseConfigured('createSupabaseUserClient()');

  const token = accessToken?.trim();

  if (!token) {
    throw new Error(
      '[AuroTap] createSupabaseUserClient() requires a non-empty access token.'
    );
  }

  return createUserClient(token);
}

// ─── Anonymous client ────────────────────────────────────────────────────────

/**
 * Create a stateless anonymous client for public operations.
 *
 * Access is still governed by the Supabase anon role and database RLS policies.
 * Do not use this client to bypass authentication on protected operations.
 */
export function createSupabaseAnonClient(): SupabaseClient {
  assertServerSupabaseConfigured('createSupabaseAnonClient()');

  return createAnonClient();
}

// ─── Admin / service-role client ──────────────────────────────────────────────

/**
 * Create a privileged service-role client.
 *
 * Service-role clients bypass RLS. Only call this from trusted server-side
 * code after the route has enforced the required authorization.
 *
 * The underlying factory checks SUPABASE_SERVICE_ROLE_KEY and throws if it
 * is missing. Do not silently fall back to an anonymous client.
 */
export function supabaseAdmin(): SupabaseClient {
  return createServiceClient();
}

/**
 * Backward-compatible alias for existing imports.
 *
 * Prefer supabaseAdmin() in new code.
 *
 * @deprecated Use supabaseAdmin().
 */
export const createSupabaseServiceClient = supabaseAdmin;
