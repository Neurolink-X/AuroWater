import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { checkAndUpgradeMilestone } from '@/lib/milestone';

/**
 * PUT /api/supplier/orders/[id]/status
 *
 * Moves an order forward:  ASSIGNED → IN_PROGRESS → COMPLETED.
 *
 * Completing an order that is not yet paid requires the supplier to confirm
 * payment was received (and, for UPI, to give the transaction reference).
 *
 * Responses
 *   200  updated order row
 *   400  invalid JSON / id / transition, or payment confirmation missing
 *   403  not a supplier, or the order belongs to someone else
 *   404  order not found
 *   409  the order changed while this request was running (double tap, retry, reassignment)
 *   422  payload failed validation
 *   502  database unavailable (details are logged, never returned)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
  payment_confirmed: z.boolean().optional(),
  payment_reference: z.string().trim().max(100).optional(),
  payment_collector: z.enum(['supplier', 'aurotap']).optional(),
});

type OrderBefore = {
  id: string;
  supplier_id: string | null;
  status: string | null;
  customer_id: string | null;
  can_count: number | null;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: number | string | null;
  service_type?: string | null;
  supplier_payout?: number | string | null;
  payout_status?: string | null;
};

const TRANSITIONS: Record<string, string> = {
  ASSIGNED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

/**
 * Runs a side effect that must never fail the request.
 * Supabase calls RETURN `{ error }` instead of throwing, so both cases are logged.
 */
async function bestEffort(label: string, task: () => PromiseLike<unknown>) {
  try {
    const res = (await task()) as { error?: { message?: string } | null } | undefined;
    if (res?.error) console.error(`[supplier/status] ${label} failed`, res.error.message);
  } catch (e) {
    console.error(`[supplier/status] ${label} threw`, e instanceof Error ? e.message : e);
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return jsonErr('Invalid order id.', 400);

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const sb = auth.ctx.supabase;
  const supplierId = auth.ctx.profile.id;

  const { data: found, error: bErr } = await sb
    .from('orders')
    .select('id, supplier_id, status, customer_id, can_count, payment_status, payment_method, total_amount, service_type, supplier_payout, payout_status')
    .eq('id', id)
    .maybeSingle();
  if (bErr) {
    console.error('[supplier/status] load failed', { orderId: id, error: bErr.message });
    return jsonErr('Could not load this order. Please try again.', 502);
  }
  if (!found) return jsonErr('Order not found', 404);

  const before = found as OrderBefore;
  if (String(before.supplier_id ?? '') !== supplierId) return jsonErr('Forbidden', 403);

  const prev = String(before.status ?? '').toUpperCase();
  const next = parsed.data.status;

  if (prev === next) return jsonErr(`This order is already ${next.toLowerCase().replace('_', ' ')}.`, 409);
  if (TRANSITIONS[prev] !== next) return jsonErr('Invalid status transition', 400);

  const patch: Record<string, unknown> = { status: next };
  const wasPaid = String(before.payment_status ?? 'unpaid').toLowerCase() === 'paid';
  const method = String(before.payment_method ?? 'cash').toLowerCase();

  if (next === 'IN_PROGRESS') {
    patch.dispatched_at = new Date().toISOString();
  } else {
    const reference = parsed.data.payment_reference?.trim() ?? '';
    if (!wasPaid && parsed.data.payment_confirmed !== true) {
      return jsonErr('Confirm payment received before completing this order.', 400);
    }
    if (!wasPaid && method === 'upi' && !reference) {
      return jsonErr('Enter the UPI transaction reference before completing this order.', 400);
    }
    if (!wasPaid && !parsed.data.payment_collector) {
      return jsonErr('Select who collected the payment before completing this order.', 400);
    }
    if (!wasPaid) {
      patch.payment_status = 'paid';
      patch.payment_confirmed_at = new Date().toISOString();
      patch.payment_reference = reference || null;
      patch.payment_collector = parsed.data.payment_collector;
      patch.payment_collected_by = parsed.data.payment_collector === 'supplier' ? supplierId : null;
      patch.payment_collected_amount = Number(before.total_amount ?? 0);
      patch.payment_collected_at = new Date().toISOString();
    }
    patch.completed_at = new Date().toISOString();

    // Supplier entitlement is not the customer total. Only apply the confirmed single-can
    // launch rule (₹20 order -> ₹20 supplier amount); leave other order sizes for reconciliation
    // until the supplier agreement and tax treatment define a verified schedule.
    const canCount = Number(before.can_count ?? 0);
    const orderTotal = Number(before.total_amount ?? 0);
    const existingSupplierPayout = Number(before.supplier_payout ?? 0);
    if (
      String(before.service_type ?? '').toLowerCase() === 'water_can' &&
      canCount === 1 && orderTotal === 20 &&
      Number.isFinite(existingSupplierPayout) && existingSupplierPayout <= 0
    ) {
      patch.supplier_payout = 20;
      patch.payout_status = 'pending';
    }
  }

  // Compare-and-set: only update if the order is STILL in the state we checked.
  // Without this, a double tap would complete twice and fire every side effect twice.
  const { data, error } = await sb
    .from('orders')
    .update(patch)
    .eq('id', id)
    .eq('supplier_id', supplierId)
    .eq('status', prev)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[supplier/status] update failed', { orderId: id, error: error.message });
    return jsonErr('Could not update this order. Please try again.', 502);
  }
  if (!data) return jsonErr('This order was just updated by another request. Refresh and try again.', 409);

  if (next === 'COMPLETED') {
    if (!wasPaid) {
      await bestEffort('payment audit', () =>
        sb.from('audit_logs').insert({
          actor_id: supplierId,
          action: 'order.payment_received',
          entity: 'orders',
          entity_id: id,
          meta: {
            method,
            reference: parsed.data.payment_reference?.trim() || null,
            amount: Number(before.total_amount ?? 0),
          },
        }),
      );
    }

    await bestEffort('increment_supplier_completed_orders', () =>
      sb.rpc('increment_supplier_completed_orders', { p_supplier_id: supplierId }),
    );
    await bestEffort('milestone check', () => checkAndUpgradeMilestone(supplierId, sb));

    // Stock is consumed atomically by the database reservation trigger on COMPLETED.

    // Notify the customer (best-effort).
    const customerId = String(before.customer_id ?? '');
    if (customerId) {
      await bestEffort('customer notification', async () => {
        const { createNotification } = await import('@/lib/notifications');
        return createNotification(
          customerId,
          'Order delivered!',
          'Your order has been delivered. Thank you for choosing AuroTap.',
          'booking',
          id,
          'completed',
        );
      });
    }
  }

  return jsonOk(data);
}












