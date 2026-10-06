import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let reason = '';
  try {
    const body = (await req.json()) as { reason?: string };
    reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  } catch {
    /* optional body */
  }

  const { data: existing, error: e0 } = await auth.ctx.supabase
    .from('orders')
    .select('id, status, service_type, supplier_id, accepted_at, can_count')
    .eq('id', id)
    .eq('customer_id', auth.ctx.profile.id)
    .maybeSingle();

  if (e0) console.error('[orders/cancel] lookup failed:', e0);
  if (e0 || !existing) {
    return jsonErr('Order not found', 404);
  }

  if (existing.status !== 'PENDING' && existing.status !== 'ASSIGNED') {
    return jsonErr('Only pending or assigned orders can be cancelled', 400);
  }

  // Status is re-checked in the update so a supplier accepting at the same
  // moment cannot be overwritten.
  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .update({
      status: 'CANCELLED',
      cancel_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('customer_id', auth.ctx.profile.id)
    .in('status', ['PENDING', 'ASSIGNED'])
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[orders/cancel] update failed:', error);
    return jsonErr(error.message ?? 'Cancel failed', 500);
  }
  if (!data) {
    return jsonErr('Order can no longer be cancelled', 409);
  }

  // Release any stock reserved when a supplier accepted the order.
  // This makes cancellation safe for supplier inventory instead of leaving cans blocked.
  if (existing.supplier_id && existing.accepted_at && Number(existing.can_count ?? 0) > 0 && existing.service_type === 'water_can') {
    try {
      const { error: releaseError } = await auth.ctx.supabase.rpc('release_reserved_supplier_stock', {
        p_supplier_id: existing.supplier_id,
        p_quantity: Math.max(1, Number(existing.can_count ?? 0)),
      });
      if (releaseError) console.error('[orders/cancel] stock release failed:', releaseError);
    } catch (e) {
      console.error('[orders/cancel] stock release exception:', e);
    }
  }

  const serviceName =
    typeof existing.service_type === 'string' && existing.service_type
      ? existing.service_type.replace(/_/g, ' ')
      : 'service';

  try {
    const { createNotification } = await import('@/lib/notifications');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notify = createNotification as any;
    await notify(
      auth.ctx.profile.id,
      'Order Cancelled',
      `Your ${serviceName} order has been cancelled.`,
      'booking',
      id,
      'cancelled'
    );
    if (existing.supplier_id) {
      await notify(
        String(existing.supplier_id),
        'Order cancelled',
        `The customer cancelled a ${serviceName} order.`,
        'system',
        id,
        'cancelled'
      );
    }
  } catch (e) {
    console.error('[notifications] order cancelled', e);
  }

  const row = data as Record<string, unknown>;
  return jsonOk({
    ...row,
    service_type_key: row.service_type ?? null,
    cancellation_reason: row.cancel_reason ?? null,
  });
}












// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

// export async function PUT(
//   req: NextRequest,
//   ctx: { params: Promise<{ id: string }> }
// ) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) {
//     return jsonErr('Forbidden', 403);
//   }

//   const { id } = await ctx.params;

//   let reason = '';
//   try {
//     const body = (await req.json()) as { reason?: string };
//     reason = typeof body.reason === 'string' ? body.reason : '';
//   } catch {
//     /* optional body */
//   }

//   const { data: existing, error: e0 } = await auth.ctx.supabase
//     .from('orders')
//     .select('id, status, service_type_id')
//     .eq('id', id)
//     .eq('customer_id', auth.ctx.profile.id)
//     .maybeSingle();

//   if (e0 || !existing) {
//     return jsonErr('Order not found', 404);
//   }

//   if (existing.status !== 'PENDING' && existing.status !== 'ASSIGNED') {
//     return jsonErr('Only pending or assigned orders can be cancelled', 400);
//   }

//   const { data, error } = await auth.ctx.supabase
//     .from('orders')
//     .update({
//       status: 'CANCELLED',
//       cancellation_reason: reason || null,
//     })
//     .eq('id', id)
//     .select('*')
//     .single();

//   if (error || !data) {
//     return jsonErr(error?.message ?? 'Cancel failed', 500);
//   }

//   let serviceName = 'service';
//   if (existing.service_type_id != null) {
//     const { data: st } = await auth.ctx.supabase
//       .from('service_types')
//       .select('name')
//       .eq('id', existing.service_type_id)
//       .maybeSingle();
//     if (st?.name) serviceName = String(st.name);
//   }
//   const { createNotification } = await import('@/lib/notifications');
//   await createNotification(
//     auth.ctx.profile.id,
//     'Order Cancelled',
//     `Your ${serviceName} order has been cancelled.`,
//     'booking',
//     id,
//     'cancelled'
//   );

//   return jsonOk(data);
// }
