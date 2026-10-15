import { NextRequest, NextResponse } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { computeExpectedTotal, totalsMatch } from '@/lib/api/order-pricing-server';
import {
  requireAdmin,
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';
import {
  isPostgrestTableUnavailableError,
  isRlsOrPermissionDeniedError,
  postgrestTableUnavailableUserMessage,
} from '@/lib/supabase/postgrest-errors';
import { resolveServiceability } from '@/lib/zones';
import { resolveAddressLocation, healAddressLocation } from '@/lib/address-geo.server';
import { MIN_QUALITY_FOR_WATER, isValidCoord } from '@/lib/address-geo';
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

  // This endpoint is for administrators only.
  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { searchParams } = new URL(req.url);

  const rawLimit = Number(searchParams.get('limit') ?? 50);
  const rawOffset = Number(searchParams.get('offset') ?? 0);

  const limit = Number.isInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, 200)
    : 50;

  const offset = Number.isInteger(rawOffset) && rawOffset >= 0
    ? rawOffset
    : 0;

  const status = searchParams.get('status')?.trim().toUpperCase();
  const paymentStatus = searchParams
    .get('payment_status')
    ?.trim()
    .toLowerCase();
  const service = searchParams.get('service')?.trim();
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const sortAscending = searchParams.get('sort') === 'asc';

  const validStatuses = new Set([
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
  ]);

  const validPaymentStatuses = new Set([
    'unpaid',
    'paid',
    'refunded',
  ]);

  if (status && status !== 'ALL' && !validStatuses.has(status)) {
    return jsonErr('Invalid order status', 400);
  }

  if (
    paymentStatus &&
    !validPaymentStatuses.has(paymentStatus)
  ) {
    return jsonErr('Invalid payment status', 400);
  }

  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;

  if (fromRaw && (!from || Number.isNaN(from.getTime()))) {
    return jsonErr('Invalid from date', 400);
  }

  if (toRaw && (!to || Number.isNaN(to.getTime()))) {
    return jsonErr('Invalid to date', 400);
  }

  if (from && to && from > to) {
    return jsonErr('"from" must be before "to"', 400);
  }

  const sb = auth.ctx.supabase;

  let query = sb
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: sortAscending })
    .order('id', { ascending: sortAscending });

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  if (paymentStatus) {
    query = query.eq('payment_status', paymentStatus);
  }

  if (service) {
    query = query.eq('service_type', service);
  }

  if (from) {
    query = query.gte('created_at', from.toISOString());
  }

  if (to) {
    query = query.lte('created_at', to.toISOString());
  }

  const {
    data: orders,
    error,
    count,
  } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('[admin/orders] Failed to fetch orders:', error.message);
    return jsonErr('Failed to fetch orders', 502);
  }

  const rows = orders ?? [];

  // Fetch related profiles separately to avoid depending on
  // PostgREST foreign-key relationship names.
  const profileIds = [
    ...new Set(
      rows.flatMap((order) =>
        [order.customer_id, order.technician_id]
          .filter(
            (id): id is string =>
              typeof id === 'string' && id.length > 0,
          ),
      ),
    ),
  ];

  const profileMap = new Map<
    string,
    { full_name: string | null; phone: string | null }
  >();

  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await sb
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', profileIds);

    if (profileError) {
      console.error(
        '[admin/orders] Failed to fetch profiles:',
        profileError.message,
      );
      return jsonErr('Failed to fetch order contact details', 502);
    }

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, {
        full_name: profile.full_name ?? null,
        phone: profile.phone ?? null,
      });
    }
  }

  const enrichedOrders = rows.map((order) => {
    const customer =
      typeof order.customer_id === 'string'
        ? profileMap.get(order.customer_id)
        : undefined;

    const technician =
      typeof order.technician_id === 'string'
        ? profileMap.get(order.technician_id)
        : undefined;

    return {
      ...order,
      customer_name: customer?.full_name ?? null,
      customer_phone: customer?.phone ?? null,
      technician_name: technician?.full_name ?? null,
      technician_phone: technician?.phone ?? null,
    };
  });

  const total = count ?? 0;
  const hasMore = offset + rows.length < total;

  const response = NextResponse.json({
  ok: true,
  data: enrichedOrders,
  meta: {
    total,
    limit,
    offset,
    next_cursor: hasMore ? String(offset + rows.length) : null,
    has_more: hasMore,
  },
});


