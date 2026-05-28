import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';

/** Cookie-session Supabase client for Server Components / Route Handlers. */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

/** Anonymous server client (no cookies) for public route handlers. */
export function createAnonServerClient() {
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
