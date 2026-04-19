import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('technician_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Job not found', 404);
  }

  return jsonOk(data);
}
