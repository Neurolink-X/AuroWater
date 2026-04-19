import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomerStatsPayload = {
  total_orders: number;
  active_orders: number;
  completed: number;
  cancelled: number;
  total_spent: number;
  savings: number;
  avg_rating: number | null;
  total_reviews: number;
};

const ACTIVE = new Set(['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']);

type OrderRow = {
  status: string | null;
  total_amount: string | number | null;
  payment_status: string | null;
};

/**
 * Computes dashboard stats from `orders` + `reviews` using the user-scoped Supabase client (RLS).
 * Used when `get_customer_stats` RPC is missing or errors in PostgREST.
 */
export async function computeCustomerStatsFromOrders(
  supabase: SupabaseClient,
  customerId: string
): Promise<{ ok: true; stats: CustomerStatsPayload } | { ok: false; message: string }> {
  const { data: orderRows, error: oErr } = await supabase
    .from('orders')
    .select('status, total_amount, payment_status')
    .eq('customer_id', customerId);

  if (oErr) {
    return { ok: false, message: oErr.message };
  }

  const orders = (orderRows ?? []) as OrderRow[];
  const total_orders = orders.length;
  let active_orders = 0;
  let completed = 0;
  let cancelled = 0;
  let total_spent = 0;

  for (const o of orders) {
    const st = (o.status ?? '').toUpperCase();
    if (ACTIVE.has(st)) active_orders += 1;
    if (st === 'COMPLETED') {
      completed += 1;
      const paid = (o.payment_status ?? '').toLowerCase() === 'paid';
      if (paid) {
        total_spent += Number(o.total_amount ?? 0);
      }
    }
    if (st === 'CANCELLED') cancelled += 1;
  }

  const savings = total_spent * 0.35;

  const { data: revRows, error: rErr } = await supabase
    .from('reviews')
    .select('rating')
    .eq('customer_id', customerId);

  if (rErr) {
    return {
      ok: true,
      stats: {
        total_orders,
        active_orders,
        completed,
        cancelled,
        total_spent,
        savings,
        avg_rating: null,
        total_reviews: 0,
      },
    };
  }

  const ratings = (revRows ?? []) as { rating: number }[];
  const total_reviews = ratings.length;
  const avg_rating =
    total_reviews > 0
      ? ratings.reduce((s, r) => s + Number(r.rating), 0) / total_reviews
      : null;

  return {
    ok: true,
    stats: {
      total_orders,
      active_orders,
      completed,
      cancelled,
      total_spent,
      savings,
      avg_rating,
      total_reviews,
    },
  };
}
