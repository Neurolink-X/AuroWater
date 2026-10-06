import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

function toSupplierOrder(row: Record<string, unknown>) {
  const scheduledAt = typeof row.scheduled_at === 'string' ? row.scheduled_at : null;
  const timeSlot = typeof row.time_slot === 'string' ? row.time_slot : null;
  const scheduledDate =
    typeof row.scheduled_date === 'string'
      ? row.scheduled_date
      : scheduledAt
        ? scheduledAt.slice(0, 10)
        : null;

  return {
    ...row,
    service_type_key: row.service_type ?? null,
    can_quantity: row.can_count ?? null,
    notes: row.note ?? null,
    cancellation_reason: row.cancel_reason ?? null,
    scheduled_date: scheduledDate,
    time_slot: timeSlot,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;

  let q = auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('supplier_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false });

  if (status) {
    q = q.eq('status', status);
  }

  const { data, error } = await q;

  if (error) {
    return jsonErr(error.message, 500);
  }

  return jsonOk((data ?? []).map((row) => toSupplierOrder(row as Record<string, unknown>)));
}
