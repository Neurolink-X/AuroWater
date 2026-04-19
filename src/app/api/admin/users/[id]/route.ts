import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.role === 'string') {
    const r = body.role.toLowerCase();
    if (['customer', 'technician', 'supplier', 'admin'].includes(r)) {
      patch.role = r;
    }
  }
  if (typeof body.is_active === 'boolean') {
    patch.is_active = body.is_active;
  }
  if (typeof body.full_name === 'string') {
    patch.full_name = body.full_name;
  }
  if (typeof body.phone === 'string') {
    patch.phone = body.phone;
  }

  if (Object.keys(patch).length === 0) {
    return jsonErr('No valid fields to update', 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('User not found', 404);
  }

  return jsonOk(data);
}
