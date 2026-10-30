import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
const BUCKET = 'private-user-files';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const db = createServiceClient();

  const { data: file, error } = await db.from('user_files')
    .select('id, owner_user_id, object_path, category, original_name, content_type, review_status')
    .eq('id', id).maybeSingle();
  if (error || !file) return jsonErr('File not found.', 404);

  const isOwner = file.owner_user_id === auth.ctx.user.id;
  const isAdmin = auth.ctx.profile.role === 'admin';
  if (!isOwner && !isAdmin) return jsonErr('You are not allowed to access this file.', 403);

  // Identity/business verification files are not exposed until an admin reviews them.
  if (!isAdmin && ['identity_document', 'business_document', 'skill_certificate'].includes(file.category)) {
    return jsonErr('This document is awaiting secure review.', 403);
  }

  const { data, error: signedError } = await db.storage.from(BUCKET)
    .createSignedUrl(file.object_path, 60);
  if (signedError || !data?.signedUrl) {
    console.error('[files/download] signed URL creation failed', signedError);
    return jsonErr('Could not open this file right now.', 503);
  }

  await db.from('audit_logs').insert({
    actor_id: auth.ctx.user.id, action: 'file_accessed',
    entity: 'user_file', entity_id: file.id,
    meta: { category: file.category, owner_access: isOwner, admin_access: isAdmin },
  });

  return jsonOk({
    file: { id: file.id, name: file.original_name, category: file.category, content_type: file.content_type },
    url: data.signedUrl,
    expires_in: 60,
  });
}
