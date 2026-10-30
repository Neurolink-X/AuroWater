import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const REQUIRED = ['aadhaar_front', 'aadhaar_back', 'profile_photo'] as const;
const ALLOWED = [...REQUIRED, 'skill_certificate'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!['technician', 'plumber'].includes(auth.ctx.profile.role)) return jsonErr('Technician access required.', 403);

  const db = createServiceClient();
  const { data, error } = await db.from('user_files')
    .select('id, document_slot, category, original_name, size_bytes, review_status, review_note, created_at, reviewed_at')
    .eq('owner_user_id', auth.ctx.user.id)
    .in('document_slot', [...ALLOWED])
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[technician/documents] status lookup failed', error);
    return jsonErr('Could not load document status.', 503);
  }

  const latest: Record<string, unknown> = {};
  for (const file of data ?? []) {
    if (file.document_slot && !latest[file.document_slot]) latest[file.document_slot] = file;
  }
  const files = Object.fromEntries(ALLOWED.map((slot) => [slot, latest[slot] ?? null]));
  const requiredApproved = REQUIRED.every((slot) => (latest[slot] as { review_status?: string } | undefined)?.review_status === 'approved');
  const anyRejected = REQUIRED.some((slot) => (latest[slot] as { review_status?: string } | undefined)?.review_status === 'rejected');
  const submitted = REQUIRED.every((slot) => Boolean(latest[slot]));
  return jsonOk({ files, verification_status: requiredApproved ? 'verified' : anyRejected ? 'rejected' : submitted ? 'pending' : 'unverified' });
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!['technician', 'plumber'].includes(auth.ctx.profile.role)) return jsonErr('Technician access required.', 403);

  let body: { file_ids?: unknown };
  try { body = await req.json(); } catch { return jsonErr('Invalid submission.', 400); }
  if (!Array.isArray(body.file_ids) || body.file_ids.length < 3 || body.file_ids.length > 4 ||
      body.file_ids.some((id) => typeof id !== 'string' || id.length > 64)) {
    return jsonErr('Submit the three required documents and optional certificate.', 422);
  }

  const db = createServiceClient();
  const ids = [...new Set(body.file_ids as string[])];
  if (ids.length !== body.file_ids.length) return jsonErr('Duplicate document references are not allowed.', 422);

  const { data: files, error } = await db.from('user_files')
    .select('id, owner_user_id, document_slot, review_status')
    .eq('owner_user_id', auth.ctx.user.id)
    .in('id', ids);
  if (error || !files || files.length !== ids.length) return jsonErr('One or more uploaded files were not found.', 422);

  const bySlot = new Map(files.map((file) => [file.document_slot, file]));
  if (REQUIRED.some((slot) => !bySlot.has(slot)) ||
      files.some((file) => !ALLOWED.includes(file.document_slot as typeof ALLOWED[number]))) {
    return jsonErr('Upload Aadhaar front, Aadhaar back and profile photo before submitting.', 422);
  }
  if (files.some((file) => file.review_status === 'approved')) {
    return jsonErr('Approved documents cannot be resubmitted. Contact support if they need updating.', 409);
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: auth.ctx.user.id,
    action: 'technician_documents_submitted',
    entity: 'user_file',
    entity_id: files[0].id,
    meta: { file_ids: ids, document_count: ids.length },
  });
  if (auditError) {
    console.error('[technician/documents] submission audit failed', auditError);
    return jsonErr('Submission could not be safely recorded. Please retry.', 503);
  }

  return jsonOk({ submitted: true, verification_status: 'pending' });
}
