import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const BUCKET = 'supplier-documents';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  void req;
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  const db = createServiceClient();

  const { data: doc, error } = await db
    .from('supplier_documents')
    .select('id, supplier_id, document_type, file_path, file_name, file_size_bytes, mime_type, status, rejection_reason, verified_at, created_at')
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    console.error('[supplier/documents/id] lookup failed', error);
    return jsonErr('Could not load document', 502);
  }
  if (!doc) return jsonErr('Document not found', 404);

  const { data: signed, error: signedError } = await db.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 300);

  if (signedError || !signed?.signedUrl) {
    console.error('[supplier/documents/id] signed url failed', signedError);
    return jsonErr('Document preview is not available right now', 502);
  }

  return jsonOk({
    ...doc,
    url: signed.signedUrl,
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;
  const db = createServiceClient();

  const { data: doc, error } = await db
    .from('supplier_documents')
    .select('id, file_path')
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    console.error('[supplier/documents/id] delete lookup failed', error);
    return jsonErr('Could not remove document', 502);
  }
  if (!doc) return jsonErr('Document not found', 404);

  const { error: storageError } = await db.storage.from(BUCKET).remove([doc.file_path]);
  if (storageError) {
    console.error('[supplier/documents/id] storage delete failed', storageError);
    return jsonErr('Could not remove document file', 502);
  }

  const { error: rowError } = await db
    .from('supplier_documents')
    .delete()
    .eq('id', id)
    .eq('supplier_id', auth.ctx.profile.id);

  if (rowError) {
    console.error('[supplier/documents/id] record delete failed', rowError);
    return jsonErr('Could not remove document record', 502);
  }

  return jsonOk({ deleted: true });
}
