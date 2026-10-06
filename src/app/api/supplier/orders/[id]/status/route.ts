import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  completeSupplierOrder,
  startSupplierOrder,
} from '@/lib/dispatch';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/**
 * Compatibility endpoint.
 *
 * New supplier clients should use /api/supplier/orders/[id].
 * We keep this route temporarily so older clients cannot bypass
 * the canonical state machine.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';

  if (status === 'IN_PROGRESS') {
    const result = await startSupplierOrder(id, auth.ctx.profile.id);
    if (!result.ok) {
      return jsonErr('Order must be accepted before delivery can start', 409, 'INVALID_TRANSITION');
    }

    const { data, error } = await auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return jsonErr('Order updated but could not be reloaded', 502);
    }

    return jsonOk(data);
  }

  if (status === 'COMPLETED') {
    const result = await completeSupplierOrder(id, auth.ctx.profile.id);
    if (!result.ok) {
      return jsonErr('Could not complete this delivery', 409, 'COMPLETION_FAILED');
    }

    const { data, error } = await auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return jsonErr('Order updated but could not be reloaded', 502);
    }

    return jsonOk(data);
  }

  return jsonErr('Invalid status transition', 400, 'INVALID_TRANSITION');
}
