import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const stockSchema = z.object({
  cans_available: z.number().int().min(0).max(100000).optional(),
  low_stock_alert: z.number().int().min(0).max(10000).optional(),
});

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
  const { data, error } = await auth.ctx.supabase
    .from('supplier_stock')
    .upsert(
      { supplier_id, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'supplier_id' }
    )
    .select('*')
    .single();
  if (error) return jsonErr(error.message, 502);

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

