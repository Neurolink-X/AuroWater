import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

export const runtime = 'nodejs';

/**
 * This endpoint always depends on the authenticated Supabase
 * session/profile, so it must not be statically optimized.
 */
export const dynamic = 'force-dynamic';

/**
 * Maximum lengths are intentionally kept conservative.
 *
 * The schema validates the incoming request before anything
 * reaches Supabase.
 */
const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(
      2,
      'Name must contain at least 2 characters',
    )
    .max(
      100,
      'Name must be 100 characters or fewer',
    )
    .optional(),

  phone: z
    .string()
    .trim()
    .min(
      10,
      'Enter a valid phone number',
    )
    .max(
      20,
      'Enter a valid phone number',
    )
    .optional(),

  city: z
    .string()
    .trim()
    .min(
      2,
      'Enter a valid city',
    )
    .max(
      100,
      'City must be 100 characters or fewer',
    )
    .optional(),

  avatar_url: z
    .string()
    .trim()
    .url('Invalid avatar URL')
    .max(
      2048,
      'Avatar URL is too long',
    )
    .nullable()
    .optional(),
});

type ProfileUpdate = z.infer<
  typeof profileSchema
>;

/**
 * Normalize a phone number before persistence.
 *
 * This intentionally removes formatting characters such as:
 * spaces, brackets, dashes and plus signs.
 *
 * Example:
 * +91 98765-43210
 * →
 * 919876543210
 */
function normalizePhone(
  phone: string,
): string {
  return phone.replace(/\D/g, '');
}

/**
 * Normalize user-entered names.
 *
 * Multiple whitespace characters are collapsed into
 * a single space so the stored profile remains clean.
 */
function normalizeName(
  name: string,
): string {
  return name
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize city names in the same way as names.
 */
function normalizeCity(
  city: string,
): string {
  return city
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Public-safe technician profile fields.
 *
 * IMPORTANT:
 *
 * This function is deliberately allowlisted.
 *
 * Never return the complete profiles row from this endpoint.
 *
 * Sensitive/internal fields that must remain excluded include:
 *
 * - license_number
 * - verification documents
 * - internal audit fields
 * - payout information
 * - private metadata
 * - permissions/internal flags not required by the client
 *
 * Keeping an explicit response allowlist makes future schema
 * additions safer because a newly-added database column will
 * not automatically become publicly visible.
 */
function sanitizeProfile(
  profile: Record<string, unknown>,
) {
  return {
    id: profile.id,

    full_name:
      profile.full_name ?? null,

    phone:
      profile.phone ?? null,

    city:
      profile.city ?? null,

    avatar_url:
      profile.avatar_url ?? null,

    role:
      profile.role ?? 'technician',

    status:
      profile.status ?? null,

    is_active:
      profile.is_active ?? false,

    verification_status:
      profile.verification_status ?? null,

    created_at:
      profile.created_at ?? null,

    updated_at:
      profile.updated_at ?? null,
  };
}

/**
 * GET
 *
 * Legacy technician profile endpoint.
 *
 * Returns only the authenticated technician's own
 * profile.
 *
 * Security:
 * - Requires a valid Supabase-authenticated session.
 * - Requires technician role.
 * - Never accepts a profile ID from the browser.
 * - Returns only explicitly allowlisted fields.
 */
export async function GET(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'technician',
    )
  ) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  return jsonOk(
    sanitizeProfile(
      auth.ctx.profile as unknown as Record<
        string,
        unknown
      >,
    ),
  );
}

/**
 * PUT
 *
 * Updates the authenticated technician's editable
 * profile.
 *
 * IMPORTANT:
 *
 * The browser can never choose which profile is updated.
 *
 * The authenticated Supabase profile ID is always used:
 *
 *     auth.ctx.profile.id
 *
 * The browser is only allowed to submit the editable
 * fields defined in profileSchema.
 *
 * Protected fields such as:
 *
 * - id
 * - role
 * - status
 * - is_active
 * - verification_status
 * - license_number
 * - payout fields
 * - permissions
 *
 * can never be changed through this endpoint.
 */
