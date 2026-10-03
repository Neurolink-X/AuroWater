import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/**
 * Customer stats computed from the real `orders` columns:
 * status, total_amount, can_count, rating.
 * Returns a superset of the old shapes so existing pages keep working.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('orders')
    .select('status, total_amount, can_count, rating')
    .eq('customer_id', auth.ctx.profile.id)
    .limit(2000);

  if (error) {
    console.error('[customer/stats] orders query failed:', error);
    return jsonErr(error.message || 'Stats load failed', 502);
  }

  const rows = (data ?? []) as {
    status: string | null;
    total_amount: number | string | null;
    can_count: number | null;
    rating: number | null;
  }[];

  let active = 0;
  let completed = 0;
  let cancelled = 0;
  let spent = 0;
  let cans = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const r of rows) {
    const s = String(r.status ?? '').toUpperCase();
    if (s === 'PENDING' || s === 'ASSIGNED' || s === 'IN_PROGRESS') active += 1;
    if (s === 'COMPLETED') {
      completed += 1;
      spent += Number(r.total_amount ?? 0) || 0;
    }
    if (s === 'CANCELLED' || s === 'FAILED') cancelled += 1;
    if (s !== 'CANCELLED' && s !== 'FAILED') cans += Number(r.can_count ?? 0) || 0;
    if (r.rating != null) {
      ratingSum += Number(r.rating);
      ratingCount += 1;
    }
  }

  const profile = auth.ctx.profile as unknown as { created_at?: string | null };

  return jsonOk({
    total_orders: rows.length,
    active_orders: active,
    completed,
    cancelled,
    total_spent: Math.round(spent * 100) / 100,
    savings: 0,
    avg_rating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    total_reviews: ratingCount,
    cans_ordered: cans,
    member_since: profile.created_at ?? null,
  });
}
