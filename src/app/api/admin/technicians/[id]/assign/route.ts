import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireAdmin,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

const assignSchema = z.object({
  order_id: z.string().trim().min(1, 'order_id is required'),
});

const ASSIGNABLE_STATUSES = new Set([
  'PENDING',
  'ASSIGNED',
]);

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id: technicianId } = await ctx.params;

  if (!technicianId?.trim()) {
    return jsonErr('Technician id is required', 400);
  }

  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = assignSchema.safeParse(rawBody);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ?? 'Invalid payload',
      422,
    );
  }

  const orderId = parsed.data.order_id;
  const supabase = auth.ctx.supabase;

  // Atomic SQL function checks exact service approval, verification, workload,
  // city, offer ledger and row locks; never directly update orders in this route.
  const { createServiceClient } = await import('@/utils/supabase/server');
  const { data: result, error: assignmentError } = await createServiceClient().rpc('admin_assign_specialist', {
    p_order_id: orderId,
    p_technician_id: technicianId,
    p_admin_id: auth.ctx.profile.id,
  });
  if (assignmentError) {
    console.error('[admin/specialist-assign] atomic assignment failed', { code: assignmentError.code });
    return jsonErr(assignmentError.code === 'P0001' ? assignmentError.message : 'Specialist assignment unavailable. No partial assignment was made.', assignmentError.code === 'P0001' ? 409 : 503);
  }
  const { data: order, error: orderError } = await supabase.from('orders').select('id,customer_id').eq('id', orderId).single();
  if (orderError) return jsonErr('Assignment saved; refresh to see order details.', 503);
  const technician = { full_name: 'Your verified specialist' };
  if ((result as { already_assigned?: boolean } | null)?.already_assigned) return jsonOk(result);

  // 4. Notify customer after successful assignment.
  // Notification failure must not undo the assignment.
  const customerId =
    order.customer_id != null
      ? String(order.customer_id)
      : '';

  if (customerId) {
    try {
      const {
        createNotification,
      } = await import('@/lib/notifications');

      const technicianName =
        technician.full_name != null &&
        String(technician.full_name).trim()
          ? String(technician.full_name).trim()
          : 'A technician';

      await createNotification(
        customerId,
        'Technician assigned',
        `${technicianName} has been assigned to your order.`,
        'booking',
        orderId,
        'assigned',
      );
    } catch (error: unknown) {
      console.error(
        '[admin/technicians/assign] notification failed:',
        error instanceof Error
          ? error.message
          : String(error),
      );
    }
  }

  return jsonOk(order);
}
