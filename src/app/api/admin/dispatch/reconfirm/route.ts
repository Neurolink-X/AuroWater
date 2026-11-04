import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { parseOrderIdentifier } from '@/lib/order-reference';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Manual review recovery. Only an authenticated admin who has already confirmed
 * the revised IST delivery time with the customer can reset failed dispatch.
 * Does NOT auto-assign, cancel, change prices or override supplier eligibility.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  let body: { orderId?: unknown; slotIst?: unknown; customerConfirmed?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid request body', 400);
  }

  if (body.customerConfirmed !== true) {
    return jsonErr('Confirm the revised delivery time with the customer first.', 400);
  }
  const identifier = parseOrderIdentifier(typeof body.orderId === 'string' ? body.orderId.trim() : '');
  if (!identifier) return jsonErr('Enter a valid order reference.', 400);

  // Explicit India local wall time: no dependency on the admin phone's timezone.
  const slot = typeof body.slotIst === 'string' ? body.slotIst.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot)) {
    return jsonErr('Choose a valid future delivery time (IST).', 400);
  }
  const slotTime = new Date(slot + ':00+05:30');
  if (!Number.isFinite(slotTime.getTime())) return jsonErr('Invalid delivery time.', 400);
  const now = Date.now();
  if (slotTime.getTime() < now + 5 * 60_000 || slotTime.getTime() > now + 30 * 86400_000) {
    return jsonErr('Choose a delivery time at least 5 minutes ahead and within 30 days.', 400);
  }
  const db = createServiceClient();
  const query = db.from('orders').select('id, status, service_type, supplier_id');
  const { data: order, error } = identifier.kind === 'uuid'
    ? await query.eq('id', identifier.value).maybeSingle()
    : await query.ilike('order_number', identifier.value).maybeSingle();

  if (error) return jsonErr('Unable to find order for safe review.', 503);
  if (!order) return jsonErr('Order not found.', 404);
  if (order.status !== 'PENDING' || order.supplier_id) {
    return jsonErr('Only currently unassigned pending orders may be rescheduled here.', 409);
  }

  const { data: updated, error: updateError } = await db.rpc('reconfirm_pending_dispatch_slot', {
    p_order_id: order.id,
    p_scheduled_at: slotTime.toISOString(),
    p_admin_id: auth.ctx.profile.id,
  });
  if (updateError) {
    console.error('[admin/dispatch/reconfirm] unable to save', updateError.code);
    return jsonErr('Schedule recovery is not ready. Verify the approved dispatch migration.', 503);
  }
  if (updated !== true) return jsonErr('Schedule no longer eligible for recovery. Refresh the order.', 409);
  return jsonOk({
    order_id: order.id, scheduled_at: slotTime.toISOString(),
    message: 'Schedule confirmed, retry reset and customer notified. Review diagnostics, then run dispatch separately.',
  });
}
