// import { createServerClient } from '@supabase/ssr';
// import { cookies } from 'next/headers';

// import {
//   getSupabaseServiceRoleKey,
//   serviceRoleSetupHint,
// } from '@/lib/env/supabase-service-role';

// const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const key =
//   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) =>
//   createServerClient(url, key, {
//     cookies: {
//       getAll: () => cookieStore.getAll(),
//       setAll: (
//         cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
//       ) => {
//         try {
//           cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
//         } catch {
//           /* Server Component — middleware handles refresh */
//         }
//       },
//     },
//   });

// /** Service-role client — API routes only, NEVER client-side */
// export const createServiceClient = () => {
//   const serviceKey = getSupabaseServiceRoleKey();
//   if (!serviceKey) {
//     console.error(serviceRoleSetupHint());
//     throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
//   }
//   return createServerClient(url, serviceKey, {
//     cookies: { getAll: () => [], setAll: () => {} },
//   });
// };



/**
 * src/utils/supabase/server.ts
 * Server-only Supabase clients. Never import in Client Components.
 */
import { createServerClient } from '@supabase/ssr';
import { type cookies } from 'next/headers';
import {
  getSupabaseServiceRoleKey,
  serviceRoleSetupHint,
} from '@/lib/env/supabase-service-role';

// ─── Env resolution (lazy, never module-level crash) ─────────────────────────

function getUrl(): string {
  const val =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();           // Vercel integration alias
  if (!val) throw new Error(
    '[AuroWater] NEXT_PUBLIC_SUPABASE_URL is not set.\n' +
    '  Add it to .env.local or Vercel Environment Variables.'
  );
  return val;
}

function getAnonKey(): string {
  const val =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();      // Vercel integration alias
  if (!val) throw new Error(
    '[AuroWater] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.\n' +
    '  Add it to .env.local or Vercel Environment Variables.'
  );
  return val;
}

// ─── Cookie-based client (Server Components / Route Handlers) ─────────────────

/**
 * Cookie-session Supabase client.
 * Pass the awaited cookies() store from next/headers.
 *
 * @example
 * const store = await cookies();
 * const sb = createClient(store);
 */
export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>
) =>
  createServerClient(getUrl(), getAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (
        cookiesToSet: Array<{
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }>
      ) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — middleware handles cookie refresh, safe to ignore
        }
      },
    },
  });

// ─── Service-role client (Admin API routes only) ──────────────────────────────

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 * Use only in admin API routes and server-side bootstrapping.
 * NEVER call from Client Components or expose to the browser.
 *
 * @throws if SUPABASE_SERVICE_ROLE_KEY is not set
 *
 * @example
 * const sb = createServiceClient();
 * await sb.from('profiles').upsert({ id, role: 'customer' });
 */
export const createServiceClient = () => {
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey) {
    console.error(serviceRoleSetupHint());
    throw new Error(
      '[AuroWater] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'See server logs for setup instructions.'
    );
  }
  return createServerClient(getUrl(), serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
};

// ─── Stateless anon client (public API routes, no cookies needed) ─────────────

/**
 * Anonymous server client — no session, no cookies.
 * For public read-only routes like GET /api/settings, GET /api/services.
 *
 * @example
 * const sb = createAnonClient();
 * const { data } = await sb.from('settings').select('key, value');
 */
export const createAnonClient = () =>
  createServerClient(getUrl(), getAnonKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });

// ─── User JWT client (Bearer token API routes) ────────────────────────────────

/**
 * Supabase client scoped to a specific user JWT.
 * RLS sees auth.uid() correctly when this client is used.
 * Use after verifying the token with requireSupabaseAuth().
 *
 * @example
 * const sb = createUserClient(accessToken);
 * const { data } = await sb.from('orders').select().eq('customer_id', userId);
 */
export const createUserClient = (accessToken: string) =>
  createServerClient(getUrl(), getAnonKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
