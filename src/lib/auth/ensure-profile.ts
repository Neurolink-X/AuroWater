import type { User } from '@supabase/supabase-js';

import type { ProfileRow, ProfileRole } from '@/lib/db/types';
import { createServiceClient } from '@/utils/supabase/server';

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function profileName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (typeof meta?.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim();
  if (typeof meta?.name === 'string' && meta.name.trim()) return meta.name.trim();
  return '';
}

/**
 * Safely ensure a profile exists after authentication.
 *
 * Existing profile role/status/phone are never overwritten with defaults or
 * null values. This is important for supplier, technician and admin accounts:
 * a Google/email login must not downgrade a privileged profile to customer.
 */
export async function ensureProfileForUser(
  user: User,
  initialData: Partial<Pick<ProfileRow, 'role' | 'city' | 'referred_by'>> = {},
): Promise<ProfileRow | null> {
  let admin;
  try {
    admin = createServiceClient();
  } catch (error) {
    console.error('[ensureProfileForUser] Service client unavailable', error);
    return null;
  }

  try {
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const metadataPhone = normalizePhone(meta?.phone) ?? normalizePhone(user.phone);
    const fullName = profileName(user);
    const avatarUrl =
      typeof meta?.avatar_url === 'string' ? meta.avatar_url :
      typeof meta?.picture === 'string' ? meta.picture : null;
    const city =
      typeof initialData.city === 'string' && initialData.city.trim()
        ? initialData.city.trim()
        : typeof meta?.city === 'string' && meta.city.trim()
          ? meta.city.trim()
          : null;

    const { data: existing, error: readError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (readError) {
      console.error('[ensureProfileForUser] Profile lookup failed', {
        userId: user.id, code: readError.code, message: readError.message,
      });
      return null;
    }

    if (existing) {
      // Patch only missing/changed identity fields; preserve role, status,
      // activation flags and an already verified phone number.
      const patch: Record<string, unknown> = {
        email: user.email ?? existing.email ?? '',
        updated_at: new Date().toISOString(),
      };
      if (!existing.full_name && fullName) patch.full_name = fullName;
      if (!existing.phone && metadataPhone) patch.phone = metadataPhone;
      if (!existing.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;
      if (!existing.city && city) patch.city = city;

      const { data, error } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select('*')
        .maybeSingle();

      if (error || !data) {
        console.error('[ensureProfileForUser] Existing profile refresh failed', {
          userId: user.id, code: error?.code, message: error?.message,
        });
        return existing as ProfileRow;
      }
      return data as ProfileRow;
    }

    // No profile exists. Normal OAuth users default to customer. Privileged
    // roles are accepted only when explicitly passed by a trusted server flow.
    const requestedRole = initialData.role;
    const role: ProfileRole =
      requestedRole === 'supplier' || requestedRole === 'technician' ||
      requestedRole === 'admin' || requestedRole === 'customer'
        ? requestedRole
        : 'customer';

    const row = {
      id: user.id,
      email: user.email ?? '',
      full_name: fullName || 'User',
      phone: metadataPhone,
      role,
      status: role === 'supplier' || role === 'technician' ? 'pending_approval' : 'active',
      city,
      referred_by: initialData.referred_by ?? null,
      avatar_url: avatarUrl,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await admin
      .from('profiles')
      .insert(row)
      .select('*')
      .maybeSingle();

    if (!insertError && inserted) return inserted as ProfileRow;

    // An Auth trigger may have inserted the row concurrently. Re-read it and
    // never overwrite that row's role/status/phone with this fallback.
    const { data: raced, error: raceError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!raceError && raced) return raced as ProfileRow;

    console.error('[ensureProfileForUser] Profile insert failed', {
      userId: user.id,
      code: insertError?.code,
      message: insertError?.message,
      raceError: raceError?.message,
    });
    return null;
  } catch (error) {
    console.error('[ensureProfileForUser] Unexpected error', error);
    return null;
  }
}

export {
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/supabase/postgrest-errors';
