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
  if (orders.length === 0) return jsonOk([]);

  // Contact details are loaded server-side and returned only to the supplier
  // assigned to these orders. The supplier UI must not query the customer
  // profile table directly, because profiles are protected by RLS.
  const service = createServiceClient();
  const customerIds = [...new Set(orders.map((order) => String(order.customer_id ?? '')).filter(Boolean))];
  const serviceTypeIds = [...new Set(orders.map((order) => Number(order.service_type_id)).filter((id) => Number.isInteger(id) && id > 0))];

  const [profilesResult, serviceTypesResult] = await Promise.all([
    customerIds.length
      ? service.from('profiles').select('id, full_name, phone, city').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    serviceTypeIds.length
      ? service.from('service_types').select('id, key, name, label').in('id', serviceTypeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    console.error('[supplier/orders] customer contact lookup failed:', profilesResult.error);
    return jsonErr('Unable to load delivery contact details right now', 502);
  }

  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [String(profile.id), profile]),
  );
  const serviceTypeById = new Map(
    (serviceTypesResult.data ?? []).map((serviceType) => [Number(serviceType.id), serviceType]),
  );

  return jsonOk(orders.map((order) => {
    const customer = profileById.get(String(order.customer_id ?? ''));
    const serviceType = serviceTypeById.get(Number(order.service_type_id));
    return {
      ...order,
      booking_id: order.order_number ?? order.booking_id ?? order.id,
      service_type_label:
        order.service_type ?? order.service_type_key ?? serviceType?.label ?? serviceType?.name ?? serviceType?.key ?? 'Service',
      customer_name: customer?.full_name ?? '—',
      customer_phone: customer?.phone ?? null,
      customer_city: customer?.city ?? null,
    };
  }));
}
