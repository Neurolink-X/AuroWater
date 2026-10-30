// PATH: src/app/api/admin/account-recovery/route.ts
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import {
  RECOVERY_STATUSES, UUID_PATTERN, firstIssue, reviewSchema, type RecoveryStatus,
} from '@/lib/account-recovery/shared';

export const dynamic = 'force-dynamic';

const LIST_COLUMNS =
  'id, request_number, user_id, contact_name, contact_email, contact_phone, category, message, status, assigned_admin_id, admin_note, ownership_verified_at, resolved_at, created_at, updated_at';
const isStatus = (s: string | null): s is RecoveryStatus => !!s && (RECOVERY_STATUSES as readonly string[]).includes(s);

async function requireAdmin(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return { response: auth.response } as const;
  if (auth.ctx.profile.role !== 'admin') return { response: jsonErr('Forbidden', 403) } as const;
  return { adminId: auth.ctx.user.id } as const;
}

const noStore = <T extends Response>(res: T): T => { res.headers.set('Cache-Control', 'no-store'); return res; };

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('response' in gate) return gate.response;

  const params = req.nextUrl.searchParams;
  const db = createServiceClient();

  // 1) Audit history for one request.
  const requestId = params.get('request_id');
  if (requestId) {
    if (!UUID_PATTERN.test(requestId)) return jsonErr('Invalid request ID.', 422);
    const { data, error } = await db.from('account_recovery_audit')
      .select('id, request_id, actor_user_id, action, details, created_at')
      .eq('request_id', requestId).order('created_at', { ascending: false }).limit(100);
    if (error) {
      console.error('[admin/account-recovery] audit history failed', error);
      return jsonErr('Could not load audit history.', 502);
    }
    return noStore(jsonOk(data ?? []));
  }

  // 2) Per-status counts for the tab badges (a failed count is null, never fatal).
  if (params.get('summary') === '1') {
    const entries = await Promise.all(RECOVERY_STATUSES.map(async (s) => {
      const { count, error } = await db.from('account_recovery_requests')
        .select('id', { count: 'exact', head: true }).eq('status', s);
      return [s, error ? null : count ?? 0] as const;
    }));
    return noStore(jsonOk(Object.fromEntries(entries)));
  }

  // 3) Request list, newest first, with a bounded page size.
  const status = params.get('status');
  const limit = Math.min(200, Math.max(1, Number(params.get('limit')) || 100));
  let query = db.from('account_recovery_requests').select(LIST_COLUMNS)
    .order('created_at', { ascending: false }).limit(limit);
  if (isStatus(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.error('[admin/account-recovery] list failed', error);
    return jsonErr('Could not load account recovery requests.', 502);
  }
  return noStore(jsonOk(data ?? []));
}

/** Maps SQLSTATE codes raised by update_account_recovery_review() to precise HTTP responses. */
function mapReviewError(error: { code?: string; message?: string }) {
  const msg = error.message ?? '';
  if (error.code === 'P0002' || msg.includes('not found')) return jsonErr('Request not found.', 404);
  if (msg.includes('already closed')) return jsonErr('This request is already closed.', 409, 'ALREADY_CLOSED');
  if (msg.includes('ownership must be verified')) return jsonErr('Verify ownership before resolving this request.', 409, 'VERIFY_FIRST');
  if (msg.includes('verification note')) return jsonErr('Add a verification note before confirming ownership.', 422);
  if (msg.includes('rejected request')) return jsonErr('Ownership cannot be verified on a rejected request.', 422);
  if (error.code === '22023') return jsonErr('Invalid review details.', 422);
  return jsonErr('Could not update the request. Refresh and try again.', 502);
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('response' in gate) return gate.response;

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return jsonErr('Invalid request.', 400);

  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(firstIssue(parsed.error, 'Request ID and a valid status are required.'), 422);
  const { request_id, status, admin_note, verify_ownership } = parsed.data;

  const db = createServiceClient();
  const { data, error } = await db.rpc('update_account_recovery_review', {
    p_request_id: request_id, p_admin_id: gate.adminId, p_status: status,
    p_admin_note: admin_note, p_verify_ownership: verify_ownership,
  });
  const updated = Array.isArray(data) ? data[0] : data;
  if (error || !updated) {
    console.error('[admin/account-recovery] transactional update failed', error);
    return error ? mapReviewError(error) : jsonErr('Could not update the request. Refresh and try again.', 502);
  }
  return noStore(jsonOk(updated));
}






// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';

// export const dynamic = 'force-dynamic';
// const allowedStatuses = new Set(['open', 'in_review', 'waiting_customer', 'resolved', 'rejected']);

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (auth.ctx.profile.role !== 'admin') return jsonErr('Forbidden', 403);
//   const requestId = req.nextUrl.searchParams.get('request_id');
//   const db = createServiceClient();
//   if (requestId) {
//     const { data: audit, error: auditError } = await db.from('account_recovery_audit')
//       .select('id, request_id, actor_user_id, action, details, created_at')
//       .eq('request_id', requestId).order('created_at', { ascending: false }).limit(100);
//     if (auditError) {
//       console.error('[admin/account-recovery] audit history failed', auditError);
//       return jsonErr('Could not load audit history.', 502);
//     }
//     return jsonOk(audit ?? []);
//   }
//   const status = req.nextUrl.searchParams.get('status');
//   let query = db.from('account_recovery_requests')
//     .select('id, request_number, user_id, contact_name, contact_email, contact_phone, category, message, status, assigned_admin_id, admin_note, ownership_verified_at, resolved_at, created_at, updated_at')
//     .order('created_at', { ascending: false }).limit(100);
//   if (status && allowedStatuses.has(status)) query = query.eq('status', status);
//   const { data, error } = await query;
//   if (error) {
//     console.error('[admin/account-recovery] list failed', error);
//     return jsonErr('Could not load account recovery requests.', 502);
//   }
//   return jsonOk(data ?? []);
// }

// export async function PATCH(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (auth.ctx.profile.role !== 'admin') return jsonErr('Forbidden', 403);
//   let body: Record<string, unknown>;
//   try { body = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
//   if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Invalid request.', 400);
//   const id = typeof body.request_id === 'string' ? body.request_id : '';
//   const status = typeof body.status === 'string' ? body.status : '';
//   const note = typeof body.admin_note === 'string' ? body.admin_note.trim().slice(0, 1000) : '';
//   const verify = body.verify_ownership === true;
//   if (!id || !allowedStatuses.has(status)) return jsonErr('Request ID and a valid status are required.', 422);
//   if (verify && note.length < 10) return jsonErr('Add a verification note before confirming ownership.', 422);

//   const db = createServiceClient();
//   const { data, error } = await db.rpc('update_account_recovery_review', {
//     p_request_id: id, p_admin_id: auth.ctx.user.id, p_status: status,
//     p_admin_note: note, p_verify_ownership: verify,
//   });
//   const updated = Array.isArray(data) ? data[0] : data;
//   if (error || !updated) {
//     console.error('[admin/account-recovery] transactional update failed', error);
//     const message = error?.message?.includes('already closed') ? 'This request is already closed.' :
//       error?.message?.includes('not found') ? 'Request not found.' :
//       error?.message?.includes('verification note') ? 'Add a verification note before confirming ownership.' :
//       'Request changed or could not be updated. Refresh and try again.';
//     return jsonErr(message, error?.message?.includes('not found') ? 404 : 409);
//   }
//   return jsonOk(updated);
// }
