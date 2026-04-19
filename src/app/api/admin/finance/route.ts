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
  const range = searchParams.get('range') ?? '30d';

  const days =
    range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === 'all' ? 3650 : 30;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders, error } = await auth.ctx.supabase
    .from('orders')
    .select('total_amount, status, created_at, payment_status')
    .eq('status', 'COMPLETED')
    .gte('created_at', since.toISOString());

  if (error) {
    return jsonErr(error.message, 500);
  }

  const gross = (orders ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const paid = (orders ?? []).filter((o) => o.payment_status === 'paid');
  const collected = paid.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  return jsonOk({
    range,
    order_count: (orders ?? []).length,
    gross_revenue: gross,
    collected_revenue: collected,
    pending_payments: gross - collected,
  });
}
