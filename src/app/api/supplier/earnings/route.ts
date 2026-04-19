import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') ?? 'month';

  const { data, error } = await auth.ctx.supabase.rpc('get_supplier_earnings', {
    p_supplier_id: auth.ctx.profile.id,
    p_period: period,
  });

  if (error) {
    return jsonErr(error.message, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return jsonOk({
    period: row?.period_label ?? period,
    order_count: Number(row?.order_count ?? 0),
    gross_amount: Number(row?.gross_amount ?? 0),
    pending_payout: Number(row?.pending_payout ?? 0),
  });
}
