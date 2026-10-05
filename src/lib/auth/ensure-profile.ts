import type { User } from '@supabase/supabase-js';

import type {
  ProfileRow,
  ProfileRole,
} from '@/lib/db/types';
import { createServiceClient } from '@/utils/supabase/server';

function mapMetaRoleToProfileRole(
  meta: Record<string, unknown> | undefined
): ProfileRole {
  /*
   * Security rule:
   *
   * Auth metadata must never be trusted for privileged roles.
   * Only explicitly approved application flows should create
   * supplier, technician, or admin profiles.
   *
   * Normal authenticated users always become customers.
   */

  const rawRole =
    typeof meta?.role === 'string'
      ? meta.role.toLowerCase().trim()
      : '';

  /*
   * Do not allow arbitrary metadata to create privileged accounts.
   *
   * A normal user signing in without an existing profile
   * must always receive the customer role.
   */
  if (rawRole === 'customer') {
    return 'customer';
  }

  return 'customer';
}

function resolveInitialRole(
  requestedRole: ProfileRole | undefined,
  metadataRole: ProfileRole
): ProfileRole {
  /*
   * `initialData.role` is trusted only when explicitly supplied
   * by a controlled server-side workflow.
   *
   * Without an explicit role, always create a customer.
   */
  if (
    requestedRole === 'admin' ||
    requestedRole === 'supplier' ||
    requestedRole === 'technician' ||
    requestedRole === 'customer'
  ) {
    return requestedRole;
  }

  return metadataRole;
}

/**
 * Ensures a `profiles` row exists for a Supabase Auth user.
 *
 * Important:
 * - Normal users become `customer`.
 * - Supplier/technician/admin roles must come from controlled
 *   application flows, not arbitrary Auth metadata.
 * - This function is called only after authentication.
 * - Service role is used because profile creation must not depend
 *   on customer RLS permissions.
 */
export async function ensureProfileForUser(
  user: User,
  initialData: Partial<
    Pick<ProfileRow, 'role' | 'city' | 'referred_by'>
  > = {}
): Promise<ProfileRow | null> {
  let admin;

  try {
    admin = createServiceClient();
  } catch (error) {
    console.error(
      '[ensureProfileForUser] Service client unavailable',
      error
    );

    return null;
  }

  try {
    const meta =
      user.user_metadata as Record<string, unknown> | undefined;

    const metadataRole =
      mapMetaRoleToProfileRole(meta);

    const role = resolveInitialRole(
      initialData.role,
      metadataRole
    );

    const full_name =
      typeof meta?.full_name === 'string'
        ? meta.full_name.trim()
        : typeof meta?.name === 'string'
          ? meta.name.trim()
          : '';

    const phone =
      typeof meta?.phone === 'string'
        ? meta.phone.trim()
        : null;

    const avatar_url =
      typeof meta?.avatar_url === 'string'
        ? meta.avatar_url
        : typeof meta?.picture === 'string'
          ? meta.picture
          : null;

    const city =
      typeof initialData.city === 'string'
        ? initialData.city.trim()
        : typeof meta?.city === 'string'
          ? meta.city.trim()
          : null;

    const referred_by =
      typeof initialData.referred_by === 'string'
        ? initialData.referred_by.trim()
        : null;

    const base = {
      id: user.id,
      email: user.email ?? '',
      full_name,
      phone,
      role,

      /*
       * Customers are immediately active.
       * Supplier/technician onboarding remains controlled.
       */
      status:
        role === 'supplier' || role === 'technician'
          ? 'pending_approval'
          : 'active',

      city: city || null,
      referred_by: referred_by || null,
      avatar_url,

      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await admin
      .from('profiles')
      .upsert(base, {
        onConflict: 'id',
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error(
        '[ensureProfileForUser] Profile upsert failed',
        {
          userId: user.id,
          code: error.code,
          message: error.message,
        }
      );

      return null;
    }

    if (!data) {
      console.error(
        '[ensureProfileForUser] Profile upsert returned no row',
        {
          userId: user.id,
        }
      );

      return null;
    }

    return data as ProfileRow;
  } catch (error) {
    console.error(
      '[ensureProfileForUser] Unexpected error',
      error
    );

    return null;
  }
}

export {
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/supabase/postgrest-errors';









// import type { User } from '@supabase/supabase-js';

// import type { ProfileRow, ProfileRole } from '@/lib/db/types';
// import { createServiceClient } from '@/utils/supabase/server';

// function mapMetaRoleToProfileRole(meta: Record<string, unknown> | undefined): ProfileRole {
//   const r = typeof meta?.role === 'string' ? meta.role.toLowerCase() : 'customer';
//   if (r === 'seller' || r === 'supplier') return 'supplier';
//   if (r === 'agent' || r === 'plumber' || r === 'technician') return 'technician';
//   if (r === 'admin' || r === 'customer') return r;
//   return 'customer';
// }

// /**
//  * Ensures a `profiles` row exists for a Supabase Auth user (service role).
//  * Call only after the user has authenticated (e.g. password sign-in).
//  * Returns null if the table is missing, service role is not configured, or insert fails.
//  */
// export async function ensureProfileForUser(
//   user: User,
//   initialData: Partial<Pick<ProfileRow, 'role' | 'city' | 'referred_by'>> = {}
// ): Promise<ProfileRow | null> {
//   let admin;
//   try {
//     admin = createServiceClient();
//   } catch {
//     return null;
//   }

//   try {
//     const meta = user.user_metadata as Record<string, unknown> | undefined;
//     const roleFromMeta = mapMetaRoleToProfileRole(meta);
//     const role =
//       initialData.role === 'admin' ||
//       initialData.role === 'supplier' ||
//       initialData.role === 'technician' ||
//       initialData.role === 'customer'
//         ? initialData.role
//         : roleFromMeta;

//     const full_name =
//       typeof meta?.full_name === 'string'
//         ? meta.full_name
//         : typeof meta?.name === 'string'
//           ? meta.name
//           : '';
//     const phone = typeof meta?.phone === 'string' ? meta.phone : null;
//     const avatar_url =
//       typeof meta?.avatar_url === 'string'
//         ? meta.avatar_url
//         : typeof meta?.picture === 'string'
//           ? meta.picture
//           : null;

//     const base = {
//       id: user.id,
//       email: user.email ?? '',
//       full_name,
//       phone,
//       role,
//       status: role === 'supplier' || role === 'technician' ? 'pending_approval' : 'active',
//       city: typeof initialData.city === 'string' ? initialData.city : typeof meta?.city === 'string' ? meta.city : null,
//       referred_by:
//         typeof initialData.referred_by === 'string' ? initialData.referred_by : null,
//       avatar_url,
//       is_active: true,
//       updated_at: new Date().toISOString(),
//     };

//     const { data, error } = await admin
//       .from('profiles')
//       .upsert(base, { onConflict: 'id' })
//       .select('*')
//       .maybeSingle();

//     if (error) {
//       console.error('[ensureProfileForUser]', error.message ?? error);
//       return null;
//     }
//     return (data ?? null) as ProfileRow | null;
//   } catch (e) {
//     console.error('[ensureProfileForUser]', e);
//     return null;
//   }
// }

// export {
//   isProfilesSchemaMissingError,
//   profileTableUnavailableMessage,
// } from '@/lib/supabase/postgrest-errors';
