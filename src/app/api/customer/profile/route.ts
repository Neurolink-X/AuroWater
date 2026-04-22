import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const schema = z.object({
  full_name: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .select('id, full_name, city, phone, created_at, settings')
    .eq('id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data ?? null);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const patch: Record<string, unknown> = {};
  if (typeof parsed.data.full_name === 'string') patch.full_name = parsed.data.full_name;
  if (typeof parsed.data.city === 'string') patch.city = parsed.data.city;
  if (parsed.data.settings != null) patch.settings = parsed.data.settings;

  if (Object.keys(patch).length === 0) {
    return jsonErr('Nothing to update', 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update(patch)
    .eq('id', auth.ctx.profile.id)
    .select('id, full_name, city, phone, created_at, settings')
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data);
}

