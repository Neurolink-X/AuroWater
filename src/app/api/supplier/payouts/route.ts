import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const amountSchema = z.number().finite().positive().max(1_000_000).multipleOf(0.01);
const upiSchema = z.string().trim().max(100).regex(/^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i, 'Enter a valid UPI ID.');
const accountSchema = z.string().trim().regex(/^\d{9,18}$/, 'Bank account number must contain 9–18 digits');
const ifscSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code.');

const schema = z.discriminatedUnion('method', [
  z.object({ amount: amountSchema, method: z.literal('upi'), upi_id: upiSchema }).strict(),
  z.object({ amount: amountSchema, method: z.literal('bank'), bank_account: accountSchema, ifsc: ifscSchema }).strict(),
]);

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

const maskUpi = (value: unknown) => {
  const s = typeof value === 'string' ? value : '';
  const [name = '', bank = ''] = s.split('@');
  return name && bank ? `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 2))}@${bank}` : null;
};
const maskAccount = (value: unknown) => typeof value === 'string' && value.length >= 4 ? `••••${value.slice(-4)}` : null;

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
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payout request', 422);

  const payout = parsed.data;
  const details = payout.method === 'upi'
    ? { upi_id: payout.upi_id }
    : { bank_account: payout.bank_account, ifsc: payout.ifsc };

  const { data, error } = await auth.ctx.supabase.rpc('request_supplier_payout', {
    p_amount: payout.amount,
    p_method: payout.method,
    p_details: details,
  });

  if (error) {
    if (error.code === '23505' || /payout_request_pending/i.test(error.message ?? '')) {
      return jsonErr('You already have a payout request awaiting processing.', 409);
    }
    if (/insufficient_verified_supplier_balance/i.test(error.message ?? '')) {
      return jsonErr('The requested amount exceeds your verified available balance.', 422);
    }
    if (/payout_settlement_requires_reconciliation/i.test(error.message ?? '')) {
      return jsonErr('A previous payout needs settlement verification before another request can be made.', 409);
    }
    console.error('[supplier/payouts] request RPC failed', { code: error.code, message: error.message });
    return jsonErr('Unable to create payout request right now. Please try again.', 502);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row?.id) return jsonErr('Unable to create payout request right now. Please try again.', 502);

  return jsonOk({
    id: row.id,
    amount: row.amount,
    method: row.method,
    status: row.status ?? 'pending',
    paid_at: row.paid_at ?? null,
    requested_at: row.created_at ?? null,
    message: 'Payout request submitted. Payment is not completed until the finance team settles it.',
  }, 201);
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('payouts')
    .select('id, amount, status, method, paid_at, created_at, payout_details')
    .eq('user_id', auth.ctx.profile.id)
    .eq('role', 'supplier')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[supplier/payouts] list failed', error.message);
    return jsonErr('Could not load your payout history. Please try again.', 500);
  }

  return jsonOk((data ?? []).map((row) => {
    const details = asObject(row.payout_details);
    const status = String(row.status ?? 'pending').toLowerCase();
    const paidAt = row.paid_at ?? null;
    const safeStatus = status === 'paid' && !paidAt ? 'needs_review' : status;
    return {
      id: row.id,
      amount: row.amount,
      method: row.method,
      status: safeStatus,
      requested_at: row.created_at ?? null,
      paid_at: safeStatus === 'paid' ? paidAt : null,
      destination: row.method === 'upi' ? maskUpi(details.upi_id) : maskAccount(details.bank_account),
    };
  }));
}
