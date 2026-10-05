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

  // 1. Verify technician.
  const {
    data: technician,
    error: technicianError,
  } = await supabase
    .from('profiles')
    .select(
      'id, role, full_name, is_active, status, is_online',
    )
    .eq('id', technicianId)
    .maybeSingle();

  if (technicianError) {
    return jsonErr(technicianError.message, 502);
  }

  if (
    !technician ||
    String(technician.role).toLowerCase() !== 'technician'
  ) {
    return jsonErr('Technician not found', 404);
  }

  // Do not assign new jobs to disabled/suspended/banned technicians.
  const technicianStatus = technician.status
    ? String(technician.status).toLowerCase()
    : 'active';

  if (
    technician.is_active === false ||
    ['suspended', 'banned', 'rejected'].includes(
      technicianStatus,
    )
  ) {
    return jsonErr(
      'This technician is not active and cannot receive new jobs',
      409,
    );
  }

  // 2. Read current order state first.
  const {
    data: currentOrder,
    error: orderLookupError,
  } = await supabase
    .from('orders')
    .select(
      'id, status, technician_id, customer_id',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (orderLookupError) {
    return jsonErr(orderLookupError.message, 502);
  }

  if (!currentOrder) {
    return jsonErr('Order not found', 404);
  }

  const currentStatus = String(
    currentOrder.status ?? '',
  ).toUpperCase();

  // Never reassign completed/cancelled/in-progress jobs
  // through this endpoint.
  if (!ASSIGNABLE_STATUSES.has(currentStatus)) {
    return jsonErr(
      `Order cannot be assigned while its status is ${
        currentStatus || 'UNKNOWN'
      }`,
      409,
    );
  }

  const currentTechnicianId =
    currentOrder.technician_id != null
      ? String(currentOrder.technician_id)
      : '';

  // Idempotent assignment.
  if (
    currentTechnicianId === technicianId &&
    currentStatus === 'ASSIGNED'
  ) {
    const {
      data: existingOrder,
      error: existingOrderError,
    } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (existingOrderError) {
      return jsonErr(existingOrderError.message, 502);
    }

    return jsonOk(existingOrder);
  }

  // 3. Conditional update prevents assigning an order
  // that changed state between the read and update.
  const {
    data: order,
    error: updateError,
  } = await supabase
    .from('orders')
    .update({
      technician_id: technicianId,
      status: 'ASSIGNED',
    })
    .eq('id', orderId)
    .in('status', ['PENDING', 'ASSIGNED'])
    .select('*')
    .maybeSingle();

  if (updateError) {
    return jsonErr(updateError.message, 502);
  }

  if (!order) {
    return jsonErr(
      'Order could not be assigned because its status changed. Please refresh and try again.',
      409,
    );
  }

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
