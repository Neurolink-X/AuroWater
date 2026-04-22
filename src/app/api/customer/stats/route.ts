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
    return jsonErr(fallback.message || 'Could not load customer stats', 500, 'STATS_COMPUTE_FAILED');
  }

  const { data: completedRows } = await auth.ctx.supabase
    .from('orders')
    .select('can_quantity, total_amount')
    .eq('customer_id', auth.ctx.profile.id)
    .eq('status', 'COMPLETED');

  const cans_ordered = (completedRows ?? []).reduce(
    (s, r) => s + Math.max(0, Number((r as { can_quantity?: number | null }).can_quantity ?? 0)),
    0
  );

  const total_spent = (completedRows ?? []).reduce(
    (s, r) => s + Math.max(0, Number((r as { total_amount?: number | string | null }).total_amount ?? 0)),
    0
  );

  const { data: profile } = await auth.ctx.supabase
    .from('profiles')
    .select('created_at')
    .eq('id', auth.ctx.profile.id)
    .maybeSingle();

  const createdAt = profile?.created_at ? String(profile.created_at) : null;

  return jsonOk({
    ...fallback.stats,
    total_spent,
    cans_ordered,
    member_since: createdAt,
  });
}
