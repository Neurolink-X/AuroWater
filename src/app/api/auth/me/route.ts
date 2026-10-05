import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  jsonErrFromUnknownAuthError,
} from '@/lib/api/map-unknown-auth-error';

import {
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

import type {
  ProfileRow,
} from '@/lib/db/types';

function normalizePhone(
  value: string,
): string | null {
  const digits =
    value.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  return digits.slice(-10);
}

export async function GET(
  req: NextRequest,
) {
  try {
    const auth =
      await requireSupabaseAuth(req);

    if (!auth.ok) {
      return auth.response;
    }

    return jsonOk(
      auth.ctx.profile as ProfileRow,
    );
  } catch (error: unknown) {
    return jsonErrFromUnknownAuthError(
      error,
      '[GET /api/auth/me]',
    );
  }
}

export async function PUT(
  req: NextRequest,
) {
  try {
    const auth =
      await requireSupabaseAuth(req);

    if (!auth.ok) {
      return auth.response;
    }

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await req.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return jsonErr(
        'Invalid JSON body',
        400,
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return jsonErr(
        'Invalid JSON body',
        400,
      );
    }

    const patch:
      Record<string, unknown> = {};

    /*
     * Only allow fields that the user is
     * actually allowed to edit.
     *
     * Never allow role, status, is_active,
     * aurotap_id, deleted_at, etc. here.
     */
    if (
      typeof body.full_name ===
      'string'
    ) {
      const fullName =
        body.full_name.trim();

      if (
        fullName.length < 2
      ) {
        return jsonErr(
          'Full name must contain at least 2 characters',
          422,
        );
      }

      if (
        fullName.length > 80
      ) {
        return jsonErr(
          'Full name is too long',
          422,
        );
      }

      patch.full_name =
        fullName;
    }

    if (
      typeof body.phone ===
      'string'
    ) {
      const phone =
        normalizePhone(
          body.phone,
        );

      if (
        phone &&
        !/^[6-9]\d{9}$/.test(
          phone,
        )
      ) {
        return jsonErr(
          'Enter a valid 10-digit Indian mobile number',
          422,
        );
      }

      patch.phone =
        phone;
    }

    if (
      typeof body.avatar_url ===
      'string'
    ) {
      const avatarUrl =
        body.avatar_url.trim();

      if (
        avatarUrl.length > 1000
      ) {
        return jsonErr(
          'Avatar URL is too long',
          422,
        );
      }

      if (
        avatarUrl &&
        !/^https?:\/\//i.test(
          avatarUrl,
        )
      ) {
        return jsonErr(
          'Avatar URL must be a valid HTTP or HTTPS URL',
          422,
        );
      }

      patch.avatar_url =
        avatarUrl || null;
    }

    if (
      Object.keys(patch).length === 0
    ) {
      return jsonOk(
        auth.ctx.profile as ProfileRow,
      );
    }

    /*
     * Check phone uniqueness before updating.
     *
     * This avoids accidentally allowing
     * another user's phone number.
     */
    if (
      typeof patch.phone ===
        'string' &&
      patch.phone
    ) {
      const {
        data: existingPhone,
        error:
          phoneLookupError,
      } = await auth.ctx.supabase
        .from('profiles')
        .select('id')
        .eq(
          'phone',
          patch.phone,
        )
        .neq(
          'id',
          auth.ctx.profile.id,
        )
        .limit(1)
        .maybeSingle();

      if (phoneLookupError) {
        return jsonErr(
          'Could not verify phone number availability',
          502,
        );
      }

      if (existingPhone) {
        return jsonErr(
          'This phone number is already associated with another account',
          409,
          'PHONE_EXISTS',
        );
      }
    }

    const {
      data,
      error,
    } = await auth.ctx.supabase
      .from('profiles')
      .update(patch)
      .eq(
        'id',
        auth.ctx.profile.id,
      )
      .select('*')
      .single();

    if (error) {
      const code =
        (
          error as {
            code?: string;
          }
        ).code;

      if (code === '23505') {
        return jsonErr(
          'This phone number is already associated with another account',
          409,
          'PHONE_EXISTS',
        );
      }

      if (code === '42501') {
        return jsonErr(
          'You are not allowed to update this profile',
          403,
        );
      }

      return jsonErr(
        'Could not update profile',
        400,
      );
    }

    return jsonOk(
      data as ProfileRow,
    );
  } catch (error: unknown) {
    return jsonErrFromUnknownAuthError(
      error,
      '[PUT /api/auth/me]',
    );
  }
}
