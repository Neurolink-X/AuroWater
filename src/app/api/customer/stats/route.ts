import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { computeCustomerStatsFromOrders } from '@/lib/customer/compute-customer-stats';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const fallback = await computeCustomerStatsFromOrders(auth.ctx.supabase, auth.ctx.profile.id);
  if (!fallback.ok) {
    return jsonErr(
      fallback.message || 'Could not load customer stats',
      500,
      'STATS_COMPUTE_FAILED'
    );
  }

  return jsonOk(fallback.stats);
}
