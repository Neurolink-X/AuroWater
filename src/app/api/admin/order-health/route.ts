import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const MODES = ['overdue', 'unpaid_completed', 'assigned_unpaid'] as const;
type Mode = typeof MODES[number];
type Row = {
  id: string;
  order_number: string | null;
  status: string;
  service_type: string | null;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: number | null;
  created_at: string;
  scheduled_at: string | null;
  supplier_id: string | null;
};

/**
 * Read-only admin triage. These are *candidates for human reconciliation*:
 * unpaid might be legitimate COD; an old order might be a test order.
 * NEVER cancel, mark paid, refund or dispatch from this route.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const modeRaw = req.nextUrl.searchParams.get('mode') ?? 'overdue';
  if (!MODES.includes(modeRaw as Mode)) return jsonErr('Invalid triage filter', 400);
  const mode = modeRaw as Mode;
  const pageRaw = Number(req.nextUrl.searchParams.get('page') ?? '0');
  if (!Number.isSafeInteger(pageRaw) || pageRaw < 0 || pageRaw > 1000) {
    return jsonErr('Invalid page', 400);
  }
  const limit = 40;
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  // Authorization is checked above; service-role reads prevent customer-scoped RLS from hiding admin triage.
  // Never return the service client or its credentials to the browser.
  let query = createServiceClient().from('orders')
    .select('id,order_number,status,service_type,payment_status,payment_method,total_amount,created_at,scheduled_at,supplier_id', { count: 'exact' });

  if (mode === 'overdue') {
    query = query.in('status', ['PENDING', 'ASSIGNED']).lt('created_at', cutoff);
  } else if (mode === 'unpaid_completed') {
    query = query.eq('status', 'COMPLETED').eq('payment_status', 'unpaid');
  } else {
    query = query.eq('status', 'ASSIGNED').eq('payment_status', 'unpaid');
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: true })
    .range(pageRaw * limit, (pageRaw + 1) * limit - 1);

  if (error) {
    console.error('[order-health] query failed', { code: error.code });
    return jsonErr('Order health is temporarily unavailable.', 503);
  }
  const rows = (data ?? []) as Row[];
  return jsonOk({
    mode, count: count ?? 0, page: pageRaw, page_size: limit, cutoff_at: cutoff,
    orders: rows.map((r) => ({
      id: r.id,
      order_number: r.order_number ?? r.id.slice(0, 8),
      status: r.status,
      service_type: r.service_type,
      payment_status: r.payment_status,
      payment_method: r.payment_method,
      amount: Number(r.total_amount ?? 0),
      created_at: r.created_at,
      scheduled_at: r.scheduled_at,
      supplier_assigned: r.supplier_id !== null,
    })),
    disclaimer: 'Triage candidates only; COD, test orders and manually completed deliveries require verification. No financial or order mutation was performed.',
  });
}
