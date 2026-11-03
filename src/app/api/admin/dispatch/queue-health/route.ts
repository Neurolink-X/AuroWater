import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin-only operational summary. Does not return customer data or payloads. */
export async function GET(request: NextRequest) {
  const auth = await requireSupabaseAuth(request);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const [flag, ready, leased, dead, oldest, agedPending] = await Promise.all([
    db.from('settings').select('value')
      .eq('key', 'dispatch_work_queue_enabled').maybeSingle(),
    db.from('dispatch_work_items').select('order_id', { head: true, count: 'exact' })
      .eq('state', 'ready'),
    db.from('dispatch_work_items').select('order_id', { head: true, count: 'exact' })
      .eq('state', 'leased'),
    db.from('dispatch_work_items').select('order_id', { head: true, count: 'exact' })
      .eq('state', 'dead'),
    db.from('dispatch_work_items').select('created_at')
      .in('state', ['ready', 'leased'])
      .order('created_at', { ascending: true }).limit(1).maybeSingle(),
    db.from('orders').select('id', { head: true, count: 'exact' })
      .eq('status', 'PENDING')
      .lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
  ]);
  if ([flag, ready, leased, dead, oldest, agedPending].some(result => result.error)) {
    return jsonErr('Dispatch queue health is temporarily unavailable.', 503);
  }

  return jsonOk({
    enabled: flag.data?.value === 'true',
    ready: ready.count ?? 0,
    leased: leased.count ?? 0,
    dead: dead.count ?? 0,
    oldest_wait_seconds: oldest.data?.created_at
      ? Math.max(0, Math.round((Date.now() - Date.parse(oldest.data.created_at)) / 1000)) : 0,
    pending_orders_over_2h: agedPending.count ?? 0,
    global_concurrency_cap: 24,
    local_concurrency_cap: 3,
    checked_at: new Date().toISOString(),
  });
}


/** Explicit privileged recovery ONLY. No order/payment changes or auto replay. */
export async function POST(request: NextRequest) {
  const auth = await requireSupabaseAuth(request);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let body: { order_id?: string };
  try { body = (await request.json()) as { order_id?: string }; }
  catch { return jsonErr('Invalid JSON request', 400); }
  const orderId = body.order_id?.trim() ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    return jsonErr('Invalid order identifier', 400);
  }

  // This merely schedules a fresh attempt. Eligibility, city, approval,
  // capacity and stock are rechecked by the existing dispatch engine.
  const { data, error } = await createServiceClient()
    .rpc('requeue_dead_dispatch_work', { p_order_id: orderId });
  if (error) return jsonErr('Queue recovery unavailable', 503);
  if (data !== true) return jsonErr('Order is not an eligible dead-letter item', 409);
  return jsonOk({ requeued: true });
}
