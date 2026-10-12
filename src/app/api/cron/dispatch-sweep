import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { sweepStaleOrders } from '@/lib/dispatch';

/**
 * GET /api/cron/dispatch-sweep
 *
 * Scheduled maintenance: hands back orders a supplier never answered and re-offers
 * unassigned orders, for ALL customers (not only those who open the app).
 *
 * Protected by the CRON_SECRET environment variable. Callers send:
 *   Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron adds this header automatically when CRON_SECRET is set.)
 *
 * Responses: 200 { ok, expired, retried } · 401 missing/wrong secret
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run open if the secret is not configured
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await sweepStaleOrders(25);
  return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
