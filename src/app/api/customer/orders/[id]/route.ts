import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { sweepCustomerOrders } from '@/lib/dispatch';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  // Lazy dispatch maintenance (releases unanswered offers, retries unassigned orders)
  await sweepCustomerOrders(auth.ctx.profile.id);

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('customer_id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    console.error('[orders/:id] load failed:', error);
    return jsonErr(error.message, 500);
  }
  if (!data) {
    return jsonErr('Order not found', 404);
  }

  // Orders store the service key directly in `service_type`.
  // Old field names are added so existing frontend code keeps working.
  const row = data as Record<string, unknown>;
  return jsonOk({
    ...row,
    service_type_key: row.service_type ?? null,
    can_quantity: row.can_count ?? null,
    notes: row.note ?? null,
    cancellation_reason: row.cancel_reason ?? null,
    base_amount: row.base_amount ?? 0,
    convenience_fee: row.convenience_fee ?? row.platform_fee ?? 0,
    emergency_charge: row.emergency_charge ?? 0,
    gst_amount: row.gst_amount ?? 0,
    address_snapshot:
      row.address_snapshot ?? (row.address ? { house_flat: row.address } : null),
  });
}






// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

// export async function GET(
//   req: NextRequest,
//   ctx: { params: Promise<{ id: string }> }
// ) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) {
//     return jsonErr('Forbidden', 403);
//   }

//   const { id } = await ctx.params;

//   const { data, error } = await auth.ctx.supabase
//     .from('orders')
//     .select('*')
//     .eq('id', id)
//     .eq('customer_id', auth.ctx.profile.id)
//     .maybeSingle();

//   if (error) {
//     console.error('[orders/:id] load failed:', error);
//     return jsonErr(error.message, 500);
//   }
//   if (!data) {
//     return jsonErr('Order not found', 404);
//   }

//   // Orders store the service key directly in `service_type`.
//   // Old field names are added so existing frontend code keeps working.
//   const row = data as Record<string, unknown>;
//   return jsonOk({
//     ...row,
//     service_type_key: row.service_type ?? null,
//     can_quantity: row.can_count ?? null,
//     notes: row.note ?? null,
//     cancellation_reason: row.cancel_reason ?? null,
//   });
// }








