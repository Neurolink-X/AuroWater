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

  // PostgREST limits individual result windows. Never silently understate
  // totals as completed order volume grows. Read only relevant columns,
  // paginate deterministically and fail closed beyond the safety budget.
  const PAGE_SIZE = 500;
  const MAX_PAGES = 20;
  let completedCount = 0;
  let gross = 0;
  let collected = 0;
  let scannedAll = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await auth.ctx.supabase
      .from('orders')
      .select('id,total_amount,payment_status,created_at')
      .eq('status', 'COMPLETED')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      console.error('[finance] aggregation unavailable', { code: error.code });
      return jsonErr('Financial summary is temporarily unavailable.', 503);
    }
    for (const row of data ?? []) {
      const amount = Number(row.total_amount ?? 0);
      if (!Number.isFinite(amount) || amount < 0) {
        return jsonErr('Financial summary contains invalid order amounts; investigate before reporting.', 503);
      }
      completedCount++;
      gross += amount;
      if (row.payment_status === 'paid') collected += amount;
    }
    if ((data ?? []).length < PAGE_SIZE) { scannedAll = true; break; }
  }
  if (!scannedAll) {
    return jsonErr('Financial volume exceeds the safe summary limit; use a verified SQL aggregate before reporting totals.', 503);
  }
  // Application-recorded paid != bank-settled; never assert gateway reconciliation.
  const pendingPayments = Math.max(0, gross - collected);

  return jsonOk({
    range,
    order_count: completedCount,
    gross_revenue: gross,
    collected_revenue: collected,
    pending_payments: pendingPayments,
    settlement_verified: false,
    data_scope: 'Recorded completed orders only; payment_status=paid is not verified bank settlement.',
  });
}
