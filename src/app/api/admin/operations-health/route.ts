import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Probe = { status: 'healthy' | 'degraded'; latency_ms: number; code?: string };
const bound = (ms: number) => Math.max(0, Math.round(ms));

/**
 * Admin-only, read-only incident snapshot.
 * No customer information, SQL contents or credentials leave this route.
 * If authentication infrastructure itself is down, the independent GitHub
 * production watchdog remains the external incident record.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);
  const started = Date.now();
  try {
    const db = createServiceClient();
    const probe = async (
      name: 'database' | 'orders' | 'cities',
    ): Promise<Probe> => {
      const at = Date.now();
      try {
        const result = name === 'database'
          ? await db.from('profiles').select('id').limit(1).abortSignal(AbortSignal.timeout(4000))
          : name === 'orders'
            ? await db.from('orders').select('id').limit(1).abortSignal(AbortSignal.timeout(4000))
            : await db.from('cities').select('id').limit(1).abortSignal(AbortSignal.timeout(4000));
        return result.error
          ? { status: 'degraded', latency_ms: bound(Date.now() - at), code: result.error.code || 'DB_QUERY_FAILED' }
          : { status: 'healthy', latency_ms: bound(Date.now() - at) };
      } catch {
        return { status: 'degraded', latency_ms: bound(Date.now() - at), code: 'DB_CONNECTION_FAILED' };
      }
    };
    const checks = await Promise.all([
      probe('database'), probe('orders'), probe('cities'),
    ]);
    const named = { database: checks[0], orders: checks[1], cities: checks[2] };
    const degraded = checks.some(check => check.status === 'degraded');

    let pendingSample: { checked: number; overdue_unassigned_water: number; overdue_unassigned_technician: number; capped: boolean } | null = null;
    if (named.orders.status === 'healthy') {
      const result = await db.from('orders')
        .select('id,created_at,scheduled_at,service_type,supplier_id,technician_id')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(100)
        .abortSignal(AbortSignal.timeout(4000));
      if (!result.error && result.data) {
        const now = Date.now();
        const due = result.data.filter(order => {
          const date = Date.parse(String(order.scheduled_at || ''));
          return Number.isFinite(date) && date <= now;
        });
        pendingSample = {
          checked: result.data.length,
          overdue_unassigned_water: due.filter(order => order.service_type === 'water_can' && !order.supplier_id).length,
          overdue_unassigned_technician: due.filter(order => order.service_type !== 'water_can' && !order.technician_id).length,
          capped: result.data.length === 100,
        };
      }
    }
    return jsonOk({
      status: degraded ? 'degraded' : 'healthy',
      checked_at: new Date().toISOString(),
      duration_ms: bound(Date.now() - started),
      checks: named,
      pending_sample: pendingSample,
      note: 'Pending counts are capped samples, not the total backlog. Only orders whose scheduled_at is due are classified as overdue. No automatic financial or status mutations.',
      recovery: degraded ? [
        'Check Supabase project and database logs, connection pool saturation and recent migrations.',
        'Check Vercel function errors and the latest deployment.',
        'After connectivity returns, inspect pending orders and dispatch sweeps before reconciling payments.',
      ] : (pendingSample?.overdue_unassigned_water || pendingSample?.overdue_unassigned_technician) ? [
        'Water orders: inspect supplier coverage, active approval, online availability, stock and dispatch no_candidates. Do not mark orders assigned without an eligible supplier.',
        'Technician jobs: inspect verified technician skills, coverage, availability, pending offers and retry limits.',
        'Check pg_cron dispatch sweeps and their HTTP response, not only cron.job_run_details success.',
      ] : [],
    });
  } catch {
    return jsonErr('Operational diagnostics could not be refreshed.', 503, 'OPS_DIAGNOSTICS_UNAVAILABLE');
  }
}
