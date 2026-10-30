import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
const allowedStatuses = new Set(['open', 'in_review', 'waiting_customer', 'resolved', 'rejected']);

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Forbidden', 403);
  const status = req.nextUrl.searchParams.get('status');
  const db = createServiceClient();
  let query = db.from('account_recovery_requests')
    .select('id, request_number, user_id, contact_name, contact_email, contact_phone, category, message, status, assigned_admin_id, admin_note, ownership_verified_at, resolved_at, created_at, updated_at')
    .order('created_at', { ascending: false }).limit(100);
  if (status && allowedStatuses.has(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.error('[admin/account-recovery] list failed', error);
    return jsonErr('Could not load account recovery requests.', 502);
  }
  return jsonOk(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Forbidden', 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Invalid request.', 400);
  const id = typeof body.request_id === 'string' ? body.request_id : '';
  const status = typeof body.status === 'string' ? body.status : '';
  const note = typeof body.admin_note === 'string' ? body.admin_note.trim().slice(0, 1000) : '';
  const verify = body.verify_ownership === true;
  if (!id || !allowedStatuses.has(status)) return jsonErr('Request ID and a valid status are required.', 422);
  if (verify && note.length < 10) return jsonErr('Add a verification note before confirming ownership.', 422);

  const db = createServiceClient();
  const { data: existing, error: readError } = await db.from('account_recovery_requests')
    .select('id, status, user_id, ownership_verified_at').eq('id', id).maybeSingle();
  if (readError || !existing) return jsonErr('Request not found.', 404);
  if (existing.status === 'resolved' || existing.status === 'rejected') return jsonErr('This request is already closed.', 409);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status, admin_note: note || null, assigned_admin_id: auth.ctx.user.id, updated_at: now,
  };
  if (verify) {
    patch.ownership_verified_at = now;
    patch.ownership_verified_by = auth.ctx.user.id;
  }
  if (status === 'resolved' || status === 'rejected') patch.resolved_at = now;

  const { data: updated, error } = await db.from('account_recovery_requests')
    .update(patch).eq('id', id).eq('status', existing.status)
    .select('id, status, ownership_verified_at, resolved_at, updated_at').maybeSingle();
  if (error || !updated) {
    console.error('[admin/account-recovery] update failed', error);
    return jsonErr('Request changed or could not be updated. Refresh and try again.', 409);
  }
  const { error: auditError } = await db.from('account_recovery_audit').insert({
    request_id: id, actor_user_id: auth.ctx.user.id,
    action: verify ? 'ownership_verified_and_review_updated' : 'review_updated',
    details: { from_status: existing.status, to_status: status, note_added: Boolean(note), ownership_verified: verify },
  });
  if (auditError) {
    console.error('[admin/account-recovery] audit insert failed', auditError);
    return jsonErr('Request was updated, but audit logging failed. Escalate this incident; do not repeat the action.', 500);
  }
  return jsonOk(updated);
}
