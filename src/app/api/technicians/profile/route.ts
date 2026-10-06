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

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Name must contain at least 2 characters')
    .max(100, 'Name must be 100 characters or fewer')
    .optional(),

  phone: z
    .string()
    .trim()
    .min(10, 'Enter a valid phone number')
    .max(20, 'Enter a valid phone number')
    .optional(),

  city: z
    .string()
    .trim()
    .min(2, 'Enter a valid city')
    .max(100, 'City must be 100 characters or fewer')
    .optional(),

  avatar_url: z
    .string()
    .trim()
    .url('Invalid avatar URL')
    .max(2048, 'Avatar URL is too long')
    .nullable()
    .optional(),
});

type ProfileUpdate = z.infer<typeof profileSchema>;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function normalizeCity(city: string): string {
  return city.replace(/\s+/g, ' ').trim();
}

/**
 * Public-safe technician profile fields.
 *
 * Do not return sensitive/internal fields such as:
 * - license_number
 * - verification documents
 * - internal audit fields
 * - payout information
 * - private metadata
 */
function sanitizeProfile(profile: Record<string, unknown>) {
  return {
    id: profile.id,
    full_name: profile.full_name ?? null,
    phone: profile.phone ?? null,
    city: profile.city ?? null,
    avatar_url: profile.avatar_url ?? null,

    role: profile.role ?? 'technician',
    status: profile.status ?? null,
    is_active: profile.is_active ?? false,

    verification_status:
      profile.verification_status ?? null,

    created_at: profile.created_at ?? null,
    updated_at: profile.updated_at ?? null,
  };
}

/**
 * GET
 *
 * Legacy technician profile endpoint.
 *
 * Returns only the authenticated technician's own profile.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
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
 * Updates the authenticated technician's editable profile.
 *
 * IMPORTANT:
 * The browser can never choose which profile is updated.
 * The authenticated Supabase profile ID is always used.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  // ------------------------------------------------------------
  // Parse request
  // ------------------------------------------------------------
  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  // ------------------------------------------------------------
  // Validate request
  // ------------------------------------------------------------
  const parsed = profileSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ??
        'Invalid profile data',
      422,
    );
  }

  const input: ProfileUpdate = parsed.data;

  // ------------------------------------------------------------
  // Normalize editable fields
  // ------------------------------------------------------------
  const updates: Record<string, unknown> = {};

  if (input.full_name !== undefined) {
    updates.full_name = normalizeName(
      input.full_name,
    );
  }

  if (input.phone !== undefined) {
    const normalizedPhone = normalizePhone(
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

    updates.phone = normalizedPhone;
  }

  if (input.city !== undefined) {
    updates.city = normalizeCity(input.city);
  }

  if (input.avatar_url !== undefined) {
    updates.avatar_url =
      input.avatar_url?.trim() || null;
  }

  // ------------------------------------------------------------
  // Prevent empty update
  // ------------------------------------------------------------
  if (Object.keys(updates).length === 0) {
    return jsonErr(
      'No profile changes were provided',
      400,
    );
  }

  // ------------------------------------------------------------
  // Update ONLY the authenticated technician's profile.
  //
  // Never accept:
  // id
  // role
  // status
  // is_active
  // verification_status
  // license_number
  // payout fields
  // permissions
  // from the browser.
  // ------------------------------------------------------------
  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.ctx.profile.id)
    .eq('role', 'technician')
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
    console.error(
      '[technician-profile] update failed:',
      error,
    );

    /*
     * Never send Supabase/Postgres error.message directly
     * to the browser.
     */
    return jsonErr(
      'Unable to update your profile right now',
      500,
    );
  }

  if (!data) {
    return jsonErr(
      'Technician profile was not found',
      404,
    );
  }

  return jsonOk(
    sanitizeProfile(
      data as Record<string, unknown>,
    ),
  );
}
