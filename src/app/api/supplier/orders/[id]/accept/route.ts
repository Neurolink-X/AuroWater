import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { acceptAssignment } from '@/lib/dispatch';

/**
 * PUT /api/supplier/orders/[id]/accept
 *
 * The supplier confirms an order that dispatch assigned to them.
 * Once accepted, an order is never reassigned automatically.
 *
 * Responses
 *   200  { accepted: true }
 *   400  malformed order id
 *   401  not signed in (from requireSupabaseAuth)
 *   403  signed in, but not a supplier
 *   409  not assigned to this supplier, reassigned, or already accepted
 *   500  unexpected failure (details are logged, never returned)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // per-user, never cached

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  // Reject bad ids up front so they never reach the database as a 500.
  if (!UUID_RE.test(id)) return jsonErr('Invalid order id.', 400);

  const supplierId = auth.ctx.profile.id;

  try {
    const accepted = await acceptAssignment(id, supplierId);
    if (!accepted) {
      return jsonErr(
        'This order is no longer assigned to you (it may have been reassigned or already accepted).',
        409,
      );
    }
    return jsonOk({ accepted: true });
  } catch (err) {
    console.error('[supplier/accept] failed', {
      orderId: id,
      supplierId,
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonErr('Could not accept this order right now. Please try again.', 500);
  }
}
