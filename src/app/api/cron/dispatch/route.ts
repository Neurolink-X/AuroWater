import { NextRequest } from 'next/server';

import { sweepDispatchQueue } from '@/lib/dispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = String(process.env.CRON_SECRET ?? '').trim();
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

/**
 * Global supplier dispatch recovery worker.
 *
 * Responsibilities:
 * - expire unaccepted supplier offers;
 * - re-route them to the next eligible supplier;
 * - retry PENDING water orders that have not been dispatched recently;
 * - surface exhausted orders through dispatch's admin alert path.
 *
 * Operational recovery must not depend on a customer opening an order page.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await sweepDispatchQueue(100);

  return Response.json({
    ok: true,
    ...summary,
    executed_at: new Date().toISOString(),
  });
}