response.headers.set('X-Total-Count', String(total));
response.headers.set('Cache-Control', 'private, no-store');

return response;
}

//   const response = jsonOk({

//     ok: true,
//     data: enrichedOrders,
//     meta: {
//       total,
//       limit,
//       offset,
//       next_cursor: hasMore ? String(offset + rows.length) : null,
//       has_more: hasMore,
//     },
//   });

//   response.headers.set('X-Total-Count', String(total));
//   response.headers.set('Cache-Control', 'private, no-store');

//   return response;
// }

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   const { searchParams } = new URL(req.url);
//   const status = searchParams.get('status') ?? undefined;
//   const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '20') || 20, 1), 100);
//   const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

//   // Keep the history endpoint read-only and fast.
//   // Dispatch maintenance must not block customer page rendering.
//   // Supplier dispatch continues through the order/dispatch workflow.

//   let q = auth.ctx.supabase
//     .from('orders')
//     .select(
//       [
//         'id',
//         'order_number',
//         'status',
//         'customer_id',
//         'supplier_id',
//         'service_type',
//         'can_count',
//         'total_amount',
//         'payment_method',
//         'payment_status',
//         'address',
//         'address_id',
//         'address_snapshot',
//         'scheduled_at',
//         'note',
//         'rating',
//         'subscription_id',
//         'can_order_type',
//         'can_frequency',
//         'can_price_per_unit',
//         'created_at',
//         'updated_at',
//       ].join(', ')
//     )
//     .eq('customer_id', auth.ctx.profile.id)
//     .order('created_at', { ascending: false })
//     .range(offset, offset + limit - 1);

//   if (status) {
//     const list = status
//       .split(',')
//       .map((x) => x.trim().toUpperCase())
//       .filter(Boolean);
//     if (list.length > 1) q = q.in('status', list);
//     else if (list.length === 1) q = q.eq('status', list[0]);
//   }

//   const { data, error } = await q;
//   if (error) return dbErr(error, 'orders', 'Orders load failed');

