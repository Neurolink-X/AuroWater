import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { getTokenFromRequest } from '@/lib/auth/jwt';
import { createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ProfileRow } from '@/lib/db/types';

/** GET /api/auth/session — current Supabase user + profile, or 401 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonErr('Supabase is not configured on the server', 503, 'MISCONFIG_ENV');
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return jsonErr('Unauthorized', 401);
  }

  try {
    const supabase = createSupabaseUserClient(token);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user?.id) {
      return jsonErr('Unauthorized', 401);
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      return jsonErr(profErr.message || 'Profile load failed', 502);
    }

    return jsonOk({
      user: { id: user.id, email: user.email },
      profile: profile as ProfileRow | null,
    });
  } catch {
    return jsonErr('Session check failed', 500);
  }
}
