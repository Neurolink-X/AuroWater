import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const createSchema = z.object({
  name: z.string().min(2).max(100),
  vehicle_type: z.string().min(2).max(60),
  capacity_cans: z.number().int().min(1).max(5000),
  plate_number: z.string().max(30).optional().nullable(),
  driver_name: z.string().max(120).optional().nullable(),
  status: z.enum(['available', 'in_use', 'maintenance', 'offline']).optional(),
});

const updateSchema = createSchema.partial();

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .select('*')
    .eq('supplier_id', auth.ctx.profile.id)
    .order('created_at', { ascending: true });

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonErr('Invalid JSON body', 400); }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid fleet item', 422);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .insert({ supplier_id: auth.ctx.profile.id, ...parsed.data })
    .select('*')
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return jsonErr('Fleet id is required', 400);

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonErr('Invalid JSON body', 400); }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid fleet update', 422);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .update(parsed.data)
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id)
    .select('*')
    .maybeSingle();

  if (error) return jsonErr(error.message, 502);
  if (!data) return jsonErr('Fleet item not found', 404);
  return jsonOk(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return jsonErr('Fleet id is required', 400);

  const { error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .delete()
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id);

  if (error) return jsonErr(error.message, 502);
  return jsonOk({ deleted: true });
}