// import { NextRequest } from 'next/server';
// import { z } from 'zod';

// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { checkAndUpgradeMilestone } from '@/lib/milestone';

// const bodySchema = z.object({
//   status: z.enum(['IN_PROGRESS', 'COMPLETED']),
//   payment_confirmed: z.boolean().optional(),
//   payment_reference: z.string().trim().max(100).optional(),
// });

// export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

//   const { id } = await ctx.params;

//   let raw: unknown;
//   try {
//     raw = (await req.json()) as unknown;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }
//   const parsed = bodySchema.safeParse(raw);
//   if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

//   const sb = auth.ctx.supabase;

//   const { data: before, error: bErr } = await sb
//     .from('orders')
//     .select('id, supplier_id, status, customer_id, can_count, payment_status, payment_method, total_amount')
//     .eq('id', id)
//     .maybeSingle();
//   if (bErr) return jsonErr(bErr.message, 502);
//   if (!before) return jsonErr('Order not found', 404);
//   if (String((before as { supplier_id?: string | null }).supplier_id ?? '') !== auth.ctx.profile.id) {
//     return jsonErr('Forbidden', 403);
//   }

//   const prev = String((before as { status?: string }).status ?? '');
//   const next = parsed.data.status;

//   const allowed =
//     (prev === 'ASSIGNED' && next === 'IN_PROGRESS') ||
//     (prev === 'IN_PROGRESS' && next === 'COMPLETED');
//   if (!allowed) return jsonErr('Invalid status transition', 400);

//   const patch: Record<string, unknown> = { status: next };
//   if (next === 'IN_PROGRESS') patch.dispatched_at = new Date().toISOString();

//   if (next === 'COMPLETED') {
//     const paymentStatus = String((before as { payment_status?: string | null }).payment_status ?? 'unpaid').toLowerCase();
//     const paymentMethod = String((before as { payment_method?: string | null }).payment_method ?? 'cash').toLowerCase();
//     const paymentConfirmed = parsed.data.payment_confirmed === true;
//     const paymentReference = parsed.data.payment_reference?.trim() ?? '';

//     if (paymentStatus !== 'paid' && !paymentConfirmed) {
//       return jsonErr('Confirm payment received before completing this order.', 400);
//     }

//     if (paymentStatus !== 'paid' && paymentMethod === 'upi' && !paymentReference) {
//       return jsonErr('Enter the UPI transaction reference before completing this order.', 400);
//     }

//     if (paymentStatus !== 'paid') {
//       patch.payment_status = 'paid';
//     }

//     patch.completed_at = new Date().toISOString();
//   }

//   const { data, error } = await sb.from('orders').update(patch).eq('id', id).select('*').single();
//   if (error) return jsonErr(error.message, 502);

//   if (next === 'COMPLETED') {
//     if (String((before as { payment_status?: string | null }).payment_status ?? 'unpaid').toLowerCase() !== 'paid') {
//       try {
//         await sb.from('audit_logs').insert({
//           actor_id: auth.ctx.profile.id,
//           action: 'order.payment_received',
//           entity: 'orders',
//           entity_id: id,
//           meta: {
//             method: String((before as { payment_method?: string | null }).payment_method ?? 'cash').toLowerCase(),
//             reference: parsed.data.payment_reference?.trim() || null,
//             amount: Number((before as { total_amount?: number | string | null }).total_amount ?? 0),
//           },
//         });
//       } catch (e) {
//         console.error('[supplier/orders] payment audit failed', e);
//       }
//     }

//     try {
//       await sb.rpc('increment_supplier_completed_orders', { p_supplier_id: auth.ctx.profile.id });
//     } catch (e) {
//       console.error('[supplier/orders] increment_supplier_completed_orders failed', e);
//     }
//     try {
//       await checkAndUpgradeMilestone(auth.ctx.profile.id, sb);
//     } catch {
//       /* best-effort */
//     }

//     // Stock is consumed atomically by the database reservation trigger on COMPLETED.


//     // Notify customer (best-effort).
//     try {
//       const customerId = String((before as { customer_id?: string | null }).customer_id ?? '');
//       if (customerId) {
//         const { createNotification } = await import('@/lib/notifications');
//         await createNotification(
//           customerId,
//           'Order delivered!',
//           'Your order has been delivered. Thank you for choosing AuroWater.',
//           'booking',
//           String(id),
//           'completed'
//         );
//       }
//     } catch (e) {
//       console.error('[supplier/orders] customer notification failed', e);
//     }
//   }

//   return jsonOk(data);
// }

