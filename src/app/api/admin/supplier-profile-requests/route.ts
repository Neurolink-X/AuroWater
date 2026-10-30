// // PATH: src/app/api/admin/supplier-profile-requests/route.ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { DOCUMENT_SLOTS, REVIEW_STATUSES, isDocumentSlot, slotApplicantRoles } from '@/lib/private-file-validation';

export const dynamic = 'force-dynamic';

const APPLICANT_ROLES = ['supplier', 'technician', 'plumber'];
const SLOT_KEYS = Object.keys(DOCUMENT_SLOTS);
const PROFILE_COLUMNS = 'id, full_name, email, phone, role, status, verification_status, business_name, city';
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

  const [{ data: files, error }, ...countResults] = await Promise.all([
    q,
    ...REVIEW_STATUSES.map((s) => db.from('user_files').select('id', { count: 'exact', head: true }).in('document_slot', SLOT_KEYS).eq('review_status', s)),
  ]);
  if (error) { console.error('[admin/verification] queue lookup failed', error); return jsonErr('Could not load the verification queue.', 503); }
  const counts = Object.fromEntries(REVIEW_STATUSES.map((s, i) => [s, countResults[i].error ? null : countResults[i].count ?? 0]));

  const ownerIds = [...new Set((files ?? []).map((f) => f.owner_user_id))];
  const { data: profiles, error: profileError } = ownerIds.length
    ? await db.from('profiles').select(PROFILE_COLUMNS).in('id', ownerIds)
    : { data: [], error: null };
  if (profileError) { console.error('[admin/verification] profiles lookup failed', profileError); return jsonErr('Could not load applicant details.', 503); }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows = (files ?? []).flatMap((f) => {
    const applicant = byId.get(f.owner_user_id);
    return applicant && APPLICANT_ROLES.includes(applicant.role) && isDocumentSlot(f.document_slot) && slotApplicantRoles(f.document_slot).includes(applicant.role)
      ? [{ ...f, applicant }] : [];
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
  if (profileError || !profile || !slotApplicantRoles(file.document_slot).includes(profile.role)) {
    return jsonErr('Document does not match an eligible applicant role.', 409);
  }

  const reviewedAt = new Date().toISOString();
  // Optimistic lock: only update if nobody reviewed it since we read it (two admins, one click each).
  const { data: updated, error } = await db.from('user_files').update({
    review_status: decision, reviewed_by: gate.adminId, reviewed_at: reviewedAt, review_note: note ?? null, updated_at: reviewedAt,
  }).eq('id', file.id).eq('review_status', file.review_status).select('id, owner_user_id, document_slot, review_status, reviewed_at, review_note').maybeSingle();
  if (error) { console.error('[admin/verification] review update failed', error); return jsonErr('Could not save the document review.', 503); }
  if (!updated) return jsonErr('This document was just reviewed by someone else. Refresh to see the latest.', 409, 'STALE');

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: gate.adminId, action: `${profile.role}_document_${decision}`, entity: 'user_file', entity_id: file.id,
    meta: { owner_user_id: file.owner_user_id, role: profile.role, document_slot: file.document_slot, note: note ?? null, from_status: file.review_status },
  });
  if (auditError) {
    // Never leave an unaudited decision behind: roll the review back, then tell the admin to retry.
    console.error('[admin/verification] audit failed, rolling back', auditError);
    const { error: rollbackError } = await db.from('user_files').update({
      review_status: file.review_status, reviewed_by: file.reviewed_by, reviewed_at: file.reviewed_at,
      review_note: file.review_note, updated_at: file.updated_at,
    }).eq('id', file.id);
    if (rollbackError) {
      console.error('[admin/verification] ROLLBACK FAILED', file.id, rollbackError);
      return jsonErr('Review saved but its audit record failed. Contact an administrator before taking further action.', 503, 'AUDIT_ROLLBACK_FAILED');
    }
    return jsonErr('The review could not be recorded safely. Nothing was changed; please retry.', 503);
  }
  return noStore(jsonOk({ file: updated }));
}
