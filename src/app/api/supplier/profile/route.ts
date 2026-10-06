import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const updateSchema = z.object({
  business_name: z.string().trim().min(2).max(120).optional(),
  gstin: z.string().trim().max(20).optional(),
  service_cities: z.array(z.string().trim().min(2).max(80)).max(30).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, email, phone, city, pincode, aurotap_id, business_name, gstin, service_cities, role, status, is_active')
    .eq('id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    console.error('[supplier/profile] get failed', error);
    return jsonErr('Could not load supplier profile', 502);
  }
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
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid profile update', 422);
  }

  const db = createServiceClient();
  try {
    const { data, error } = await db.rpc('update_supplier_profile', {
      p_supplier_id: auth.ctx.profile.id,
      p_business_name: parsed.data.business_name ?? null,
      p_gstin: parsed.data.gstin ?? null,
      p_service_cities: parsed.data.service_cities ?? null,
    });

    if (error || !data) {
      if (error) console.error('[supplier/profile] update failed', error);
      return jsonErr('Could not update supplier profile', 502);
    }

    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('FORBIDDEN')) return jsonErr('Forbidden', 403);
    if (message.includes('SUPPLIER_NOT_FOUND')) return jsonErr('Supplier profile not found', 404);
    console.error('[supplier/profile] update exception', message);
    return jsonErr('Could not update supplier profile', 502);
  }
}
