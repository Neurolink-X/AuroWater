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
  if (typeof body.status === 'string') {
    const s = body.status.toLowerCase();
    if (['active', 'suspended', 'pending_approval', 'pending', 'rejected'].includes(s)) {
      patch.status = s;
      if (s === 'active') {
        patch.approved_at = new Date().toISOString();
        patch.approved_by = auth.ctx.profile.id;
        patch.is_active = true;
      }
      if (s === 'rejected' && typeof body.rejection_reason === 'string') {
        patch.rejection_reason = body.rejection_reason;
      }
    }
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
