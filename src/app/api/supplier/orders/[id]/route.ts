import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { checkAndUpgradeMilestone } from '@/lib/milestone';

const bodySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
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
    .select('id, supplier_id, status, accepted_at, customer_id, can_quantity, can_count')
    .eq('id', id)
    .maybeSingle();
  if (bErr) return jsonErr(bErr.message, 502);
  if (!before) return jsonErr('Order not found', 404);
  if (String((before as { supplier_id?: string | null }).supplier_id ?? '') !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }

  const prev = String((before as { status?: string }).status ?? '');
  const next = parsed.data.status;
  const acceptedAt = (before as { accepted_at?: string | null }).accepted_at ?? null;

  if (next === 'COMPLETED' && !acceptedAt) {
    return jsonErr('Order must be accepted before it can be completed', 409);
  }

  const allowed =
    (prev === 'ASSIGNED' && next === 'IN_PROGRESS') ||
    (prev === 'IN_PROGRESS' && next === 'COMPLETED');
  if (!allowed) return jsonErr('Invalid status transition', 400);

  const patch: Record<string, unknown> = { status: next };
  if (next === 'IN_PROGRESS') patch.dispatched_at = new Date().toISOString();
  if (next === 'COMPLETED') patch.completed_at = new Date().toISOString();

  const { data, error } = await sb.from('orders').update(patch).eq('id', id).select('*').single();
  if (error) return jsonErr(error.message, 502);

  if (next === 'COMPLETED') {
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

    // Consume the stock reserved when the supplier accepted this order.
    try {
      const qty = Math.max(0, Number((before as { can_count?: number | null; can_quantity?: number | null }).can_count ?? (before as { can_quantity?: number | null }).can_quantity ?? 0));
      if (qty > 0) {
        const { data: consumed, error: consumeError } = await sb.rpc('consume_reserved_supplier_stock', {
          p_supplier_id: auth.ctx.profile.id,
          p_quantity: qty,
        });
        if (consumeError || consumed !== true) {
          console.error('[supplier/orders] reserved stock consumption failed', consumeError ?? 'reservation not found');
        }
      }
    } catch (e) {
      console.error('[supplier/orders] supplier stock consumption failed', e);
    }

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

