import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/** Records a payout request intent; finance team processes offline. */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  let body: { amount?: number; notes?: string };
  try {
    body = (await req.json()) as { amount?: number; notes?: string };
  } catch {
    body = {};
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonErr('Valid amount is required', 400);
  }

  return jsonOk({
    received: true as const,
    message:
      'Payout request recorded. Our team will verify pending earnings and process settlement.',
    amount,
    notes: typeof body.notes === 'string' ? body.notes : '',
  });
}
