import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const amountSchema = z.number().finite().positive().max(1_000_000).multipleOf(0.01);
const upiSchema = z.string().trim().min(3).max(100).regex(/^[\w.-]{2,256}@[\w.-]{2,64}$/, 'Enter a valid UPI ID');
const accountSchema = z.string().trim().regex(/^\d{9,18}$/, 'Bank account number must contain 9–18 digits');
const ifscSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code');

const schema = z.discriminatedUnion('method', [
  z.object({
    amount: amountSchema,
    method: z.literal('upi'),
    upi_id: upiSchema,
  }).strict(),
  z.object({
    amount: amountSchema,
    method: z.literal('bank'),
    bank_account: accountSchema,
    ifsc: ifscSchema,
  }).strict(),
]);

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
  const payoutDetails = payout.method === 'upi'
    ? { upi_id: payout.upi_id }
    : { bank_account: payout.bank_account, ifsc: payout.ifsc };

  const { data, error } = await auth.ctx.supabase
    .from('payouts')
    .insert({
      supplier_id: auth.ctx.profile.id,
      amount: payout.amount,
      method: payout.method,
      reference: payout.method === 'upi' ? payout.upi_id : null,
      notes: JSON.stringify({ status: 'pending', ...payoutDetails }),
      paid_at: null,
    })
    .select('id, amount, method, paid_at')
    .single();

  if (error || !data) {
    return jsonErr('Unable to create payout request. Confirm the latest payout migration is applied.', 502);
  }

  return jsonOk({ ...data, status: 'pending', message: 'Payout request submitted; payment is not yet completed.' }, 201);
}
