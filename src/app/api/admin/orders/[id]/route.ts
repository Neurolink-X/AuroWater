import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { checkAndUpgradeMilestone } from '@/lib/milestone';

function formatAddressSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const o = snapshot as Record<string, unknown>;
  const parts = [o.house_flat, o.area, o.city, o.pincode, o.landmark]
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => (x as string).trim());
  return parts.join(', ');
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(_req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;
  const sb = auth.ctx.supabase;

  const { data: order, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!order) {
    return jsonErr('Order not found', 404);
  }

  const row = order as Record<string, unknown>;
  const customerId = row.customer_id != null ? String(row.customer_id) : '';
  const technicianId = row.technician_id != null ? String(row.technician_id) : '';

  let customer_name: string | null = null;
  let customer_phone: string | null = null;
  if (customerId) {
    const { data: c } = await sb.from('profiles').select('full_name, phone').eq('id', customerId).maybeSingle();
    customer_name = c?.full_name != null ? String(c.full_name) : null;
    customer_phone = c?.phone != null ? String(c.phone) : null;
  }

  let technician_name: string | null = null;
  let technician_phone: string | null = null;
  if (technicianId) {
    const { data: t } = await sb.from('profiles').select('full_name, phone').eq('id', technicianId).maybeSingle();
    technician_name = t?.full_name != null ? String(t.full_name) : null;
    technician_phone = t?.phone != null ? String(t.phone) : null;
  }

  let service_name: string | null = null;
  let service_key: string | null = null;
  if (row.service_type_id != null) {
    const { data: st } = await sb
      .from('service_types')
      .select('key, name')
      .eq('id', row.service_type_id as number)
      .maybeSingle();
    if (st?.name != null) service_name = String(st.name);
    if (st?.key != null) service_key = String(st.key);
  }

  const flatAddress = typeof row.address === 'string' && row.address.trim() ? String(row.address).trim() : '';
  const address_text = flatAddress || formatAddressSnapshot(row.address_snapshot);

  return jsonOk({
    ...order,
    customer_name,
    customer_phone,
    technician_name,
    technician_phone,
    service_name,
    service_key,
    address_text,
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const allowed = [
    'status',
    'supplier_id',
    'technician_id',
    'scheduled_date',
    'time_slot',
    'payment_status',
    'notes',
    'total_amount',
    'base_amount',
    'gst_amount',
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) {
      patch[k] = body[k];
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonErr('No updatable fields provided', 400);
  }

  // Fetch current row first so we can detect status transitions.
  const sb = auth.ctx.supabase;
  const { data: before, error: beforeErr } = await sb
    .from('orders')
    .select('id, status, supplier_id, customer_id, can_quantity')
    .eq('id', id)
    .maybeSingle();
  if (beforeErr) return jsonErr(beforeErr.message, 500);
  if (!before) return jsonErr('Order not found', 404);

  const prevStatus = String((before as Record<string, unknown>).status ?? '');
  const patchStatus = typeof patch.status === 'string' ? String(patch.status) : '';
  if (prevStatus !== 'COMPLETED' && patchStatus === 'COMPLETED') {
    patch.completed_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Order not found', 404);
  }

  const nextStatus = String((data as Record<string, unknown>).status ?? '');
  const supplierIdRaw = (data as Record<string, unknown>).supplier_id;
  const supplierId = supplierIdRaw != null ? String(supplierIdRaw) : '';

  // When status changes TO COMPLETED and order has supplier_id:
  // - increment profiles.completed_orders atomically
  // - check milestone upgrade and update supplier benefits
  if (prevStatus !== 'COMPLETED' && nextStatus === 'COMPLETED' && supplierId) {
    const { error: incErr } = await sb.rpc('increment_supplier_completed_orders', {
      p_supplier_id: supplierId,
    });
    if (incErr) {
      // Fallback: best-effort read + write (not atomic).
      const { data: p } = await sb
        .from('profiles')
        .select('completed_orders')
        .eq('id', supplierId)
        .maybeSingle();
      const curr = Number((p as { completed_orders?: number } | null)?.completed_orders ?? 0);
      await sb.from('profiles').update({ completed_orders: curr + 1 }).eq('id', supplierId);
    }

    try {
      await checkAndUpgradeMilestone(supplierId, sb);
    } catch (e: unknown) {
      console.error('[milestone upgrade]', e instanceof Error ? e.message : String(e));
    }

    // Decrement supplier stock (best-effort).
    try {
      const qty = Math.max(0, Number((before as { can_quantity?: number | null }).can_quantity ?? 0));
      if (qty > 0) {
        const { data: stockRow } = await sb
          .from('supplier_stock')
          .select('cans_available')
          .eq('supplier_id', supplierId)
          .maybeSingle();
        const available = Math.max(0, Number((stockRow as { cans_available?: number } | null)?.cans_available ?? 0));
        await sb
          .from('supplier_stock')
          .upsert(
            { supplier_id: supplierId, cans_available: Math.max(0, available - qty), updated_at: new Date().toISOString() },
            { onConflict: 'supplier_id' }
          );
      }
    } catch (e) {
      console.error('[admin/orders] supplier_stock decrement failed', e);
    }
  }

  if (prevStatus !== 'COMPLETED' && nextStatus === 'COMPLETED') {
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
      console.error('[admin/orders] customer notification failed', e);
    }
  }

  return jsonOk(data);
}
