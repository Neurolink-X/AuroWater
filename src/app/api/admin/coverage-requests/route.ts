import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const { data, error } = await db
    .from('supplier_zone_requests')
    .select('id, supplier_id, zone_id, service_keys, status, supplier_note, admin_note, created_at, updated_at, profiles:supplier_id(full_name, phone, city), service_zones:zone_id(city, name, status, pincodes)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[admin/coverage-requests] load failed', error);
    return jsonErr('Could not load coverage requests.', 502);
  }
  return jsonOk(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  let body: unknown;
  try { body = await req.json(); } catch { return jsonErr('Invalid JSON body', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Request body must be an object.', 400);
  const b = body as Record<string, unknown>;
  if (typeof b.request_id !== 'string' || !['APPROVED', 'REJECTED'].includes(String(b.status))) {
    return jsonErr('request_id and status APPROVED or REJECTED are required.', 422);
  }
  const adminNote = typeof b.admin_note === 'string' ? b.admin_note.trim().slice(0, 500) : null;
  const db = createServiceClient();
  const { data: request, error: loadError } = await db.from('supplier_zone_requests')
    .select('id, supplier_id, zone_id, status').eq('id', b.request_id).maybeSingle();
  if (loadError || !request) {
    if (loadError) console.error('[admin/coverage-requests] request lookup failed', loadError);
    return jsonErr('Coverage request not found.', 404);
  }
  if (request.status !== 'PENDING') return jsonErr('This request has already been reviewed. Refresh the list.', 409);

  if (b.status === 'APPROVED') {
    const { data: zone, error: zoneError } = await db.from('service_zones').select('id, name, status').eq('id', request.zone_id).maybeSingle();
    if (zoneError || !zone) return jsonErr('The selected service area no longer exists.', 409);
    const { error: linkError } = await db.from('supplier_zones')
      .upsert({ supplier_id: request.supplier_id, zone_id: request.zone_id }, { onConflict: 'supplier_id,zone_id' });
    if (linkError) {
      console.error('[admin/coverage-requests] supplier-zone mapping failed', linkError);
      return jsonErr('Could not map supplier to this service area.', 502);
    }
  }

  const { data: updated, error: updateError } = await db.from('supplier_zone_requests')
    .update({
      status: b.status, admin_note: adminNote, reviewed_by: auth.ctx.profile.id,
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    .eq('id', request.id).eq('status', 'PENDING')
    .select('id, status, supplier_id, zone_id').maybeSingle();
  if (updateError || !updated) {
    console.error('[admin/coverage-requests] review update failed', updateError);
    return jsonErr('Could not save the review. Check the request and refresh.', 502);
  }

  try {
    await db.from('audit_logs').insert({
      actor_id: auth.ctx.profile.id, action: 'supplier.coverage_request.review',
      entity: 'supplier_zone_requests', entity_id: request.id,
      meta: { supplier_id: request.supplier_id, zone_id: request.zone_id, status: b.status, admin_note: adminNote },
    });
  } catch (e) {
    console.error('[admin/coverage-requests] audit log failed', e);
  }
  return jsonOk(updated);
}
