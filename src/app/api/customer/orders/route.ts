import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  computeExpectedTotal,
  pickGstRateFromFlat,
  totalsMatch,
} from '@/lib/api/order-pricing-server';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import {
  isPostgrestTableUnavailableError,
  isRlsOrPermissionDeniedError,
  postgrestTableUnavailableUserMessage,
} from '@/lib/supabase/postgrest-errors';

async function settingsMap(
  sb: ReturnType<typeof import('@/lib/db/supabase').createSupabaseUserClient>
): Promise<
  | { ok: true; map: Record<string, string> }
  | { ok: false; message: string; status: number }
> {
  const { data, error } = await sb.from('settings').select('key, value');
  if (error) {
    if (isRlsOrPermissionDeniedError(error)) {
      return { ok: false, message: error.message || 'Forbidden', status: 403 };
    }
    if (isPostgrestTableUnavailableError(error)) {
      return {
        ok: false,
        message: postgrestTableUnavailableUserMessage(error, 'public.settings'),
        status: 503,
      };
    }
    return { ok: false, message: error.message || 'Settings load failed', status: 502 };
  }
  return {
    ok: true,
    map: Object.fromEntries((data ?? []).map((r) => [r.key, r.value])),
  };
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
    if (isRlsOrPermissionDeniedError(error)) {
      return jsonErr(error.message, 403);
    }
    if (isPostgrestTableUnavailableError(error)) {
      return jsonErr(postgrestTableUnavailableUserMessage(error, 'public.orders'), 503);
    }
    return jsonErr(error.message, 502);
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

  if (stErr) {
    if (isRlsOrPermissionDeniedError(stErr)) {
      return jsonErr(stErr.message || 'Forbidden', 403);
    }
    if (isPostgrestTableUnavailableError(stErr)) {
      return jsonErr(postgrestTableUnavailableUserMessage(stErr, 'public.service_types'), 503);
    }
    return jsonErr(stErr.message || 'Service lookup failed', 502);
  }
  if (!st) {
    return jsonErr('Invalid or inactive service', 400);
  }

  const { data: addr, error: aErr } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('id', address_id)
    .eq('user_id', auth.ctx.profile.id)
    .maybeSingle();

  if (aErr) {
    if (isRlsOrPermissionDeniedError(aErr)) {
      return jsonErr(aErr.message || 'Forbidden', 403);
    }
    if (isPostgrestTableUnavailableError(aErr)) {
      return jsonErr(postgrestTableUnavailableUserMessage(aErr, 'public.addresses'), 503);
    }
    return jsonErr(aErr.message || 'Address lookup failed', 502);
  }
  if (!addr) {
    return jsonErr('Address not found', 404);
  }

  const settingsResult = await settingsMap(auth.ctx.supabase);
  if (!settingsResult.ok) {
    return jsonErr(settingsResult.message, settingsResult.status);
  }
  const flat = settingsResult.map;

  const address_snapshot = {
    label: addr.label,
    house_flat: addr.house_flat,
    area: addr.area,
    city: addr.city,
    pincode: addr.pincode,
    landmark: addr.landmark,
  };

  if (service_type_key === 'water_can') {
    const { data: priceRows, error: prErr } = await auth.ctx.supabase
      .from('settings')
      .select('key, value')
      .in('key', ['default_can_price', 'platform_fee', 'platform_fee_per_order']);

    if (prErr) {
      return jsonErr(prErr.message, 502);
    }

    const pm: Record<string, number> = {};
    for (const row of priceRows ?? []) {
      const k = row.key;
      const v = Number(row.value);
      if (typeof k === 'string') pm[k] = v;
    }

    const unit = Number.isFinite(pm.default_can_price) ? pm.default_can_price : 12;
    const fee = Number.isFinite(pm.platform_fee)
      ? pm.platform_fee
      : Number.isFinite(pm.platform_fee_per_order)
        ? pm.platform_fee_per_order
        : 2;

    const qtyRaw = body.can_count ?? body.can_quantity;
    const qty = Math.max(1, Math.floor(Number(qtyRaw ?? 1)));

    const serverTotal = qty * unit + fee;
    const clientTotal = Number(body.total_amount);

    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - serverTotal) > 1) {
      return jsonErr(
        `Price validation failed — expected ₹${Math.round(serverTotal * 100) / 100} for ${qty} unit(s)`,
        400
      );
    }

    const roundedTotal = Math.round(serverTotal * 100) / 100;
    const base_amount = Math.round(qty * unit * 100) / 100;

    const insertWater = {
      customer_id: auth.ctx.profile.id,
      service_type_id: st.id,
      sub_option_key: typeof body.sub_option_key === 'string' ? body.sub_option_key : null,
      address_id: addr.id,
      address_snapshot,
      scheduled_date: typeof body.scheduled_date === 'string' ? body.scheduled_date : null,
      time_slot: typeof body.time_slot === 'string' ? body.time_slot : null,
      scheduled_time: typeof body.scheduled_time === 'string' ? body.scheduled_time : null,
      is_emergency: false,
      status: 'PENDING' as const,
      base_amount,
      convenience_fee: fee,
      emergency_charge: 0,
      gst_amount: 0,
      total_amount: roundedTotal,
      supplier_payout: 0,
      platform_fee: fee,
      payment_method: typeof body.payment_method === 'string' ? body.payment_method : 'cash',
      payment_status: 'unpaid' as const,
      payout_status: 'pending' as const,
      notes: typeof body.notes === 'string' ? body.notes : null,
      can_quantity: qty,
      can_price_per_unit: unit,
      can_order_type:
        typeof body.can_order_type === 'string' ? (body.can_order_type as string) : null,
      can_frequency: typeof body.can_frequency === 'string' ? (body.can_frequency as string) : null,
    };

    const { data: orderW, error: oErrW } = await auth.ctx.supabase
      .from('orders')
      .insert(insertWater)
      .select('*')
      .single();

    if (oErrW || !orderW) {
      if (oErrW && isRlsOrPermissionDeniedError(oErrW)) {
        return jsonErr(oErrW.message, 403);
      }
      if (oErrW && isPostgrestTableUnavailableError(oErrW)) {
        return jsonErr(postgrestTableUnavailableUserMessage(oErrW, 'public.orders'), 503);
      }
      return jsonErr(oErrW?.message ?? 'Failed to create order', oErrW ? 502 : 500);
    }

    const serviceName =
      typeof st.name === 'string' && st.name.trim() ? st.name : service_type_key;
    const scheduledDate =
      typeof insertWater.scheduled_date === 'string' ? insertWater.scheduled_date : 'your slot';
    const timeSlot =
      typeof insertWater.time_slot === 'string' && insertWater.time_slot ? insertWater.time_slot : '';
    const { createNotification } = await import('@/lib/notifications');
    await createNotification(
      auth.ctx.profile.id,
      'Booking Confirmed 🎉',
      `Your ${serviceName} is booked for ${scheduledDate}${timeSlot ? ` · ${timeSlot}` : ''}.`,
      'booking',
      String(orderW.id),
      'created'
    );

    return jsonOk(orderW, 201);
  }

  const gstRate = pickGstRateFromFlat(flat);
  const convenience = Number(flat.convenience_fee ?? 29);
  const emergencyFee = Number(flat.emergency_surcharge ?? 199);
  const is_emergency = Boolean(body.is_emergency);

  let base_amount = Number(body.base_amount ?? 0);
  if (!Number.isFinite(base_amount) || base_amount < 0) {
    base_amount = Number(st.base_price);
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
    can_price_per_unit: null,
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
    if (oErr && isRlsOrPermissionDeniedError(oErr)) {
      return jsonErr(oErr.message, 403);
    }
    if (oErr && isPostgrestTableUnavailableError(oErr)) {
      return jsonErr(postgrestTableUnavailableUserMessage(oErr, 'public.orders'), 503);
    }
    return jsonErr(oErr?.message ?? 'Failed to create order', oErr ? 502 : 500);
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
