// PATH: src/app/api/files/route.ts
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { slotsForRole } from '@/lib/private-file-validation';

export const dynamic = 'force-dynamic';

/** The signed-in user's own files + the document slots their role must provide. Powers the uploader UI. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const db = createServiceClient();
  const { data, error } = await db.from('user_files')
    .select('id, category, document_slot, original_name, content_type, size_bytes, review_status, review_note, created_at, reviewed_at')
    .eq('owner_user_id', auth.ctx.user.id).order('created_at', { ascending: false }).limit(200);
  if (error) {
    console.error('[files/list] lookup failed', error);
    return jsonErr('Could not load your documents.', 503);
  }
  const res = jsonOk({ role: auth.ctx.profile.role, slots: slotsForRole(auth.ctx.profile.role), files: data ?? [] });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
