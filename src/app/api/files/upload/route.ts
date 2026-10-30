import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'private-user-files';
const MAX_BYTES = 5 * 1024 * 1024;
const categories = new Set([
  'profile_photo', 'identity_document', 'business_document',
  'skill_certificate', 'service_evidence', 'support_attachment',
]);
const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function matchesSignature(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  // Allow multipart framing overhead, but reject oversized bodies before parsing them.
  if (contentLength > MAX_BYTES + 256 * 1024) return jsonErr('Upload request is too large.', 413);
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const role = auth.ctx.profile.role;
  if (!['customer', 'supplier', 'technician', 'admin'].includes(role)) {
    return jsonErr('Your account cannot upload files.', 403);
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return jsonErr('Invalid upload request.', 400); }
  const file = form.get('file');
  const category = form.get('category');
  if (!(file instanceof File) || typeof category !== 'string' || !categories.has(category)) {
    return jsonErr('Choose a valid file and file category.', 422);
  }
  if (file.size < 1 || file.size > MAX_BYTES) return jsonErr('Files must be between 1 byte and 5 MB.', 413);
  const extension = mimeExtensions[file.type];
  if (!extension) return jsonErr('Use JPG, PNG, WebP or PDF files only.', 415);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(bytes, file.type)) return jsonErr('The file content does not match its declared type.', 415);

  const id = randomUUID();
  const path = `${auth.ctx.user.id}/${category}/${id}.${extension}`;
  const db = createServiceClient();
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type, upsert: false, cacheControl: '3600',
  });
  if (uploadError) {
    console.error('[files/upload] storage upload failed', uploadError);
    return jsonErr('File upload is temporarily unavailable.', 503);
  }

  const { data, error } = await db.from('user_files').insert({
    owner_user_id: auth.ctx.user.id,
    object_path: path,
    category,
    original_name: file.name.replace(/[\\/\\0-\\x1f]/g, '_').slice(0, 180) || `upload.${extension}`,
    content_type: file.type,
    size_bytes: file.size,
  }).select('id, category, original_name, content_type, size_bytes, review_status, created_at').single();

  if (error || !data) {
    await db.storage.from(BUCKET).remove([path]);
    console.error('[files/upload] metadata insert failed', error);
    return jsonErr('Could not safely register the uploaded file.', 503);
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: auth.ctx.user.id, action: 'file_uploaded',
    entity: 'user_file', entity_id: data.id,
    meta: { category, content_type: file.type, size_bytes: file.size },
  });
  if (auditError) {
    await db.from('user_files').delete().eq('id', data.id);
    await db.storage.from(BUCKET).remove([path]);
    console.error('[files/upload] audit write failed', auditError);
    return jsonErr('Upload could not be completed safely. Please retry.', 503);
  }

  return jsonOk({ file: data }, 201);
}
