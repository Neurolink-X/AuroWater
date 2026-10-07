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

  const { data: order, error: lookupError } = await auth.ctx.supabase
    .from('orders')
    .select('id, technician_id, status, customer_id, service_type_id')
    .eq('id', id)
    .maybeSingle();

  if (lookupError || !order) {
    return jsonErr('Job not found', 404);
  }
  if (order.technician_id !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }
  if (order.status !== 'ASSIGNED') {
    return jsonErr('Job cannot be accepted in current status', 409);
  }

  const { data: accepted, error: acceptError } =
    await auth.ctx.supabase.rpc('accept_technician_job', {
      p_order_id: id,
      p_technician_id: auth.ctx.profile.id,
    });

  if (acceptError) {
    console.error('[technician/accept] atomic accept failed:', acceptError);
    return jsonErr('Unable to accept this job right now', 409);
  }

  if (!accepted) {
    return jsonErr('Job was already accepted or reassigned', 409);
  }

  const customerId = order.customer_id ? String(order.customer_id) : null;

  if (customerId) {
    try {
      const { createNotification } = await import('@/lib/notifications');
      await createNotification(
        customerId,
        'Technician accepted your service',
        'Your technician accepted the job. They will start the visit shortly.',
        'booking',
        id,
        'technician_accepted',
      );
    } catch (error) {
      console.error('[technician/accept] notification failed:', error);
    }
  }

  return jsonOk({
    accepted: true,
    status: 'ASSIGNED',
  });
}

