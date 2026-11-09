// PATH: src/app/api/admin/verification/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { DOCUMENT_SLOTS, REVIEW_STATUSES, isDocumentSlot, slotApplicantRoles } from '@/lib/private-file-validation';

export const dynamic = 'force-dynamic';

const APPLICANT_ROLES = ['supplier', 'technician', 'plumber'];
const SLOT_KEYS = Object.keys(DOCUMENT_SLOTS);
const PROFILE_COLUMNS = 'id, full_name, email, phone, role, status, verification_status, city';
const noStore = <T extends Response>(r: T): T => { r.headers.set('Cache-Control', 'no-store'); return r; };

async function requireAdmin(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return { response: auth.response } as const;
  if (auth.ctx.profile.role !== 'admin') return { response: jsonErr('Admin access required.', 403) } as const;
  return { adminId: auth.ctx.user.id } as const;
}

/** GET ?status=pending|approved|rejected&limit=  →  { files, counts } (oldest first so nobody waits forever). */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('response' in gate) return gate.response;
  const db = createServiceClient();

  const status = req.nextUrl.searchParams.get('status');
  const limit = Math.min(300, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 200));

  let q = db.from('user_files')
    .select('id, owner_user_id, document_slot, category, original_name, content_type, size_bytes, review_status, review_note, created_at, reviewed_at')
    .in('document_slot', SLOT_KEYS).order('created_at', { ascending: true }).limit(limit);
  if (status && (REVIEW_STATUSES as readonly string[]).includes(status)) q = q.eq('review_status', status);

  // Start counts independently so applicant lookups do not wait for a slow count.
  const countRequest = Promise.all(REVIEW_STATUSES.map((s) =>
    db.from('user_files').select('id', { count: 'exact', head: true }).in('document_slot', SLOT_KEYS).eq('review_status', s)
  ));
  const { data: files, error } = await q;
  if (error) { console.error('[admin/verification] queue lookup failed', error); return jsonErr('Could not load the verification queue.', 503); }

  const ownerIds = [...new Set((files ?? []).map((f) => f.owner_user_id))];
  const applicationOwnerIds = [...new Set((files ?? []).flatMap((f) =>
    isDocumentSlot(f.document_slot) && slotApplicantRoles(f.document_slot).includes('technician') ? [f.owner_user_id] : []
  ))];
  const [{ data: profiles, error: profileError }, { data: pending, error: pendingError }, countResults] = await Promise.all([
    ownerIds.length ? db.from('profiles').select(PROFILE_COLUMNS).in('id', ownerIds) : { data: [], error: null },
    applicationOwnerIds.length
      ? db.from('applications').select('user_id').in('user_id', applicationOwnerIds)
        .eq('type', 'technician').in('status', ['pending', 'pending_approval'])
      : { data: [], error: null },
    countRequest,
  ]);
  if (profileError) { console.error('[admin/verification] profiles lookup failed', profileError); return jsonErr('Could not load applicant details.', 503); }

  // Applicants keep the customer role until approval. Resolve it from their
  // application record, with the same eligibility checks used for a review.
  if (pendingError && (profiles ?? []).some((profile) => profile.role === 'customer' && applicationOwnerIds.includes(profile.id))) {
    return jsonErr('Could not validate pending applicant documents.', 503);
  }
  const counts = Object.fromEntries(REVIEW_STATUSES.map((s, i) => [s, countResults[i].error ? null : countResults[i].count ?? 0]));
  const pendingIds = new Set((pending ?? []).map(a => a.user_id));
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows = (files ?? []).flatMap((f) => {
    const profile = byId.get(f.owner_user_id);
    if (!profile || !isDocumentSlot(f.document_slot)) return [];
    const effectiveRole = profile.role === 'customer' && pendingIds.has(profile.id)
      ? 'technician' : profile.role;
    if (!APPLICANT_ROLES.includes(effectiveRole) || !slotApplicantRoles(f.document_slot).includes(effectiveRole)) return [];
    const applicant = { ...profile, business_name: null, role: effectiveRole };
    return [{ ...f, applicant }];
  });
  return noStore(jsonOk({ files: rows, counts }));
}

const reviewSchema = z.object({
  file_id: z.string().uuid('Invalid file.'),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500, 'Note must be 500 characters or fewer.').optional(),
}).refine((v) => v.decision !== 'rejected' || !!v.note, { path: ['note'], message: 'Add a short reason when rejecting a document.' });

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ('response' in gate) return gate.response;

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonErr('Invalid review request.', 400); }
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid review request.', 422);
  const { file_id, decision, note } = parsed.data;

  const db = createServiceClient();
  const { data: file, error: lookupError } = await db.from('user_files')
    .select('id, owner_user_id, document_slot, review_status, reviewed_by, reviewed_at, review_note, updated_at')
    .eq('id', file_id).maybeSingle();
  if (lookupError || !file?.document_slot || !isDocumentSlot(file.document_slot)) return jsonErr('Document not found.', 404);

  const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', file.owner_user_id).maybeSingle();
  if (profileError || !profile) return jsonErr('Applicant account not found.', 404);
  let effectiveRole = profile.role;
  if (effectiveRole === 'customer') {
    const { data: pending, error: pendingError } = await db.from('applications')
      .select('id').eq('user_id', file.owner_user_id).eq('type', 'technician')
      .in('status', ['pending', 'pending_approval']).limit(1).maybeSingle();
    if (pendingError) return jsonErr('Could not verify the applicant role.', 503);
    if (pending) effectiveRole = 'technician';
  }
  if (!slotApplicantRoles(file.document_slot).includes(effectiveRole)) {
    return jsonErr('Document does not match an eligible applicant role.', 409);
  }

  const reviewedAt = new Date().toISOString();
  // Optimistic lock: only update if nobody reviewed it since we read it (two admins, one click each).
  const { data: updated, error } = await db.from('user_files').update({
    review_status: decision, reviewed_by: gate.adminId, reviewed_at: reviewedAt, review_note: note ?? null, updated_at: reviewedAt,
  }).eq('id', file.id).eq('review_status', file.review_status).eq('updated_at', file.updated_at).select('id, owner_user_id, document_slot, review_status, reviewed_at, review_note').maybeSingle();
  if (error) { console.error('[admin/verification] review update failed', error); return jsonErr('Could not save the document review.', 503); }
  if (!updated) return jsonErr('This document was just reviewed by someone else. Refresh to see the latest.', 409, 'STALE');

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: gate.adminId, action: `${effectiveRole}_document_${decision}`, entity: 'user_file', entity_id: file.id,
    meta: { owner_user_id: file.owner_user_id, role: effectiveRole, account_role: profile.role, document_slot: file.document_slot, note: note ?? null, from_status: file.review_status },
  });
  if (auditError) {
    // Never leave an unaudited decision behind: roll the review back, then tell the admin to retry.
    console.error('[admin/verification] audit failed, rolling back', auditError);
    const { error: rollbackError } = await db.from('user_files').update({
      review_status: file.review_status, reviewed_by: file.reviewed_by, reviewed_at: file.reviewed_at,
      review_note: file.review_note, updated_at: file.updated_at,
    }).eq('id', file.id).eq('reviewed_at', reviewedAt).eq('review_status', decision);
    if (rollbackError) {
      console.error('[admin/verification] ROLLBACK FAILED', file.id, rollbackError);
      return jsonErr('Review saved but its audit record failed. Contact an administrator before taking further action.', 503, 'AUDIT_ROLLBACK_FAILED');
    }
    return jsonErr('The review could not be recorded safely. Nothing was changed; please retry.', 503);
  }
  return noStore(jsonOk({ file: updated }));
}
