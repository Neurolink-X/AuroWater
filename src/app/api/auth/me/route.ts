import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { jsonErrFromUnknownAuthError } from '@/lib/api/map-unknown-auth-error';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import type { ProfileRow } from '@/lib/db/types';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSupabaseAuth(req);
    if (!auth.ok) return auth.response;
    return jsonOk(auth.ctx.profile as ProfileRow);
  } catch (e: unknown) {
    return jsonErrFromUnknownAuthError(e, '[GET /api/auth/me]');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSupabaseAuth(req);
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonErr('Invalid JSON body', 400);
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.full_name === 'string') patch.full_name = body.full_name.trim();
    if (typeof body.phone === 'string') patch.phone = body.phone.trim() || null;
    if (typeof body.avatar_url === 'string') patch.avatar_url = body.avatar_url || null;

    const { data, error } = await auth.ctx.supabase
      .from('profiles')
      .update(patch)
      .eq('id', auth.ctx.profile.id)
      .select('*')
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      const status = code === '42501' ? 403 : 400;
      return jsonErr(error.message, status);
    }

    return jsonOk(data as ProfileRow);
  } catch (e: unknown) {
    return jsonErrFromUnknownAuthError(e, '[PUT /api/auth/me]');
  }
}
