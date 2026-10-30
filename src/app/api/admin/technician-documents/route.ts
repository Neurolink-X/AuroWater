import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Admin access required.', 403);

  const db = createServiceClient();
  const { data, error } = await db.from('user_files')
    .select('id, owner_user_id, document_slot, category, original_name, content_type, size_bytes, review_status, created_at')
    .not('document_slot', 'is', null)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    console.error('[admin/technician-documents] queue lookup failed', error);
    return jsonErr('Could not load the review queue.', 503);
  }
  return jsonOk({ files: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Admin access required.', 403);

  let body: { file_id?: unknown; decision?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return jsonErr('Invalid review request.', 400); }
  if (typeof body.file_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.file_id) ||
      !['approved', 'rejected'].includes(String(body.decision)) ||
      (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 500))) {
    return jsonErr('Provide a valid file, decision and optional note (max 500 characters).', 422);
  }
  if (body.decision === 'rejected' && !(body.note as string | undefined)?.trim()) {
    return jsonErr('Add a short reason when rejecting a document.', 422);
  }

  const db = createServiceClient();
  const { data: file, error: lookupError } = await db.from('user_files')
    .select('id, owner_user_id, document_slot, review_status')
    .eq('id', body.file_id)
    .maybeSingle();
  if (lookupError || !file || !file.document_slot) return jsonErr('Document not found.', 404);

  const reviewedAt = new Date().toISOString();
  const { data: updated, error } = await db.from('user_files')
    .update({
      review_status: body.decision,
      reviewed_by: auth.ctx.user.id,
      reviewed_at: reviewedAt,
      review_note: typeof body.note === 'string' ? body.note.trim() : null,
      updated_at: reviewedAt,
    })
    .eq('id', file.id)
    .select('id, owner_user_id, document_slot, review_status, reviewed_at, review_note')
    .single();
  if (error || !updated) {
    console.error('[admin/technician-documents] review update failed', error);
    return jsonErr('Could not save the document review.', 503);
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: auth.ctx.user.id,
    action: body.decision === 'approved' ? 'technician_document_approved' : 'technician_document_rejected',
    entity: 'user_file',
    entity_id: file.id,
    meta: { owner_user_id: file.owner_user_id, document_slot: file.document_slot, note: typeof body.note === 'string' ? body.note.trim() : null },
  });
  if (auditError) {
    console.error('[admin/technician-documents] review audit failed', auditError);
    return jsonErr('Review was saved but its audit record failed. Contact an administrator before taking further action.', 503);
  }
  return jsonOk({ file: updated });
}