export async function PUT(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'technician',
    )
  ) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  // ------------------------------------------------------------
  // Parse request
  // ------------------------------------------------------------

  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  // ------------------------------------------------------------
  // Validate request
  // ------------------------------------------------------------

  const parsed =
    profileSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ??
        'Invalid profile data',
      422,
    );
  }

  const input: ProfileUpdate =
    parsed.data;

  // ------------------------------------------------------------
  // Normalize editable fields
  // ------------------------------------------------------------

  const updates: Record<
    string,
    unknown
  > = {};

  /**
   * Full name
   */
  if (
    input.full_name !== undefined
  ) {
    const fullName =
      normalizeName(
        input.full_name,
      );

    if (
      fullName.length < 2
    ) {
      return jsonErr(
        'Name must contain at least 2 characters',
        422,
      );
    }

    if (
      fullName.length > 100
    ) {
      return jsonErr(
        'Name must be 100 characters or fewer',
        422,
      );
    }

    updates.full_name =
      fullName;
  }

  /**
   * Phone
   *
   * Normalize first, then validate the normalized
   * representation.
   */
  if (
    input.phone !== undefined
  ) {
    const normalizedPhone =
      normalizePhone(
        input.phone,
      );

    if (
      normalizedPhone.length < 10 ||
      normalizedPhone.length > 15
    ) {
      return jsonErr(
        'Enter a valid phone number',
        422,
      );
    }

    updates.phone =
      normalizedPhone;
  }

  /**
   * City
   */
  if (
    input.city !== undefined
  ) {
    const city =
      normalizeCity(
        input.city,
      );

    if (
      city.length < 2
    ) {
      return jsonErr(
        'Enter a valid city',
        422,
      );
    }

    if (
      city.length > 100
    ) {
      return jsonErr(
        'City must be 100 characters or fewer',
        422,
      );
    }

    updates.city =
      city;
  }

  /**
   * Avatar URL
   *
   * Zod has already validated the URL format and
   * maximum length.
   *
   * Empty/whitespace-only values are converted to null.
   */
  if (
    input.avatar_url !== undefined
  ) {
    updates.avatar_url =
      input.avatar_url?.trim() ||
      null;
  }

  // ------------------------------------------------------------
  // Prevent empty update
  // ------------------------------------------------------------

  if (
    Object.keys(updates).length === 0
  ) {
    return jsonErr(
      'No profile changes were provided',
      400,
    );
  }

  // ------------------------------------------------------------
  // Update ONLY the authenticated technician's profile.
  //
  // Never accept these security-sensitive fields from
  // the browser:
  //
  // id
  // role
  // status
  // is_active
  // verification_status
  // license_number
  // payout fields
  // permissions
  //
  // The profile ID always comes from the authenticated
  // server-side context.
  // ------------------------------------------------------------

  const {
    data,
    error,
  } =
    await auth.ctx.supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        auth.ctx.profile.id,
      )
      .eq(
        'role',
        'technician',
      )
      .select(
        [
          'id',
          'full_name',
          'phone',
          'city',
          'avatar_url',
          'role',
          'status',
          'is_active',
          'verification_status',
          'created_at',
          'updated_at',
        ].join(', '),
      )
      .single();

  // ------------------------------------------------------------
  // Database error handling
  // ------------------------------------------------------------

  if (error) {
    /**
     * Log the complete Supabase error server-side for
     * diagnostics, but never expose the database error
     * directly to the client.
     */
    console.error(
      '[technician-profile] update failed:',
      error,
    );

    return jsonErr(
      'Unable to update your profile right now',
      500,
    );
  }

  // ------------------------------------------------------------
  // Defensive response check
  // ------------------------------------------------------------

  if (!data) {
    return jsonErr(
      'Technician profile was not found',
      404,
    );
  }

  // ------------------------------------------------------------
  // Return sanitized profile
  //
  // The Supabase generated type can resolve the selected
  // response as GenericStringError in this project.
  //
  // Passing through unknown before the final structural
  // type is the intentional TypeScript boundary here.
  // ------------------------------------------------------------

  return jsonOk(
    sanitizeProfile(
      data as unknown as Record<
        string,
        unknown
      >,
    ),
  );
}
