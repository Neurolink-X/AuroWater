import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id: technicianId } = await ctx.params;

  let body: { order_id?: string };
  try {
    body = (await req.json()) as { order_id?: string };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const order_id = typeof body.order_id === 'string' ? body.order_id : '';
  if (!order_id) {
    return jsonErr('order_id is required', 400);
  }

  const { data: tech, error: te } = await auth.ctx.supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', technicianId)
    .maybeSingle();

  if (te || !tech || tech.role !== 'technician') {
    return jsonErr('Technician not found', 404);
  }

  const { data: order, error } = await auth.ctx.supabase
    .from('orders')
    .update({
      technician_id: technicianId,
      status: 'ASSIGNED',
    })
    .eq('id', order_id)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!order) {
    return jsonErr('Order not found', 404);
  }

  const customerId = order.customer_id != null ? String(order.customer_id) : '';
  if (customerId) {
    const techName = tech.full_name != null && String(tech.full_name).trim() ? String(tech.full_name) : 'A technician';
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      customerId,
      'Technician assigned',
      `${techName} has been assigned to your order.`,
      'booking',
      order_id,
      'assigned'
    );
  }

  return jsonOk(order);
}
