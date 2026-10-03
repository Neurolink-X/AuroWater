/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { getServiceZone, isCityServed, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';
import { dispatchOrder, sweepCustomerOrders } from '@/lib/dispatch';

type PgErr = { message?: string; code?: string } | null;

function dbErr(error: NonNullable<PgErr>, table: string, fallback: string) {
  console.error(`[orders] ${table}:`, error);
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

/** Add old field names so existing frontend code keeps working. */
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
  };
}

async function settingsMap(
  sb: any
): Promise<{ ok: true; map: Record<string, string> } | { ok: false; message: string; status: number }> {
  const { data, error } = await sb.from('settings').select('key, value');
  if (error) {
    console.error('[orders] settings:', error);
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
  return { ok: true, map: Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value])) };
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
    await (createNotification as any)(userId, title, body, type, orderId, event);
  } catch (e) {
    console.error('[notifications]', event, e);
  }
}

/** Tab names -> real order statuses */
const TAB_STATUSES: Record<string, string[]> = {
  active: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED'],
};

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const customerId = auth.ctx.profile.id;

  // Release timed-out offers and retry unassigned orders (no cron needed)
  await sweepCustomerOrders(customerId);

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') ?? '').trim();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50') || 50, 1), 100);
  const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

  let q = auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    const key = status.toLowerCase();
    const list = TAB_STATUSES[key] ?? status.split(',').map((s) => s.trim().toUpperCase());
    q = q.in('status', list);
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
  const inZone =
    Number.isFinite(addrLat) && Number.isFinite(addrLng)
      ? getServiceZone(addrLat, addrLng) !== null
      : isCityServed(String(a.city ?? ''));
  if (!inZone) return jsonErr(OUT_OF_ZONE_MESSAGE, 400);

  const settingsResult = await settingsMap(auth.ctx.supabase);
  if (!settingsResult.ok) return jsonErr(settingsResult.message, settingsResult.status);
  const flat = settingsResult.map;

  const gstRate = pickGstRateFromFlat(flat);
  const convenience = Number(flat.convenience_fee ?? 29);
  const emergencyFee = Number(flat.emergency_surcharge ?? 199);
  const is_emergency = Boolean(body.is_emergency);
  const emergency_charge = is_emergency ? emergencyFee : 0;

  const isWater = service_type_key === 'water_can';
  let qty: number | null = null;
  let base_amount: number;

  if (isWater) {
    const subPrice = Number(flat.subscription_can_price);
    const defPrice = Number(flat.default_can_price);
    const unit =
      str(body.can_order_type) === 'subscription' && Number.isFinite(subPrice) && subPrice > 0
        ? subPrice
        : Number.isFinite(defPrice)
          ? defPrice
          : Number((st as any).base_price) || 12;
    qty = Math.min(
      Math.max(1, Math.floor(Number(body.can_count ?? body.can_quantity ?? 1)) || 1),
      500
    );
    base_amount = round2(qty * unit);
  } else {
    base_amount = Number(body.base_amount ?? 0);
    if (!Number.isFinite(base_amount) || base_amount < 0) base_amount = Number((st as any).base_price);
  }

  const clientTotal = Number(body.total_amount);
  if (!Number.isFinite(clientTotal)) return jsonErr('total_amount is required', 400);

  if (!totalsMatch(clientTotal, base_amount, convenience, emergency_charge, gstRate, 3)) {
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

  let scheduledAt: string | null = null;
  const stRaw = str(body.scheduled_time);
  const sdRaw = str(body.scheduled_date);
  if (stRaw && !Number.isNaN(new Date(stRaw).getTime())) {
    scheduledAt = new Date(stRaw).toISOString();
  } else if (sdRaw && !Number.isNaN(new Date(`${sdRaw}T00:00:00+05:30`).getTime())) {
    scheduledAt = new Date(`${sdRaw}T00:00:00+05:30`).toISOString();
  }

  const noteParts = [
    str(body.notes),
    str(body.time_slot) ? `Slot: ${str(body.time_slot)}` : null,
    str(body.sub_option_key) ? `Option: ${str(body.sub_option_key)}` : null,
    str(body.can_order_type) ? `Type: ${str(body.can_order_type)}` : null,
    str(body.can_frequency) ? `Frequency: ${str(body.can_frequency)}` : null,
  ].filter(Boolean);

  const total = round2(clientTotal);

  const { data: order, error: oErr } = await auth.ctx.supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      service_type: service_type_key,
      status: 'PENDING',
      can_count: qty,
      total_amount: total,
      platform_fee: convenience,
      final_amount: total,
      base_amount,
      convenience_fee: convenience,
      emergency_charge,
      gst_amount,
      address_snapshot,
      payment_status: 'pending',
      payment_method: str(body.payment_method) ?? 'cash',
      address: addressText || null,
      address_id: (addr as any).id,
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

  const orderId = String((order as any).id);
  const label =
    typeof (st as any).label === 'string' && (st as any).label.trim()
      ? (st as any).label
      : service_type_key.replace(/_/g, ' ');
  const slotText = `${sdRaw ?? 'your slot'}${str(body.time_slot) ? ` · ${str(body.time_slot)}` : ''}`;

  // The dispatch engine assigns the supplier and notifies them itself
  let supplierId: string | null = null;
  if (isWater) {
    const result = await dispatchOrder(orderId);
    supplierId = result.supplierId;
    if (supplierId) {
      (order as any).supplier_id = supplierId;
      (order as any).status = 'ASSIGNED';
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

  const out = withCompat(order);
  return jsonOk(isWater && !supplierId ? { ...out, supplier_status: 'searching' } : out, 201);
}



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
// import { createServiceClient } from '@/utils/supabase/server';
// import { getServiceZone, isCityServed, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';

// /*
//  * Real `orders` columns used here:
//  * customer_id, supplier_id, service_type, status, can_count, total_amount,
//  * platform_fee, payment_status, payment_method, address, address_id,
//  * is_emergency, note, scheduled_at, final_amount, assigned_at
//  */

// type PgErr = { message?: string; code?: string } | null;

// function dbErr(error: NonNullable<PgErr>, table: string, fallback: string) {
//   console.error(`[orders] ${table}:`, error);
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
//   sb: ReturnType<typeof import('@/lib/db/supabase').createSupabaseUserClient>
// ): Promise<
//   | { ok: true; map: Record<string, string> }
//   | { ok: false; message: string; status: number }
// > {
//   const { data, error } = await sb.from('settings').select('key, value');
//   if (error) {
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     const e = error as any;
//     console.error('[orders] settings:', error);
//     if (isRlsOrPermissionDeniedError(e)) {
//       return { ok: false, message: error.message || 'Forbidden', status: 403 };
//     }
//     if (isPostgrestTableUnavailableError(e)) {
//       return {
//         ok: false,
//         message: postgrestTableUnavailableUserMessage(e, 'public.settings'),
//         status: 503,
//       };
//     }
//     return { ok: false, message: error.message || 'Settings load failed', status: 502 };
//   }
//   return {
//     ok: true,
//     map: Object.fromEntries((data ?? []).map((r) => [r.key, r.value])),
//   };
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
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     await (createNotification as any)(userId, title, body, type, orderId, event);
//   } catch (e) {
//     console.error('[notifications]', event, e);
//   }
// }

// const TIER_RANK: Record<string, number> = {
//   starter: 0,
//   bronze: 1,
//   silver: 2,
//   gold: 3,
//   platinum: 4,
// };

// /** Supplier routing on the service client (customers can't read other suppliers under RLS). */
// async function assignSupplier(orderId: string, customerId: string): Promise<string | null> {
//   try {
//     const admin = createServiceClient();
//     let supplierId: string | null = null;

//     const { data: last } = await admin
//       .from('orders')
//       .select('supplier_id')
//       .eq('customer_id', customerId)
//       .eq('status', 'COMPLETED')
//       .not('supplier_id', 'is', null)
//       .order('created_at', { ascending: false })
//       .limit(1)
//       .maybeSingle();

//     const preferred = (last as { supplier_id: string | null } | null)?.supplier_id ?? null;
//     if (preferred) {
//       const { data: ps } = await admin
//         .from('supplier_settings')
//         .select('user_id, is_online')
//         .eq('user_id', preferred)
//         .maybeSingle();
//       if ((ps as { is_online?: boolean } | null)?.is_online) supplierId = preferred;
//     }

//     if (!supplierId) {
//       const { data: online } = await admin
//         .from('supplier_settings')
//         .select('user_id, zone_radius_km')
//         .eq('is_online', true)
//         .limit(200);

//       const rows = (online ?? []) as { user_id: string; zone_radius_km: number | null }[];
//       const ids = rows.map((r) => String(r.user_id)).filter(Boolean);

//       if (ids.length) {
//         const { data: tiers } = await admin
//           .from('profiles')
//           .select('id, milestone_tier')
//           .in('id', ids);

//         const tierById = new Map(
//           ((tiers ?? []) as { id: string; milestone_tier: string | null }[]).map((r) => [
//             String(r.id),
//             String(r.milestone_tier ?? 'starter'),
//           ])
//         );

//         const best = rows
//           .map((r) => ({
//             id: String(r.user_id),
//             tier: tierById.get(String(r.user_id)) ?? 'starter',
//             radius: Number(r.zone_radius_km ?? 5),
//           }))
//           .filter((c) => c.radius > 0)
//           .sort(
//             (a, b) =>
//               (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0) || b.radius - a.radius
//           )[0];

//         supplierId = best?.id ?? null;
//       }
//     }

//     if (supplierId) {
//       const { data: updated, error } = await admin
//         .from('orders')
//         .update({
//           supplier_id: supplierId,
//           status: 'ASSIGNED',
//           assigned_at: new Date().toISOString(),
//         })
//         .eq('id', orderId)
//         .eq('status', 'PENDING')
//         .select('id')
//         .maybeSingle();
//       if (error || !updated) {
//         if (error) console.error('[orders] assign update:', error);
//         return null;
//       }
//       return supplierId;
//     }

//     const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin').limit(20);
//     for (const a of (admins ?? []) as { id?: string }[]) {
//       if (!a.id) continue;
//       await admin.from('notifications').insert({
//         user_id: a.id,
//         title: 'Unassigned order',
//         body: `Unassigned order ${orderId} — no supplier available`,
//         type: 'system',
//         order_id: orderId,
//         is_read: false,
//         dedup_key: `order_${orderId}_no_supplier`,
//       });
//     }
//     await admin.from('audit_logs').insert({
//       actor_id: null,
//       action: 'order.no_supplier',
//       entity: 'orders',
//       entity_id: orderId,
//       meta: {},
//     });
//     return null;
//   } catch (e) {
//     console.error('[orders] supplier routing failed:', e);
//     return null;
//   }
// }

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   const { searchParams } = new URL(req.url);
//   const status = searchParams.get('status') ?? undefined;
//   const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '20') || 20, 1), 100);
//   const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

//   let q = auth.ctx.supabase
//     .from('orders')
//     .select('*')
//     .eq('customer_id', auth.ctx.profile.id)
//     .order('created_at', { ascending: false })
//     .range(offset, offset + limit - 1);

//   if (status) q = q.eq('status', status);

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

//   // service_types has: id, key, label, description, base_price, is_active
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

//   // ── Pricing (same formula the booking page shows the customer) ──
//   const gstRate = pickGstRateFromFlat(flat);
//   const convenience = Number(flat.convenience_fee ?? 29);
//   const emergencyFee = Number(flat.emergency_surcharge ?? 199);
//   const is_emergency = Boolean(body.is_emergency);
//   const emergency_charge = is_emergency ? emergencyFee : 0;

//   const isWater = service_type_key === 'water_can';
//   let qty: number | null = null;
//   let base_amount: number;

//   if (isWater) {
//     // Subscription cans use their own price (same rule as the booking page)
//     const subPrice = Number(flat.subscription_can_price);
//     const defPrice = Number(flat.default_can_price);
//     const unit =
//       str(body.can_order_type) === 'subscription' && Number.isFinite(subPrice) && subPrice > 0
//         ? subPrice
//         : Number.isFinite(defPrice)
//           ? defPrice
//           : Number(st.base_price) || 12;
//     qty = Math.min(
//       Math.max(1, Math.floor(Number(body.can_count ?? body.can_quantity ?? 1)) || 1),
//       500
//     );
//     base_amount = round2(qty * unit);
//   } else {
//     base_amount = Number(body.base_amount ?? 0);
//     if (!Number.isFinite(base_amount) || base_amount < 0) base_amount = Number(st.base_price);
//   }

//   const clientTotal = Number(body.total_amount);
//   if (!Number.isFinite(clientTotal)) return jsonErr('total_amount is required', 400);

//   if (!totalsMatch(clientTotal, base_amount, convenience, emergency_charge, gstRate, 3)) {
//     const expected = computeExpectedTotal(base_amount, convenience, emergency_charge, gstRate);
//     console.error('[orders] price mismatch', { clientTotal, base_amount, convenience, gstRate, expected });
//     return jsonErr('Price validation failed — totals do not match platform rates', 400);
//   }

//   const { gst: gst_amount } = computeExpectedTotal(
//     base_amount,
//     convenience,
//     emergency_charge,
//     gstRate
//   );

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

//   // ── Build the row using ONLY real columns ──
//   const addressText = [
//     a.house_flat ?? a.line1,
//     a.area ?? a.line2,
//     a.landmark,
//     a.city,
//     a.state,
//     a.pincode,
//   ]
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
//       address_id: addr.id,
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

//   const orderId = String(order.id);
//   const label = typeof st.label === 'string' && st.label.trim() ? st.label : service_type_key.replace(/_/g, ' ');
//   const slotText = `${sdRaw ?? 'your slot'}${str(body.time_slot) ? ` · ${str(body.time_slot)}` : ''}`;

//   let supplierId: string | null = null;
//   if (isWater) {
//     supplierId = await assignSupplier(orderId, customerId);
//     if (supplierId) {
//       (order as Record<string, unknown>).supplier_id = supplierId;
//       (order as Record<string, unknown>).status = 'ASSIGNED';
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
//   if (supplierId) {
//     await safeNotify(
//       supplierId,
//       'New order incoming',
//       'A new order has been assigned to you.',
//       'system',
//       orderId,
//       'assigned'
//     );
//   }

//   const out = withCompat(order);
//   return jsonOk(isWater && !supplierId ? { ...out, supplier_status: 'searching' } : out, 201);
// }













// // import { NextRequest } from 'next/server';
// // import { jsonErr, jsonOk } from '@/lib/api/json-response';
// // import {
// //   computeExpectedTotal,
// //   pickGstRateFromFlat,
// //   totalsMatch,
// // } from '@/lib/api/order-pricing-server';
// // import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// // import {
// //   isPostgrestTableUnavailableError,
// //   isRlsOrPermissionDeniedError,
// //   postgrestTableUnavailableUserMessage,
// // } from '@/lib/supabase/postgrest-errors';
// // import { createServiceClient } from '@/utils/supabase/server';
// // import { getServiceZone, isCityServed, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';

// // async function settingsMap(
// //   sb: ReturnType<typeof import('@/lib/db/supabase').createSupabaseUserClient>
// // ): Promise<
// //   | { ok: true; map: Record<string, string> }
// //   | { ok: false; message: string; status: number }
// // > {
// //   const { data, error } = await sb.from('settings').select('key, value');
// //   if (error) {
// //     if (isRlsOrPermissionDeniedError(error)) {
// //       return { ok: false, message: error.message || 'Forbidden', status: 403 };
// //     }
// //     if (isPostgrestTableUnavailableError(error)) {
// //       return {
// //         ok: false,
// //         message: postgrestTableUnavailableUserMessage(error, 'public.settings'),
// //         status: 503,
// //       };
// //     }
// //     return { ok: false, message: error.message || 'Settings load failed', status: 502 };
// //   }
// //   return {
// //     ok: true,
// //     map: Object.fromEntries((data ?? []).map((r) => [r.key, r.value])),
// //   };
// // }

// // export async function GET(req: NextRequest) {
// //   const auth = await requireSupabaseAuth(req);
// //   if (!auth.ok) return auth.response;
// //   if (!requireRole(auth.ctx, 'customer')) {
// //     return jsonErr('Forbidden', 403);
// //   }

// //   const { searchParams } = new URL(req.url);
// //   const status = searchParams.get('status') ?? undefined;
// //   const limit = Math.min(Number(searchParams.get('limit') ?? '20') || 20, 100);
// //   const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

// //   let q = auth.ctx.supabase
// //     .from('orders')
// //     .select('*')
// //     .eq('customer_id', auth.ctx.profile.id)
// //     .order('created_at', { ascending: false })
// //     .range(offset, offset + limit - 1);

// //   if (status) {
// //     q = q.eq('status', status);
// //   }

// //   const { data, error } = await q;

// //   if (error) {
// //     if (isRlsOrPermissionDeniedError(error)) {
// //       return jsonErr(error.message, 403);
// //     }
// //     if (isPostgrestTableUnavailableError(error)) {
// //       return jsonErr(postgrestTableUnavailableUserMessage(error, 'public.orders'), 503);
// //     }
// //     return jsonErr(error.message, 502);
// //   }

// //   const orders = data ?? [];
// //   const typeIds = [...new Set(orders.map((o) => o.service_type_id).filter(Boolean))];
// //   let keyById: Record<number, string> = {};
// //   if (typeIds.length) {
// //     const { data: types } = await auth.ctx.supabase
// //       .from('service_types')
// //       .select('id, key')
// //       .in('id', typeIds as number[]);
// //     keyById = Object.fromEntries((types ?? []).map((t) => [t.id as number, t.key as string]));
// //   }

// //   const enriched = orders.map((o) => ({
// //     ...o,
// //     service_type_key: keyById[Number(o.service_type_id)] ?? null,
// //   }));

// //   return jsonOk(enriched);
// // }

// // export async function POST(req: NextRequest) {
// //   const auth = await requireSupabaseAuth(req);
// //   if (!auth.ok) return auth.response;
// //   if (!requireRole(auth.ctx, 'customer')) {
// //     return jsonErr('Forbidden', 403);
// //   }

// //   let body: Record<string, unknown>;
// //   try {
// //     body = (await req.json()) as Record<string, unknown>;
// //   } catch {
// //     return jsonErr('Invalid JSON body', 400);
// //   }

// //   const service_type_key = typeof body.service_type_key === 'string' ? body.service_type_key : '';
// //   const address_id = typeof body.address_id === 'string' ? body.address_id : '';

// //   if (!service_type_key || !address_id) {
// //     return jsonErr('service_type_key and address_id are required', 400);
// //   }

// //   const { data: st, error: stErr } = await auth.ctx.supabase
// //     .from('service_types')
// //     .select('id, base_price, key, name')
// //     .eq('key', service_type_key)
// //     .eq('is_active', true)
// //     .maybeSingle();

// //   if (stErr) {
// //     if (isRlsOrPermissionDeniedError(stErr)) {
// //       return jsonErr(stErr.message || 'Forbidden', 403);
// //     }
// //     if (isPostgrestTableUnavailableError(stErr)) {
// //       return jsonErr(postgrestTableUnavailableUserMessage(stErr, 'public.service_types'), 503);
// //     }
// //     return jsonErr(stErr.message || 'Service lookup failed', 502);
// //   }
// //   if (!st) {
// //     return jsonErr('Invalid or inactive service', 400);
// //   }

// //   const { data: addr, error: aErr } = await auth.ctx.supabase
// //     .from('addresses')
// //     .select('*')
// //     .eq('id', address_id)
// //     .eq('user_id', auth.ctx.profile.id)
// //     .maybeSingle();

// //   if (aErr) {
// //     if (isRlsOrPermissionDeniedError(aErr)) {
// //       return jsonErr(aErr.message || 'Forbidden', 403);
// //     }
// //     if (isPostgrestTableUnavailableError(aErr)) {
// //       return jsonErr(postgrestTableUnavailableUserMessage(aErr, 'public.addresses'), 503);
// //     }
// //     return jsonErr(aErr.message || 'Address lookup failed', 502);
// //   }
// //   if (!addr) {
// //     return jsonErr('Address not found', 404);
// //   }

// //   const addrLat = Number((addr as { lat?: number }).lat);
// //   const addrLng = Number((addr as { lng?: number }).lng);
// //   const inZone =
// //     Number.isFinite(addrLat) && Number.isFinite(addrLng)
// //       ? getServiceZone(addrLat, addrLng) !== null
// //       : isCityServed(String(addr.city ?? ''));
// //   if (!inZone) {
// //     return jsonErr(OUT_OF_ZONE_MESSAGE, 400);
// //   }

// //   const settingsResult = await settingsMap(auth.ctx.supabase);
// //   if (!settingsResult.ok) {
// //     return jsonErr(settingsResult.message, settingsResult.status);
// //   }
// //   const flat = settingsResult.map;

// //   const address_snapshot = {
// //     label: addr.label,
// //     house_flat: addr.house_flat,
// //     area: addr.area,
// //     city: addr.city,
// //     pincode: addr.pincode,
// //     landmark: addr.landmark,
// //   };

// //   if (service_type_key === 'water_can') {
// //     const { data: priceRows, error: prErr } = await auth.ctx.supabase
// //       .from('settings')
// //       .select('key, value')
// //       .in('key', ['default_can_price', 'platform_fee', 'platform_fee_per_order']);

// //     if (prErr) {
// //       return jsonErr(prErr.message, 502);
// //     }

// //     const pm: Record<string, number> = {};
// //     for (const row of priceRows ?? []) {
// //       const k = row.key;
// //       const v = Number(row.value);
// //       if (typeof k === 'string') pm[k] = v;
// //     }

// //     const unit = Number.isFinite(pm.default_can_price) ? pm.default_can_price : 12;
// //     const fee = Number.isFinite(pm.platform_fee)
// //       ? pm.platform_fee
// //       : Number.isFinite(pm.platform_fee_per_order)
// //         ? pm.platform_fee_per_order
// //         : 2;

// //     const qtyRaw = body.can_count ?? body.can_quantity;
// //     const qty = Math.max(1, Math.floor(Number(qtyRaw ?? 1)));

// //     const serverTotal = qty * unit + fee;
// //     const clientTotal = Number(body.total_amount);

// //     if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - serverTotal) > 1) {
// //       return jsonErr(
// //         `Price validation failed — expected ₹${Math.round(serverTotal * 100) / 100} for ${qty} unit(s)`,
// //         400
// //       );
// //     }

// //     const roundedTotal = Math.round(serverTotal * 100) / 100;
// //     const base_amount = Math.round(qty * unit * 100) / 100;

// //     const insertWater = {
// //       customer_id: auth.ctx.profile.id,
// //       service_type_id: st.id,
// //       sub_option_key: typeof body.sub_option_key === 'string' ? body.sub_option_key : null,
// //       address_id: addr.id,
// //       address_snapshot,
// //       scheduled_date: typeof body.scheduled_date === 'string' ? body.scheduled_date : null,
// //       time_slot: typeof body.time_slot === 'string' ? body.time_slot : null,
// //       scheduled_time: typeof body.scheduled_time === 'string' ? body.scheduled_time : null,
// //       is_emergency: false,
// //       status: 'PENDING' as const,
// //       base_amount,
// //       convenience_fee: fee,
// //       emergency_charge: 0,
// //       gst_amount: 0,
// //       total_amount: roundedTotal,
// //       supplier_payout: 0,
// //       platform_fee: fee,
// //       payment_method: typeof body.payment_method === 'string' ? body.payment_method : 'cash',
// //       payment_status: 'unpaid' as const,
// //       payout_status: 'pending' as const,
// //       notes: typeof body.notes === 'string' ? body.notes : null,
// //       can_quantity: qty,
// //       can_price_per_unit: unit,
// //       can_order_type:
// //         typeof body.can_order_type === 'string' ? (body.can_order_type as string) : null,
// //       can_frequency: typeof body.can_frequency === 'string' ? (body.can_frequency as string) : null,
// //     };

// //     const { data: orderW, error: oErrW } = await auth.ctx.supabase
// //       .from('orders')
// //       .insert(insertWater)
// //       .select('*')
// //       .single();

// //     if (oErrW || !orderW) {
// //       if (oErrW && isRlsOrPermissionDeniedError(oErrW)) {
// //         return jsonErr(oErrW.message, 403);
// //       }
// //       if (oErrW && isPostgrestTableUnavailableError(oErrW)) {
// //         return jsonErr(postgrestTableUnavailableUserMessage(oErrW, 'public.orders'), 503);
// //       }
// //       return jsonErr(oErrW?.message ?? 'Failed to create order', oErrW ? 502 : 500);
// //     }

// //     // ── Supplier routing (territory protection + affinity) ────────────────
// //     type LastSupplierRow = { supplier_id: string | null };
// //     type SupplierSettingsRow = { user_id: string; is_online: boolean; zone_radius_km: number | null };
// //     type SupplierProfileTierRow = { id: string; milestone_tier: string | null };

// //     const tierRank: Record<string, number> = {
// //       starter: 0,
// //       bronze: 1,
// //       silver: 2,
// //       gold: 3,
// //       platinum: 4,
// //     };

// //     let assignedSupplierId: string | null = null;

// //     // 1) Preferred supplier from last COMPLETED order
// //     const { data: lastCompleted } = await auth.ctx.supabase
// //       .from('orders')
// //       .select('supplier_id')
// //       .eq('customer_id', auth.ctx.profile.id)
// //       .eq('status', 'COMPLETED')
// //       .not('supplier_id', 'is', null)
// //       .order('created_at', { ascending: false })
// //       .limit(1)
// //       .maybeSingle();

// //     const preferredSupplierId =
// //       (lastCompleted as unknown as LastSupplierRow | null)?.supplier_id ?? null;

// //     if (preferredSupplierId) {
// //       const { data: prefSettings } = await auth.ctx.supabase
// //         .from('supplier_settings')
// //         .select('user_id, is_online, zone_radius_km')
// //         .eq('user_id', preferredSupplierId)
// //         .maybeSingle();

// //       const ps = prefSettings as unknown as SupplierSettingsRow | null;
// //       const online = Boolean(ps?.is_online);
// //       if (online) {
// //         assignedSupplierId = preferredSupplierId;
// //       }
// //     }

// //     // 2) Else: pick best available supplier by tier (platinum first)
// //     if (!assignedSupplierId) {
// //       const { data: onlineSuppliers } = await auth.ctx.supabase
// //         .from('supplier_settings')
// //         .select('user_id, is_online, zone_radius_km')
// //         .eq('is_online', true)
// //         .limit(200);

// //       const supplierIds = (onlineSuppliers ?? [])
// //         .map((r) => String((r as { user_id?: string }).user_id ?? ''))
// //         .filter(Boolean);

// //       if (supplierIds.length) {
// //         const { data: tiers } = await auth.ctx.supabase
// //           .from('profiles')
// //           .select('id, milestone_tier')
// //           .in('id', supplierIds);

// //         const tierById = new Map(
// //           (tiers ?? []).map((r) => [
// //             String((r as SupplierProfileTierRow).id),
// //             String((r as SupplierProfileTierRow).milestone_tier ?? 'starter'),
// //           ])
// //         );

// //         const candidates = (onlineSuppliers ?? [])
// //           .map((r) => {
// //             const row = r as unknown as SupplierSettingsRow;
// //             const tid = tierById.get(String(row.user_id)) ?? 'starter';
// //             const radius = Number(row.zone_radius_km ?? 5);
// //             return { id: String(row.user_id), tier: tid, radius };
// //           })
// //           .filter((c) => c.radius > 0);

// //         candidates.sort((a, b) => {
// //           const tr = (tierRank[b.tier] ?? 0) - (tierRank[a.tier] ?? 0);
// //           if (tr !== 0) return tr;
// //           return (b.radius ?? 0) - (a.radius ?? 0);
// //         });

// //         assignedSupplierId = candidates[0]?.id ?? null;
// //       }
// //     }

// //     if (assignedSupplierId) {
// //       const { error: assignErr } = await auth.ctx.supabase
// //         .from('orders')
// //         .update({ supplier_id: assignedSupplierId, status: 'ASSIGNED' })
// //         .eq('id', String(orderW.id));
// //       if (!assignErr) {
// //         (orderW as Record<string, unknown>).supplier_id = assignedSupplierId;
// //         (orderW as Record<string, unknown>).status = 'ASSIGNED';
// //       }
// //     } else {
// //       // 4) No supplier found: keep PENDING + notify admins + audit log
// //       try {
// //         const sbAdmin = createServiceClient();
// //         const { data: admins } = await sbAdmin
// //           .from('profiles')
// //           .select('id')
// //           .eq('role', 'admin')
// //           .limit(20);

// //         const msg = `Unassigned order ${String(orderW.id)} — no supplier available`;
// //         for (const a of admins ?? []) {
// //           const adminId = String((a as { id?: string }).id ?? '');
// //           if (!adminId) continue;
// //           await sbAdmin.from('notifications').insert({
// //             user_id: adminId,
// //             title: 'Unassigned order',
// //             body: msg,
// //             type: 'system',
// //             order_id: String(orderW.id),
// //             is_read: false,
// //             dedup_key: `order_${String(orderW.id)}_no_supplier`,
// //           });
// //         }

// //         await sbAdmin.from('audit_logs').insert({
// //           actor_id: null,
// //           action: 'order.no_supplier',
// //           entity: 'orders',
// //           entity_id: String(orderW.id),
// //           meta: { service_type_key, city: (address_snapshot as { city?: string }).city ?? null },
// //         });
// //       } catch {
// //         // best-effort
// //       }
// //     }

// //     const serviceName =
// //       typeof st.name === 'string' && st.name.trim() ? st.name : service_type_key;
// //     const scheduledDate =
// //       typeof insertWater.scheduled_date === 'string' ? insertWater.scheduled_date : 'your slot';
// //     const timeSlot =
// //       typeof insertWater.time_slot === 'string' && insertWater.time_slot ? insertWater.time_slot : '';
// //     const { createNotification } = await import('@/lib/notifications');
// //     try {
// //       await createNotification(
// //         auth.ctx.profile.id,
// //         'Order placed successfully',
// //         `Your ${serviceName} is booked for ${scheduledDate}${timeSlot ? ` · ${timeSlot}` : ''}.`,
// //         'booking',
// //         String(orderW.id),
// //         'created'
// //       );
// //     } catch (e) {
// //       console.error('[notifications] customer order created', e);
// //     }

// //     if (assignedSupplierId) {
// //       try {
// //         await createNotification(
// //           assignedSupplierId,
// //           'New order incoming',
// //           'A new order has been assigned to you.',
// //           'system',
// //           String(orderW.id),
// //           'assigned'
// //         );
// //       } catch (e) {
// //         console.error('[notifications] supplier order assigned', e);
// //       }
// //     }

// //     if (!assignedSupplierId) {
// //       return jsonOk({ ...(orderW as Record<string, unknown>), supplier_status: 'searching' }, 201);
// //     }

// //     return jsonOk(orderW, 201);
// //   }

// //   const gstRate = pickGstRateFromFlat(flat);
// //   const convenience = Number(flat.convenience_fee ?? 29);
// //   const emergencyFee = Number(flat.emergency_surcharge ?? 199);
// //   const is_emergency = Boolean(body.is_emergency);

// //   let base_amount = Number(body.base_amount ?? 0);
// //   if (!Number.isFinite(base_amount) || base_amount < 0) {
// //     base_amount = Number(st.base_price);
// //   }

// //   const emergency_charge = is_emergency ? emergencyFee : 0;
// //   const clientTotal = Number(body.total_amount);
// //   const clientGst = Number(body.gst_amount);

// //   if (!Number.isFinite(clientTotal)) {
// //     return jsonErr('total_amount is required', 400);
// //   }

// //   if (
// //     !totalsMatch(clientTotal, base_amount, convenience, emergency_charge, gstRate, 3)
// //   ) {
// //     return jsonErr('Price validation failed — totals do not match platform rates', 400);
// //   }

// //   const { gst: gst_amount } = (await import('@/lib/api/order-pricing-server')).computeExpectedTotal(
// //     base_amount,
// //     convenience,
// //     emergency_charge,
// //     gstRate
// //   );

// //   const insert = {
// //     customer_id: auth.ctx.profile.id,
// //     service_type_id: st.id,
// //     sub_option_key: typeof body.sub_option_key === 'string' ? body.sub_option_key : null,
// //     address_id: addr.id,
// //     address_snapshot,
// //     scheduled_date: typeof body.scheduled_date === 'string' ? body.scheduled_date : null,
// //     time_slot: typeof body.time_slot === 'string' ? body.time_slot : null,
// //     scheduled_time: typeof body.scheduled_time === 'string' ? body.scheduled_time : null,
// //     is_emergency,
// //     status: 'PENDING' as const,
// //     base_amount,
// //     convenience_fee: convenience,
// //     emergency_charge,
// //     gst_amount: Number.isFinite(clientGst) ? clientGst : gst_amount,
// //     total_amount: clientTotal,
// //     supplier_payout: 0,
// //     platform_fee: 0,
// //     payment_method: typeof body.payment_method === 'string' ? body.payment_method : 'cash',
// //     payment_status: 'unpaid' as const,
// //     payout_status: 'pending' as const,
// //     notes: typeof body.notes === 'string' ? body.notes : null,
// //     can_quantity: body.can_quantity != null ? Number(body.can_quantity) : null,
// //     can_price_per_unit: null,
// //     can_order_type:
// //       typeof body.can_order_type === 'string' ? (body.can_order_type as string) : null,
// //     can_frequency: typeof body.can_frequency === 'string' ? (body.can_frequency as string) : null,
// //   };

// //   const { data: order, error: oErr } = await auth.ctx.supabase
// //     .from('orders')
// //     .insert(insert)
// //     .select('*')
// //     .single();

// //   if (oErr || !order) {
// //     if (oErr && isRlsOrPermissionDeniedError(oErr)) {
// //       return jsonErr(oErr.message, 403);
// //     }
// //     if (oErr && isPostgrestTableUnavailableError(oErr)) {
// //       return jsonErr(postgrestTableUnavailableUserMessage(oErr, 'public.orders'), 503);
// //     }
// //     return jsonErr(oErr?.message ?? 'Failed to create order', oErr ? 502 : 500);
// //   }

// //   const serviceName = typeof st.name === 'string' && st.name.trim() ? st.name : service_type_key;
// //   const scheduledDate = typeof insert.scheduled_date === 'string' ? insert.scheduled_date : 'your slot';
// //   const timeSlot = typeof insert.time_slot === 'string' && insert.time_slot ? insert.time_slot : '';
// //   const { createNotification } = await import('@/lib/notifications');
// //   await createNotification(
// //     auth.ctx.profile.id,
// //     'Booking Confirmed 🎉',
// //     `Your ${serviceName} is booked for ${scheduledDate}${timeSlot ? ` · ${timeSlot}` : ''}.`,
// //     'booking',
// //     String(order.id),
// //     'created'
// //   );

// //   return jsonOk(order, 201);
// // }
