import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? '30') || 30, 100);
  const unreadOnly = (searchParams.get('unread_only') ?? 'false').toLowerCase() === 'true';

  let query = auth.ctx.supabase
    .from('notifications')
    .select('*')
    .eq('user_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;

  if (error) {
    return jsonErr(error.message, 500);
  }

  return jsonOk(data ?? []);
}
