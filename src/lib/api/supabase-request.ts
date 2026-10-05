import { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';
import { getTokenFromRequest } from '@/lib/auth/jwt';
import {
  createSupabaseUserClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';
import type {
  ProfileRow,
  ProfileRole,
} from '@/lib/db/types';
import { jsonErr } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';

export type AuthedContext = {
  accessToken: string;
  user: User;
  profile: ProfileRow;
  supabase: ReturnType<typeof createSupabaseUserClient>;
};

type AuthFailureCode =
  | 'MISCONFIG_ENV'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DB_NOT_READY'
  | 'SERVICE_ROLE_MISSING'
  | 'PROFILE_NOT_FOUND';

function authError(
  message: string,
  status: number,
  code: AuthFailureCode
) {
  return {
    ok: false as const,
    response: jsonErr(message, status, code),
  };
}

/**
 * Authenticate a request using the Supabase access token.
 *
 * Security rules:
 * - Never expose access tokens.
 * - Never expose internal database errors to customers.
 * - Never automatically elevate a user's role.
 * - Customer-facing APIs should receive only generic auth failures.
 */
export async function requireSupabaseAuth(
  req: NextRequest
): Promise<
  | { ok: true; ctx: AuthedContext }
  | { ok: false; response: NextResponse }
> {
  /* ───────────────────────── Environment ───────────────────────── */

  if (!isSupabaseConfigured()) {
    console.error(
      '[auth] Supabase environment is not configured'
    );

    return authError(
      'Service temporarily unavailable. Please try again later.',
      503,
      'MISCONFIG_ENV'
    );
  }

  /* ───────────────────────── Access token ───────────────────────── */

  const token = getTokenFromRequest(req);

  if (!token) {
    return authError(
      'Unauthorized',
      401,
      'UNAUTHORIZED'
    );
  }

  /* ───────────────────────── Supabase user ───────────────────────── */

  const supabase = createSupabaseUserClient(token);

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    console.warn(
      '[auth] Supabase user authentication failed'
    );

    return authError(
      'Unauthorized',
      401,
      'UNAUTHORIZED'
    );
  }

  /* ───────────────────────── Profile ───────────────────────── */

 const admin = createServiceClient();

const {
  data: profile,
  error: profErr,
} = await admin
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .maybeSingle();

  if (profErr) {
    const code = (profErr as { code?: string }).code;

    /*
     * RLS / permission failure.
     *
     * Do not expose the raw Supabase error to the customer.
     */
    if (code === '42501') {
      console.error(
        '[auth] Profile access denied',
        {
          userId: user.id,
          code,
        }
      );

      return authError(
        'Unable to verify your account. Please try again.',
        403,
        'FORBIDDEN'
      );
    }

    if (isProfilesSchemaMissingError(profErr)) {
      console.error(
        '[auth] Profiles table/schema unavailable',
        profErr.message
      );

      return authError(
        'Service temporarily unavailable. Please try again later.',
        503,
        'DB_NOT_READY'
      );
    }

    console.error(
      '[auth] Profile lookup failed',
      {
        userId: user.id,
        code,
        message: profErr.message,
      }
    );

    return authError(
      'Unable to verify your account. Please try again.',
      502,
      'FORBIDDEN'
    );
  }

  /* ─────────────────────── Missing profile ─────────────────────── */

  if (!profile) {
    const ensured = await ensureProfileForUser(user);

    if (ensured) {
      return {
        ok: true,
        ctx: {
          accessToken: token,
          user,
          profile: ensured,
          supabase,
        },
      };
    }

    /*
     * Verify service-role configuration before returning
     * a more specific server-side failure.
     */
    try {
      createServiceClient();
    } catch {
      console.error(
        '[auth] Service role client is unavailable'
      );

      return authError(
        'Service temporarily unavailable. Please try again later.',
        503,
        'SERVICE_ROLE_MISSING'
      );
    }

    console.error(
      '[auth] Profile missing and could not be created',
      {
        userId: user.id,
      }
    );

    return authError(
      'Unable to complete your account setup. Please contact support.',
      404,
      'PROFILE_NOT_FOUND'
    );
  }

  /* ───────────────────────── Auth success ───────────────────────── */

  return {
    ok: true,
    ctx: {
      accessToken: token,
      user,
      profile: profile as ProfileRow,
      supabase,
    },
  };
}

/**
 * Check whether the authenticated profile has one of the
 * required application roles.
 *
 * This function intentionally does not return an HTTP response
 * because different routes may handle authorization differently.
 */
export function requireRole(
  ctx: AuthedContext,
  allowed: ProfileRole | ProfileRole[]
): boolean {
  const roles = Array.isArray(allowed)
    ? allowed
    : [allowed];

  return roles.includes(ctx.profile.role);
}

export function requireAdmin(
  ctx: AuthedContext
): boolean {
  return ctx.profile.role === 'admin';
}
