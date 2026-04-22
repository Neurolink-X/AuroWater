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
export async function ensureProfileForUser(
  user: User,
  initialData: Partial<Pick<ProfileRow, 'role' | 'city' | 'referred_by'>> = {}
): Promise<ProfileRow | null> {
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return null;
  }

  try {
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const roleFromMeta = mapMetaRoleToProfileRole(meta);
    const role =
      initialData.role === 'admin' ||
      initialData.role === 'supplier' ||
      initialData.role === 'technician' ||
      initialData.role === 'customer'
        ? initialData.role
        : roleFromMeta;

    const full_name =
      typeof meta?.full_name === 'string'
        ? meta.full_name
        : typeof meta?.name === 'string'
          ? meta.name
          : '';
    const phone = typeof meta?.phone === 'string' ? meta.phone : null;
    const avatar_url =
      typeof meta?.avatar_url === 'string'
        ? meta.avatar_url
        : typeof meta?.picture === 'string'
          ? meta.picture
          : null;

    const base = {
      id: user.id,
      email: user.email ?? '',
      full_name,
      phone,
      role,
      city: typeof initialData.city === 'string' ? initialData.city : null,
      referred_by:
        typeof initialData.referred_by === 'string' ? initialData.referred_by : null,
      avatar_url,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('profiles')
      .upsert(base, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[ensureProfileForUser]', error.message ?? error);
      return null;
    }
    return (data ?? null) as ProfileRow | null;
  } catch (e) {
    console.error('[ensureProfileForUser]', e);
    return null;
  }
}

export {
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/supabase/postgrest-errors';
