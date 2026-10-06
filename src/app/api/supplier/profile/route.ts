import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const updateSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  business_name: z.string().max(200).optional().nullable(),
  business_type: z.string().max(120).optional().nullable(),
  gst_number: z.string().max(30).optional().nullable(),
  vehicle_type: z.string().max(60).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  pincode: z.string().max(12).optional().nullable(),
  service_area_km: z.number().int().min(1).max(100).optional(),
});

const PROFILE_FIELDS = [
  'id',
  'full_name',
  'email',
  'phone',
  'city',
  'pincode',
  'business_name',
  'business_type',
  'gst_number',
  'vehicle_type',
  'service_area_km',
  'aurotap_id',
  'status',
  'is_active',
].join(', ');

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) return jsonErr(error.message, 502);
  if (!data) return jsonErr('Supplier profile not found', 404);

  return jsonOk(data);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid profile update', 422);

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', auth.ctx.profile.id)
    .select(PROFILE_FIELDS)
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data);
}
