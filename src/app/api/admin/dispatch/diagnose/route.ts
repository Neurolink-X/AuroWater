import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { diagnoseOrderDispatch, dispatchOrder } from '@/lib/dispatch';
import { parseOrderIdentifier } from '@/lib/order-reference';

/**
 * /api/admin/dispatch/diagnose        (ADMIN ONLY)
 *
 * GET  ?orderId=<uuid-or-public-reference>   Explains why an order is not being assigned: which suppliers are online,
 *                        which pass eligibility, and the exact reason each other one was rejected.
 *                        Changes nothing and bypasses no safeguard.
 * POST { orderId: uuid-or-public-reference }       Runs the normal dispatch once right now (same eligibility, same stock
 *                        reservation), then returns the result and a fresh diagnosis.
 *
 * Responses: 200 · 400 bad input · 403 not an admin · 404 order not found
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveOrderId(supabase: SupabaseClient, input: string): Promise<string | null> {
  const identifier = parseOrderIdentifier(input);
  if (!identifier) return null;
  const query = supabase.from('orders').select('id');
  const { data, error } = identifier.kind === 'uuid'
    ? await query.eq('id', identifier.value).maybeSingle()
    : await query.ilike('order_number', identifier.value).maybeSingle();
  return error || !data ? null : String(data.id);
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const orderId = new URL(req.url).searchParams.get('orderId')?.trim() ?? '';
  const resolvedId = await resolveOrderId(auth.ctx.supabase, orderId);
  if (!resolvedId) return jsonErr('Send a valid existing order reference.', 400);

  const report = await diagnoseOrderDispatch(resolvedId);
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
  const resolvedId = await resolveOrderId(auth.ctx.supabase, orderId);
  if (!resolvedId) return jsonErr('Send a valid existing order reference.', 400);

  const result = await dispatchOrder(resolvedId);
  const report = await diagnoseOrderDispatch(resolvedId);
  return jsonOk({ result, report: report.ok ? report : null });
}
