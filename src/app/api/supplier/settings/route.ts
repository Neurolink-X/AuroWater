import { NextRequest, after } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { dispatchOrder } from '@/lib/dispatch';

/**
 * /api/supplier/settings
 *
 * GET  the supplier's dispatch settings (payment details are MASKED, never returned in full)
 * PUT  update any subset of the settings
 *
 * Going online (offline → online) retries recent unassigned water orders in the
 * BACKGROUND, so the toggle responds instantly instead of waiting for up to 25 dispatches.
 *
 * Responses: 200 · 400 bad JSON · 403 not a supplier · 422 validation · 502 database failure
 * (database messages are logged, never returned to the browser)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i;

const settingsSchema = z
  .object({
    is_online: z.boolean().optional(),
    price_per_can: z.number().min(1).max(1000).optional(),
    upi_id: z.string().trim().max(100).regex(UPI_RE, 'Enter a valid UPI ID, for example name@bank').optional(),
    bank_account: z.string().trim().regex(/^\d{9,18}$/, 'Bank account number must contain 9–18 digits').optional(),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code, for example HDFC0001234')
      .optional(),
    auto_accept: z.boolean().optional(),
    // https only: a "javascript:" or "data:" link must never be stored and later rendered.
    qr_code_url: z
      .string()
      .trim()
      .max(2048)
      .url()
      .refine((u) => u.startsWith('https://'), 'QR code link must start with https://')
      .optional(),
    base_lat: z.number().min(-90).max(90).nullable().optional(),
    base_lng: z.number().min(-180).max(180).nullable().optional(),
    zone_radius_km: z.number().int().min(1).max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update.' })
  .refine((d) => (d.base_lat === undefined) === (d.base_lng === undefined), {
    message: 'Send base_lat and base_lng together.',
  })
  .refine((d) => (d.bank_account === undefined) === (d.ifsc === undefined), {
    message: 'Send bank_account and ifsc together.',
  });

type Row = Record<string, unknown>;

/** Shown when the supplier has not saved settings yet. Mirrors the defaults used by the settings page. */
const DEFAULTS = { is_online: false, zone_radius_km: 5, auto_accept: false };

const maskUpi = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v : '';
  const [name = '', bank = ''] = s.split('@');
  return name ? `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 2))}@${bank}` : null;
};
const maskAccount = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 4 ? `••••${v.slice(-4)}` : null;

/** Never send full payment details to the browser. */
function sanitize(row: Row): Row {
  return {
    ...row,
    upi_id: maskUpi(row.upi_id),
    bank_account: maskAccount(row.bank_account),
    has_payout_details: Boolean(row.upi_id || row.bank_account),
  };
}

/** Retries recent unassigned water orders. Best-effort: failures are logged, never thrown. */
async function recoverWaitingOrders() {
  try {
    const service = createServiceClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: waiting, error } = await service
      .from('orders')
      .select('id')
      .eq('status', 'PENDING')
      .is('supplier_id', null)
      .eq('service_type', 'water_can')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(25);

    if (error) {
      console.error('[supplier/settings] pending-order recovery query failed', error.message);
      return;
    }
    // Sequential on purpose: dispatch checks active load and stock, which concurrent runs could over-assign.
    for (const order of waiting ?? []) {
      try {
        await dispatchOrder(String(order.id));
      } catch (e) {
        console.error('[supplier/settings] dispatch failed for order', order.id, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error('[supplier/settings] pending-order recovery failed', e instanceof Error ? e.message : e);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('supplier_settings')
    .select('*')
    .eq('user_id', auth.ctx.profile.id)
    .maybeSingle();
  if (error) {
    console.error('[supplier/settings] load failed', error.message);
    return jsonErr('Could not load your settings. Please try again.', 502);
  }

  return jsonOk(data ? sanitize(data as Row) : DEFAULTS);
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

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const sb = auth.ctx.supabase;
  const userId = auth.ctx.profile.id;

  // Only recover orders on a real offline → online change, not every save that happens to include is_online: true.
  let becameOnline = false;
  if (parsed.data.is_online === true) {
    const { data: prev } = await sb.from('supplier_settings').select('is_online').eq('user_id', userId).maybeSingle();
    becameOnline = (prev as { is_online?: boolean } | null)?.is_online !== true;
  }

  const { data, error } = await sb
    .from('supplier_settings')
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) {
    console.error('[supplier/settings] save failed', error.message);
    return jsonErr('Could not save your settings. Please try again.', 502);
  }

  // Runs after the response is sent, so the toggle never waits on up to 25 dispatches.
  if (becameOnline) after(recoverWaitingOrders);

  return jsonOk(sanitize(data as Row));
}
