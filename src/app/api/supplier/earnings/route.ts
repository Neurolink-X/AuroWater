import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/**
 * GET /api/supplier/earnings?period=month
 *
 * Earnings summary for the signed-in supplier, computed by the database function
 * get_supplier_earnings (the accounting source of truth: nothing is calculated in the browser).
 *
 * Query params
 *   period  optional, default "month"; passed to the database function as-is after validation
 *
 * Response 200
 *   { period, currency, order_count, gross_amount, pending_payout }
 *
 * Other responses: 400 bad period · 403 not a supplier · 500 failure (logged, never leaked)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // per-user money data, never cached

const DEFAULT_PERIOD = 'month';
const PERIOD_RE = /^[a-z0-9_-]{1,20}$/;

/** Safe number: Postgres `numeric` arrives as a string, and bad data must never become NaN. */
const toNumber = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const toMoney = (v: unknown): number => Math.round(toNumber(v) * 100) / 100;

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const period = (new URL(req.url).searchParams.get('period') ?? DEFAULT_PERIOD).trim().toLowerCase();
  if (!PERIOD_RE.test(period)) return jsonErr('Invalid period.', 400);

  try {
    const { data, error } = await auth.ctx.supabase.rpc('get_supplier_earnings', {
      // Always the signed-in supplier: never taken from the request.
      p_supplier_id: auth.ctx.profile.id,
      p_period: period,
    });

    if (error) {
      console.error('[supplier/earnings] rpc failed', { period, code: error.code, message: error.message });
      return jsonErr('Could not load your earnings. Please try again.', 500);
    }

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;

    return jsonOk({
      period: typeof row?.period_label === 'string' && row.period_label ? row.period_label : period,
      currency: 'INR',
      order_count: Math.max(0, Math.trunc(toNumber(row?.order_count))),
      gross_amount: toMoney(row?.gross_amount),
      pending_payout: toMoney(row?.pending_payout),
    });
  } catch (err) {
    console.error('[supplier/earnings] unexpected failure', err instanceof Error ? err.message : err);
    return jsonErr('Could not load your earnings. Please try again.', 500);
  }
}
