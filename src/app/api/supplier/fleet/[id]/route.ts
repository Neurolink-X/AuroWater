import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const patchSchema = z.object({
  vehicle_number: z.string().trim().min(3).max(30).optional(),
  vehicle_name: z.string().trim().max(80).nullable().optional(),
  vehicle_type: z.string().trim().min(2).max(40).optional(),
  capacity_litres: z.number().int().min(100).max(100000).optional(),
  driver_name: z.string().trim().max(80).nullable().optional(),
  price_per_trip: z.number().nonnegative().max(1_000_000).nullable().optional(),
  status: z.enum(['available','in_use','maintenance','inactive']).optional(),
});

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid fleet update', 422);

  const patch = {
    ...parsed.data,
    ...(parsed.data.vehicle_number !== undefined
      ? { vehicle_number: parsed.data.vehicle_number.toUpperCase() }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .update(patch)
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id)
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return jsonErr('This vehicle number is already in your fleet.', 409);
    console.error('[supplier/fleet] update failed', error);
    return jsonErr('Could not update vehicle', 502);
  }

  if (!data) return jsonErr('Vehicle not found', 404);
  return jsonOk(data);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .delete()
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[supplier/fleet] delete failed', error);
    return jsonErr('Could not remove vehicle', 502);
  }
  if (!data) return jsonErr('Vehicle not found', 404);

  return jsonOk({ deleted: true, id: data.id });
}
