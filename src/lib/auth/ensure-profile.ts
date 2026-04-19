import type { User } from '@supabase/supabase-js';

import type { ProfileRow, ProfileRole } from '@/lib/db/types';
import { createServiceClient } from '@/utils/supabase/server';

function mapMetaRoleToProfileRole(meta: Record<string, unknown> | undefined): ProfileRole {
  const r = typeof meta?.role === 'string' ? meta.role.toLowerCase() : 'customer';
  if (r === 'admin' || r === 'supplier' || r === 'technician' || r === 'customer') {
    return r;
  }
  return 'customer';
}

/**
 * Ensures a `profiles` row exists for a Supabase Auth user (service role).
 * Call only after the user has authenticated (e.g. password sign-in).
 * Returns null if the table is missing, service role is not configured, or insert fails.
 */
export async function ensureProfileForUser(user: User): Promise<ProfileRow | null> {
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return null;
  }

  const { data: existing, error: readErr } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr) {
    return null;
  }
  if (existing) {
    return existing as ProfileRow;
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const role = mapMetaRoleToProfileRole(meta);
  const full_name = typeof meta?.full_name === 'string' ? meta.full_name : '';
  const phone = typeof meta?.phone === 'string' ? meta.phone : null;

  const { data: inserted, error: insErr } = await admin
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name,
      phone,
      role,
    })
    .select('*')
    .single();

  if (insErr || !inserted) {
    return null;
  }
  return inserted as ProfileRow;
}

export function isProfilesSchemaMissingError(err: { message?: string; code?: string } | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find the table')
  );
}
