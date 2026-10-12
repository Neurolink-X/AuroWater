import { NextRequest, after } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set([
  'IN_PROGRESS',
  'COMPLETED',
]);

const TRANSITIONS: Record<string, string[]> = {
  IN_PROGRESS: ['ASSIGNED'],
  COMPLETED: ['IN_PROGRESS'],
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRecord = {
  id: string;
  supplier_id: string | null;
  customer_id: string | null;
  status: string;
  service_type: string | null;
  payment_method: string | null;
  payment_status: string | null;
  supplier_payout: number | string | null;
  payout_status: string | null;
  [key: string]: unknown;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

async function notifyCustomer(
  admin: ReturnType<typeof createServiceClient>,
  order: OrderRecord,
  status: string,
): Promise<void> {
  try {
    if (!order.customer_id) return;

    const isWater = order.service_type === 'water_can';

    let serviceLabel = isWater ? 'water delivery' : 'service';

    if (order.service_type) {
      const { data, error } = await admin
        .from('service_types')
        .select('label')
        .eq('key', order.service_type)
        .maybeSingle();

      if (!error && data?.label) {
        serviceLabel = String(data.label);
      }
    }

    const { createNotification } =
      await import('@/lib/notifications');

    if (status === 'IN_PROGRESS') {
      await createNotification(
        String(order.customer_id),
        isWater
          ? 'Delivery on the way'
          : 'Service started',
        isWater
          ? 'Your water delivery has started.'
          : `Your ${serviceLabel} has started.`,
        'booking',
        order.id,
        'status_changed',
      );
    }

    if (status === 'COMPLETED') {
      await createNotification(
        String(order.customer_id),
        isWater
          ? 'Water delivered'
          : 'Service completed',
        isWater
          ? 'Your water delivery is complete.'
          : `Your ${serviceLabel} is complete.`,
        'booking',
        order.id,
        'completed',
      );
    }
  } catch (error) {
    console.error(
      '[supplier/status] Customer notification failed:',
      error,
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // 1. Authenticate supplier.
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) return auth.response;

  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  // 2. Validate request.
  const { id } = await ctx.params;

  if (!UUID_PATTERN.test(id)) {
    return jsonErr('Invalid order ID', 400);
  }

  let body: { status?: string };

  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const requestedStatus = String(body.status ?? '')
    .trim()
    .toUpperCase();

  if (!ALLOWED_STATUSES.has(requestedStatus)) {
    return jsonErr('Invalid order status', 400);
  }

  const supplierId = auth.ctx.profile.id;
  const admin = createServiceClient();

  // 3. Read the order and preserve real database errors.
  const { data: found, error: readError } = await admin
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readError) {
    console.error(
      '[supplier/status] Order lookup failed:',
      readError,
    );

    return jsonErr(
      'Unable to load this order. Please try again.',
      500,
    );
  }

  if (!found) {
    return jsonErr('Order not found', 404);
  }

  const order = found as unknown as OrderRecord;

  // 4. Never permit cross-supplier order updates.
  if (order.supplier_id !== supplierId) {
    return jsonErr('Forbidden', 403);
  }

  const currentStatus = String(order.status ?? '')
    .trim()
    .toUpperCase();

  // 5. Repeated requests are safe.
  if (currentStatus === requestedStatus) {
    return jsonOk(order);
  }

  if (
    !TRANSITIONS[requestedStatus]?.includes(currentStatus)
  ) {
    return jsonErr(
      `Cannot change order from ${currentStatus || 'UNKNOWN'} to ${requestedStatus}.`,
      409,
    );
  }

  const paymentMethod = normalize(order.payment_method);
  const paymentStatus = normalize(order.payment_status);

  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    status: requestedStatus,
  };

  if (requestedStatus === 'IN_PROGRESS') {
    update.started_at = now;
  }

  if (requestedStatus === 'COMPLETED') {
    update.completed_at = now;

    // COD: completing delivery confirms collection under this
    // application's current business rule.
    //
    // Direct UPI should ideally also require transaction-reference
    // verification before payment can be marked received.
    if (
      paymentStatus !== 'paid' &&
      paymentMethod === 'cash'
    ) {
      update.payment_status = 'paid';
    }
  }

  // 6. Conditional update prevents stale requests from overwriting
  //    a newer status. Never fall back to status-only updates.
  const { data: updated, error: updateError } = await admin
    .from('orders')
    .update(update)
    .eq('id', id)
    .eq('supplier_id', supplierId)
    .eq('status', order.status)
    .select('*')
    .maybeSingle();

  if (updateError) {
    console.error(
      '[supplier/status] Order update failed:',
      updateError,
    );

    return jsonErr(
      'Order update failed. Check the database schema and try again.',
      500,
    );
  }

  if (!updated) {
    return jsonErr(
      'This order changed while you were updating it. Refresh and try again.',
      409,
    );
  }

  const updatedOrder = updated as unknown as OrderRecord;

  // 7. Notify after responding to the supplier.
  after(async () => {
    await notifyCustomer(
      admin,
      updatedOrder,
      requestedStatus,
    );
  });

  return jsonOk(updatedOrder);
}
