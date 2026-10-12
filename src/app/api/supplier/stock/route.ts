import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

/**
 * /api/supplier/stock
 *
 * GET  the supplier's stock (created with safe defaults on first visit)
 * PUT  change stock with ONE of:
 *        { stock_delta }      add (+) or remove (−) cans, e.g. an offline sale
 *        { cans_available }   set an exact count (stock-take)
 *      optionally with low_stock_alert / reservation_buffer_cans.
 *
 * Every response row includes `low_stock: boolean` (cans_available <= low_stock_alert).
 * Reservation rules are enforced by the database functions, not here.
 *
 * Responses: 200 · 400 bad JSON · 403 not a supplier · 409 stock rule refused the change
 *            422 validation · 502 database failure (logged, never leaked)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LOW_STOCK = 10;
/** Postgres code for RAISE EXCEPTION: the database functions use it for user-facing stock rules. */
const BUSINESS_RULE_CODE = 'P0001';

const stockSchema = z
  .object({
    cans_available: z.number().int().min(0).max(100000).optional(),
    stock_delta: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((n) => n !== 0, 'Enter a non-zero number of cans')
      .optional(),
    low_stock_alert: z.number().int().min(0).max(10000).optional(),
    reservation_buffer_cans: z.number().int().min(0).max(10000).optional(),
  })
  .refine((v) => v.cans_available !== undefined || v.stock_delta !== undefined, {
    message: 'cans_available or stock_delta is required',
  })
  .refine((v) => !(v.cans_available !== undefined && v.stock_delta !== undefined), {
    message: 'Use either cans_available or stock_delta, not both',
  });

type Row = Record<string, unknown>;

/** RPCs may return one row or an array of rows. */
const firstRow = (data: unknown): Row | null => {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? (row as Row) : null;
};

const withFlags = (row: Row): Row => {
  const cans = Number(row.cans_available);
  const low = Number(row.low_stock_alert);
  return { ...row, low_stock: Number.isFinite(cans) && Number.isFinite(low) && cans <= low };
};

/** Supabase returns `{ error }` instead of throwing, so check it explicitly. */
async function bestEffort(label: string, task: () => PromiseLike<unknown>) {
  try {
    const res = (await task()) as { error?: { message?: string } | null } | undefined;
    if (res?.error) console.error(`[supplier/stock] ${label} failed`, res.error.message);
  } catch (e) {
    console.error(`[supplier/stock] ${label} threw`, e instanceof Error ? e.message : e);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const sb = auth.ctx.supabase;
  const supplierId = auth.ctx.profile.id;

  const read = () => sb.from('supplier_stock').select('*').eq('supplier_id', supplierId).maybeSingle();

  const first = await read();
  if (first.error) {
    console.error('[supplier/stock] load failed', first.error.message);
    return jsonErr('Could not load your stock. Please try again.', 502);
  }
  if (first.data) return jsonOk(withFlags(first.data as Row));

  // First visit: create the row, but NEVER overwrite one that appeared in the meantime.
  // (A plain upsert here could reset real stock to 0 if another request saved stock first.)
  const created = await sb
    .from('supplier_stock')
    .upsert(
      { supplier_id: supplierId, cans_available: 0, low_stock_alert: DEFAULT_LOW_STOCK },
      { onConflict: 'supplier_id', ignoreDuplicates: true },
    );
  if (created.error) {
    console.error('[supplier/stock] create failed', created.error.message);
    return jsonErr('Could not load your stock. Please try again.', 502);
  }

  const second = await read();
  if (second.error || !second.data) {
    console.error('[supplier/stock] reload failed', second.error?.message ?? 'no row');
    return jsonErr('Could not load your stock. Please try again.', 502);
  }
  return jsonOk(withFlags(second.data as Row));
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

  const input = parsed.data;
  const supplierId = auth.ctx.profile.id;
  const sb = auth.ctx.supabase;

  const result =
    input.stock_delta !== undefined
      ? await sb.rpc('adjust_supplier_stock', {
          p_supplier_id: supplierId,
          p_delta: input.stock_delta,
          p_low_stock_alert: input.low_stock_alert ?? null,
          p_reservation_buffer_cans: input.reservation_buffer_cans ?? null,
        })
      : await sb.rpc('set_supplier_stock', {
          p_supplier_id: supplierId,
          p_cans_available: input.cans_available,
          p_low_stock_alert: input.low_stock_alert ?? null,
          p_reservation_buffer_cans: input.reservation_buffer_cans ?? null,
        });

  if (result.error) {
    // A raised stock rule (e.g. "would go below reserved cans") is meant for the supplier: pass it on as a 409.
    // Anything else is an internal failure: log it, return a generic message.
    if (result.error.code === BUSINESS_RULE_CODE && result.error.message) {
      return jsonErr(result.error.message, 409);
    }
    console.error('[supplier/stock] rpc failed', { code: result.error.code, message: result.error.message });
    return jsonErr('Could not update your stock. Please try again.', 502);
  }

  const row = firstRow(result.data);
  const flagged = row ? withFlags(row) : null;

  // Audit trail for every stock change, including offline sales (best-effort).
  await bestEffort('audit', () =>
    sb.from('audit_logs').insert({
      actor_id: supplierId,
      action: input.stock_delta !== undefined ? 'stock.adjusted' : 'stock.set',
      entity: 'supplier_stock',
      entity_id: supplierId,
      meta: {
        delta: input.stock_delta ?? null,
        set_to: input.cans_available ?? null,
        cans_available: row?.cans_available ?? null,
      },
    }),
  );

  // Low-stock alert, at most one per supplier per day (best-effort, never blocks the response).
  if (flagged?.low_stock === true) {
    const cans = Number(flagged.cans_available);
    const day = new Date().toISOString().slice(0, 10);
    await bestEffort('low stock notification', () =>
      createServiceClient().from('notifications').insert({
        user_id: supplierId,
        title: 'Low stock alert',
        body: `Your available cans are low (${cans}). Please restock soon.`,
        type: 'system',
        order_id: null,
        is_read: false,
        dedup_key: `stock_low_${supplierId}_${day}`,
      }),
    );
  }

  return jsonOk(flagged ?? result.data);
}
