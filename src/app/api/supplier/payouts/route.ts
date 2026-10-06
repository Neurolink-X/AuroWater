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

  const [{ data: earnings, error: earningsError }, { data: pendingRequests, error: requestError }] =
    await Promise.all([
      db
        .from('orders')
        .select('supplier_payout')
        .eq('supplier_id', supplierId)
        .eq('status', 'COMPLETED')
        .eq('payout_status', 'pending'),
      db
        .from('payout_requests')
        .select('amount')
        .eq('supplier_id', supplierId)
        .in('status', ['pending', 'processing']),
    ]);

  if (earningsError || requestError) {
    return jsonErr('Could not verify payout balance', 502);
  }

  const eligible = (earnings ?? []).reduce(
    (sum, row) => sum + Number(row.supplier_payout ?? 0),
    0
  );
  const alreadyRequested = (pendingRequests ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  const available = Math.max(0, Math.round((eligible - alreadyRequested) * 100) / 100);

  if (parsed.data.amount > available) {
    return jsonErr(
      `Requested amount exceeds your available payout balance (₹${available.toLocaleString('en-IN')}).`,
      409,
      'PAYOUT_BALANCE_EXCEEDED'
    );
  }

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

  const { data, error } = await db
    .from('payout_requests')
    .insert({
      supplier_id: supplierId,
      amount: parsed.data.amount,
      method,
      destination_reference: destinationReference,
      status: 'pending',
      notes: parsed.data.notes ?? null,
    })
    .select('id, supplier_id, amount, method, status, destination_reference, notes, created_at')
    .single();

  if (error || !data) {
    console.error('[supplier/payouts] insert failed', error);
    return jsonErr('Could not create payout request', 502);
  }

  return jsonOk(data, 201);
}
