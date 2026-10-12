import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { releaseAssignment } from '@/lib/dispatch';

/**
 * PUT /api/supplier/orders/[id]/reject
 *
 * The supplier declines an order that was assigned to them.
 * The order goes straight to the next best supplier. It is NOT cancelled for the customer.
 *
 * Body (optional): { "reason": string }  — trimmed, control characters removed, max 200 chars.
 *
 * Responses
 *   200  { released: true, reassigned: boolean }
 *   400  malformed order id
 *   401  not signed in (from requireSupabaseAuth)
 *   403  signed in, but not a supplier
 *   409  not assigned to this supplier, or already accepted
 *   500  unexpected failure (details are logged, never returned)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON = 200;

/** Reads the optional JSON body without ever throwing. */
async function readReason(req: NextRequest): Promise<string | undefined> {
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body?.reason !== 'string') return undefined;
    const cleaned = body.reason
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_REASON);
    return cleaned || undefined;
  } catch {
    return undefined; // body is optional
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return jsonErr('Invalid order id.', 400);

  const supplierId = auth.ctx.profile.id;
  const reason = await readReason(req);

  try {
    const result = await releaseAssignment(id, supplierId, 'REJECTED', reason);
    if (!result.released) {
      return jsonErr('This order is not assigned to you, or you have already accepted it.', 409);
    }
    // Deliberately does not reveal which supplier receives it next.
    return jsonOk({ released: true, reassigned: result.reassigned });
  } catch (err) {
    console.error('[supplier/reject] failed', {
      orderId: id,
      supplierId,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonErr('Could not decline this order right now. Please try again.', 500);
  }
}
