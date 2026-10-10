import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const stockSchema = z
  .object({
    cans_available: z.number().int().min(0).max(100000).optional(),
    stock_delta: z.number().int().min(-100000).max(100000).optional(),
    low_stock_alert: z.number().int().min(0).max(10000).optional(),
    reservation_buffer_cans: z.number().int().min(0).max(10000).optional(),
  })
  .refine(
    (value) =>
      value.cans_available !== undefined || value.stock_delta !== undefined,
    { message: 'cans_available or stock_delta is required' },
  )
  .refine(
    (value) =>
      !(value.cans_available !== undefined && value.stock_delta !== undefined),
    { message: 'Use either cans_available or stock_delta, not both' },
  );

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const sb = auth.ctx.supabase;
  const supplier_id = auth.ctx.profile.id;

  const { data, error } = await sb
    .from('supplier_stock')
    .select('*')
    .eq('supplier_id', supplier_id)
    .maybeSingle();
  if (error) return jsonErr(error.message, 502);

  if (data) return jsonOk(data);

  const { data: created, error: cErr } = await sb
    .from('supplier_stock')
    .upsert({ supplier_id, cans_available: 0, low_stock_alert: 10 }, { onConflict: 'supplier_id' })
    .select('*')
    .single();
  if (cErr) return jsonErr(cErr.message, 502);
  return jsonOk(created);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = stockSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const supplier_id = auth.ctx.profile.id;

  let data: unknown = null;
  let error: { message?: string } | null = null;

  if (parsed.data.stock_delta !== undefined) {
    const result = await auth.ctx.supabase.rpc('adjust_supplier_stock', {
      p_supplier_id: supplier_id,
      p_delta: parsed.data.stock_delta,
      p_low_stock_alert: parsed.data.low_stock_alert ?? null,
      p_reservation_buffer_cans:
        parsed.data.reservation_buffer_cans ?? null,
    });
    data = result.data;
    error = result.error;
  } else {
    const result = await auth.ctx.supabase.rpc('set_supplier_stock', {
      p_supplier_id: supplier_id,
      p_cans_available: parsed.data.cans_available,
      p_low_stock_alert: parsed.data.low_stock_alert ?? null,
      p_reservation_buffer_cans:
        parsed.data.reservation_buffer_cans ?? null,
    });
    data = result.data;
    error = result.error;
  }

  if (error) {
    const message = error.message ?? 'Stock update failed';
    const normalized = message.toUpperCase();

    // RPC validation conflicts are actionable client errors; unexpected
    // database failures must not be misreported as stock conflicts.
    if (normalized.includes('STOCK_BELOW_RESERVED')) {
      return jsonErr(
        'Stock cannot be reduced below the quantity already reserved for customer orders. Refresh inventory and try a smaller adjustment.',
        409,
        'STOCK_BELOW_RESERVED',
      );
    }
    if (normalized.includes('INVALID_STOCK') || normalized.includes('INVALID_STOCK_ADJUSTMENT')) {
      return jsonErr('Enter a valid non-negative stock quantity or adjustment.', 422, 'INVALID_STOCK');
    }
    if (normalized.includes('FORBIDDEN')) {
      return jsonErr('You are not allowed to update this supplier inventory.', 403, 'FORBIDDEN');
    }

    console.error('[supplier/stock] update failed:', {
      code: (error as { code?: string }).code,
      message,
    });
    return jsonErr('Inventory could not be updated right now. Please retry.', 502, 'STOCK_UPDATE_FAILED');
  }

  // Low stock alert notification (best-effort, never blocks response).
  try {
    const cans = Number((data as { cans_available?: unknown }).cans_available);
    const low = Number((data as { low_stock_alert?: unknown }).low_stock_alert);
    if (Number.isFinite(cans) && Number.isFinite(low) && cans <= low) {
      const sb = createServiceClient();
      await sb.from('notifications').insert({
        user_id: supplier_id,
        title: 'Low stock alert',
        body: `Your available cans are low (${cans}). Please restock soon.`,
        type: 'system',
        order_id: null,
        is_read: false,
        dedup_key: `stock_low_${supplier_id}`,
      });
    }
  } catch (e) {
    console.error('[supplier/stock] low stock notification failed', e);
  }

  return jsonOk(data);
}

