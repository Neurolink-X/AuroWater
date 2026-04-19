import { createClient as createJsClient, type SupabaseClient } from '@supabase/supabase-js';

import { createClient as createBrowserClientFromUtils } from '@/utils/supabase/client';
import { createClient as createServerClientFromUtils, createServiceClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True when both public Supabase env vars are non-empty. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon);
}

/**
 * Server client for Route Handlers / Server Components (cookie session).
 * Prefer Bearer-token user client in API routes if the app stores the session in localStorage.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClientFromUtils(store);
}

let browserSingleton: SupabaseClient | null = null;

/** Browser client (singleton) — Client Components only. */
export function supabaseBrowser(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('supabaseBrowser() is only available in the browser');
  }
  if (!browserSingleton) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)');
    }
    browserSingleton = createBrowserClientFromUtils();
  }
  return browserSingleton;
}

/**
 * User-scoped client: passes JWT so Postgres RLS sees auth.uid().
 * Use in API routes when the client sends `Authorization: Bearer <access_token>`.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
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

/** Admin / migration only — never import in Client Components. */
export function supabaseAdmin(): SupabaseClient {
  return createServiceClient();
}

/** Anonymous server-side client (no user) — public inserts that RLS allows. */
export function createSupabaseAnonClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  return createJsClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
