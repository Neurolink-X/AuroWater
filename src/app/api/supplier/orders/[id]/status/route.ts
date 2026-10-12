/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/app/api/supplier/orders/[id]/status/route.ts
 *
 * Supplier moves an order forward:  ASSIGNED → IN_PROGRESS → COMPLETED
 *
 * What changed (and why):
 *  - The old route selected columns that do not exist on `orders`
 *    (service_type_id, time_slot…). PostgREST returned an error, and the route
 *    turned EVERY error into "404 Order not found". Now: select('*'), and a real
 *    database error is logged and returned as 500, never disguised as 404.
 *  - Uses the service client after checking ownership in code
 *    (order.supplier_id === logged-in supplier), so a missing RLS policy cannot
 *    hide the supplier's own order.
 *  - Safe status flow, repeat-tap safe (idempotent), and race safe
 *    (the update only runs if the status is still what we read).
 *  - Cash / UPI orders become 'paid' when delivery completes (see switch below).
 *  - Customer notifications run AFTER the response is sent, so the supplier's
 *    button responds instantly.
 */

import { NextRequest, after } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['IN_PROGRESS', 'COMPLETED']);

/** target status → statuses it may come from */
const TRANSITIONS: Record<string, string[]> = {
  IN_PROGRESS: ['ASSIGNED'],
  COMPLETED: ['ASSIGNED', 'IN_PROGRESS'],
};

/**
 * BUSINESS RULE: when the supplier completes a delivery paid by cash or UPI,
 * the customer has paid on the spot, so mark payment_status = 'paid'.
 * Set to false if you want payment confirmed by a separate step.
 * Online (card / netbanking) payments are never touched here.
 */
const MARK_PAID_ON_DELIVERY = true;
const PAID_ON_DELIVERY_METHODS = new Set(['cash', 'upi']);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tell the customer. Runs after the response, never throws. */
async function notifyCustomer(admin: any, order: any, status: string): Promise<void> {
  try {
    const customerId = order.customer_id != null ? String(order.customer_id) : '';
    if (!customerId) return;

    let label = 'service';
    if (order.service_type) {
      const { data: st } = await admin
        .from('service_types')
        .select('label')
        .eq('key', order.service_type)
        .maybeSingle();
      if (st?.label) label = String(st.label);
    }

    const isWater = order.service_type === 'water_can';
    const { createNotification } = await import('@/lib/notifications');

    if (status === 'IN_PROGRESS') {
      await (createNotification as any)(
        customerId,
        isWater ? 'Delivery on the way 🚚' : 'Service Started ⚡',
        isWater ? 'Your water delivery has started and is on its way.' : `Your ${label} service has started.`,
        'booking',
        String(order.id),
        'status_changed'
      );
    } else if (status === 'COMPLETED') {
      await (createNotification as any)(
        customerId,
        isWater ? 'Water delivered ✅' : 'Service Complete ✅',
        isWater
          ? 'Your water has been delivered. Tap to rate your experience.'
          : `Your ${label} is done. Tap to rate your experience.`,
        'booking',
        String(order.id),
        'completed'
      );
    }
  } catch (e) {
    console.error('[supplier/status] notification failed:', e);
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  // 1) Who is asking?
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  // 2) What are they asking for?
  const { id } = await ctx.params;
  if (!UUID_PATTERN.test(id)) {
    return jsonErr('Invalid order ID', 400);
  }

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
  if (!ALLOWED.has(status)) {
    return jsonErr('Invalid status', 400);
  }

  const supplierId = auth.ctx.profile.id;
  const admin: any = createServiceClient();

  // 3) Load the order. Real database errors are NOT "not found".
  const { data: order, error: readErr } = await admin
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (readErr) {
    console.error('[supplier/status] order lookup failed:', readErr);
    return jsonErr('Could not load this order right now. Please try again.', 500);
  }
  if (!order) {
    return jsonErr('Order not found', 404);
  }

  // 4) Ownership is checked here, in code, before anything is changed.
  if (order.supplier_id !== supplierId) {
    return jsonErr('Forbidden', 403);
  }

  // 5) Already there? Double taps and retries are harmless.
  const current = String(order.status ?? '').toUpperCase();
  if (current === status) {
    return jsonOk(order);
  }

  if (!TRANSITIONS[status].includes(current)) {
    return jsonErr(
      current === 'COMPLETED' || current === 'CANCELLED'
        ? `This order is already ${current.toLowerCase()}.`
        : `Cannot change an order from ${current || 'unknown'} to ${status}.`,
      409
    );
  }

  // 6) Update. Try the full update first; if the database lacks an optional
  //    column or rejects a value, fall back to the status alone.
  const now = new Date().toISOString();
  const paymentMethod = String(order.payment_method ?? 'cash').toLowerCase();
  const markPaid =
    status === 'COMPLETED' &&
    MARK_PAID_ON_DELIVERY &&
    PAID_ON_DELIVERY_METHODS.has(paymentMethod) &&
    String(order.payment_status ?? '').toLowerCase() !== 'paid';

  const fullUpdate: Record<string, unknown> = {
    status,
    ...(status === 'IN_PROGRESS' ? { started_at: now } : { completed_at: now }),
    ...(markPaid ? { payment_status: 'paid' } : {}),
  };

  const run = (payload: Record<string, unknown>) =>
    admin
      .from('orders')
      .update(payload)
      .eq('id', id)
      .eq('supplier_id', supplierId)
      .eq('status', order.status) // only if nobody changed it meanwhile
      .select('*')
      .maybeSingle();

  let { data: updated, error: updErr } = await run(fullUpdate);

  if (updErr) {
    console.warn('[supplier/status] full update failed, retrying with status only:', updErr.message);
    // keep the payment change if only the optional timestamp column was the problem
    const retry: Record<string, unknown> = { status, ...(markPaid ? { payment_status: 'paid' } : {}) };
    ({ data: updated, error: updErr } = await run(retry));
    if (updErr) {
      console.warn('[supplier/status] retry failed, trying status only:', updErr.message);
      ({ data: updated, error: updErr } = await run({ status }));
    }
  }

  if (updErr) {
    console.error('[supplier/status] update failed:', updErr);
    return jsonErr('Could not update this order right now. Please try again.', 500);
  }

  // Nobody matched: someone else changed it between our read and write.
  if (!updated) {
    const { data: latest } = await admin.from('orders').select('*').eq('id', id).maybeSingle();
    if (latest && String(latest.status ?? '').toUpperCase() === status) {
      return jsonOk(latest);
    }
    return jsonErr('This order was just updated. Please refresh and try again.', 409);
  }

  // 7) Tell the customer after replying, so the supplier sees the result instantly.
  after(() => notifyCustomer(admin, updated, status));

  return jsonOk(updated);
}