//   return jsonOk((data ?? []).map(withCompat));
// }

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

  // Best available point: saved GPS/pin first, then the pincode area.
  const geo = await resolveAddressLocation(a);

  if (service_type_key === 'water_can' && (!geo.ok || geo.quality < MIN_QUALITY_FOR_WATER)) {
    return jsonErr(
      'Please save this delivery address with a valid map location before ordering water.',
      400,
      'DELIVERY_LOCATION_REQUIRED'
    );
  }

  const addrLat = geo.ok ? geo.lat : NaN;
  const addrLng = geo.ok ? geo.lng : NaN;
  const geoSource = geo.ok ? geo.source : null;

  // Zone rules always receive valid coordinates now
  const serviceability = await resolveServiceability(
    geo.ok ? { ...a, lat: geo.lat, lng: geo.lng } : a,
    service_type_key
  );

  if (!serviceability.serviceable) {
    return jsonErr(serviceability.message, 400);
  }

  // Self-heal: remember the derived point so this address works everywhere next time
  if (geo.ok && geo.quality >= MIN_QUALITY_FOR_WATER && !isValidCoord(a.lat, a.lng)) {
    void healAddressLocation(String(addr.id), customerId, geo);
  }

  const settingsResult = await settingsMap(auth.ctx.supabase);
  if (!settingsResult.ok) return jsonErr(settingsResult.message, settingsResult.status);
  const flat = settingsResult.map;

  const { data: activePricingRow, error: activePricingError } = await auth.ctx.supabase
    .from('pricing_versions').select('version, effective_from, config')
    .lte('effective_from', new Date().toISOString())
    .order('effective_from', { ascending: false }).order('version', { ascending: false })
    .limit(1).maybeSingle();
  const activePricingConfig = activePricingRow?.config && typeof activePricingRow.config === 'object'
    ? activePricingRow.config as Record<string, unknown> : null;
  const activeServicePrices = activePricingConfig?.services && typeof activePricingConfig.services === 'object'
    ? activePricingConfig.services as Record<string, unknown> : {};
  if (activePricingError && !['42P01', 'PGRST205'].includes(String((activePricingError as { code?: string }).code ?? ''))) {
    console.error('[admin/orders] active pricing lookup failed', activePricingError);
    return jsonErr('Pricing is temporarily unavailable. Please retry shortly.', 503);
  }

  const gstCandidate = Number(activePricingConfig?.gst_rate ?? 0);
  const gstRate = Number.isFinite(gstCandidate) && gstCandidate >= 0 && gstCandidate <= 1 ? gstCandidate : 0;
  const convenience = service_type_key === 'water_can' ? 0 : Number(activePricingConfig?.convenience_fee ?? flat.convenience_fee ?? 10);
  const emergencyFee = Number(activePricingConfig?.emergency_surcharge ?? flat.emergency_surcharge ?? 30);
  const is_emergency = Boolean(body.is_emergency);
  const emergency_charge = is_emergency ? emergencyFee : 0;

  const isWater = service_type_key === 'water_can';
  const isSubscription = str(body.can_order_type) === 'subscription';
  let qty: number | null = null;
  let base_amount: number;

  let waterUnitPrice: number | null = null;
  let subscriptionFrequency: string | null = null;

  if (isWater) {
    const bulkThreshold = Math.max(1, Math.floor(Number(activePricingConfig?.bulk_threshold ?? flat.bulk_threshold)) || 50);
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

    // Approved launch prices: Normal RO ₹20 and Chilled RO ₹25.
    // Recurring Normal RO uses the same ₹20 unit price; no hidden legacy discount.
    const regularPrice = Number(activePricingConfig?.water_normal ?? 20);
    const chilledPrice = Number(activePricingConfig?.water_chilled ?? 25);
    const subscriptionPrice = Number(activePricingConfig?.water_subscription ?? regularPrice);
    const bulkPrice = Number(activePricingConfig?.bulk_can_price ?? flat.bulk_can_price ?? regularPrice);
    const unitPrice = isSubscription ? subscriptionPrice : isChilled ? chilledPrice : qty >= bulkThreshold ? bulkPrice : regularPrice;
    if (![regularPrice, chilledPrice, subscriptionPrice].every((price) => Number.isFinite(price) && price > 0)) return jsonErr('Water pricing configuration is invalid.', 503);
    waterUnitPrice = unitPrice;

    base_amount = round2(qty * waterUnitPrice);
    subscriptionFrequency = isSubscription ? String(body.can_frequency) : null;
  } else {
    // Never trust a client-supplied base amount. Resolve the canonical service
    // rate from server settings, then apply only known option adjustments.
    const configuredPrice = Number(activeServicePrices[service_type_key] ?? flat[service_type_key + '_price']);
    const plumberType = str(body.plumber_type) ?? 'labour';
    if (service_type_key === 'plumbing' && !['labour', 'mistri'].includes(plumberType)) {
      return jsonErr('Choose a valid plumber charge type.', 400);
    }
    // Plumbing prices MUST match PLUMBER_PRICES in BookingWizard.tsx (labour 149, mistri 700).
    const serviceBase = service_type_key === 'plumbing'
      ? (plumberType === 'mistri' ? Number(activeServicePrices.plumbing_mistri ?? 700) : Number(activeServicePrices.plumbing ?? 149))
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
    return jsonErr('Pricing changed since this checkout opened. Refresh and review the updated total before placing the order.', 400, 'PRICE_CHANGED');
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
    geo_source: geoSource,
    location_warning: geo.ok ? geo.warning : null,
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
      ...(activePricingRow ? {
        pricing_version: Number(activePricingRow.version),
        pricing_snapshot: {
          currency: 'INR', version: Number(activePricingRow.version), effective_from: activePricingRow.effective_from,
          service_type: service_type_key, option_key: str(body.sub_option_key), quantity: qty, unit_price: waterUnitPrice,
          base_amount, convenience_fee: convenience, emergency_charge, gst_rate: gstRate, gst_amount, total_amount: total,
          supplier_entitlement: isWater && qty === 1 && total === 20 ? 20 : null,
          supplier_entitlement_policy: isWater ? 'existing_completion_policy_auto_posts_only_single_can_total_20; other_water_orders_require_approved_payout_schedule' : 'existing_completion_policy',
          config: activePricingConfig,
        },
      } : {}),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // A subscription keeps the exact pricing contract from its first order.
        pricing_version: activePricingRow ? Number(activePricingRow.version) : null,
        pricing_snapshot: activePricingRow
          ? ((order as Record<string, unknown>).pricing_snapshot ?? null)
          : null,
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










// /**
//  * GET /api/admin/orders
//  *
//  * Admin-only order listing endpoint.
//  *
//  * Features:
//  * - Status whitelist
//  * - ISO date validation
//  * - DB-level service filter
//  * - Offset pagination
//  * - Cursor pagination
//  * - Stable cursor ordering using created_at + id
//  * - X-Total-Count response header
//  * - Supabase FK joins normalized from arrays
//  */

// import { NextRequest, NextResponse } from 'next/server';
// import { jsonErr } from '@/lib/api/json-response';
// import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

// const VALID_PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'refunded']);

// const VALID_STATUSES = new Set([
//   'PENDING',
//   'ASSIGNED',
//   'IN_PROGRESS',
//   'COMPLETED',
//   'CANCELLED',
//   'FAILED',
// ]);

// const MAX_LIMIT = 200;
// const DEFAULT_LIMIT = 50;

// interface OrderRow {
//   id: string;
//   status: string;
//   total_amount: number | null;
//   platform_fee: number | null;
//   created_at: string;
//   updated_at: string | null;
//   service_type: string | null;
//   address: string | null;
//   is_emergency: boolean | null;
//   customer_id: string | null;
//   technician_id: string | null;
//   payment_status: string | null;
//   customer_name: string | null;
//   technician_name: string | null;
// }

// interface RawOrderRow {
//   id: unknown;
//   status: unknown;
//   total_amount: unknown;
//   platform_fee: unknown;
//   created_at: unknown;
//   updated_at: unknown;
//   service_type: unknown;
//   address: unknown;
//   is_emergency: unknown;
//   customer_id: unknown;
//   technician_id: unknown;
//   payment_status: unknown;
//   customer: Array<{ full_name: string }> | null;
//   technician: Array<{ full_name: string }> | null;
// }

// function parsePositiveInt(raw: string | null, fallback: number): number {
//   if (!raw) return fallback;

//   const n = Number(raw);

//   if (!Number.isInteger(n) || n < 0) {
//     return fallback;
//   }

//   return n;
// }

// function parseLimit(raw: string | null): number {
//   if (!raw) return DEFAULT_LIMIT;

//   const n = Number(raw);

//   if (!Number.isInteger(n) || n < 1) {
//     return DEFAULT_LIMIT;
//   }

//   return Math.min(n, MAX_LIMIT);
// }

// function parseISODate(raw: string | null): string | null {
//   if (!raw) return null;

//   const d = new Date(raw);

//   if (Number.isNaN(d.getTime())) {
//     return null;
//   }

//   return d.toISOString();
// }

// /**
//  * Cursor format:
//  *   created_at|id
//  *
//  * Both values are encoded with encodeURIComponent so timestamps/UUIDs
//  * remain safe inside a query parameter.
//  */
// function parseCursor(raw: string | null): { createdAt: string; id: string } | null {
//   if (!raw) return null;

//   const separator = raw.lastIndexOf('|');

//   if (separator <= 0 || separator === raw.length - 1) {
//     return null;
//   }

//   const createdAt = raw.slice(0, separator);
//   const id = raw.slice(separator + 1);

//   const parsedDate = new Date(createdAt);

//   if (Number.isNaN(parsedDate.getTime()) || !id.trim()) {
//     return null;
//   }

//   return {
//     createdAt: parsedDate.toISOString(),
//     id: id.trim(),
//   };
// }

// function encodeCursor(createdAt: string, id: string): string {
//   return `${createdAt}|${id}`;
// }

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);

