import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { acceptAssignment } from '@/lib/dispatch';

/**
 * Supplier confirms an assigned order. Once accepted it is never reassigned automatically.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  const result = await acceptAssignment(id, auth.ctx.profile.id);
  if (!result.accepted) {
    if (result.reason === 'insufficient_stock') {
      return jsonErr('You do not have enough available stock to accept this order.', 409, 'INSUFFICIENT_STOCK');
    }
    return jsonErr('This order is no longer assigned to you (it may have been reassigned or already accepted).', 409);
  }
  return jsonOk({
    accepted: true,
    reserved_qty: result.reservedQty ?? 0,
  });
}
