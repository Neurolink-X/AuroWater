import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';

/** Browser-only Supabase client (localStorage session). */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
