import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { releaseAssignment } from '@/lib/dispatch';

/**
 * Supplier declines an order that was assigned to them.
 * The order goes straight to the next best supplier. It is NOT cancelled for the customer.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;

  let reason = '';
  try {
    const body = (await req.json()) as { reason?: string };
    reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';
  } catch {
    /* optional body */
  }

  const result = await releaseAssignment(id, auth.ctx.profile.id, 'REJECTED', reason || undefined);
  if (!result.released) {
    return jsonErr('This order is not assigned to you, or you have already accepted it.', 409);
  }
  // Deliberately does not reveal which supplier receives it next
  return jsonOk({ released: true, reassigned: result.reassigned });
}
