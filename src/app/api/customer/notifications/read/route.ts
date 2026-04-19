import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  let body: { ids?: string[] | 'all' };
  try {
    body = (await req.json()) as { ids?: string[] | 'all' };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  let updated = 0;
  if (body.ids === 'all') {
    const { data, error } = await auth.ctx.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', auth.ctx.profile.id)
      .eq('is_read', false)
      .select('id');
    if (error) {
      return jsonErr(error.message, 500);
    }
    updated = Array.isArray(data) ? data.length : 0;
    return jsonOk({ updated });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
  if (!ids.length) {
    return jsonErr("ids must be string[] or 'all'", 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', auth.ctx.profile.id)
    .in('id', ids)
    .select('id');

  if (error) {
    return jsonErr(error.message, 500);
  }

  updated = Array.isArray(data) ? data.length : 0;
  return jsonOk({ updated });
}
