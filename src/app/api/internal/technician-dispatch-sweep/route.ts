import { NextRequest } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { releaseTechnicianAssignment, dispatchTechnicianJob } from '@/lib/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 170;

const BATCH_SIZE = 25;
const MAX_RUNTIME_MS = 150_000;
const RECENT_ORDER_GRACE_MS = 30_000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  return runSweep(req);
}

export async function POST(req: NextRequest) {
  return runSweep(req);
}

async function runSweep(req: NextRequest) {
  const startedAt = Date.now();

  if (!authorized(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createServiceClient();

  const { data: setting, error: settingError } = await db
    .from('settings')
    .select('value')
    .eq('key', 'dispatch_response_seconds')
    .maybeSingle();

  if (settingError) {
    console.error('[technician-dispatch-sweep] settings lookup failed:', settingError);
    return Response.json(
      { ok: false, error: 'Unable to load dispatch settings' },
      { status: 502 },
    );
  }

  const responseSeconds = Math.max(
    60,
    Number(setting?.value ?? 300) || 300,
  );

  const staleBefore = new Date(
    Date.now() - responseSeconds * 1000,
  ).toISOString();

  const { data: stale, error: staleError } = await db
    .from('technician_job_dispatch')
    .select('order_id, technician_id')
    .eq('status', 'OFFERED')
    .lt('created_at', staleBefore)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (staleError) {
    console.error('[technician-dispatch-sweep] stale-offer query failed:', staleError);
    return Response.json(
      { ok: false, error: 'Unable to load expired technician offers' },
      { status: 502 },
    );
  }

  let expired = 0;
  let reassigned = 0;
  let releaseErrors = 0;

  for (const offer of stale ?? []) {
    if (Date.now() - startedAt >= MAX_RUNTIME_MS) break;

    try {
      const result = await releaseTechnicianAssignment(
        String(offer.order_id),
        String(offer.technician_id),
        'EXPIRED',
      );

      if (result.released) {
        expired += 1;
        if (result.reassigned) reassigned += 1;
      }
    } catch (error) {
      releaseErrors += 1;
      console.error(
        '[technician-dispatch-sweep] release failed:',
        offer.order_id,
        error,
      );
    }
  }

  const retryBefore = new Date(
    Date.now() - RECENT_ORDER_GRACE_MS,
  ).toISOString();

  const { data: pending, error: pendingError } = await db
    .from('orders')
    .select('id')
    .eq('status', 'PENDING')
    .is('technician_id', null)
    .neq('service_type', 'water_can')
    .lt('created_at', retryBefore)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (pendingError) {
    console.error('[technician-dispatch-sweep] pending-order query failed:', pendingError);
    return Response.json(
      {
        ok: false,
        error: 'Unable to load pending technician jobs',
        expired,
        reassigned,
        release_errors: releaseErrors,
      },
      { status: 502 },
    );
  }

  let retried = 0;
  let dispatchErrors = 0;

  for (const order of pending ?? []) {
    if (Date.now() - startedAt >= MAX_RUNTIME_MS) break;

    try {
      const result = await dispatchTechnicianJob(String(order.id));
      if (result.technicianId) retried += 1;
    } catch (error) {
      dispatchErrors += 1;
      console.error(
        '[technician-dispatch-sweep] dispatch failed:',
        order.id,
        error,
      );
    }
  }

  const durationMs = Date.now() - startedAt;

  return Response.json({
    ok: true,
    expired,
    reassigned,
    retried,
    release_errors: releaseErrors,
    dispatch_errors: dispatchErrors,
    stale_checked: stale?.length ?? 0,
    pending_checked: pending?.length ?? 0,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
  });
}
