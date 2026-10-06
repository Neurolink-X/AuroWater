import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const schema = z.object({
  amount: z.number().finite().positive(),
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

  const { data: settings, error: settingsError } = await db
    .from('supplier_settings')
    .select('upi_id, bank_account, ifsc')
    .eq('user_id', supplierId)
    .maybeSingle();

  if (settingsError) return jsonErr(settingsError.message, 502);
  if (!settings?.upi_id && !settings?.bank_account) {
    return jsonErr('Add a payout UPI ID or bank account before requesting settlement', 409);
  }

  const { data: earnings, error: earningsError } = await db.rpc('get_supplier_earnings', {
    p_supplier_id: supplierId,
    p_period: 'month',
  });

  if (earningsError) return jsonErr(earningsError.message, 502);

  const row = Array.isArray(earnings) ? earnings[0] : earnings;
  const pending = Number(row?.pending_payout ?? 0);
  const requested = Math.round(parsed.data.amount * 100) / 100;

  if (requested > pending + 0.01) {
    return jsonErr(
      `Payout amount exceeds your pending settlement balance of ₹${Math.round(pending).toLocaleString('en-IN')}.`,
      409
    );
  }

  const { data: active } = await db
    .from('payouts')
    .select('id, amount, status')
    .eq('supplier_id', supplierId)
    .in('status', ['pending', 'processing'])
    .limit(1)
    .maybeSingle();

  if (active) {
    return jsonErr('A payout request is already pending or processing', 409);
  }

  const { data, error } = await db
    .from('payouts')
    .insert({
      supplier_id: supplierId,
      amount: requested,
      method: settings.upi_id ? 'upi' : 'bank',
      reference: settings.upi_id ?? null,
      notes: JSON.stringify({
        request_note: parsed.data.notes ?? null,
        payout_account: settings.upi_id ?? settings.bank_account ?? null,
        ifsc: settings.ifsc ?? null,
      }),
      status: 'pending',
      requested_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (String(error.code ?? '') === '23505') {
      return jsonErr('A payout request is already pending or processing', 409);
    }
    return jsonErr(error.message, 502);
  }

  return jsonOk(data, 201);
}
