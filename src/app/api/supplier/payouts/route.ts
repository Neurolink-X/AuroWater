import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/**
 * /api/supplier/payouts
 *
 * POST  Create a payout request (money is NOT moved; the finance team settles it).
 *         UPI:  { amount, method: 'upi',  upi_id }
 *         Bank: { amount, method: 'bank', bank_account, ifsc }
 *         201 created · 400 bad JSON · 403 not a supplier · 409 a request is already open
 *         422 validation · 502 database failure (logged, never leaked)
 *
 * GET   The supplier's own payout history, newest first, with payment details masked.
 *
 * Validation rules match the form in supplier/[section]/page.tsx, so users never see
 * a rule on the server that the form accepted.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const amountSchema = z.number().finite().positive().max(1_000_000).multipleOf(0.01);
const upiSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i, 'Enter a valid UPI ID, for example name@bank');
const accountSchema = z.string().trim().regex(/^\d{9,18}$/, 'Bank account number must contain 9–18 digits');
const ifscSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code, for example HDFC0001234');

const schema = z.discriminatedUnion('method', [
  z.object({ amount: amountSchema, method: z.literal('upi'), upi_id: upiSchema }).strict(),
  z.object({ amount: amountSchema, method: z.literal('bank'), bank_account: accountSchema, ifsc: ifscSchema }).strict(),
]);

/** `notes` holds a JSON string like {"status":"pending", ...details}. Never throws. */
function parseNotes(notes: unknown): Record<string, unknown> {
  if (notes && typeof notes === 'object') return notes as Record<string, unknown>;
  if (typeof notes !== 'string') return {};
  try {
    const v = JSON.parse(notes) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const maskUpi = (v: unknown) => {
  const s = typeof v === 'string' ? v : '';
  const [name = '', bank = ''] = s.split('@');
  return name ? `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 2))}@${bank}` : null;
};
const maskAccount = (v: unknown) => (typeof v === 'string' && v.length >= 4 ? `••••${v.slice(-4)}` : null);

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payout request', 422);
  }

  const payout = parsed.data;
  const sb = auth.ctx.supabase;
  const supplierId = auth.ctx.profile.id;

  // One open request at a time: stops double-clicks and repeat submissions creating duplicate payouts.
  const { data: open, error: openErr } = await sb
    .from('payouts')
    .select('id, notes')
    .eq('supplier_id', supplierId)
    .is('paid_at', null);
  if (openErr) {
    console.error('[supplier/payouts] open-request check failed', openErr.message);
    return jsonErr('Unable to create payout request right now. Please try again.', 502);
  }
  if ((open ?? []).some((r) => String(parseNotes(r.notes).status ?? 'pending') === 'pending')) {
    return jsonErr('You already have a payout request awaiting processing. Wait for it to be settled before requesting another.', 409);
  }

  const details =
    payout.method === 'upi'
      ? { upi_id: payout.upi_id }
      : { bank_account: payout.bank_account, ifsc: payout.ifsc };

  const { data, error } = await sb
    .from('payouts')
    .insert({
      supplier_id: supplierId,
      amount: payout.amount,
      method: payout.method,
      reference: payout.method === 'upi' ? payout.upi_id : null,
      notes: JSON.stringify({ status: 'pending', ...details }),
      paid_at: null,
    })
    .select('id, amount, method, paid_at')
    .single();

  if (error || !data) {
    console.error('[supplier/payouts] insert failed', error?.message ?? 'no row returned');
    return jsonErr('Unable to create payout request right now. Please try again.', 502);
  }

  // Audit trail (best-effort). Payment details are deliberately NOT copied here.
  try {
    const { error: auditErr } = await sb.from('audit_logs').insert({
      actor_id: supplierId,
      action: 'payout.requested',
      entity: 'payouts',
      entity_id: data.id,
      meta: { amount: payout.amount, method: payout.method },
    });
    if (auditErr) console.error('[supplier/payouts] audit failed', auditErr.message);
  } catch (e) {
    console.error('[supplier/payouts] audit threw', e instanceof Error ? e.message : e);
  }

  return jsonOk(
    { ...data, status: 'pending', message: 'Payout request submitted. Payment is not completed until our team settles it.' },
    201,
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('payouts')
    .select('*')
    .eq('supplier_id', auth.ctx.profile.id)
    .limit(200);
  if (error) {
    console.error('[supplier/payouts] list failed', error.message);
    return jsonErr('Could not load your payout history. Please try again.', 500);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const stamp = (r: Record<string, unknown>) => Date.parse(String(r.created_at ?? r.paid_at ?? '')) || 0;

  return jsonOk(
    rows
      .sort((a, b) => stamp(b) - stamp(a))
      .map((r) => {
        const notes = parseNotes(r.notes);
        return {
          id: r.id,
          amount: r.amount,
          method: r.method,
          status: r.paid_at ? 'paid' : String(notes.status ?? 'pending'),
          requested_at: r.created_at ?? null,
          paid_at: r.paid_at ?? null,
          // Masked: the full number never goes back to the browser.
          destination: r.method === 'upi' ? maskUpi(notes.upi_id ?? r.reference) : maskAccount(notes.bank_account),
        };
      }),
  );
}
