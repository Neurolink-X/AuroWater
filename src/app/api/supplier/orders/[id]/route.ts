import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { checkAndUpgradeMilestone } from '@/lib/milestone';

const bodySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
  payment_confirmed: z.boolean().optional(),
  payment_reference: z.string().trim().max(100).optional(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const sb = auth.ctx.supabase;

  const { data: before, error: bErr } = await sb
    .from('orders')
    .select('id, supplier_id, status, customer_id, can_quantity, payment_status, payment_method, total_amount')
    .eq('id', id)
    .maybeSingle();
  if (bErr) return jsonErr(bErr.message, 502);
  if (!before) return jsonErr('Order not found', 404);
  if (String((before as { supplier_id?: string | null }).supplier_id ?? '') !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }

  const prev = String((before as { status?: string }).status ?? '');
  const next = parsed.data.status;

  const allowed =
    (prev === 'ASSIGNED' && next === 'IN_PROGRESS') ||
    (prev === 'IN_PROGRESS' && next === 'COMPLETED');
  if (!allowed) return jsonErr('Invalid status transition', 400);

  const patch: Record<string, unknown> = { status: next };
  if (next === 'IN_PROGRESS') patch.dispatched_at = new Date().toISOString();

  if (next === 'COMPLETED') {
    const paymentStatus = String((before as { payment_status?: string | null }).payment_status ?? 'unpaid').toLowerCase();
    const paymentMethod = String((before as { payment_method?: string | null }).payment_method ?? 'cash').toLowerCase();
    const paymentConfirmed = parsed.data.payment_confirmed === true;
    const paymentReference = parsed.data.payment_reference?.trim() ?? '';

    if (paymentStatus !== 'paid' && !paymentConfirmed) {
      return jsonErr('Confirm payment received before completing this order.', 400);
    }

    if (paymentStatus !== 'paid' && paymentMethod === 'upi' && !paymentReference) {
      return jsonErr('Enter the UPI transaction reference before completing this order.', 400);
    }

    if (paymentStatus !== 'paid') {
      patch.payment_status = 'paid';
    }

    patch.completed_at = new Date().toISOString();
  }

  const { data, error } = await sb.from('orders').update(patch).eq('id', id).select('*').single();
  if (error) return jsonErr(error.message, 502);

  if (next === 'COMPLETED') {
    if (String((before as { payment_status?: string | null }).payment_status ?? 'unpaid').toLowerCase() !== 'paid') {
      try {
        await sb.from('audit_logs').insert({
          actor_id: auth.ctx.profile.id,
          action: 'order.payment_received',
          entity: 'orders',
          entity_id: id,
          meta: {
            method: String((before as { payment_method?: string | null }).payment_method ?? 'cash').toLowerCase(),
            reference: parsed.data.payment_reference?.trim() || null,
            amount: Number((before as { total_amount?: number | string | null }).total_amount ?? 0),
          },
        });
      } catch (e) {
        console.error('[supplier/orders] payment audit failed', e);
      }
    }

    try {
      await sb.rpc('increment_supplier_completed_orders', { p_supplier_id: auth.ctx.profile.id });
    } catch (e) {
      console.error('[supplier/orders] increment_supplier_completed_orders failed', e);
    }
    try {
      await checkAndUpgradeMilestone(auth.ctx.profile.id, sb);
    } catch {
      /* best-effort */
    }

    // Stock is consumed atomically by the database reservation trigger on COMPLETED.


    // Notify customer (best-effort).
    try {
      const customerId = String((before as { customer_id?: string | null }).customer_id ?? '');
      if (customerId) {
        const { createNotification } = await import('@/lib/notifications');
        await createNotification(
          customerId,
          'Order delivered!',
          'Your order has been delivered. Thank you for choosing AuroWater.',
          'booking',
          String(id),
          'completed'
        );
      }
    } catch (e) {
      console.error('[supplier/orders] customer notification failed', e);
    }
  }

  return jsonOk(data);
}

