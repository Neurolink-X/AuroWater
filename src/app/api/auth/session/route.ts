import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  getTokenFromRequest,
} from '@/lib/auth/jwt';

import {
  createSupabaseUserClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

import type {
  ProfileRow,
} from '@/lib/db/types';

export async function GET(
  req: NextRequest,
) {
  if (!isSupabaseConfigured()) {
    return jsonErr(
      'Supabase is not configured on the server',
      503,
      'MISCONFIG_ENV',
    );
  }

  const token =
    getTokenFromRequest(req);

  if (!token) {
    return jsonErr(
      'Unauthorized',
      401,
      'UNAUTHORIZED',
    );
  }

  try {
    /*
     * Supabase validates the JWT and returns
     * the authenticated user.
     */
    const supabase =
      createSupabaseUserClient(
        token,
      );

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user?.id
    ) {
      return jsonErr(
        'Unauthorized',
        401,
        'UNAUTHORIZED',
      );
    }

    /*
     * Load application profile.
     */
    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from('profiles')
        .select('*')
        .eq(
          'id',
          user.id,
        )
        .maybeSingle();

    if (profileError) {
      const code =
        (
          profileError as {
            code?: string;
          }
        ).code;

      if (code === '42501') {
        return jsonErr(
          'Forbidden',
          403,
          'FORBIDDEN',
        );
      }

      return jsonErr(
        'Profile load failed',
        502,
        'PROFILE_LOAD_FAILED',
      );
    }

    if (!profile) {
      return jsonErr(
        'Profile not found',
        404,
        'PROFILE_NOT_FOUND',
      );
    }

    const typedProfile =
      profile as ProfileRow;

    /*
     * Application-level account protection.
     */
    if (
      typedProfile.deleted_at
    ) {
      return jsonErr(
        'Account deleted',
        403,
        'ACCOUNT_DELETED',
      );
    }

    if (
      typedProfile.is_active ===
      false
    ) {
      return jsonErr(
        'Account suspended. Contact support.',
        403,
        'ACCOUNT_SUSPENDED',
      );
    }

    if (
      typedProfile.status ===
        'suspended' ||
      typedProfile.status ===
        'banned'
    ) {
      return jsonErr(
        'Account suspended. Contact support.',
        403,
        'ACCOUNT_SUSPENDED',
      );
    }

    if (
      typedProfile.status ===
      'rejected'
    ) {
      return jsonErr(
        typedProfile.rejection_reason
          ? `Application rejected: ${typedProfile.rejection_reason}`
          : 'Application was rejected. Contact support.',
        403,
        'ACCOUNT_REJECTED',
      );
    }

    if (
      (
        typedProfile.status ===
          'pending' ||
        typedProfile.status ===
          'pending_approval'
      ) &&
      (
        typedProfile.role ===
          'supplier' ||
        typedProfile.role ===
          'technician'
      )
    ) {
      return jsonErr(
        'Your account is still under review.',
        403,
        'PENDING_APPROVAL',
      );
    }

    return jsonOk({
      user: {
        id: user.id,
        email:
          user.email ?? null,
      },

      profile:
        typedProfile,
    });
  } catch (error) {
    console.error(
      '[GET /api/auth/session]',
      error,
    );

    return jsonErr(
      'Session check failed',
      500,
      'SESSION_CHECK_FAILED',
    );
  }
}
