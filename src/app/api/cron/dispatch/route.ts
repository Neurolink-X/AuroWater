import { NextRequest } from 'next/server';

import { createServiceClient } from '@/utils/supabase/server';
import { dispatchOrder, releaseAssignment } from '@/lib/dispatch';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Global dispatch maintenance.
 *
 * This is intentionally independent of customer page visits.
 * It releases expired unaccepted offers and retries pending
 * water orders that still need a supplier.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const db = createServiceClient();

  const { data: settings } = await db
    .from('settings')
    .select('key, value')
    .in('key', [
      'dispatch_response_seconds',
      'dispatch_max_attempts',
    ]);

  const map = Object.fromEntries(
    (settings ?? []).map((r) => [r.key, String(r.value)])
  );

  const responseSeconds = Math.max(
    30,
    Number(map.dispatch_response_seconds ?? 300) || 300
  );
  const maxAttempts = Math.max(
    1,
    Math.floor(Number(map.dispatch_max_attempts ?? 5) || 5)
  );

  const staleBefore = new Date(
    Date.now() - responseSeconds * 1000
  ).toISOString();

  const { data: stale } = await db
    .from('orders')
    .select('id, supplier_id')
    .eq('service_type', 'water_can')
    .eq('status', 'ASSIGNED')
    .is('accepted_at', null)
    .lt('assigned_at', staleBefore)
    .not('supplier_id', 'is', null)
    .limit(100);

  let expired = 0;
  let reassigned = 0;

  for (const order of stale ?? []) {
    if (!order.supplier_id) continue;

    const result = await releaseAssignment(
      String(order.id),
      String(order.supplier_id),
      'EXPIRED',
      'global dispatch timeout'
    );

    if (result.released) {
      expired += 1;
      if (result.reassigned) reassigned += 1;
    }
  }

  const { data: pending } = await db
    .from('orders')
    .select('id, dispatch_attempts, last_dispatch_at')
    .eq('service_type', 'water_can')
    .eq('status', 'PENDING')
    .is('supplier_id', null)
    .limit(100);

  let attempted = 0;
  let assigned = 0;

  const retryAfter = Date.now() - 30_000;

  for (const order of pending ?? []) {
    if (Number(order.dispatch_attempts ?? 0) >= maxAttempts) continue;

    const last = order.last_dispatch_at
      ? new Date(String(order.last_dispatch_at)).getTime()
      : 0;

    if (last >= retryAfter) continue;

    attempted += 1;
    const result = await dispatchOrder(String(order.id));
    if (result.supplierId) assigned += 1;
  }

  return json({
    ok: true,
    expired,
    reassigned,
    retry_attempted: attempted,
    newly_assigned: assigned,
  });
}
