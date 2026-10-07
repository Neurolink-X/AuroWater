import { NextRequest } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { releaseTechnicianAssignment, dispatchTechnicianJob } from '@/lib/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createServiceClient();

  const { data: setting } = await db
    .from('settings')
    .select('value')
    .eq('key', 'dispatch_response_seconds')
    .maybeSingle();

  const responseSeconds = Math.max(
    60,
    Number(setting?.value ?? 300) || 300,
  );
  const staleBefore = new Date(Date.now() - responseSeconds * 1000).toISOString();

  const { data: stale } = await db
    .from('technician_job_dispatch')
    .select('order_id, technician_id')
    .eq('status', 'OFFERED')
    .lt('created_at', staleBefore)
    .limit(100);

  let expired = 0;
  let reassigned = 0;

  for (const offer of stale ?? []) {
    const result = await releaseTechnicianAssignment(
      String(offer.order_id),
      String(offer.technician_id),
      'EXPIRED',
    );
    if (result.released) {
      expired += 1;
      if (result.reassigned) reassigned += 1;
    }
  }

  const { data: pending } = await db
    .from('orders')
    .select('id')
    .eq('status', 'PENDING')
    .is('technician_id', null)
    .neq('service_type', 'water_can')
    .limit(100);

  let retried = 0;
  for (const order of pending ?? []) {
    const result = await dispatchTechnicianJob(String(order.id));
    if (result.technicianId) retried += 1;
  }

  return Response.json({
    ok: true,
    expired,
    reassigned,
    retried,
    checked_at: new Date().toISOString(),
  });
}
