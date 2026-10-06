import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const createSchema = z.object({
  vehicle_number: z.string().trim().min(3).max(30),
  vehicle_name: z.string().trim().max(80).optional(),
  vehicle_type: z.string().trim().min(2).max(40).default('water_tanker'),
  capacity_litres: z.number().int().min(100).max(100000),
  driver_name: z.string().trim().max(80).optional(),
  price_per_trip: z.number().nonnegative().max(1_000_000).optional(),
  status: z.enum(['available','in_use','maintenance','inactive']).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .select('id, supplier_id, vehicle_number, vehicle_name, vehicle_type, capacity_litres, driver_name, price_per_trip, status, created_at, updated_at')
    .eq('supplier_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supplier/fleet] list failed', error);
    return jsonErr('Could not load fleet', 502);
  }

  return jsonOk(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid fleet data', 422);
  }

  const { data, error } = await auth.ctx.supabase
    .from('supplier_fleet')
    .insert({
      supplier_id: auth.ctx.profile.id,
      vehicle_number: parsed.data.vehicle_number.toUpperCase(),
      vehicle_name: parsed.data.vehicle_name ?? null,
      vehicle_type: parsed.data.vehicle_type,
      capacity_litres: parsed.data.capacity_litres,
      driver_name: parsed.data.driver_name ?? null,
      price_per_trip: parsed.data.price_per_trip ?? null,
      status: parsed.data.status ?? 'available',
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return jsonErr('This vehicle number is already in your fleet.', 409);
    console.error('[supplier/fleet] create failed', error);
    return jsonErr('Could not add vehicle', 502);
  }

  return jsonOk(data, 201);
}
