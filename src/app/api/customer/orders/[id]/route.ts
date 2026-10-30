import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

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

  // Resolve the assigned professional server-side after verifying that this
  // order belongs to the authenticated customer. This avoids relying on
  // client-side profile RLS policies to show the provider's name.
  const row = data as Record<string, unknown>;
  let technicianProfile: { id: string; full_name: string | null; avatar_url: string | null } | null = null;
  let supplierProfile: { id: string; full_name: string | null; avatar_url: string | null; milestone_tier: string | null; last_seen_at: string | null } | null = null;
  let technicianAcceptanceStatus: string | null = null;
  const admin = createServiceClient();

  if (typeof row.technician_id === 'string' && row.technician_id.trim()) {
    const [profileResult, dispatchResult] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', row.technician_id)
        .maybeSingle(),
      admin
        .from('technician_job_dispatch')
        .select('status')
        .eq('order_id', id)
        .eq('technician_id', row.technician_id)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      console.error('[orders/:id] technician profile lookup failed:', profileResult.error.message);
    } else if (profileResult.data) {
      technicianProfile = profileResult.data;
    }

    if (dispatchResult.error) {
      // Keep tracking resilient if dispatch metadata is temporarily unavailable.
      console.error('[orders/:id] technician acceptance lookup failed:', dispatchResult.error.message);
    } else if (dispatchResult.data?.status) {
      technicianAcceptanceStatus = String(dispatchResult.data.status).toUpperCase();
    }
  }

  if (typeof row.supplier_id === 'string' && row.supplier_id.trim()) {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, milestone_tier, last_seen_at')
      .eq('id', row.supplier_id)
      .maybeSingle();
    if (profileError) {
      console.error('[orders/:id] supplier profile lookup failed:', profileError.message);
    } else if (profile) {
      supplierProfile = profile;
    }
  }

  // Orders store the service key directly in `service_type`.
  // Old field names are added so existing frontend code keeps working.
  return jsonOk({
    ...row,
    technician_profile: technicianProfile,
    technician_acceptance_status: technicianAcceptanceStatus,
    supplier_profile: supplierProfile,
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