//   if (!auth.ok) return auth.response;

//   if (!requireAdmin(auth.ctx)) {
//     return jsonErr('Forbidden', 403);
//   }

//   const sp = new URL(req.url).searchParams;

//   const status = sp.get('status')?.toUpperCase() ?? undefined;
//   const paymentStatus = sp.get('payment_status')?.toLowerCase() ?? undefined;
//   const service = sp.get('service')?.trim() || undefined;
//   const sortAscending = sp.get('sort') === 'asc';

//   const limit = parseLimit(sp.get('limit'));
//   const offset = parsePositiveInt(sp.get('offset'), 0);

//   const cursorRaw = sp.get('cursor');
//   const cursor = parseCursor(cursorRaw);

//   const fromRaw = sp.get('from');
//   const toRaw = sp.get('to');

//   const from = parseISODate(fromRaw);
//   const to = parseISODate(toRaw);

//   if (paymentStatus && !VALID_PAYMENT_STATUSES.has(paymentStatus)) {
//     return jsonErr(
//       `Invalid payment_status "${paymentStatus}". Allowed: ${[...VALID_PAYMENT_STATUSES].join(', ')}`,
//       400,
//     );
//   }

//   if (status && !VALID_STATUSES.has(status)) {
//     return jsonErr(
//       `Invalid status "${status}". Allowed: ${[...VALID_STATUSES].join(', ')}`,
//       400,
//     );
//   }

