import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { getServiceZone, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';
import { PINCODE, sanitiseText } from '@/lib/sanitise';

// Live database contract for public.addresses:
//   owner column ........ customer_id   (required)
//   address text ........ line1, line2  (line1 required)
//   region .............. state         (required)
//   extra form columns .. house_flat, area, landmark (added 3 Oct 2026)

const SERVED_CITIES = ['gorakhpur', 'kanpur', 'lucknow'];
const DEFAULT_STATE = 'Uttar Pradesh';

function toCoord(value: unknown): number {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
}

// Older rows only have line1/line2, so fall back to them for the form fields.
function withFormFields(row: Record<string, unknown>) {
  return {
    ...row,
    house_flat: row.house_flat ?? row.line1 ?? '',
    area: row.area ?? row.line2 ?? '',
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { data, error } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('customer_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[addresses:GET]', error.message);
    return jsonErr(error.message, 500);
  }

  const rows = (data ?? []).map((row: Record<string, unknown>) => withFormFields(row));
  return jsonOk(rows);
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

  const house_flat = sanitiseText(typeof body.house_flat === 'string' ? body.house_flat : '');
  const area = sanitiseText(typeof body.area === 'string' ? body.area : '');
  const city = sanitiseText(typeof body.city === 'string' ? body.city : '', 80);
  const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';

  if (!house_flat.trim() || !area.trim() || !city.trim() || !pincode) {
    return jsonErr('house_flat, area, city, and pincode are required', 400);
  }
  if (!PINCODE.test(pincode)) {
    return jsonErr('pincode must be 6 digits', 400);
  }

  const lat = toCoord(body.lat);
  const lng = toCoord(body.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  if (hasCoords) {
    if (!getServiceZone(lat, lng)) {
      return jsonErr(OUT_OF_ZONE_MESSAGE, 400);
    }
  } else if (!SERVED_CITIES.includes(city.trim().toLowerCase())) {
    return jsonErr(OUT_OF_ZONE_MESSAGE, 400);
  }

  const state =
    (typeof body.state === 'string' ? sanitiseText(body.state, 80) : '') || DEFAULT_STATE;

  const row = {
    customer_id: auth.ctx.profile.id,
    label: typeof body.label === 'string' ? sanitiseText(body.label, 40) : 'Home',
    line1: house_flat,
    line2: area,
    house_flat,
    area,
    city,
    state,
    pincode,
    landmark: typeof body.landmark === 'string' ? sanitiseText(body.landmark, 120) : null,
    is_default: Boolean(body.is_default),
    ...(hasCoords ? { lat, lng } : {}),
  };

  const { data: created, error } = await auth.ctx.supabase
    .from('addresses')
    .insert(row)
    .select('*')
    .single();

  if (error || !created) {
    console.error('[addresses:POST]', error?.message);
    return jsonErr(error?.message ?? 'Failed to save address', 500);
  }

  if (row.is_default) {
    await auth.ctx.supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', auth.ctx.profile.id)
      .neq('id', created.id);
    await auth.ctx.supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', created.id)
      .eq('customer_id', auth.ctx.profile.id);
  }

  return jsonOk(withFormFields(created), 201);
}
