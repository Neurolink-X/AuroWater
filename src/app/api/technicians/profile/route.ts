import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const patchSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  avatar_url: z.string().url().optional().nullable(),
});

/** Legacy path — same data as technician profile (profiles row). */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);

  return jsonOk(auth.ctx.profile);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', auth.ctx.profile.id)
    .select('*')
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data);
}
