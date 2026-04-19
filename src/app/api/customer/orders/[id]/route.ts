import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('customer_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Order not found', 404);
  }

  let service_type_key: string | null = null;
  if (data.service_type_id != null) {
    const { data: st } = await auth.ctx.supabase
      .from('service_types')
      .select('key')
      .eq('id', data.service_type_id)
      .maybeSingle();
    service_type_key = st?.key ?? null;
  }

  return jsonOk({ ...data, service_type_key });
}
