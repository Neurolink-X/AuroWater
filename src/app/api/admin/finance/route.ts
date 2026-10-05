import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const requestedRange = searchParams.get('range') ?? '30d';

  const days =
    requestedRange === '7d'
      ? 7
      : requestedRange === '30d'
        ? 30
        : requestedRange === '90d'
          ? 90
          : requestedRange === 'all'
            ? 3650
            : 30;

  const range =
    requestedRange === '7d' ||
    requestedRange === '30d' ||
    requestedRange === '90d' ||
    requestedRange === 'all'
      ? requestedRange
      : '30d';

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders, error } = await auth.ctx.supabase
    .from('orders')
    .select('total_amount, status, created_at, payment_status')
    .eq('status', 'COMPLETED')
    .gte('created_at', since.toISOString());

  if (error) {
    return jsonErr(error.message, 502);
  }

  const completedOrders = orders ?? [];

  const gross = completedOrders.reduce(
    (sum, order) => sum + Number(order.total_amount ?? 0),
    0,
  );

  const collected = completedOrders
    .filter((order) => order.payment_status === 'paid')
    .reduce(
      (sum, order) => sum + Number(order.total_amount ?? 0),
      0,
    );

  const pendingPayments = Math.max(0, gross - collected);

  return jsonOk({
    range,
    order_count: completedOrders.length,
    gross_revenue: gross,
    collected_revenue: collected,
    pending_payments: pendingPayments,
  });
}
