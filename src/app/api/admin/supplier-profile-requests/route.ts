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
  const { data, error } = await db.from('supplier_profile_change_requests')
    .select('id, supplier_id, requested_changes, status, admin_note, created_at, profiles:profiles!supplier_profile_change_requests_supplier_id_fkey(full_name, phone, city, email)')
    .order('created_at', { ascending: false }).limit(300);
  if (error) {
    console.error('[admin/supplier-profile-requests] load failed', error);
    return jsonErr('Could not load supplier profile requests.', 502);
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
  const db = createServiceClient();
  const { data: request, error: loadError } = await db.from('supplier_profile_change_requests')
    .select('id, supplier_id, requested_changes, status').eq('id', b.request_id).maybeSingle();
  if (loadError || !request) {
    if (loadError) console.error('[admin/supplier-profile-requests] lookup failed', loadError);
    return jsonErr('Profile change request not found.', 404);
  }
  if (request.status !== 'PENDING') return jsonErr('This request has already been reviewed.', 409);
  const changes = request.requested_changes as Record<string, unknown>;
  const now = new Date().toISOString();
  const adminNote = typeof b.admin_note === 'string' ? b.admin_note.trim().slice(0, 500) : null;

  if (b.status === 'APPROVED') {
    const profilePatch: Record<string, unknown> = {};
    for (const key of ['full_name', 'phone', 'business_name', 'city'] as const) {
      if (changes[key] !== undefined) profilePatch[key] = changes[key];
    }
    if (Object.keys(profilePatch).length) {
      const { error } = await db.from('profiles').update(profilePatch).eq('id', request.supplier_id);
      if (error) {
        console.error('[admin/supplier-profile-requests] profile update failed', error);
        return jsonErr('Could not apply approved profile details.', 502);
      }
    }
    const settingsPatch: Record<string, unknown> = {};
    if (changes.address !== undefined) settingsPatch.business_address = changes.address;
    if (changes.pincode !== undefined) settingsPatch.pincode = changes.pincode;
    if (Object.keys(settingsPatch).length) {
      const { data: existing, error: readError } = await db.from('supplier_settings')
        .select('id').eq('user_id', request.supplier_id).maybeSingle();
      if (readError) {
        console.error('[admin/supplier-profile-requests] settings lookup failed', readError);
        return jsonErr('Could not verify supplier settings. Profile details may have been updated; do not retry blindly—inspect the supplier record first.', 502);
      }
      if (existing) {
        const { error } = await db.from('supplier_settings').update(settingsPatch).eq('user_id', request.supplier_id);
        if (error) {
          console.error('[admin/supplier-profile-requests] settings update failed', error);
          return jsonErr('Could not apply the approved service address. Profile fields may already be updated; inspect before retrying.', 502);
        }
      } else {
        return jsonErr('Supplier dispatch settings do not exist yet. Create/repair those settings before approving this address change.', 409);
      }
    }
  }

  const { data: updated, error } = await db.from('supplier_profile_change_requests').update({
    status: b.status, admin_note: adminNote, reviewed_by: auth.ctx.profile.id,
    reviewed_at: now, updated_at: now,
  }).eq('id', request.id).eq('status', 'PENDING').select('id, status').maybeSingle();
  if (error || !updated) {
    if (error) console.error('[admin/supplier-profile-requests] review update failed', error);
    return jsonErr('Could not save review status. Inspect the supplier record before retrying.', 409);
  }
  return jsonOk(updated);
}
