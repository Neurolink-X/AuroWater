import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
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
  if (typeof body.label === 'string') patch.label = body.label;
  if (typeof body.house_flat === 'string') patch.house_flat = body.house_flat;
  if (typeof body.area === 'string') patch.area = body.area;
  if (typeof body.city === 'string') patch.city = body.city;
  if (typeof body.pincode === 'string') patch.pincode = body.pincode;
  if (typeof patch.pincode === 'string' && !/^\d{6}$/.test(patch.pincode.trim())) {
    return jsonErr('pincode must be 6 digits', 400);
  }
  if (typeof patch.city === 'string' && !patch.city.trim()) {
    return jsonErr('city is required', 400);
  }
  if (typeof patch.house_flat === 'string' && !patch.house_flat.trim()) {
    return jsonErr('house_flat is required', 400);
  }

  if (typeof body.landmark === 'string') patch.landmark = body.landmark;
  if (typeof body.is_default === 'boolean') patch.is_default = body.is_default;

  const { data, error } = await auth.ctx.supabase
    .from('addresses')
    .update(patch)
    .eq('id', id)
    .eq('user_id', auth.ctx.profile.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Address not found', 404);
  }

  if (patch.is_default === true) {
    await auth.ctx.supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', auth.ctx.profile.id)
      .neq('id', id);
    await auth.ctx.supabase.from('addresses').update({ is_default: true }).eq('id', id);
  }

  return jsonOk(data);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  const { error } = await auth.ctx.supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.ctx.profile.id);

  if (error) {
    return jsonErr(error.message, 500);
  }

  return jsonOk({ deleted: true as const });
}
