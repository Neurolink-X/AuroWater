import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const schema = z.object({
  amount: z.number().min(1),
  upi_id: z.string().min(3),
  bank_account: z.string().optional(),
  ifsc: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = (await req.json()) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

  const { data, error } = await auth.ctx.supabase
    .from('payouts')
    .insert({
      supplier_id: auth.ctx.profile.id,
      amount: parsed.data.amount,
      method: parsed.data.upi_id ? 'upi' : 'bank',
      reference: parsed.data.upi_id,
      notes: JSON.stringify({
        upi_id: parsed.data.upi_id,
        bank_account: parsed.data.bank_account ?? null,
        ifsc: parsed.data.ifsc ?? null,
      }),
    })
    .select('*')
    .single();

  if (error) return jsonErr(error.message, 502);
  return jsonOk(data, 201);
}

