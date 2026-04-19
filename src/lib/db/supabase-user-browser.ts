'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Browser-only Supabase client authenticated with the user JWT (matches API route behaviour; avoids importing `supabase.ts` which pulls server-only deps). */
export function createSupabaseBrowserAuthed(accessToken: string): SupabaseClient | null {
  if (!url || !anon || !accessToken) return null;
  return createClient(url, anon, {
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
