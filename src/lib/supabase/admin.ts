import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';

/** Service-role client for admin operations that bypass RLS. Server-only. */
export function createSupabaseAdmin(): SupabaseClient {
  const key = getSupabaseServiceRoleKey();
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let _admin: SupabaseClient | null = null;

/** Shared admin client (lazy). Prefer createSupabaseAdmin() in new code. */
export function supabaseAdmin(): SupabaseClient {
  if (!_admin) _admin = createSupabaseAdmin();
  return _admin;
}
