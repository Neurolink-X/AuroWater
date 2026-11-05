import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/** Private application receipt and status. Never use URL id as authorization. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const id = req.nextUrl.searchParams.get('id');
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return jsonErr('Invalid application reference', 422);
  let query = createServiceClient().from('applications')
    .select('id,user_id,type,status,created_at,reviewed_at,rejection_note,payload')
    .eq('user_id', auth.ctx.user.id)
    .order('created_at', { ascending: false }).limit(1);
  if (id) query = query.eq('id', id);
  const { data, error } = await query.maybeSingle();
  if (error) return jsonErr('Application status is temporarily unavailable', 503);
  if (!data) return jsonErr('No submitted application exists for this account', 404);
  const payload = data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
    ? data.payload as Record<string, unknown> : {};
  const response = jsonOk({
    application: {
      id: data.id, type: data.type, status: data.status,
      created_at: data.created_at, reviewed_at: data.reviewed_at,
      rejection_note: data.rejection_note,
      role: typeof payload.role === 'string' ? payload.role : data.type,
    },
    account_role: auth.ctx.profile.role,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
