import { NextRequest } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth/jwt';
import { createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { createServiceClient } from '@/utils/supabase/server';
import type { ProfileRow, ProfileRole } from '@/lib/db/types';
import { jsonErr } from '@/lib/api/json-response';
import type { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

export type AuthedContext = {
  accessToken: string;
  user: User;
  profile: ProfileRow;
  supabase: ReturnType<typeof createSupabaseUserClient>;
};

function mapJwtRoleToProfileRole(role: string | undefined): ProfileRole {
  const r = (role ?? 'customer').toLowerCase();
  if (r === 'admin' || r === 'supplier' || r === 'technician' || r === 'customer') {
    return r;
  }
  return 'customer';
}

/**
 * Auth via Supabase access token (Bearer). Loads `profiles` row.
 * Decision: we use Bearer tokens from Supabase Auth (stored in the client session)
 * so API routes work with the existing localStorage-first UX; cookie SSR can be added later.
 */
export async function requireSupabaseAuth(
  req: NextRequest
): Promise<{ ok: true; ctx: AuthedContext } | { ok: false; response: NextResponse }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: jsonErr('Server misconfiguration: Supabase env missing', 503) };
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
    return { ok: false, response: jsonErr(profErr.message || 'Profile load failed', 500) };
  }

  if (!profile) {
    // Bootstrap profile if trigger missed (e.g. legacy project) — service role only
    try {
      const admin = createServiceClient();
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const role = mapJwtRoleToProfileRole(typeof meta?.role === 'string' ? meta.role : undefined);
      const fullName = typeof meta?.full_name === 'string' ? meta.full_name : '';
      const phone = typeof meta?.phone === 'string' ? meta.phone : null;
      const { data: inserted, error: insErr } = await admin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email ?? '',
          full_name: fullName,
          phone,
          role,
        })
        .select('*')
        .single();

      if (insErr || !inserted) {
        return { ok: false, response: jsonErr('Profile not found', 404) };
      }
      return {
        ok: true,
        ctx: {
          accessToken: token,
          user,
          profile: inserted as ProfileRow,
          supabase,
        },
      };
    } catch {
      return { ok: false, response: jsonErr('Profile not found', 404) };
    }
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
