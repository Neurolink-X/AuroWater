import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { data, error } = await auth.ctx.supabase.rpc('get_customer_stats', {
    p_customer_id: auth.ctx.profile.id,
  });

  if (error) {
    return jsonErr(error.message, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return jsonOk({
    total_orders: Number(row?.total_orders ?? 0),
    active_orders: Number(row?.active_orders ?? 0),
    completed: Number(row?.completed ?? row?.completed_orders ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    total_spent: Number(row?.total_spent ?? 0),
    savings: Number(row?.savings ?? row?.estimated_savings ?? 0),
    avg_rating: row?.avg_rating == null ? null : Number(row.avg_rating),
    total_reviews: Number(row?.total_reviews ?? 0),
  });
}
