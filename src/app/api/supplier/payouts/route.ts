import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const schema = z.object({
  amount: z.number().positive().max(1_000_000),
  upi_id: z.string().min(3).optional(),
  bank_account: z.string().min(6).optional(),
  ifsc: z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/).optional(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payout request', 422);
  }

  const supplierId = auth.ctx.profile.id;
  const db = createServiceClient();

  const { data: supplierSettings } = await db
    .from('supplier_settings')
    .select('upi_id, bank_account, ifsc')
    .eq('user_id', supplierId)
    .maybeSingle();

  const upi = parsed.data.upi_id ?? supplierSettings?.upi_id ?? null;
  const bank = parsed.data.bank_account ?? supplierSettings?.bank_account ?? null;
  const ifsc = parsed.data.ifsc ?? supplierSettings?.ifsc ?? null;

  const method = upi ? 'upi' : bank && ifsc ? 'bank' : null;
  if (!method) {
    return jsonErr('Add a valid UPI ID or bank account before requesting a payout.', 400, 'PAYOUT_DESTINATION_MISSING');
  }

  const destinationReference = method === 'upi'
    ? String(upi)
    : `${String(bank).slice(-4)} / ${String(ifsc).toUpperCase()}`;

  const { data, error } = await db.rpc('create_supplier_payout_request', {
    p_supplier_id: supplierId,
    p_amount: parsed.data.amount,
    p_method: method,
    p_destination_reference: destinationReference,
    p_notes: parsed.data.notes ?? null,
  });

  if (error || !data) {
    const message = error?.message ?? '';
    const balanceMatch = message.match(/PAYOUT_BALANCE_EXCEEDED:([0-9.]+)/);
    if (balanceMatch) {
      const available = Number(balanceMatch[1]);
      return jsonErr(
        `Requested amount exceeds your available payout balance (₹${available.toLocaleString('en-IN')}).`,
        409,
        'PAYOUT_BALANCE_EXCEEDED',
      );
    }

    if (error) {
      console.error('[supplier/payouts] request creation failed', error);
    }
    return jsonErr('Could not create payout request', 502);
  }

  return jsonOk(data, 201);
}