//   if (fromRaw && !from) {
//     return jsonErr('Invalid "from" date — use ISO 8601', 400);
//   }

//   if (toRaw && !to) {
//     return jsonErr('Invalid "to" date — use ISO 8601', 400);
//   }

//   if (from && to && from > to) {
//     return jsonErr('"from" must be before "to"', 400);
//   }

//   if (cursorRaw && !cursor) {
//     return jsonErr('Invalid "cursor"', 400);
//   }

//   const sb = auth.ctx.supabase;

//   let q = sb
//     .from('orders')
//     .select(
//       `
//       id,
//       status,
//       total_amount,
//       platform_fee,
//       created_at,
//       updated_at,
//       service_type,
//       address,
//       is_emergency,
//       customer_id,
//       technician_id,
//       payment_status,
//       customer:profiles!orders_customer_id_fkey ( full_name ),
//       technician:profiles!orders_technician_id_fkey ( full_name )
//       `,
//       { count: 'exact' },
//     )
//     .order('created_at', { ascending: sortAscending })
//     .order('id', { ascending: sortAscending });

//   if (status) {
//     q = q.eq('status', status);
//   }

//   if (paymentStatus) {
//     q = q.eq('payment_status', paymentStatus);
//   }

//   if (service) {
//     q = q.eq('service_type', service);
//   }

//   if (from) {
//     q = q.gte('created_at', from);
//   }

//   if (to) {
//     q = q.lte('created_at', to);
//   }

//   /*
//    * Cursor pagination uses a stable composite key:
//    *
//    * ASC: (created_at > cursorDate)
//    *   OR (created_at = cursorDate AND id > cursorId)
//    *
//    * DESC:
//    *   OR (created_at = cursorDate AND id < cursorId)
//    *
//    * This prevents duplicate/skipped rows when several orders share
//    * the same created_at timestamp.
//    */
//   if (cursor) {
//     const comparison = sortAscending ? 'gt' : 'lt';
//     const idComparison = sortAscending ? 'gt' : 'lt';

//     q = q.or(
//       `created_at.${comparison}.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.${idComparison}.${cursor.id})`,
//     );

//     q = q.limit(limit);
//   } else {
//     q = q.range(offset, offset + limit - 1);
//   }

//   const { data: raw, error, count } = await q;

//   if (error) {
//     return jsonErr(error.message, 502);
//   }

//   const orders: OrderRow[] = (raw ?? []).map((r) => {
//     const row = r as unknown as RawOrderRow;

//     return {
//       id: String(row.id ?? ''),
//       status: String(row.status ?? ''),
//       total_amount:
//         row.total_amount != null ? Number(row.total_amount) : null,
//       platform_fee:
//         row.platform_fee != null ? Number(row.platform_fee) : null,
//       created_at: String(row.created_at ?? ''),
//       updated_at:
//         row.updated_at != null ? String(row.updated_at) : null,
//       service_type:
//         row.service_type != null ? String(row.service_type) : null,
//       address: row.address != null ? String(row.address) : null,
//       is_emergency:
//         row.is_emergency != null ? Boolean(row.is_emergency) : null,
//       customer_id:
//         row.customer_id != null ? String(row.customer_id) : null,
//       technician_id:
//         row.technician_id != null ? String(row.technician_id) : null,
//       payment_status:
//         row.payment_status != null ? String(row.payment_status) : null,
//       customer_name: row.customer?.[0]?.full_name ?? null,
//       technician_name: row.technician?.[0]?.full_name ?? null,
//     };
//   });

//   const lastOrder = orders[orders.length - 1];

//   const nextCursor =
//     orders.length === limit && lastOrder
//       ? encodeCursor(lastOrder.created_at, lastOrder.id)
//       : null;

//   return NextResponse.json(
//     {
//       ok: true,
//       data: orders,
//       meta: {
//         total: count ?? 0,
//         limit,
//         offset: cursor ? null : offset,
//         next_cursor: nextCursor,
//         has_more: orders.length === limit,
//       },
//     },
//     {
//       status: 200,
//       headers: {
//         'X-Total-Count': String(count ?? 0),
//         'Cache-Control': 'private, no-store',
//       },
//     },
//   );
// }
