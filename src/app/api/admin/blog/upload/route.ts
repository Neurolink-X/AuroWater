import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
const BUCKET = 'blog-images';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { extension: string; magic: (b: Uint8Array) => boolean }> = {
  'image/jpeg': { extension: 'jpg', magic: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: 'png', magic: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { extension: 'webp', magic: b => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' },
};

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES + 65536) return jsonErr('Image too large.', 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return jsonErr('Select an image.', 422);
  const type = TYPES[file.type];
  if (!type) return jsonErr('Use JPEG, PNG or WebP.', 422);
  if (!file.size || file.size > MAX_BYTES) return jsonErr('Image must be under 5 MB.', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!type.magic(bytes)) return jsonErr('Invalid image content.', 422);
  const key = `covers/${new Date().getUTCFullYear()}/${randomUUID()}.${type.extension}`;
  const db = createServiceClient();
  const { error } = await db.storage.from(BUCKET).upload(key, bytes, {
    contentType: file.type, cacheControl: '31536000', upsert: false,
  });
  if (error) {
    console.error('[admin/blog/upload] storage failed', { code: error.name });
    return jsonErr('Upload unavailable. Confirm blog-images storage bucket exists and is public.', 503);
  }
  const { data } = db.storage.from(BUCKET).getPublicUrl(key);
  return jsonOk({ url: data.publicUrl, key }, 201);
}
