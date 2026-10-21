import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Supplier may request coverage for configured zones; requests never activate a zone. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const [zonesRes, requestsRes] = await Promise.all([
    db.from('service_zones').select('id, city, name, status, pincodes, services').order('city').order('name'),
    db.from('supplier_zone_requests').select('id, zone_id, service_keys, status, supplier_note, admin_note, created_at, updated_at').eq('supplier_id', auth.ctx.profile.id),
  ]);
  if (zonesRes.error || requestsRes.error) {
    console.error('[supplier/coverage] load failed', zonesRes.error ?? requestsRes.error);
    return jsonErr('Coverage settings are temporarily unavailable.', 502);
  }
  return jsonOk({ zones: zonesRes.data ?? [], requests: requestsRes.data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let body: unknown;
  try { body = await req.json(); } catch { return jsonErr('Invalid JSON body', 400); }
  if (!isRecord(body) || !Array.isArray(body.zone_ids) || body.zone_ids.length < 1 || body.zone_ids.length > 30 ||
      body.zone_ids.some((id) => typeof id !== 'string')) {
    return jsonErr('Select between 1 and 30 service areas.', 422);
  }
  const zoneIds = [...new Set(body.zone_ids as string[])];
  const serviceKeys = Array.isArray(body.service_keys) &&
    body.service_keys.length <= 30 &&
    body.service_keys.every((x) => typeof x === 'string' && /^[a-z0-9_-]{1,60}$/.test(x))
      ? [...new Set(body.service_keys as string[])] : null;
  if (serviceKeys === null || serviceKeys.length === 0) return jsonErr('Choose at least one valid service type.', 422);
  const note = typeof body.supplier_note === 'string' ? body.supplier_note.trim().slice(0, 500) : '';

  const db = createServiceClient();
  const { data: zones, error: zoneError } = await db.from('service_zones').select('id').in('id', zoneIds);
  if (zoneError) {
    console.error('[supplier/coverage] zone validation failed', zoneError);
    return jsonErr('Could not validate selected service areas.', 502);
  }
  const valid = new Set((zones ?? []).map((z: { id: string }) => String(z.id)));
  if (zoneIds.some((id) => !valid.has(id))) return jsonErr('One or more selected service areas do not exist.', 422);

  const rows = zoneIds.map((zone_id) => ({
    supplier_id: auth.ctx.profile.id, zone_id, service_keys: serviceKeys,
    supplier_note: note || null, status: 'PENDING', admin_note: null,
    reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from('supplier_zone_requests').upsert(rows, { onConflict: 'supplier_id,zone_id' });
  if (error) {
    console.error('[supplier/coverage] request save failed', error);
    return jsonErr('Could not submit coverage request.', 502);
  }
  return jsonOk({ submitted: rows.length, status: 'PENDING' });
}
