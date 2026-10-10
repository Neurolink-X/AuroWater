import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const payoutRequestSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  method: z.enum(['upi', 'bank']),
  notes: z.string().trim().max(500).optional(),
});

/** Creates a durable payout request. Settlement remains a finance-team action. */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403, 'FORBIDDEN');
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400, 'INVALID_JSON');
  }

  const parsed = payoutRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payout request', 422, 'INVALID_PAYOUT_REQUEST');
  }

  // This records a request only. It does not initiate a bank transfer or mark
  // funds paid. Finance must verify eligible earnings and payout details.
  const { data, error } = await auth.ctx.supabase
    .from('supplier_payout_requests')
    .insert({
      supplier_id: auth.ctx.profile.id,
      amount: parsed.data.amount,
      method: parsed.data.method,
      notes: parsed.data.notes ?? null,
      status: 'requested',
    })
    .select('id, amount, method, status, created_at')
    .single();

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return jsonErr(
        'Payout requests are temporarily unavailable until the supplier payout migration is applied.',
        503,
        'PAYOUT_MIGRATION_REQUIRED',
      );
    }
    console.error('[supplier/payout-request] insert failed:', {
      code: error.code,
      message: error.message,
    });
    return jsonErr('Unable to submit payout request right now.', 502, 'PAYOUT_REQUEST_FAILED');
  }

  return jsonOk({
    request: data,
    message: 'Payout request submitted for finance review. No transfer has been initiated yet.',
  }, 201);
}
