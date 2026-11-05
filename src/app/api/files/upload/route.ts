// PATH: src/app/api/files/upload/route.ts
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { consumeRateLimit } from '@/lib/api/rate-limit';
import { createServiceClient } from '@/utils/supabase/server';
import {
  DOCUMENT_SLOTS, FILE_CATEGORIES, MAX_PRIVATE_FILE_BYTES, PRIVATE_FILE_TYPES, UPLOAD_ROLES,
  detectPrivateFileMime, isDocumentSlot, isValidPrivateFileSize, sanitizePrivateFileName, sha256Hex,
} from '@/lib/private-file-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'private-user-files';
const UPLOADS_PER_HOUR = 30;
const MAX_PENDING_PER_SLOT = 5;

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const fail = (message: string, status: number, code?: string) => {
    const res = jsonErr(message, status, code);
    res.headers.set('X-Request-Id', requestId);
    return res;
  };

  if (Number(req.headers.get('content-length') || 0) > MAX_PRIVATE_FILE_BYTES + 256 * 1024) return fail('Upload request is too large.', 413);

  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.ctx.user.id;
  const role = auth.ctx.profile.role;
  if (!(UPLOAD_ROLES as readonly string[]).includes(role)) return fail('Your account cannot upload files.', 403);
  // A newly registered technician is still a customer until admin approval.
  // Customer uploads of KYC slots are allowed ONLY when they own a pending application.
  let pendingTechnicianApplicant = false;
  if (role === 'customer') {
    const { data: application, error: eligibilityError } = await createServiceClient()
      .from('applications').select('id').eq('user_id', userId).eq('type', 'technician')
      .in('status', ['pending', 'pending_approval']).limit(1).maybeSingle();
    if (eligibilityError) return fail('Could not verify your application. Please retry.', 503);
    pendingTechnicianApplicant = Boolean(application);
  }

  const db = createServiceClient();

  // Durable per-user limit. Fail closed if unavailable: private uploads are
  // sensitive writes and must not bypass abuse protection across instances.
  const rate = await consumeRateLimit(db, 'file-upload', userId, UPLOADS_PER_HOUR, 3600);
  if (rate.unavailable) {
    console.error('[files/upload] rate limiter unavailable', { requestId });
    const res = fail('Uploads are temporarily unavailable. Please retry later.', 503, 'RATE_LIMIT_UNAVAILABLE');
    res.headers.set('Retry-After', '60');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (!rate.allowed) {
    const res = fail('Too many uploads. Please try again later.', 429, 'RATE_LIMITED');
    res.headers.set('Retry-After', String(Math.max(1, rate.retryAfter)));
    return res;
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return fail('Invalid upload request.', 400); }
  const file = form.get('file');
  const category = form.get('category');
  const slot = form.get('document_slot');

  if (!(file instanceof File) || typeof category !== 'string' || !(FILE_CATEGORIES as readonly string[]).includes(category)) {
    return fail('Choose a valid file and file category.', 422);
  }
  let slotName: string | null = null;
  if (slot !== null) {
    if (!isDocumentSlot(slot) || DOCUMENT_SLOTS[slot].category !== category) return fail('Invalid document type.', 422);
    const directRoleAllowed = (DOCUMENT_SLOTS[slot].roles as readonly string[]).includes(role);
    const applicantSlotAllowed = pendingTechnicianApplicant &&
      (DOCUMENT_SLOTS[slot].roles as readonly string[]).includes('technician');
    if (!directRoleAllowed && !applicantSlotAllowed)
      return fail('This document type is not available for your account.', 403);
    slotName = slot;
  }

  // Do not turn an ordinary customer account into an unrestricted upload endpoint.
  if (role === 'customer' && !pendingTechnicianApplicant &&
      category !== 'profile_photo' && category !== 'support_attachment')
    return fail('Submit and sign in to your technician application before uploading verification documents.', 403);
  if (!isValidPrivateFileSize(file.size)) return fail('Files must be between 1 byte and 5 MB.', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());

  // Trust the bytes, not the browser: phones often send empty or wrong MIME types.
  const detected = detectPrivateFileMime(bytes);
  if (!detected) return fail('Use JPG, PNG, WebP or PDF files only.', 415);
  const declared = file.type;
  if (declared && declared !== 'application/octet-stream' && declared !== detected) {
    return fail('The file content does not match its declared type.', 415);
  }
  const extension = PRIVATE_FILE_TYPES[detected];

  if (slotName) {
    const { count, error: pendingCountError } = await db.from('user_files').select('id', { count: 'exact', head: true })
      .eq('owner_user_id', userId).eq('document_slot', slotName).eq('review_status', 'pending');
    if (pendingCountError || count === null) {
      console.error('[files/upload] pending count unavailable', { requestId, code: pendingCountError?.code });
      return fail('Could not check existing documents. Please retry.', 503, 'PENDING_COUNT_UNAVAILABLE');
    }
    if (count >= MAX_PENDING_PER_SLOT) {
      return fail('You already have documents awaiting review for this type. Remove one or wait for review.', 409, 'TOO_MANY_PENDING');
    }
  }

  const id = randomUUID();
  const path = `${userId}/${category}/${id}.${extension}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: detected, upsert: false, cacheControl: '0' });
  if (uploadError) {
    console.error('[files/upload] storage upload failed', { requestId, uploadError });
    return fail('File upload is temporarily unavailable.', 503);
  }

  const rollback = async (fileRowId?: string) => {
    if (fileRowId) await db.from('user_files').delete().eq('id', fileRowId);
    await db.storage.from(BUCKET).remove([path]);
  };

  const { data, error } = await db.from('user_files').insert({
    owner_user_id: userId, object_path: path, category,
    ...(slotName ? { document_slot: slotName } : {}),
    original_name: sanitizePrivateFileName(file.name, `upload.${extension}`),
    content_type: detected, size_bytes: file.size,
  }).select('id, category, document_slot, original_name, content_type, size_bytes, review_status, created_at').single();
  if (error || !data) {
    await rollback();
    console.error('[files/upload] metadata insert failed', { requestId, error });
    return fail('Could not safely register the uploaded file.', 503);
  }

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: userId, action: 'file_uploaded', entity: 'user_file', entity_id: data.id,
    meta: { category, document_slot: slotName, content_type: detected, size_bytes: file.size, sha256: await sha256Hex(bytes), request_id: requestId },
  });
  if (auditError) {
    await rollback(data.id);
    console.error('[files/upload] audit write failed', { requestId, auditError });
    return fail('Upload could not be completed safely. Please retry.', 503);
  }

  const res = jsonOk({ file: data }, 201);
  res.headers.set('X-Request-Id', requestId);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
