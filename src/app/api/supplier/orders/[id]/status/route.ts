import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const ALLOWED = new Set(['IN_PROGRESS', 'COMPLETED']);

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';
  if (!ALLOWED.has(status)) {
    return jsonErr('Invalid status', 400);
  }

  const { data: order, error: e0 } = await auth.ctx.supabase
    .from('orders')
    .select('id, supplier_id, status, customer_id, service_type_id, technician_id, scheduled_date, time_slot')
    .eq('id', id)
    .maybeSingle();

  if (e0 || !order) {
    return jsonErr('Order not found', 404);
  }
  if (order.supplier_id !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return jsonErr(error?.message ?? 'Update failed', 500);
  }

  const { createNotification } = await import('@/lib/notifications');
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
    if (status === 'IN_PROGRESS') {
      await createNotification(
        customerId,
        'Service Started ⚡',
        `Your ${serviceName} service has started.`,
        'booking',
        id,
        'status_changed_in_progress'
      );
    }
    if (status === 'COMPLETED') {
      await createNotification(
        customerId,
        'Service Complete ✅',
        `Your ${serviceName} is done. Tap to rate your experience.`,
        'booking',
        id,
        'status_changed_completed'
      );
    }
  }

  return jsonOk(data);
}
