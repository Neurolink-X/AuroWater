
/**
 * src/lib/db/supabase-server.ts
 *
 * Server-only Supabase client factory for AuroTap.
 *
 * Use only in server-side App Router code:
 * - Server Components
 * - App Router Route Handlers
 *
 * Never import this module into Client Components.
 * Do not import it from code that is compiled for the browser.
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

/**
 * Fail clearly when required public Supabase configuration is missing.
 */
function assertServerSupabaseConfigured(caller: string): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `[AuroWater] Supabase is not configured. ${caller} requires ` +
        'NEXT_PUBLIC_SUPABASE_URL and a public Supabase anon/publishable key.'
    );
  }
}

/**
 * Cookie-based client for App Router Server Components and Route Handlers.
 *
 * The caller must not assume this automatically authenticates or authorizes
 * a user. Protected operations must still verify the user's identity and role.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  assertServerSupabaseConfigured('createSupabaseServerClient()');

  const cookieStore = await cookies();
  return createServerClientUtil(cookieStore);
}

/**
 * User-scoped client for requests with a previously verified access token.
 *
 * Verify the token with the application's authentication guard before using
 * this client for protected operations. RLS remains enabled.
 */
export function createSupabaseUserClient(
  accessToken: string
): SupabaseClient {
  assertServerSupabaseConfigured('createSupabaseUserClient()');

  if (!accessToken?.trim()) {
    throw new Error(
      '[AuroWater] createSupabaseUserClient() requires an access token.'
    );
  }

  return createUserClient(accessToken);
}

/**
 * Anonymous server client for public operations.
 * Database access remains subject to the anon role's RLS policies.
 */
export function createSupabaseAnonClient(): SupabaseClient {
  assertServerSupabaseConfigured('createSupabaseAnonClient()');

  return createAnonClient();
}

/**
 * Privileged service-role client.
 *
 * Bypasses RLS. Use only for operations that genuinely require elevated
 * privileges and enforce authorization before calling this function.
 */
export function supabaseAdmin(): SupabaseClient {
  return createServiceClient();
}

/** @deprecated Use supabaseAdmin(). */
export const createSupabaseServiceClient = supabaseAdmin;
