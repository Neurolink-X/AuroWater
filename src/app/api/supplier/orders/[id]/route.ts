import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { startSupplierOrder, completeSupplierOrder } from '@/lib/dispatch';
import { checkAndUpgradeMilestone } from '@/lib/milestone';

const bodySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const sb = auth.ctx.supabase;

  const { data: before, error: bErr } = await sb
    .from('orders')
    .select('id, supplier_id, status, customer_id, can_quantity')
    .eq('id', id)
    .maybeSingle();
  if (bErr) return jsonErr(bErr.message, 502);
  if (!before) return jsonErr('Order not found', 404);
  if (String((before as { supplier_id?: string | null }).supplier_id ?? '') !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }

  const prev = String((before as { status?: string }).status ?? '');
  const acceptedAt = (before as { accepted_at?: string | null }).accepted_at ?? null;
  const next = parsed.data.status;

  if (next === 'IN_PROGRESS') {
    if (prev !== 'ASSIGNED' || !acceptedAt) {
      return jsonErr('Order must be accepted before delivery can start', 409, 'INVALID_TRANSITION');
    }
    const result = await startSupplierOrder(id, auth.ctx.profile.id);
    if (!result.ok) {
      return jsonErr('Could not start this delivery', 409, 'INVALID_TRANSITION');
    }
    const { data } = await sb.from('orders').select('*').eq('id', id).single();
    return jsonOk(data);
  }

  if (next === 'COMPLETED') {
    if (prev !== 'IN_PROGRESS') {
      return jsonErr('Order must be in progress before completion', 409, 'INVALID_TRANSITION');
    }
    const result = await completeSupplierOrder(id, auth.ctx.profile.id);
    if (!result.ok) {
      return jsonErr(
        result.reason === 'reserved_stock_missing'
          ? 'Reserved stock is missing; completion was not recorded'
          : 'Could not complete this delivery',
        409,
        'COMPLETION_FAILED'
      );
    }
    const { data } = await sb.from('orders').select('*').eq('id', id).single();
    return jsonOk(data);
  }

  return jsonErr('Invalid status transition', 400, 'INVALID_TRANSITION');
}

