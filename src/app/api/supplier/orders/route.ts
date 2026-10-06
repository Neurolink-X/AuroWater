import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

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

  const orders = data ?? [];
  const customerIds = [...new Set(
    orders
      .map((order) => String((order as { customer_id?: string | null }).customer_id ?? ''))
      .filter(Boolean),
  )];

  if (!customerIds.length) return jsonOk(orders);

  const admin = createServiceClient();
  const { data: customers, error: customerError } = await admin
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', customerIds);

  if (customerError) {
    return jsonErr('Could not load customer contact details', 502);
  }

  const byId = new Map(
    (customers ?? []).map((customer) => [
      String(customer.id),
      {
        customer_name: customer.full_name ?? null,
        customer_phone: customer.phone ?? null,
      },
    ]),
  );

  return jsonOk(
    orders.map((order) => ({
      ...order,
      ...(byId.get(String((order as { customer_id?: string | null }).customer_id ?? '')) ?? {}),
    })),
  );
}
