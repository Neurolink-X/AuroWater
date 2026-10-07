import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

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

  // Latency-sensitive tracking read: dispatch maintenance runs independently.

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .select(`id, order_number, status, created_at, updated_at, service_type,
      address_snapshot, address, scheduled_at, note, total_amount, base_amount,
      platform_fee, convenience_fee, gst_amount, emergency_charge,
      payment_method, payment_status, technician_id, supplier_id,
      assigned_at, accepted_at, dispatched_at, completed_at, cancelled_at,
      cancel_reason, can_count, is_emergency`)
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








