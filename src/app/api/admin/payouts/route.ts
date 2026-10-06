import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const updateSchema = z.object({
  status: z.enum(['paid', 'rejected']),
  reference: z.string().max(200).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const db = createServiceClient();
  let query = db
    .from('payouts')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(100);

  if (status && ['pending', 'processing', 'paid', 'rejected'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data: payouts, error } = await query;
  if (error) return jsonErr(error.message, 502);

  const rows = payouts ?? [];
  const supplierIds = [...new Set(rows.map((p) => String(p.supplier_id)).filter(Boolean))];

  const { data: profiles } = supplierIds.length
    ? await db.from('profiles').select('id, full_name, phone, city, email').in('id', supplierIds)
    : { data: [] as any[] };

  const byId = new Map(
    (profiles ?? []).map((p) => [String(p.id), p])
  );

  return jsonOk(rows.map((p) => ({
    ...p,
    supplier_name: byId.get(String(p.supplier_id))?.full_name ?? 'Supplier',
    supplier_phone: byId.get(String(p.supplier_id))?.phone ?? null,
    supplier_email: byId.get(String(p.supplier_id))?.email ?? null,
    supplier_city: byId.get(String(p.supplier_id))?.city ?? null,
  })));
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payout update', 422);

  const payoutId = new URL(req.url).searchParams.get('id');
  if (!payoutId) return jsonErr('Payout id is required', 400);

  const db = createServiceClient();
  const { data: current, error: lookupError } = await db
    .from('payouts')
    .select('id, supplier_id, status')
    .eq('id', payoutId)
    .maybeSingle();

  if (lookupError) return jsonErr(lookupError.message, 502);
  if (!current) return jsonErr('Payout not found', 404);

  if (current.status === parsed.data.status) {
    return jsonOk(current);
  }

  if (!['pending', 'processing'].includes(String(current.status))) {
    return jsonErr('Only pending or processing payouts can be finalized', 409);
  }

  const { data, error } = await db.rpc('finalize_supplier_payout', {
    p_payout_id: payoutId,
    p_status: parsed.data.status,
    p_reference: parsed.data.reference ?? null,
  });

  if (error) {
    const message = String(error.message ?? '');
    if (message.includes('PAYOUT_NOT_FOUND')) return jsonErr('Payout not found', 404);
    return jsonErr(message || 'Could not finalize payout', 502);
  }

  try {
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      String(current.supplier_id),
      parsed.data.status === 'paid' ? 'Payout completed' : 'Payout rejected',
      parsed.data.status === 'paid'
        ? 'Your supplier settlement has been marked as paid.'
        : 'Your payout request was rejected. Your eligible balance has been returned to pending settlement.',
      'system',
      payoutId,
      'payout_' + parsed.data.status
    );
  } catch (e) {
    console.error('[admin/payouts] supplier notification failed', e);
  }

  return jsonOk(data);
}
