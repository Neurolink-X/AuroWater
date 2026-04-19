import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let reason = '';
  try {
    const body = (await req.json()) as { reason?: string };
    reason = typeof body.reason === 'string' ? body.reason : '';
  } catch {
    /* optional body */
  }

  const { data: existing, error: e0 } = await auth.ctx.supabase
    .from('orders')
    .select('id, status, service_type_id')
    .eq('id', id)
    .eq('customer_id', auth.ctx.profile.id)
    .maybeSingle();

  if (e0 || !existing) {
    return jsonErr('Order not found', 404);
  }

  if (existing.status !== 'PENDING' && existing.status !== 'ASSIGNED') {
    return jsonErr('Only pending or assigned orders can be cancelled', 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .update({
      status: 'CANCELLED',
      cancellation_reason: reason || null,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return jsonErr(error?.message ?? 'Cancel failed', 500);
  }

  let serviceName = 'service';
  if (existing.service_type_id != null) {
    const { data: st } = await auth.ctx.supabase
      .from('service_types')
      .select('name')
      .eq('id', existing.service_type_id)
      .maybeSingle();
    if (st?.name) serviceName = String(st.name);
  }
  const { createNotification } = await import('@/lib/notifications');
  await createNotification(
    auth.ctx.profile.id,
    'Order Cancelled',
    `Your ${serviceName} order has been cancelled.`,
    'booking',
    id,
    'cancelled'
  );

  return jsonOk(data);
}
