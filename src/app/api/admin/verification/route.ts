import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
const ROLES = ['supplier', 'technician', 'plumber'] as const;
const SLOT_ROLES: Record<string, string[]> = {
  aadhaar_front: ['technician', 'plumber'], aadhaar_back: ['technician', 'plumber'],
  profile_photo: ['technician', 'plumber'], skill_certificate: ['technician', 'plumber'],
  business_certificate: ['supplier'],
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Admin access required.', 403);
  const db = createServiceClient();
  const { data: files, error } = await db.from('user_files')
    .select('id, owner_user_id, document_slot, category, original_name, content_type, size_bytes, review_status, review_note, created_at, reviewed_at')
    .in('document_slot', Object.keys(SLOT_ROLES)).order('created_at', { ascending: true }).limit(300);
  if (error) { console.error('[admin/verification] queue lookup failed', error); return jsonErr('Could not load the verification queue.', 503); }
  const ownerIds = [...new Set((files ?? []).map(file => file.owner_user_id))];
  const { data: profiles, error: profileError } = ownerIds.length
    ? await db.from('profiles').select('id, full_name, email, phone, role, status, verification_status, business_name, city').in('id', ownerIds)
    : { data: [], error: null };
  if (profileError) { console.error('[admin/verification] profiles lookup failed', profileError); return jsonErr('Could not load applicant details.', 503); }
  const byId = new Map((profiles ?? []).map(profile => [profile.id, profile]));
  const rows = (files ?? []).flatMap(file => {
    const applicant = byId.get(file.owner_user_id);
    return applicant && ROLES.includes(applicant.role as typeof ROLES[number]) && SLOT_ROLES[file.document_slot]?.includes(applicant.role)
      ? [{ ...file, applicant }] : [];
  });
  return jsonOk({ files: rows });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Admin access required.', 403);
  let body: { file_id?: unknown; decision?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return jsonErr('Invalid review request.', 400); }
  if (typeof body.file_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.file_id) ||
      !['approved', 'rejected'].includes(String(body.decision)) ||
      (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 500)))
    return jsonErr('Provide a valid file, decision and optional note (max 500 characters).', 422);
  if (body.decision === 'rejected' && !(body.note as string | undefined)?.trim()) return jsonErr('Add a short reason when rejecting a document.', 422);
  const db = createServiceClient();
  const { data: file, error: lookupError } = await db.from('user_files').select('id, owner_user_id, document_slot').eq('id', body.file_id).maybeSingle();
  if (lookupError || !file?.document_slot) return jsonErr('Document not found.', 404);
  const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', file.owner_user_id).maybeSingle();
  if (profileError || !profile || !ROLES.includes(profile.role as typeof ROLES[number]) || !SLOT_ROLES[file.document_slot]?.includes(profile.role))
    return jsonErr('Document does not match an eligible applicant role.', 409);
  const reviewedAt = new Date().toISOString();
  const { data: updated, error } = await db.from('user_files').update({
    review_status: body.decision, reviewed_by: auth.ctx.user.id, reviewed_at: reviewedAt,
    review_note: typeof body.note === 'string' ? body.note.trim() : null, updated_at: reviewedAt,
  }).eq('id', file.id).select('id, owner_user_id, document_slot, review_status, reviewed_at, review_note').single();
  if (error || !updated) { console.error('[admin/verification] review update failed', error); return jsonErr('Could not save the document review.', 503); }
  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: auth.ctx.user.id, action: `${profile.role}_document_${body.decision}`, entity: 'user_file', entity_id: file.id,
    meta: { owner_user_id: file.owner_user_id, role: profile.role, document_slot: file.document_slot, note: typeof body.note === 'string' ? body.note.trim() : null },
  });
  if (auditError) { console.error('[admin/verification] audit failed', auditError); return jsonErr('Review was saved but its audit record failed. Contact an administrator before taking further action.', 503); }
  return jsonOk({ file: updated });
}
