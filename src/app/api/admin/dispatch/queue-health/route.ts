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
  const [flag, ready, leased, dead, oldest, agedPending, deadLetters, releaseCheck] = await Promise.all([
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
    db.from('dispatch_work_items')
      .select('order_id,last_result_code,attempts,updated_at')
      .eq('state', 'dead')
      .order('updated_at', { ascending: false }).limit(20),
    db.rpc('dispatch_queue_release_readiness'),
  ]);
  if ([flag, ready, leased, dead, oldest, agedPending, deadLetters, releaseCheck].some(result => result.error)) {
    return jsonErr('Dispatch queue health is temporarily unavailable.', 503);
  }

  const readiness = (releaseCheck.data ?? {}) as {
    queueCronReady?: boolean; reconcileCronReady?: boolean; secretReady?: boolean;
    autoAssignEnabled?: boolean; pendingWithoutQueue?: number;
    staleOrdersAwaitingReview?: number;
  };
  const operationalReady = Boolean(
    readiness.queueCronReady && readiness.reconcileCronReady &&
    readiness.secretReady && readiness.autoAssignEnabled &&
    Number(readiness.pendingWithoutQueue ?? 1000) <= 100
  );
  return jsonOk({
    enabled: flag.data?.value === 'true',
    release_approved: process.env.AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED === 'true',
    activation_ready: operationalReady && process.env.AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED === 'true',
    readiness,
    ready: ready.count ?? 0,
    leased: leased.count ?? 0,
    dead: dead.count ?? 0,
    oldest_wait_seconds: oldest.data?.created_at
      ? Math.max(0, Math.round((Date.now() - Date.parse(oldest.data.created_at)) / 1000)) : 0,
    pending_orders_over_2h: agedPending.count ?? 0,
    dead_letters: deadLetters.data ?? [],
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

/**
 * Manually controlled queue rollout. It MUST NOT auto-enable based on traffic.
 * Even a privileged admin cannot activate it until an operator has passed
 * the release gates and explicitly configured the server-only approval flag.
 * The database activation trigger performs the final pending-order handoff check.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireSupabaseAuth(request);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let body: { enabled?: unknown; confirmation?: unknown };
  try {
    body = (await request.json()) as { enabled?: unknown; confirmation?: unknown };
  } catch {
    return jsonErr('Invalid JSON request', 400);
  }
  if (typeof body.enabled !== 'boolean') return jsonErr('Specify true or false for enabled', 400);
  const enable = body.enabled;

  // Opt-in requires a deliberate release approval, not current load.
  if (enable) {
    if (body.confirmation !== 'ENABLE_DISPATCH_QUEUE') {
      return jsonErr('Explicit queue activation confirmation required', 400);
    }
    if (process.env.AUROTAP_DISPATCH_QUEUE_RELEASE_APPROVED !== 'true') {
      return jsonErr(
        'Queue activation is locked. Complete migration, staging tests, cron and capacity release gates first.',
        409,
        'QUEUE_RELEASE_NOT_APPROVED',
      );
    }
  }

  const db = createServiceClient();
  if (enable) {
    const { data: releaseData, error: releaseError } = await db.rpc('dispatch_queue_release_readiness');
    if (releaseError || !releaseData || typeof releaseData !== 'object') {
      return jsonErr('Queue readiness check is unavailable. Verify the safe rollout migration.', 503, 'QUEUE_READINESS_UNAVAILABLE');
    }
    const readiness = releaseData as {
      queueCronReady?: boolean; reconcileCronReady?: boolean; secretReady?: boolean;
      autoAssignEnabled?: boolean; pendingWithoutQueue?: number;
    };
    if (!readiness.queueCronReady || !readiness.reconcileCronReady ||
        !readiness.secretReady || !readiness.autoAssignEnabled) {
      return jsonErr('Queue activation blocked: scheduler, vault or assignment checks are not ready.', 409, 'QUEUE_NOT_READY');
    }
    if (Number(readiness.pendingWithoutQueue ?? Infinity) > 100) {
      return jsonErr('Queue activation blocked: prefill pending jobs in controlled batches before enabling.', 409, 'QUEUE_BACKFILL_REQUIRED');
    }
  }
  const { data: current, error: readError } = await db.from('settings')
    .select('value').eq('key', 'dispatch_work_queue_enabled').maybeSingle();
  if (readError || !current) {
    return jsonErr('Dispatch queue configuration unavailable. Verify its database migration.', 503);
  }
  if (current.value === String(enable)) return jsonOk({ enabled: enable, changed: false });

  // Atomic database toggle + audit; the DB trigger checks authorization,
  // cron configuration, shared secret and pending-order backfill.
  const actorId = auth.ctx.user?.id;
  if (!actorId) return jsonErr('Verified admin identity is unavailable', 401);
  const { data, error } = await db.rpc('set_dispatch_queue_enabled', {
    p_enabled: enable,
    p_actor_id: actorId,
  });
  if (error || data !== enable) {
    return jsonErr(
      enable ? 'Queue activation blocked by database release checks. Review readiness and pending orders.' :
        'Could not disable queue safely. Check the database and audit log.',
      409,
      'QUEUE_TRANSITION_FAILED',
    );
  }
  return jsonOk({ enabled: data, changed: true });
}
