import { NextRequest } from 'next/server';
import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';
import { getTokenFromRequest } from '@/lib/auth/jwt';
import { createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ProfileRow, ProfileRole } from '@/lib/db/types';
import { jsonErr } from '@/lib/api/json-response';
import type { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServiceClient } from '@/utils/supabase/server';

export type AuthedContext = {
  accessToken: string;
  user: User;
  profile: ProfileRow;
  supabase: ReturnType<typeof createSupabaseUserClient>;
};

/**
 * Auth via Supabase access token (Bearer). Loads `profiles` row.
 * Decision: we use Bearer tokens from Supabase Auth (stored in the client session)
 * so API routes work with the existing localStorage-first UX; cookie SSR can be added later.
 */
export async function requireSupabaseAuth(
  req: NextRequest
): Promise<{ ok: true; ctx: AuthedContext } | { ok: false; response: NextResponse }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: jsonErr('Server misconfiguration: Supabase env missing', 503, 'MISCONFIG_ENV') };
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return { ok: false, response: jsonErr('Unauthorized', 401) };
  }

  const supabase = createSupabaseUserClient(token);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    return { ok: false, response: jsonErr('Unauthorized', 401) };
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profErr) {
    const code = (profErr as { code?: string }).code;
    const msg = profErr.message || 'Profile load failed';
    if (code === '42501') {
      return { ok: false, response: jsonErr(msg, 403) };
    }
    if (isProfilesSchemaMissingError(profErr)) {
      return {
        ok: false,
        response: jsonErr(profileTableUnavailableMessage(profErr), 503, 'DB_NOT_READY'),
      };
    }
    return { ok: false, response: jsonErr(msg, 502) };
  }

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

    try {
      createServiceClient();
    } catch {
      return {
        ok: false,
        response: jsonErr('Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set', 503, 'SERVICE_ROLE_MISSING'),
      };
    }

    return {
      ok: false,
      response: jsonErr(
        'Profile not found or could not be created. Apply sql migrations (001–006), ensure auth trigger (004), and set SUPABASE_SERVICE_ROLE_KEY.',
        404
      ),
    };
  }

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

export function requireRole(
  ctx: AuthedContext,
  allowed: ProfileRole | ProfileRole[]
): boolean {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return roles.includes(ctx.profile.role);
}

export function requireAdmin(ctx: AuthedContext): boolean {
  return ctx.profile.role === 'admin';
}
