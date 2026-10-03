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
//     return jsonErr(error.message, 500);
//   }
//   if (!data) {
//     return jsonErr('Order not found', 404);
//   }

//   let service_type_key: string | null = null;
//   if (data.service_type_id != null) {
//     const { data: st } = await auth.ctx.supabase
//       .from('service_types')
//       .select('key')
//       .eq('id', data.service_type_id)
//       .maybeSingle();
//     service_type_key = st?.key ?? null;
//   }

//   return jsonOk({ ...data, service_type_key });
// }
