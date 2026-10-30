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
  const requestId = req.nextUrl.searchParams.get('request_id');
  const db = createServiceClient();
  if (requestId) {
    const { data: audit, error: auditError } = await db.from('account_recovery_audit')
      .select('id, request_id, actor_user_id, action, details, created_at')
      .eq('request_id', requestId).order('created_at', { ascending: false }).limit(100);
    if (auditError) {
      console.error('[admin/account-recovery] audit history failed', auditError);
      return jsonErr('Could not load audit history.', 502);
    }
    return jsonOk(audit ?? []);
  }
  const status = req.nextUrl.searchParams.get('status');
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
  const { data, error } = await db.rpc('update_account_recovery_review', {
    p_request_id: id, p_admin_id: auth.ctx.user.id, p_status: status,
    p_admin_note: note, p_verify_ownership: verify,
  });
  const updated = Array.isArray(data) ? data[0] : data;
  if (error || !updated) {
    console.error('[admin/account-recovery] transactional update failed', error);
    const message = error?.message?.includes('already closed') ? 'This request is already closed.' :
      error?.message?.includes('not found') ? 'Request not found.' :
      error?.message?.includes('verification note') ? 'Add a verification note before confirming ownership.' :
      'Request changed or could not be updated. Refresh and try again.';
    return jsonErr(message, error?.message?.includes('not found') ? 404 : 409);
  }
  return jsonOk(updated);
}
