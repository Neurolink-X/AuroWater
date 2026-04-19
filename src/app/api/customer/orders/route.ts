import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  computeExpectedTotal,
  pickGstRateFromFlat,
  totalsMatch,
} from '@/lib/api/order-pricing-server';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

async function settingsMap(
  sb: ReturnType<typeof import('@/lib/db/supabase').createSupabaseUserClient>
): Promise<Record<string, string>> {
  const { data } = await sb.from('settings').select('key, value');
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? '20') || 20, 100);
  const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

  let q = auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('customer_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    q = q.eq('status', status);
  }

  const { data, error } = await q;

  if (error) {
    return jsonErr(error.message, 500);
  }

  const orders = data ?? [];
  const typeIds = [...new Set(orders.map((o) => o.service_type_id).filter(Boolean))];
  let keyById: Record<number, string> = {};
  if (typeIds.length) {
    const { data: types } = await auth.ctx.supabase
      .from('service_types')
      .select('id, key')
      .in('id', typeIds as number[]);
    keyById = Object.fromEntries((types ?? []).map((t) => [t.id as number, t.key as string]));
  }

  const enriched = orders.map((o) => ({
    ...o,
    service_type_key: keyById[Number(o.service_type_id)] ?? null,
  }));

  return jsonOk(enriched);
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const service_type_key = typeof body.service_type_key === 'string' ? body.service_type_key : '';
  const address_id = typeof body.address_id === 'string' ? body.address_id : '';

  if (!service_type_key || !address_id) {
    return jsonErr('service_type_key and address_id are required', 400);
  }

  const { data: st, error: stErr } = await auth.ctx.supabase
    .from('service_types')
    .select('id, base_price, key, name')
    .eq('key', service_type_key)
    .eq('is_active', true)
    .maybeSingle();

  if (stErr || !st) {
    return jsonErr('Invalid or inactive service', 400);
  }

  const { data: addr, error: aErr } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('id', address_id)
    .eq('user_id', auth.ctx.profile.id)
    .maybeSingle();

  if (aErr || !addr) {
    return jsonErr('Address not found', 404);
  }

  const flat = await settingsMap(auth.ctx.supabase);
  const gstRate = pickGstRateFromFlat(flat);
  const convenience = Number(flat.convenience_fee ?? 29);
  const emergencyFee = Number(flat.emergency_surcharge ?? 199);
  const is_emergency = Boolean(body.is_emergency);

  let base_amount = Number(body.base_amount ?? 0);
  if (!Number.isFinite(base_amount) || base_amount < 0) {
    base_amount = Number(st.base_price);
  }

  if (service_type_key === 'water_can') {
    const qty = Number(body.can_quantity ?? 1);
    const per =
      body.can_order_type === 'subscription'
        ? Number(flat.subscription_can_price ?? 10)
        : Number(flat.default_can_price ?? 12);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(per)) {
      base_amount = Math.round(qty * per);
    }
  }

  const emergency_charge = is_emergency ? emergencyFee : 0;
  const clientTotal = Number(body.total_amount);
  const clientGst = Number(body.gst_amount);

  if (!Number.isFinite(clientTotal)) {
    return jsonErr('total_amount is required', 400);
  }

  if (
    !totalsMatch(clientTotal, base_amount, convenience, emergency_charge, gstRate, 3)
  ) {
    return jsonErr('Price validation failed — totals do not match platform rates', 400);
  }

  const { gst: gst_amount } = (await import('@/lib/api/order-pricing-server')).computeExpectedTotal(
    base_amount,
    convenience,
    emergency_charge,
    gstRate
  );

  const address_snapshot = {
    label: addr.label,
    house_flat: addr.house_flat,
    area: addr.area,
    city: addr.city,
    pincode: addr.pincode,
    landmark: addr.landmark,
  };

  const insert = {
    customer_id: auth.ctx.profile.id,
    service_type_id: st.id,
    sub_option_key: typeof body.sub_option_key === 'string' ? body.sub_option_key : null,
    address_id: addr.id,
    address_snapshot,
    scheduled_date: typeof body.scheduled_date === 'string' ? body.scheduled_date : null,
    time_slot: typeof body.time_slot === 'string' ? body.time_slot : null,
    scheduled_time: typeof body.scheduled_time === 'string' ? body.scheduled_time : null,
    is_emergency,
    status: 'PENDING' as const,
    base_amount,
    convenience_fee: convenience,
    emergency_charge,
    gst_amount: Number.isFinite(clientGst) ? clientGst : gst_amount,
    total_amount: clientTotal,
    supplier_payout: 0,
    platform_fee: 0,
    payment_method: typeof body.payment_method === 'string' ? body.payment_method : 'cash',
    payment_status: 'unpaid' as const,
    payout_status: 'pending' as const,
    notes: typeof body.notes === 'string' ? body.notes : null,
    can_quantity: body.can_quantity != null ? Number(body.can_quantity) : null,
    can_price_per_unit:
      service_type_key === 'water_can'
        ? Number(
            body.can_order_type === 'subscription'
              ? flat.subscription_can_price ?? 10
              : flat.default_can_price ?? 12
          )
        : null,
    can_order_type:
      typeof body.can_order_type === 'string' ? (body.can_order_type as string) : null,
    can_frequency: typeof body.can_frequency === 'string' ? (body.can_frequency as string) : null,
  };

  const { data: order, error: oErr } = await auth.ctx.supabase
    .from('orders')
    .insert(insert)
    .select('*')
    .single();

  if (oErr || !order) {
    return jsonErr(oErr?.message ?? 'Failed to create order', 500);
  }

  const serviceName = typeof st.name === 'string' && st.name.trim() ? st.name : service_type_key;
  const scheduledDate = typeof insert.scheduled_date === 'string' ? insert.scheduled_date : 'your slot';
  const timeSlot = typeof insert.time_slot === 'string' && insert.time_slot ? insert.time_slot : '';
  const { createNotification } = await import('@/lib/notifications');
  await createNotification(
    auth.ctx.profile.id,
    'Booking Confirmed 🎉',
    `Your ${serviceName} is booked for ${scheduledDate}${timeSlot ? ` · ${timeSlot}` : ''}.`,
    'booking',
    String(order.id),
    'created'
  );

  return jsonOk(order, 201);
}
