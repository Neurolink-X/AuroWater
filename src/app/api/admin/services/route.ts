import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

const createSchema = z.object({
  key: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  base_price: z.number().nonnegative(),
  unit: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const updateSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  base_price: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('service_types')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const key =
    parsed.data.key ??
    parsed.data.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const { data, error } = await auth.ctx.supabase
    .from('service_types')
    .insert({
      key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      base_price: parsed.data.base_price,
      unit: parsed.data.unit ?? 'per visit',
      is_active: parsed.data.is_active ?? true,
      sort_order: parsed.data.sort_order ?? 0,
    })
    .select('*')
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { id, ...fields } = parsed.data;
  const { data, error } = await auth.ctx.supabase
    .from('service_types')
    .update(fields)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return jsonErr(error.message, 502);
  if (!data) return jsonErr('Service not found', 404);
  return jsonOk(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return jsonErr('id is required', 400);

  const { error } = await auth.ctx.supabase.from('service_types').delete().eq('id', Number(id));
  if (error) return jsonErr(error.message, 502);
  return jsonOk({ deleted: true });
}
