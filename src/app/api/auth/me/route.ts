import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import type { ProfileRow } from '@/lib/db/types';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  return jsonOk(auth.ctx.profile as ProfileRow);
}

export async function PUT(req: NextRequest) {
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
    return jsonErr(error.message, 400);
  }

  return jsonOk(data as ProfileRow);
}
