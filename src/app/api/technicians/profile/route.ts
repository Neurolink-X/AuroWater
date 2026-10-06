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
export const dynamic = 'force-dynamic';

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
 * Deliberately excludes sensitive/internal fields such as:
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
      auth.ctx.profile as unknown as Record<string, unknown>,
    ),
  );
}

/**
 * PUT
 *
 * Updates only editable profile fields for the authenticated technician.
 *
 * The browser cannot choose which profile is updated.
 * The authenticated profile ID is always used server-side.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = profileSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ?? 'Invalid profile data',
      422,
    );
  }

  const input: ProfileUpdate = parsed.data;
  const updates: Record<string, unknown> = {};

  if (input.full_name !== undefined) {
    const fullName = normalizeName(input.full_name);

    if (fullName.length < 2) {
      return jsonErr(
        'Name must contain at least 2 characters',
        422,
      );
    }

    updates.full_name = fullName;
  }

  if (input.phone !== undefined) {
    const normalizedPhone = normalizePhone(input.phone);

    if (
      normalizedPhone.length < 10 ||
      normalizedPhone.length > 15
    ) {
      return jsonErr('Enter a valid phone number', 422);
    }

    updates.phone = normalizedPhone;
  }

  if (input.city !== undefined) {
    const city = normalizeCity(input.city);

    if (city.length < 2) {
      return jsonErr('Enter a valid city', 422);
    }

    updates.city = city;
  }

  if (input.avatar_url !== undefined) {
    updates.avatar_url =
      input.avatar_url?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return jsonErr(
      'No profile changes were provided',
      400,
    );
  }

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

  if (error) {
    console.error(
      '[technician-profile] update failed:',
      error,
    );

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
      data as unknown as Record<string, unknown>,
    ),
  );
}
