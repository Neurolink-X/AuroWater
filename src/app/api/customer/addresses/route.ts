import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { data, error } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('user_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    return jsonErr(error.message, 500);
  }

  return jsonOk(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const house_flat = typeof body.house_flat === 'string' ? body.house_flat.trim() : '';
  const area = typeof body.area === 'string' ? body.area.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';

  if (!house_flat || !city || !pincode) {
    return jsonErr('house_flat, city, and pincode are required', 400);
  }
  if (!/^\d{6}$/.test(pincode)) {
    return jsonErr('pincode must be 6 digits', 400);
  }
  if (!city.trim()) {
    return jsonErr('city is required', 400);
  }
  if (!house_flat.trim()) {
    return jsonErr('house_flat is required', 400);
  }

  const row = {
    user_id: auth.ctx.profile.id,
    label: typeof body.label === 'string' ? body.label : 'Home',
    house_flat,
    area,
    city,
    pincode,
    landmark: typeof body.landmark === 'string' ? body.landmark : null,
    is_default: Boolean(body.is_default),
  };

  const { data: created, error } = await auth.ctx.supabase.from('addresses').insert(row).select('*').single();

  if (error || !created) {
    return jsonErr(error?.message ?? 'Failed to save address', 500);
  }

  if (row.is_default) {
    await auth.ctx.supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', auth.ctx.profile.id)
      .neq('id', created.id);
    await auth.ctx.supabase.from('addresses').update({ is_default: true }).eq('id', created.id);
  }

  return jsonOk(created, 201);
}
