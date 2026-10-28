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
  const { data: requests, error } = await db
    .from('supplier_zone_requests')
    .select('id, supplier_id, zone_id, service_keys, status, supplier_note, admin_note, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('[admin/coverage-requests] load failed', error);
    return jsonErr('Could not load coverage requests.', 502);
  }

  const supplierIds = [...new Set((requests ?? []).map((r: { supplier_id: string }) => String(r.supplier_id)))];
  const zoneIds = [...new Set((requests ?? []).map((r: { zone_id: string }) => String(r.zone_id)))];
  const [profilesRes, zonesRes] = await Promise.all([
    supplierIds.length ? db.from('profiles').select('id, full_name, phone, city').in('id', supplierIds) : Promise.resolve({ data: [], error: null }),
    zoneIds.length ? db.from('service_zones').select('id, city, name, status, pincodes').in('id', zoneIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesRes.error || zonesRes.error) {
    console.error('[admin/coverage-requests] related data load failed', profilesRes.error ?? zonesRes.error);
    return jsonErr('Could not load supplier or zone details.', 502);
  }
  const profiles = new Map((profilesRes.data ?? []).map((p: { id: string }) => [String(p.id), p]));
  const zones = new Map((zonesRes.data ?? []).map((z: { id: string }) => [String(z.id), z]));
  return jsonOk((requests ?? []).map((r: { supplier_id: string; zone_id: string }) => ({
    ...r,
    profiles: profiles.get(String(r.supplier_id)) ?? null,
    service_zones: zones.get(String(r.zone_id)) ?? null,
  })));
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
    .select('id, supplier_id, zone_id, service_keys, status').eq('id', b.request_id).maybeSingle();
  if (loadError || !request) {
    if (loadError) console.error('[admin/coverage-requests] request lookup failed', loadError);
    return jsonErr('Coverage request not found.', 404);
  }
  if (request.status !== 'PENDING') return jsonErr('This request has already been reviewed. Refresh the list.', 409);

  let previousZonePincodes: string[] | null = null;
  let nextZonePincodes: string[] | null = null;
  let requestedPincodes: string[] = [];
  if (b.status === 'APPROVED') {
    const { data: zone, error: zoneError } = await db.from('service_zones')
      .select('id, name, status, city, pincodes').eq('id', request.zone_id).maybeSingle();
    if (zoneError || !zone) return jsonErr('The selected service area no longer exists.', 409);

    const { data: supplierProfile, error: supplierProfileError } = await db.from('profiles')
      .select('city').eq('id', request.supplier_id).maybeSingle();
    if (supplierProfileError || !supplierProfile) return jsonErr('Could not verify supplier city. Refresh and retry.', 409);
    const normalizeCity = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalizeCity(supplierProfile.city) && normalizeCity(supplierProfile.city) !== normalizeCity(zone.city)) {
      return jsonErr('Supplier city does not match this service area. Correct the supplier profile or select a matching zone.', 409);
    }

    const pinMatch = String(request.supplier_note ?? '').match(/Requested PIN codes:\s*([^\n]+)/i);
    requestedPincodes = pinMatch
      ? [...new Set(pinMatch[1].split(/[\s,]+/).filter((pin: string) => /^\d{6}$/.test(pin)))].slice(0, 3)
      : [];
    if (requestedPincodes.length) {
      previousZonePincodes = Array.isArray(zone.pincodes) ? zone.pincodes.map(String) : [];
      nextZonePincodes = [...new Set([...previousZonePincodes, ...requestedPincodes])];
    }
  }

  // Claim the pending request first. This prevents a mapping from being created by a
  // concurrent/rejected review. If mapping fails, restore PENDING so an admin can retry.
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await db.from('supplier_zone_requests')
    .update({
      status: b.status, admin_note: adminNote, reviewed_by: auth.ctx.profile.id,
      reviewed_at: now, updated_at: now,
    })
    .eq('id', request.id).eq('status', 'PENDING')
    .select('id, status, supplier_id, zone_id').maybeSingle();
  if (updateError || !updated) {
    if (updateError) console.error('[admin/coverage-requests] review update failed', updateError);
    return jsonErr('This request was reviewed by another admin or could not be saved. Refresh and try again.', 409);
  }

  // Only apply requested PINs after this admin successfully claims the pending request.
  if (b.status === 'APPROVED' && nextZonePincodes !== null) {
    const { error: pinUpdateError } = await db.from('service_zones')
      .update({ pincodes: nextZonePincodes, updated_at: new Date().toISOString() }).eq('id', request.zone_id);
    if (pinUpdateError) {
      console.error('[admin/coverage-requests] requested PIN update failed', pinUpdateError);
      const { error: requestRollbackError } = await db.from('supplier_zone_requests').update({
        status: 'PENDING', admin_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString(),
      }).eq('id', request.id).eq('status', 'APPROVED');
      if (requestRollbackError) console.error('[admin/coverage-requests] request rollback failed', requestRollbackError);
      return jsonErr('Could not add requested PINs to the selected zone. The request was returned to pending review.', 502);
    }
  }

  if (b.status === 'APPROVED') {
    const { error: linkError } = await db.from('supplier_zones')
      .upsert({ supplier_id: request.supplier_id, zone_id: request.zone_id, service_keys: request.service_keys }, { onConflict: 'supplier_id,zone_id' });
    if (linkError) {
      console.error('[admin/coverage-requests] supplier-zone mapping failed', linkError);
      if (previousZonePincodes !== null) {
        const { error: pinRollbackError } = await db.from('service_zones')
          .update({ pincodes: previousZonePincodes, updated_at: new Date().toISOString() }).eq('id', request.zone_id);
        if (pinRollbackError) console.error('[admin/coverage-requests] PIN rollback failed', pinRollbackError);
      }
      const { error: rollbackError } = await db.from('supplier_zone_requests').update({
        status: 'PENDING', admin_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString(),
      }).eq('id', request.id).eq('status', 'APPROVED');
      if (rollbackError) console.error('[admin/coverage-requests] rollback failed', rollbackError);
      return jsonErr('Could not map supplier to this service area. The request remains pending for retry.', 502);
    }
  }

  try {
    const { error: auditError } = await db.from('audit_logs').insert({
      actor_id: auth.ctx.profile.id, action: 'supplier.coverage_request.review',
      entity: 'supplier_zone_requests', entity_id: request.id,
      meta: { supplier_id: request.supplier_id, zone_id: request.zone_id, status: b.status, admin_note: adminNote },
    });
    if (auditError) console.error('[admin/coverage-requests] audit log failed', auditError);
  } catch (e) {
    console.error('[admin/coverage-requests] audit log failed', e);
  }
  return jsonOk({ ...updated, requested_pincodes: requestedPincodes });
}
