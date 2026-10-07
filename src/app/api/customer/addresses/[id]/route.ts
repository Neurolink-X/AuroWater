import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { OUT_OF_ZONE_MESSAGE } from '@/lib/geo';
import { sanitiseText } from '@/lib/sanitise';

// Live database contract for public.addresses:
//   owner column ........ customer_id
//   address text ........ line1, line2 (kept in sync with house_flat, area)

const SERVED_CITIES = ['gorakhpur', 'kanpur', 'lucknow'];

function withFormFields(row: Record<string, unknown>) {
  return {
    ...row,
    house_flat: row.house_flat ?? row.line1 ?? '',
    area: row.area ?? row.line2 ?? '',
  };
}

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

  if (typeof body.label === 'string') {
    patch.label = sanitiseText(body.label, 40);
  }
  if (typeof body.house_flat === 'string') {
    const value = sanitiseText(body.house_flat);
    if (!value.trim()) return jsonErr('house_flat is required', 400);
    patch.house_flat = value;
    patch.line1 = value;
  }
  if (typeof body.area === 'string') {
    const value = sanitiseText(body.area);
    if (!value.trim()) return jsonErr('area is required', 400);
    patch.area = value;
    patch.line2 = value;
  }
  if (typeof body.city === 'string') {
    const value = sanitiseText(body.city, 80);
    if (!value.trim()) return jsonErr('city is required', 400);
    if (!SERVED_CITIES.includes(value.trim().toLowerCase())) {
      return jsonErr(OUT_OF_ZONE_MESSAGE, 400);
    }
    patch.city = value;
  }

  if (typeof body.pincode === 'string') {
    const value = body.pincode.trim();
    if (!/^\d{6}$/.test(value)) return jsonErr('pincode must be 6 digits', 400);
    patch.pincode = value;
  }
  if (typeof body.landmark === 'string') {
    patch.landmark = sanitiseText(body.landmark, 120);
  }
  if (typeof body.is_default === 'boolean') {
    patch.is_default = body.is_default;
  }

  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = body.lat === null ? null : Number(body.lat);
    const lng = body.lng === null ? null : Number(body.lng);

    if (
      (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
    ) {
      return jsonErr('Invalid latitude or longitude', 400);
    }

    if (lat === null || lng === null) {
      return jsonErr('Latitude and longitude must be provided together', 400);
    }

    patch.lat = lat;
    patch.lng = lng;
  }

  if (Object.keys(patch).length === 0) {
    return jsonErr('Nothing to update', 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('addresses')
    .update(patch)
    .eq('id', id)
    .eq('customer_id', auth.ctx.profile.id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[addresses:PUT]', error.message);
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Address not found', 404);
  }


  if (patch.is_default === true) {
    await auth.ctx.supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', auth.ctx.profile.id)
      .neq('id', id);
    await auth.ctx.supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .eq('customer_id', auth.ctx.profile.id);
  }

  return jsonOk(withFormFields(data));
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

  const { data, error } = await auth.ctx.supabase
    .from('addresses')
    .delete()
    .eq('id', id)

    .eq('customer_id', auth.ctx.profile.id)
    .select('id');

  if (error) {
    console.error('[addresses:DELETE]', error.message);
    return jsonErr(error.message, 500);
  }
  if (!data || data.length === 0) {
    return jsonErr('Address not found', 404);
  }

  return jsonOk({ deleted: true as const });
}
