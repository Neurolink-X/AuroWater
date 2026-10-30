import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { isPrivateFileMime, isValidPrivateFileSize, matchesPrivateFileSignature, PRIVATE_FILE_TYPES, sanitizePrivateFileName, MAX_PRIVATE_FILE_BYTES } from '@/lib/private-file-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'private-user-files';
const categories = new Set(['profile_photo', 'identity_document', 'business_document', 'skill_certificate', 'service_evidence', 'support_attachment']);
const slotCategory: Record<string, string> = {
  aadhaar_front: 'identity_document',
  aadhaar_back: 'identity_document',
  profile_photo: 'profile_photo',
  skill_certificate: 'skill_certificate',
  business_certificate: 'business_document',
};

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_PRIVATE_FILE_BYTES + 256 * 1024) return jsonErr('Upload request is too large.', 413);
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const role = auth.ctx.profile.role;
  if (!['customer', 'supplier', 'technician', 'plumber', 'admin'].includes(role)) return jsonErr('Your account cannot upload files.', 403);

  let form: FormData;
  try { form = await req.formData(); } catch { return jsonErr('Invalid upload request.', 400); }
  const file = form.get('file');
  const category = form.get('category');
  const slot = form.get('document_slot');
  if (slot !== null) {
    if (typeof slot !== 'string' || slotCategory[slot] !== category) return jsonErr('Invalid document type.', 422);
    const allowedForRole: Record<string, string[]> = {
      technician: ['aadhaar_front', 'aadhaar_back', 'profile_photo', 'skill_certificate'],
      plumber: ['aadhaar_front', 'aadhaar_back', 'profile_photo', 'skill_certificate'],
      supplier: ['business_certificate'],
      admin: ['business_certificate'],
    };
    if (!allowedForRole[role]?.includes(slot)) return jsonErr('This document type is not available for your account.', 403);
  }
  if (!(file instanceof File) || typeof category !== 'string' || !categories.has(category)) return jsonErr('Choose a valid file and file category.', 422);
  if (!isValidPrivateFileSize(file.size)) return jsonErr('Files must be between 1 byte and 5 MB.', 413);
  const extension = isPrivateFileMime(file.type) ? PRIVATE_FILE_TYPES[file.type] : undefined;
  if (!extension) return jsonErr('Use JPG, PNG, WebP or PDF files only.', 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesPrivateFileSignature(bytes, file.type)) return jsonErr('The file content does not match its declared type.', 415);

  const id = randomUUID();
  const path = `${auth.ctx.user.id}/${category}/${id}.${extension}`;
  const db = createServiceClient();
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (uploadError) {
    console.error('[files/upload] storage upload failed', uploadError);
    return jsonErr('File upload is temporarily unavailable.', 503);
  }
  const { data, error } = await db.from('user_files').insert({
    owner_user_id: auth.ctx.user.id, object_path: path, category,
    ...(typeof slot === 'string' ? { document_slot: slot } : {}),
    original_name: sanitizePrivateFileName(file.name, `upload.${extension}`),
    content_type: file.type, size_bytes: file.size,
  }).select('id, category, document_slot, original_name, content_type, size_bytes, review_status, created_at').single();
  if (error || !data) {
    await db.storage.from(BUCKET).remove([path]);
    console.error('[files/upload] metadata insert failed', error);
    return jsonErr('Could not safely register the uploaded file.', 503);
  }
  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: auth.ctx.user.id, action: 'file_uploaded', entity: 'user_file', entity_id: data.id,
    meta: { category, document_slot: typeof slot === 'string' ? slot : null, content_type: file.type, size_bytes: file.size },
  });
  if (auditError) {
    await db.from('user_files').delete().eq('id', data.id);
    await db.storage.from(BUCKET).remove([path]);
    console.error('[files/upload] audit write failed', auditError);
    return jsonErr('Upload could not be completed safely. Please retry.', 503);
  }
  return jsonOk({ file: data }, 201);
}
