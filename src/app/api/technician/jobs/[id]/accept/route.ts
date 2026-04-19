import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  const { data: order, error: e0 } = await auth.ctx.supabase
    .from('orders')
    .select('id, technician_id, status, customer_id, service_type_id')
    .eq('id', id)
    .maybeSingle();

  if (e0 || !order) {
    return jsonErr('Job not found', 404);
  }
  if (order.technician_id !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }
  if (order.status !== 'ASSIGNED' && order.status !== 'PENDING') {
    return jsonErr('Job cannot be accepted in current status', 400);
  }

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .update({ status: 'IN_PROGRESS' })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return jsonErr(error?.message ?? 'Accept failed', 500);
  }

  const customerId = data.customer_id != null ? String(data.customer_id) : '';
  let serviceName = 'service';
  if (data.service_type_id != null) {
    const { data: st } = await auth.ctx.supabase
      .from('service_types')
      .select('name')
      .eq('id', data.service_type_id)
      .maybeSingle();
    if (st?.name) serviceName = String(st.name);
  }
  if (customerId) {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      customerId,
      'Technician is on the way ⚡',
      `Your ${serviceName} visit has started.`,
      'booking',
      id,
      'status_changed'
    );
  }

  return jsonOk(data);
}
