import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';

export const dynamic = 'force-dynamic';
const cacheOff = <T extends Response>(response: T): T => {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.ctx.supabase.from('notifications')
    .select('id,title,message,type,is_read,created_at,data')
    .eq('user_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false }).limit(25);
  if (error) return cacheOff(jsonErr('Unable to load notifications', 503));
  return cacheOff(jsonOk(data ?? []));
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  let body: { id?: string; all?: boolean };
  try { body = await req.json(); } catch { return cacheOff(jsonErr('Invalid request', 400)); }
  if (body.all !== true && (typeof body.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(body.id))) {
    return cacheOff(jsonErr('Invalid notification ID', 400));
  }
  let query = auth.ctx.supabase.from('notifications')
    .update({ is_read: true }).eq('user_id', auth.ctx.profile.id)
    .eq('is_read', false);
  if (body.all !== true && typeof body.id === 'string') query = query.eq('id', body.id);
  const { error } = await query;
  if (error) return cacheOff(jsonErr('Could not update notification', 503));
  return cacheOff(jsonOk({ updated: true }));
}
