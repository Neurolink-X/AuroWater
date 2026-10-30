// PATH: src/app/api/files/[id]/download/route.ts
// (If your existing route lives at src/app/api/files/[id]/route.ts, put this there instead.)
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { REVIEW_GATED_CATEGORIES } from '@/lib/private-file-validation';

export const dynamic = 'force-dynamic';
const BUCKET = 'private-user-files';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 60;

type Ctx = { params: Promise<{ id: string }> };
const noStore = <T extends Response>(r: T): T => { r.headers.set('Cache-Control', 'no-store'); return r; };

async function loadFile(req: NextRequest, context: Ctx) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return { response: auth.response } as const;
  const { id } = await context.params;
  if (!UUID.test(id)) return { response: jsonErr('File not found.', 404) } as const;
  const db = createServiceClient();
  const { data: file, error } = await db.from('user_files')
    .select('id, owner_user_id, object_path, category, document_slot, original_name, content_type, review_status')
    .eq('id', id).maybeSingle();
  if (error || !file) return { response: jsonErr('File not found.', 404) } as const;
  const isOwner = file.owner_user_id === auth.ctx.user.id;
  const isAdmin = auth.ctx.profile.role === 'admin';
  if (!isOwner && !isAdmin) return { response: jsonErr('File not found.', 404) } as const; // do not reveal existence
  return { db, file, isOwner, isAdmin, userId: auth.ctx.user.id } as const;
}

/** GET ?disposition=inline|attachment  →  short-lived signed URL (audited, fail-closed). */
export async function GET(req: NextRequest, context: Ctx) {
  const loaded = await loadFile(req, context);
  if ('response' in loaded) return loaded.response;
  const { db, file, isOwner, isAdmin, userId } = loaded;

  if (!isAdmin && file.review_status !== 'approved' && REVIEW_GATED_CATEGORIES.includes(file.category)) {
    return jsonErr('This document is awaiting secure review.', 403, 'AWAITING_REVIEW');
  }

  const attachment = req.nextUrl.searchParams.get('disposition') === 'attachment';
  const { data, error: signedError } = await db.storage.from(BUCKET)
    .createSignedUrl(file.object_path, SIGNED_URL_SECONDS, attachment ? { download: file.original_name } : undefined);
  if (signedError || !data?.signedUrl) {
    console.error('[files/download] signed URL creation failed', signedError);
    return jsonErr('Could not open this file right now.', 503);
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: userId, action: 'file_accessed', entity: 'user_file', entity_id: file.id,
    meta: { category: file.category, owner_access: isOwner, admin_access: isAdmin, disposition: attachment ? 'attachment' : 'inline' },
  });
  if (auditError) {
    console.error('[files/download] access audit failed', auditError);
    return jsonErr('File access could not be safely recorded. Please retry.', 503);
  }

  return noStore(jsonOk({
    file: { id: file.id, name: file.original_name, category: file.category, content_type: file.content_type },
    url: data.signedUrl,
    expires_in: SIGNED_URL_SECONDS,
  }));
}

/** DELETE → owner (or admin) removes a file that is not yet approved. Audit first, then delete. */
export async function DELETE(req: NextRequest, context: Ctx) {
  const loaded = await loadFile(req, context);
  if ('response' in loaded) return loaded.response;
  const { db, file, isOwner, isAdmin, userId } = loaded;

  if (file.review_status === 'approved' && !isAdmin) {
    return jsonErr('Approved documents can only be removed by support.', 409, 'APPROVED_LOCKED');
  }
  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: userId, action: 'file_deleted', entity: 'user_file', entity_id: file.id,
    meta: { category: file.category, document_slot: file.document_slot, owner_action: isOwner, review_status: file.review_status },
  });
  if (auditError) {
    console.error('[files/delete] audit failed', auditError);
    return jsonErr('Removal could not be safely recorded. Please retry.', 503);
  }
  const { error: rowError } = await db.from('user_files').delete().eq('id', file.id);
  if (rowError) {
    console.error('[files/delete] row delete failed', rowError);
    return jsonErr('Could not remove this file right now.', 503);
  }
  const { error: storageError } = await db.storage.from(BUCKET).remove([file.object_path]);
  if (storageError) console.error('[files/delete] orphaned object (cleanup job should remove)', file.object_path, storageError);
  return noStore(jsonOk({ deleted: true }));
}
