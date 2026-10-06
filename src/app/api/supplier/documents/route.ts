import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const ALLOWED = new Set([
  'gst',
  'reg',
  'aadhaar',
  'insurance',
  'bank',
  'vehicle_rc',
  'water_quality',
]);
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = 'supplier-documents';

function safeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-140) || 'document';
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const { data, error } = await db
    .from('supplier_documents')
    .select('id, supplier_id, document_type, file_name, file_size_bytes, mime_type, status, rejection_reason, verified_at, created_at, updated_at')
    .eq('supplier_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supplier/documents] list failed', error);
    return jsonErr('Could not load documents', 502);
  }

  return jsonOk(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const form = await req.formData().catch(() => null);
  if (!form) return jsonErr('Invalid multipart form', 400);

  const documentType = String(form.get('document_type') ?? '').trim().toLowerCase();
  const file = form.get('file');

  if (!ALLOWED.has(documentType)) {
    return jsonErr('Unsupported document type', 422);
  }
  if (!(file instanceof File)) {
    return jsonErr('A document file is required', 400);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return jsonErr('Document must be between 1 byte and 5MB', 400);
  }

  const allowedMime = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  if (!allowedMime.has(file.type)) {
    return jsonErr('Only PDF, JPG, PNG or WEBP documents are allowed', 415);
  }

  const db = createServiceClient();
  const safeName = safeFileName(file.name);
  const path = `${auth.ctx.profile.id}/${documentType}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: bucketError } = await db.storage.getBucket(BUCKET);
  if (bucketError) {
    const { error: createBucketError } = await db.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...allowedMime],
    });
    if (createBucketError && !/already exists/i.test(createBucketError.message)) {
      console.error('[supplier/documents] bucket create failed', createBucketError);
      return jsonErr('Document storage is not available right now', 503);
    }
  }

  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    console.error('[supplier/documents] upload failed', uploadError);
    return jsonErr('Could not upload document', 502);
  }

  const { data, error } = await db
    .from('supplier_documents')
    .upsert({
      supplier_id: auth.ctx.profile.id,
      document_type: documentType,
      file_path: path,
      file_name: safeName,
      file_size_bytes: file.size,
      mime_type: file.type,
      status: 'submitted',
      rejection_reason: null,
      verified_by: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'supplier_id,document_type' })
    .select('id, supplier_id, document_type, file_name, file_size_bytes, mime_type, status, rejection_reason, verified_at, created_at, updated_at')
    .single();

  if (error || !data) {
    await db.storage.from(BUCKET).remove([path]);
    console.error('[supplier/documents] record failed', error);
    return jsonErr('Could not record uploaded document', 502);
  }

  return jsonOk(data, 201);
}
