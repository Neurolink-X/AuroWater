import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { computeExpectedTotal, totalsMatch } from '@/lib/api/order-pricing-server';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import {
  isPostgrestTableUnavailableError,
  isRlsOrPermissionDeniedError,
  postgrestTableUnavailableUserMessage,
} from '@/lib/supabase/postgrest-errors';
import { resolveServiceability } from '@/lib/zones';
import { getServiceZone, isCityServed, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';
import { dispatchOrder, dispatchTechnicianJob } from '@/lib/dispatch';
import { createServiceClient } from '@/utils/supabase/server';
import { addSubscriptionFrequency, isSubscriptionFrequency, parseTimeSlot, scheduledAtIST } from '@/lib/subscription-schedule';

/*
 * Real `orders` columns used here:
 * customer_id, supplier_id, service_type, status, can_count, total_amount, platform_fee,
 * payment_status, payment_method, address, address_id, is_emergency, note, scheduled_at,
 * final_amount, base_amount, convenience_fee, emergency_charge, gst_amount, address_snapshot,
 * assigned_at, dispatch_attempts, last_dispatch_at
 */

type PgErr = { message?: string; code?: string } | null;

function dbErr(error: NonNullable<PgErr>, table: string, fallback: string) {
  console.error(`[orders] ${table}:`, error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = error as any;
  if (isRlsOrPermissionDeniedError(e)) return jsonErr(error.message || 'Forbidden', 403);
  if (isPostgrestTableUnavailableError(e)) {
    return jsonErr(postgrestTableUnavailableUserMessage(e, `public.${table}`), 503);
  }
  return jsonErr(error.message || fallback, 502);
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  return Number(v);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

function hourSetting(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 24 ? Math.floor(n) : fallback;
}

function hourLabel(h: number): string {
  const ap = h >= 12 && h < 24 ? 'PM' : 'AM';
  return `${h % 12 || 12} ${ap}`;
}

/** Add old field names so existing frontend code keeps working. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withCompat(o: any) {
  return {
    ...o,
    service_type_key: o.service_type ?? null,
    can_quantity: o.can_count ?? null,
    notes: o.note ?? null,
    cancellation_reason: o.cancel_reason ?? null,
    base_amount: o.base_amount ?? 0,
    convenience_fee: o.convenience_fee ?? o.platform_fee ?? 0,
    emergency_charge: o.emergency_charge ?? 0,
    gst_amount: o.gst_amount ?? 0,
    address_snapshot: o.address_snapshot ?? (o.address ? { house_flat: o.address } : null),
    has_review: o.rating != null,
  };
}

async function settingsMap(
  sb: ReturnType<typeof import('@/lib/db/supabase').createSupabaseUserClient>
): Promise<
  | { ok: true; map: Record<string, string> }
  | { ok: false; message: string; status: number }
> {
  const { data, error } = await sb.from('settings').select('key, value');
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = error as any;
    console.error('[orders] settings:', error);
    if (isRlsOrPermissionDeniedError(e)) {
      return { ok: false, message: error.message || 'Forbidden', status: 403 };
    }
    if (isPostgrestTableUnavailableError(e)) {
      return {
        ok: false,
        message: postgrestTableUnavailableUserMessage(e, 'public.settings'),
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

async function safeNotify(
  userId: string,
  title: string,
  body: string,
  type: string,
  orderId: string,
  event: string
) {
  try {
    const { createNotification } = await import('@/lib/notifications');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createNotification as any)(userId, title, body, type, orderId, event);
  } catch (e) {
    console.error('[notifications]', event, e);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '20') || 20, 1), 100);
  const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

  // Keep the history endpoint read-only and fast.
  // Dispatch maintenance must not block customer page rendering.
  // Supplier dispatch continues through the order/dispatch workflow.

  let q = auth.ctx.supabase
    .from('orders')
    .select(
      [
        'id',
        'order_number',
        'status',
        'customer_id',
        'supplier_id',
        'service_type',
        'can_count',
        'total_amount',
        'payment_method',
        'payment_status',
        'address',
        'address_id',
        'address_snapshot',
        'scheduled_at',
        'note',
        'rating',
        'subscription_id',
        'can_order_type',
        'can_frequency',
        'can_price_per_unit',
        'created_at',
        'updated_at',
      ].join(', ')
    )
    .eq('customer_id', auth.ctx.profile.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    const list = status
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    if (list.length > 1) q = q.in('status', list);
    else if (list.length === 1) q = q.eq('status', list[0]);
  }

  const { data, error } = await q;
  if (error) return dbErr(error, 'orders', 'Orders load failed');

  return jsonOk((data ?? []).map(withCompat));
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

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

  const customerId = auth.ctx.profile.id;

  // service_types has: id, key, label, description, base_price, is_active
  const { data: st, error: stErr } = await auth.ctx.supabase
    .from('service_types')
    .select('id, key, label, base_price')
    .eq('key', service_type_key)
    .eq('is_active', true)
    .maybeSingle();
  if (stErr) return dbErr(stErr, 'service_types', 'Service lookup failed');
  if (!st) return jsonErr('Invalid or inactive service', 400);

  const { data: addr, error: aErr } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('id', address_id)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (aErr) return dbErr(aErr, 'addresses', 'Address lookup failed');
  if (!addr) return jsonErr('Address not found', 404);

  const a = addr as Record<string, unknown>;

const addrLat = toNum(a.lat);
const addrLng = toNum(a.lng);
const hasValidCoordinates = Number.isFinite(addrLat) && Number.isFinite(addrLng) && addrLat >= -90 && addrLat <= 90 && addrLng >= -180 && addrLng <= 180;

if (service_type_key === 'water_can' && !hasValidCoordinates) {
  return jsonErr('Please save this delivery address with a valid map location before ordering water.', 400, 'DELIVERY_LOCATION_REQUIRED');
}

const serviceability = await resolveServiceability(
  a,
  service_type_key
);

if (!serviceability.serviceable) {
  return jsonErr(serviceability.message, 400);
}
  
  // const a = addr as Record<string, unknown>;
  // const addrLat = toNum(a.lat);
  // const addrLng = toNum(a.lng);
  // const inZone =
  //   Number.isFinite(addrLat) && Number.isFinite(addrLng)
  //     ? getServiceZone(addrLat, addrLng) !== null
  //     : isCityServed(String(a.city ?? ''));
  // if (!inZone) return jsonErr(OUT_OF_ZONE_MESSAGE, 400);

  const settingsResult = await settingsMap(auth.ctx.supabase);
  if (!settingsResult.ok) return jsonErr(settingsResult.message, settingsResult.status);
  const flat = settingsResult.map;

  // ── Pricing ──
  // The booking UI currently does not charge GST. Keep server validation in
  // sync until tax registration/configuration is explicitly enabled.
  const gstRate = 0;
  const convenience = service_type_key === 'water_can' ? 0 : Number(flat.convenience_fee ?? 10);
  const emergencyFee = Number(flat.emergency_surcharge ?? 30);
  const is_emergency = Boolean(body.is_emergency);
  const emergency_charge = is_emergency ? emergencyFee : 0;

  const isWater = service_type_key === 'water_can';
  const isSubscription = str(body.can_order_type) === 'subscription';
  let qty: number | null = null;
  let base_amount: number;

  let waterUnitPrice: number | null = null;
  let subscriptionFrequency: string | null = null;

  if (isWater) {
    const subPrice = Number(flat.subscription_can_price);
    const bulkThreshold = Math.max(1, Math.floor(Number(flat.bulk_threshold)) || 50);
    const isChilled = str(body.sub_option_key) === 'chilled_ro';

    // Chilled RO is a separate one-time product: it uses its own configured
    // price and must never inherit the Normal RO subscription/bulk rate.
    if (isChilled && isSubscription) {
      return jsonErr('Chilled RO is available for one-time orders only.', 400);
    }

    const maxOneTime = Math.max(1, Math.floor(Number(flat.max_cans_per_order)) || 50);
    const maxSub = Math.max(maxOneTime, Math.floor(Number(flat.max_cans_subscription)) || 200);
    const cap = isSubscription ? maxSub : maxOneTime;
    const requested = Math.floor(Number(body.can_count ?? body.can_quantity ?? 1)) || 1;

    if (requested > cap) {
      return jsonErr(
        `You can order up to ${cap} cans at a time${isSubscription ? '' : '. For larger quantities choose a subscription'}.`,
        400
      );
    }

    if (isSubscription && !isSubscriptionFrequency(body.can_frequency)) {
      return jsonErr('Choose a valid subscription frequency', 400);
    }

    if (
      isSubscription &&
      str(body.payment_method) &&
      !['cash', 'upi'].includes(String(body.payment_method).toLowerCase())
    ) {
      return jsonErr(
        'Recurring water deliveries currently support Cash or UPI payment per delivery.',
        400
      );
    }

    qty = Math.max(1, requested);

    // Approved launch prices: Normal RO ₹20, Chilled RO ₹25, subscription ₹18.
    // Stale legacy settings must not cause client/server total mismatches.
    const regularPrice = 20;
    const configuredRecurringPrice = Number.isFinite(subPrice) && subPrice > 0 ? subPrice : 18;
    const recurringPrice = configuredRecurringPrice < regularPrice
      ? Math.min(configuredRecurringPrice, 18)
      : 18;
    waterUnitPrice = isChilled
      ? 25
      : isSubscription
        ? recurringPrice
        : regularPrice;

    base_amount = round2(qty * waterUnitPrice);
    subscriptionFrequency = isSubscription ? String(body.can_frequency) : null;
  } else {
    // Never trust a client-supplied base amount. Resolve the canonical service
    // rate from server settings, then apply only known option adjustments.
    const configuredPrice = Number(flat[service_type_key + '_price']);
    const plumberType = str(body.plumber_type) ?? 'labour';
    if (service_type_key === 'plumbing' && !['labour', 'mistri'].includes(plumberType)) {
      return jsonErr('Choose a valid plumber charge type.', 400);
    }
    const serviceBase = service_type_key === 'plumbing'
      ? (plumberType === 'mistri' ? 900 : 149)
      : Number.isFinite(configuredPrice) && configuredPrice > 0
        ? configuredPrice
        : Number(st.base_price) || 0;
    const optionKey = str(body.sub_option_key) ?? '';
    const optionDeltas: Record<string, Record<string, number>> = {
      ro_service: { service: 0, filter_change: 49, amc: 149, new_installation: 599 },
      plumbing: { pipe_leak: 0, tap: 0, drainage: 49, new_fitting: 99, other: 0 },
      water_tanker: { '500': 0, '1000': 50, '2000': 120, custom: 80 },
    };
    const allowedOptions = optionDeltas[service_type_key];
    if (allowedOptions && optionKey && !(optionKey in allowedOptions)) {
      return jsonErr('Invalid service option. Please choose an available option.', 400);
    }
    base_amount = round2(serviceBase + (allowedOptions?.[optionKey] ?? 0));
  }

  const clientTotal = Number(body.total_amount);
  if (!Number.isFinite(clientTotal)) return jsonErr('total_amount is required', 400);

  if (!totalsMatch(clientTotal, base_amount, convenience, emergency_charge, gstRate, 0.5)) {
    const expected = computeExpectedTotal(base_amount, convenience, emergency_charge, gstRate);
    console.error('[orders] price mismatch', { clientTotal, base_amount, convenience, gstRate, expected });
    return jsonErr('Price validation failed — totals do not match platform rates', 400);
  }

  const { gst: gst_amount } = computeExpectedTotal(base_amount, convenience, emergency_charge, gstRate);

  const address_snapshot = {
    label: a.label ?? null,
    house_flat: a.house_flat ?? a.line1 ?? null,
    area: a.area ?? a.line2 ?? null,
    landmark: a.landmark ?? null,
    city: a.city ?? null,
    state: a.state ?? null,
    pincode: a.pincode ?? null,
    lat: Number.isFinite(addrLat) ? addrLat : null,
    lng: Number.isFinite(addrLng) ? addrLng : null,
  };

  const addressText = [a.house_flat ?? a.line1, a.area ?? a.line2, a.landmark, a.city, a.state, a.pincode]
    .filter((x) => typeof x === 'string' && x.trim())
    .join(', ');

  // ── Schedule ──
  let scheduledAt: string | null = null;
  const stRaw = str(body.scheduled_time);
  const sdRaw = str(body.scheduled_date);
  if (stRaw && !Number.isNaN(new Date(stRaw).getTime())) {
    scheduledAt = new Date(stRaw).toISOString();
  } else if (sdRaw && !Number.isNaN(new Date(`${sdRaw}T00:00:00+05:30`).getTime())) {
    scheduledAt = new Date(`${sdRaw}T00:00:00+05:30`).toISOString();
  }

  if (stRaw && scheduledAt) {
    // Slots that already passed (30 min grace)
    if (new Date(scheduledAt).getTime() < Date.now() - 30 * 60 * 1000) {
      return jsonErr('That time slot has already passed. Please pick a new slot.', 400);
    }
    // Service hours (India time). Emergency bookings are allowed at any time.
    if (!is_emergency) {
      const openH = hourSetting(flat.service_open_hour, 7);
      const closeH = hourSetting(flat.service_close_hour, 21);
      const ist = new Date(new Date(scheduledAt).getTime() + 330 * 60 * 1000);
      const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
      if (mins < openH * 60 || mins >= closeH * 60) {
        return jsonErr(
          `We deliver between ${hourLabel(openH)} and ${hourLabel(closeH)}. Please pick a slot in that window.`,
          400
        );
      }
    }
  }

  const noteParts = [
    str(body.notes),
    str(body.time_slot) ? `Slot: ${str(body.time_slot)}` : null,
    str(body.sub_option_key) ? `Option: ${str(body.sub_option_key)}` : null,
    service_type_key === 'water_can' ? `Water: ${str(body.sub_option_key) === 'chilled_ro' ? 'Chilled RO' : 'Normal RO'}` : null,
    str(body.can_order_type) ? `Type: ${str(body.can_order_type)}` : null,
    str(body.can_frequency) ? `Frequency: ${str(body.can_frequency)}` : null,
  ].filter(Boolean);

  // Persist the server-calculated amount, never the client-provided total.
  const total = computeExpectedTotal(base_amount, convenience, emergency_charge, gstRate).total;

  // Double-submit guard: an identical order in the last 20 seconds returns the existing one.
  {
    let dq = auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .eq('service_type', service_type_key)
      .eq('address_id', addr.id)
      .eq('total_amount', total)
      .in('status', ['PENDING', 'ASSIGNED'])
      .gte('created_at', new Date(Date.now() - 20_000).toISOString());
    if (scheduledAt) dq = dq.eq('scheduled_at', scheduledAt);
    if (isWater && qty !== null && waterUnitPrice !== null) {
      dq = dq.eq('can_count', qty).eq('can_price_per_unit', waterUnitPrice);
    }
    const { data: dup } = await dq.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (dup) return jsonOk(withCompat(dup), 200);
  }

  const { data: order, error: oErr } = await auth.ctx.supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      service_type: service_type_key,
      status: 'PENDING',
      zone_id: serviceability.zone?.id ?? null,
      can_count: qty,
      can_price_per_unit: isWater ? waterUnitPrice : null,
      can_order_type: isWater ? (isSubscription ? 'subscription' : 'one_time') : null,
      can_frequency: isWater ? subscriptionFrequency : null,
      subscription_id: null,
      total_amount: total,
      platform_fee: convenience,
      final_amount: total,
      base_amount,
      convenience_fee: convenience,
      emergency_charge,
      gst_amount,
      address_snapshot,
      payment_status: 'unpaid',
      payment_method: str(body.payment_method) ?? 'cash',
      address: addressText || null,
      address_id: addr.id,
      is_emergency,
      note: noteParts.length ? noteParts.join(' | ') : null,
      scheduled_at: scheduledAt,
    })
    .select('*')
    .single();

  if (oErr || !order) {
    if (oErr) return dbErr(oErr, 'orders', 'Failed to create order');
    return jsonErr('Failed to create order', 500);
  }

  const orderId = String(order.id);
  const label = typeof st.label === 'string' && st.label.trim()
    ? st.label
    : service_type_key.replace(/_/g, ' ');
  const slotText = `${sdRaw ?? 'your slot'}${str(body.time_slot) ? ` · ${str(body.time_slot)}` : ''}`;

  // ── Subscription setup ───────────────────────────────────────────────
  // AuroTap subscriptions are recurring delivery plans, not silent auto-debits.
  // Each recurring delivery becomes a separate order and is paid per delivery.
  let subscriptionId: string | null = null;

  if (
    isWater &&
    isSubscription &&
    qty &&
    waterUnitPrice &&
    subscriptionFrequency &&
    sdRaw &&
    str(body.time_slot)
  ) {
    const slot = parseTimeSlot(String(body.time_slot));
    const nextDate = addSubscriptionFrequency(
      sdRaw,
      subscriptionFrequency as any
    );
    const admin = createServiceClient();

    const { data: subscription, error: subscriptionError } = await admin
      .from('water_subscriptions')
      .insert({
        customer_id: customerId,
        address_id: addr.id,
        quantity: qty,
        frequency: subscriptionFrequency,
        status: 'ACTIVE',
        start_date: sdRaw,
        next_order_date: nextDate,
        preferred_time_slot: String(body.time_slot),
        preferred_start_time: slot.start,
        preferred_end_time: slot.end,
        payment_method: String(body.payment_method ?? 'cash').toLowerCase() === 'upi' ? 'upi' : 'cash',
        price_per_can: waterUnitPrice,
        convenience_fee: convenience,
        gst_rate: gstRate,
        notes: str(body.notes),
      })
      .select('id')
      .single();

    if (subscriptionError || !subscription) {
      await admin.from('orders').delete().eq('id', orderId).eq('customer_id', customerId);
      console.error('[orders] subscription creation failed', subscriptionError);
      return jsonErr(
        'We could not activate the recurring delivery plan. Your order was not confirmed. Please try again.',
        500
      );
    }

    subscriptionId = String(subscription.id);

    const { error: linkError } = await auth.ctx.supabase
      .from('orders')
      .update({ subscription_id: subscriptionId })
      .eq('id', orderId)
      .eq('customer_id', customerId);

    if (linkError) {
      await admin.from('water_subscriptions').delete().eq('id', subscriptionId);
      await admin.from('orders').delete().eq('id', orderId).eq('customer_id', customerId);
      console.error('[orders] subscription link failed', linkError);
      return jsonErr(
        'We could not finish setting up your recurring delivery plan. Please try again.',
        500
      );
    }

    await admin
      .from('water_subscriptions')
      .update({ first_order_id: orderId, last_order_id: orderId })
      .eq('id', subscriptionId);

    // Keep the next delivery in the database before the customer leaves checkout.
    const nextScheduledAt = scheduledAtIST(nextDate, slot.start);
    const nextBase = round2(qty * waterUnitPrice);
    const nextSubtotal = nextBase + convenience;
    const nextGst = Math.round(nextSubtotal * gstRate);
    const nextTotal = nextSubtotal + nextGst;

    const { error: nextOrderError } = await admin
      .from('orders')
      .insert({
        customer_id: customerId,
        service_type: service_type_key,
        status: 'PENDING',
        subscription_id: subscriptionId,
        can_count: qty,
        can_price_per_unit: waterUnitPrice,
        can_order_type: 'subscription',
        can_frequency: subscriptionFrequency,
        total_amount: nextTotal,
        platform_fee: convenience,
        final_amount: nextTotal,
        base_amount: nextBase,
        convenience_fee: convenience,
        emergency_charge: 0,
        gst_amount: nextGst,
        address_snapshot,
        payment_status: 'unpaid',
        payment_method: String(body.payment_method ?? 'cash').toLowerCase() === 'upi' ? 'upi' : 'cash',
        address: addressText || null,
        address_id: addr.id,
        is_emergency: false,
        note: [
          str(body.notes),
          `Slot: ${String(body.time_slot)}`,
          'Type: subscription',
          `Frequency: ${subscriptionFrequency}`,
        ].filter(Boolean).join(' | ') || null,
        scheduled_date: nextDate,
        scheduled_at: nextScheduledAt,
      });

    if (nextOrderError) {
      // The active subscription is still valid. The daily scheduler can safely
      // create the missing next order later, without duplicating a schedule.
      console.error('[orders] next subscription order creation failed', nextOrderError);
    }
  }

  // ── Role-aware dispatch ─────────────────────────────────────────────
  // Water delivery uses the supplier engine. Home-service jobs use the
  // technician engine with location ranking + atomic fallback.
  let supplierId: string | null = null;
  let technicianId: string | null = null;

  if (isWater) {
    const d = await dispatchOrder(orderId);
    supplierId = d.supplierId;
    if (supplierId) {
      (order as Record<string, unknown>).supplier_id = supplierId;
      (order as Record<string, unknown>).status = 'ASSIGNED';
    }
  } else {
    const d = await dispatchTechnicianJob(orderId);
    technicianId = d.technicianId;
    if (technicianId) {
      (order as Record<string, unknown>).technician_id = technicianId;
      (order as Record<string, unknown>).status = 'ASSIGNED';
    }
  }

  await safeNotify(
    customerId,
    isWater ? 'Order placed successfully' : 'Booking Confirmed 🎉',
    `Your ${label} is booked for ${slotText}.`,
    'booking',
    orderId,
    'created'
  );

  const out = withCompat({
    ...order,
    subscription_id:
      subscriptionId ??
      (order as Record<string, unknown>).subscription_id ??
      null,
  });

  return jsonOk(
    isWater && !supplierId
      ? { ...out, supplier_status: 'searching' }
      : out,
    201
  );
}



// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import {
//   computeExpectedTotal,
//   pickGstRateFromFlat,
//   totalsMatch,
// } from '@/lib/api/order-pricing-server';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import {
//   isPostgrestTableUnavailableError,
//   isRlsOrPermissionDeniedError,
//   postgrestTableUnavailableUserMessage,
// } from '@/lib/supabase/postgrest-errors';
// import { getServiceZone, isCityServed, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';
// import { dispatchOrder, sweepCustomerOrders } from '@/lib/dispatch';

// type PgErr = { message?: string; code?: string } | null;

// function dbErr(error: NonNullable<PgErr>, table: string, fallback: string) {
//   console.error(`[orders] ${table}:`, error);
//   const e = error as any;
//   if (isRlsOrPermissionDeniedError(e)) return jsonErr(error.message || 'Forbidden', 403);
//   if (isPostgrestTableUnavailableError(e)) {
//     return jsonErr(postgrestTableUnavailableUserMessage(e, `public.${table}`), 503);
//   }
//   return jsonErr(error.message || fallback, 502);
// }

// function toNum(v: unknown): number {
//   if (v === null || v === undefined || v === '') return NaN;
//   return Number(v);
// }

// const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
// const round2 = (n: number) => Math.round(n * 100) / 100;

// /** Add old field names so existing frontend code keeps working. */
// function withCompat(o: any) {
//   return {
//     ...o,
//     service_type_key: o.service_type ?? null,
//     can_quantity: o.can_count ?? null,
//     notes: o.note ?? null,
//     cancellation_reason: o.cancel_reason ?? null,
//     base_amount: o.base_amount ?? 0,
//     convenience_fee: o.convenience_fee ?? o.platform_fee ?? 0,
//     emergency_charge: o.emergency_charge ?? 0,
//     gst_amount: o.gst_amount ?? 0,
//     address_snapshot: o.address_snapshot ?? (o.address ? { house_flat: o.address } : null),
//   };
// }

// async function settingsMap(
//   sb: any
// ): Promise<{ ok: true; map: Record<string, string> } | { ok: false; message: string; status: number }> {
//   const { data, error } = await sb.from('settings').select('key, value');
//   if (error) {
//     console.error('[orders] settings:', error);
//     if (isRlsOrPermissionDeniedError(error)) {
//       return { ok: false, message: error.message || 'Forbidden', status: 403 };
//     }
//     if (isPostgrestTableUnavailableError(error)) {
//       return {
//         ok: false,
//         message: postgrestTableUnavailableUserMessage(error, 'public.settings'),
//         status: 503,
//       };
//     }
//     return { ok: false, message: error.message || 'Settings load failed', status: 502 };
//   }
//   return { ok: true, map: Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value])) };
// }

// async function safeNotify(
//   userId: string,
//   title: string,
//   body: string,
//   type: string,
//   orderId: string,
//   event: string
// ) {
//   try {
//     const { createNotification } = await import('@/lib/notifications');
//     await (createNotification as any)(userId, title, body, type, orderId, event);
//   } catch (e) {
//     console.error('[notifications]', event, e);
//   }
// }

// /** Tab names -> real order statuses */
// const TAB_STATUSES: Record<string, string[]> = {
//   active: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'],
//   completed: ['COMPLETED'],
//   cancelled: ['CANCELLED'],
// };

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   const customerId = auth.ctx.profile.id;

//   // Release timed-out offers and retry unassigned orders (no cron needed)
//   await sweepCustomerOrders(customerId);

//   const { searchParams } = new URL(req.url);
//   const status = (searchParams.get('status') ?? '').trim();
//   const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50') || 50, 1), 100);
//   const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

//   let q = auth.ctx.supabase
//     .from('orders')
//     .select('*')
//     .eq('customer_id', customerId)
//     .order('created_at', { ascending: false })
//     .range(offset, offset + limit - 1);

//   if (status) {
//     const key = status.toLowerCase();
//     const list = TAB_STATUSES[key] ?? status.split(',').map((s) => s.trim().toUpperCase());
//     q = q.in('status', list);
//   }

//   const { data, error } = await q;
//   if (error) return dbErr(error, 'orders', 'Orders load failed');

//   return jsonOk((data ?? []).map(withCompat));
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   let body: Record<string, unknown>;
//   try {
//     body = (await req.json()) as Record<string, unknown>;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   const service_type_key = typeof body.service_type_key === 'string' ? body.service_type_key : '';
//   const address_id = typeof body.address_id === 'string' ? body.address_id : '';
//   if (!service_type_key || !address_id) {
//     return jsonErr('service_type_key and address_id are required', 400);
//   }

//   const customerId = auth.ctx.profile.id;

//   const { data: st, error: stErr } = await auth.ctx.supabase
//     .from('service_types')
//     .select('id, key, label, base_price')
//     .eq('key', service_type_key)
//     .eq('is_active', true)
//     .maybeSingle();
//   if (stErr) return dbErr(stErr, 'service_types', 'Service lookup failed');
//   if (!st) return jsonErr('Invalid or inactive service', 400);

//   const { data: addr, error: aErr } = await auth.ctx.supabase
//     .from('addresses')
//     .select('*')
//     .eq('id', address_id)
//     .eq('customer_id', customerId)
//     .maybeSingle();
//   if (aErr) return dbErr(aErr, 'addresses', 'Address lookup failed');
//   if (!addr) return jsonErr('Address not found', 404);

//   const a = addr as Record<string, unknown>;
//   const addrLat = toNum(a.lat);
//   const addrLng = toNum(a.lng);
//   const inZone =
//     Number.isFinite(addrLat) && Number.isFinite(addrLng)
//       ? getServiceZone(addrLat, addrLng) !== null
//       : isCityServed(String(a.city ?? ''));
//   if (!inZone) return jsonErr(OUT_OF_ZONE_MESSAGE, 400);

//   const settingsResult = await settingsMap(auth.ctx.supabase);
//   if (!settingsResult.ok) return jsonErr(settingsResult.message, settingsResult.status);
//   const flat = settingsResult.map;

//   const gstRate = pickGstRateFromFlat(flat);
//   const convenience = Number(flat.convenience_fee ?? 29);
//   const emergencyFee = Number(flat.emergency_surcharge ?? 199);
//   const is_emergency = Boolean(body.is_emergency);
//   const emergency_charge = is_emergency ? emergencyFee : 0;

//   const isWater = service_type_key === 'water_can';
//   let qty: number | null = null;
//   let base_amount: number;

//   if (isWater) {
//     const subPrice = Number(flat.subscription_can_price);
//     const defPrice = Number(flat.default_can_price);
//     const unit =
//       str(body.can_order_type) === 'subscription' && Number.isFinite(subPrice) && subPrice > 0
//         ? subPrice
//         : Number.isFinite(defPrice)
//           ? defPrice
//           : Number((st as any).base_price) || 12;
//     qty = Math.min(
//       Math.max(1, Math.floor(Number(body.can_count ?? body.can_quantity ?? 1)) || 1),
//       500
//     );
//     base_amount = round2(qty * unit);
//   } else {
//     base_amount = Number(body.base_amount ?? 0);
//     if (!Number.isFinite(base_amount) || base_amount < 0) base_amount = Number((st as any).base_price);
//   }

//   const clientTotal = Number(body.total_amount);
//   if (!Number.isFinite(clientTotal)) return jsonErr('total_amount is required', 400);

//   if (!totalsMatch(clientTotal, base_amount, convenience, emergency_charge, gstRate, 3)) {
//     return jsonErr('Price validation failed — totals do not match platform rates', 400);
//   }

//   const { gst: gst_amount } = computeExpectedTotal(base_amount, convenience, emergency_charge, gstRate);

//   const address_snapshot = {
//     label: a.label ?? null,
//     house_flat: a.house_flat ?? a.line1 ?? null,
//     area: a.area ?? a.line2 ?? null,
//     landmark: a.landmark ?? null,
//     city: a.city ?? null,
//     state: a.state ?? null,
//     pincode: a.pincode ?? null,
//     lat: Number.isFinite(addrLat) ? addrLat : null,
//     lng: Number.isFinite(addrLng) ? addrLng : null,
//   };

//   const addressText = [a.house_flat ?? a.line1, a.area ?? a.line2, a.landmark, a.city, a.state, a.pincode]
//     .filter((x) => typeof x === 'string' && x.trim())
//     .join(', ');

//   let scheduledAt: string | null = null;
//   const stRaw = str(body.scheduled_time);
//   const sdRaw = str(body.scheduled_date);
//   if (stRaw && !Number.isNaN(new Date(stRaw).getTime())) {
//     scheduledAt = new Date(stRaw).toISOString();
//   } else if (sdRaw && !Number.isNaN(new Date(`${sdRaw}T00:00:00+05:30`).getTime())) {
//     scheduledAt = new Date(`${sdRaw}T00:00:00+05:30`).toISOString();
//   }

//   const noteParts = [
//     str(body.notes),
//     str(body.time_slot) ? `Slot: ${str(body.time_slot)}` : null,
//     str(body.sub_option_key) ? `Option: ${str(body.sub_option_key)}` : null,
//     str(body.can_order_type) ? `Type: ${str(body.can_order_type)}` : null,
//     str(body.can_frequency) ? `Frequency: ${str(body.can_frequency)}` : null,
//   ].filter(Boolean);

//   const total = round2(clientTotal);

//   const { data: order, error: oErr } = await auth.ctx.supabase
//     .from('orders')
//     .insert({
//       customer_id: customerId,
//       service_type: service_type_key,
//       status: 'PENDING',
//       can_count: qty,
//       total_amount: total,
//       platform_fee: convenience,
//       final_amount: total,
//       base_amount,
//       convenience_fee: convenience,
//       emergency_charge,
//       gst_amount,
//       address_snapshot,
//       payment_status: 'pending',
//       payment_method: str(body.payment_method) ?? 'cash',
//       address: addressText || null,
//       address_id: (addr as any).id,
//       is_emergency,
//       note: noteParts.length ? noteParts.join(' | ') : null,
//       scheduled_at: scheduledAt,
//     })
//     .select('*')
//     .single();

//   if (oErr || !order) {
//     if (oErr) return dbErr(oErr, 'orders', 'Failed to create order');
//     return jsonErr('Failed to create order', 500);
//   }

//   const orderId = String((order as any).id);
//   const label =
//     typeof (st as any).label === 'string' && (st as any).label.trim()
//       ? (st as any).label
//       : service_type_key.replace(/_/g, ' ');
//   const slotText = `${sdRaw ?? 'your slot'}${str(body.time_slot) ? ` · ${str(body.time_slot)}` : ''}`;

//   // The dispatch engine assigns the supplier and notifies them itself
//   let supplierId: string | null = null;
//   if (isWater) {
//     const result = await dispatchOrder(orderId);
//     supplierId = result.supplierId;
//     if (supplierId) {
//       (order as any).supplier_id = supplierId;
//       (order as any).status = 'ASSIGNED';
//     }
//   }

//   await safeNotify(
//     customerId,
//     isWater ? 'Order placed successfully' : 'Booking Confirmed 🎉',
//     `Your ${label} is booked for ${slotText}.`,
//     'booking',
//     orderId,
//     'created'
//   );

//   const out = withCompat(order);
//   return jsonOk(isWater && !supplierId ? { ...out, supplier_status: 'searching' } : out, 201);
// }



