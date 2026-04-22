import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.ctx.supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', auth.ctx.profile.id)
    .eq('is_read', false)
    .select('id');

  if (error) return jsonErr(error.message, 500);
  const updated = Array.isArray(data) ? data.length : 0;
  return jsonOk({ updated });
}

