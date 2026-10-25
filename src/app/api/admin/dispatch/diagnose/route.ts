import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { diagnoseOrderDispatch, dispatchOrder } from '@/lib/dispatch';

/**
 * /api/admin/dispatch/diagnose        (ADMIN ONLY)
 *
 * GET  ?orderId=<uuid>   Explains why an order is not being assigned: which suppliers are online,
 *                        which pass eligibility, and the exact reason each other one was rejected.
 *                        Changes nothing and bypasses no safeguard.
 * POST { orderId }       Runs the normal dispatch once right now (same eligibility, same stock
 *                        reservation), then returns the result and a fresh diagnosis.
 *
 * Responses: 200 · 400 bad input · 403 not an admin · 404 order not found
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const orderId = new URL(req.url).searchParams.get('orderId')?.trim() ?? '';
  if (!UUID_RE.test(orderId)) return jsonErr('Send a valid orderId.', 400);

  const report = await diagnoseOrderDispatch(orderId);
  if (!report.ok) return jsonErr(report.error, report.error === 'Order not found' ? 404 : 500);
  return jsonOk(report);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  let body: { orderId?: unknown };
  try {
    body = (await req.json()) as { orderId?: unknown };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  if (!UUID_RE.test(orderId)) return jsonErr('Send a valid orderId.', 400);

  const result = await dispatchOrder(orderId);
  const report = await diagnoseOrderDispatch(orderId);
  return jsonOk({ result, report: report.ok ? report : null });
}
