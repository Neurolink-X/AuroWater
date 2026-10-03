/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/utils/supabase/server';

/**
 * Supplier dispatch engine.
 *
 * Flow
 *   PENDING --dispatchOrder--> ASSIGNED (supplier notified)
 *   ASSIGNED --supplier rejects / does not respond in time--> releaseAssignment --> next supplier
 *   ASSIGNED --supplier accepts--> accepted_at set (never reassigned again)
 *
 * Safety rules
 *   - A supplier is never offered the same order twice (unique order_id + supplier_id).
 *   - Every state change is a conditional UPDATE, so two simultaneous requests cannot double-assign.
 *   - Only online, active, non-blocked suppliers with spare capacity are considered.
 *   - Distance is used when both sides have coordinates; otherwise same-city matching.
 *   - No cron needed: stale offers are released lazily (see sweepCustomerOrders).
 */

export type DispatchReason =
  | 'assigned'
  | 'disabled'
  | 'not_pending'
  | 'no_candidates'
  | 'max_attempts'
  | 'error';

export type DispatchResult = {
  supplierId: string | null;
  reason: DispatchReason;
  distanceKm?: number | null;
};

type Cfg = {
  enabled: boolean;
  responseSeconds: number;
  maxAttempts: number;
  maxActive: number;
  defaultRadiusKm: number;
};

const TIER_RANK: Record<string, number> = {
  starter: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

const BLOCKED_STATUS = new Set(['pending', 'rejected', 'suspended', 'blocked', 'banned', 'inactive', 'disabled']);

function posNum(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function coord(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  return Number(v);
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function loadCfg(db: any): Promise<Cfg> {
  const { data } = await db
    .from('settings')
    .select('key, value')
    .in('key', [
      'auto_assign_orders',
      'dispatch_response_seconds',
      'dispatch_max_attempts',
      'supplier_max_active_orders',
      'service_radius_km',
    ]);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as { key: string; value: unknown }[]) m[r.key] = String(r.value);
  return {
    enabled: String(m.auto_assign_orders ?? 'true').toLowerCase() !== 'false',
    responseSeconds: posNum(m.dispatch_response_seconds, 300),
    maxAttempts: Math.floor(posNum(m.dispatch_max_attempts, 5)),
    maxActive: Math.floor(posNum(m.supplier_max_active_orders, 5)),
    defaultRadiusKm: posNum(m.service_radius_km, 10),
  };
}

async function notify(
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
    console.error('[dispatch] notify failed', event, e);
  }
}

async function alertAdmins(db: any, orderId: string, message: string, action: string) {
  try {
    const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(20);
    for (const a of (admins ?? []) as { id?: string }[]) {
      if (!a.id) continue;
      // dedup_key makes repeated alerts for the same order harmless
      await db.from('notifications').insert({
        user_id: a.id,
        title: 'Unassigned order',
        body: `${message} (order ${orderId})`,
        type: 'system',
        order_id: orderId,
        is_read: false,
        dedup_key: `order_${orderId}_${action}`,
      });
    }
    await db.from('audit_logs').insert({
      actor_id: null,
      action: `order.${action}`,
      entity: 'orders',
      entity_id: orderId,
      meta: { message },
    });
  } catch {
    /* best-effort; duplicates are expected */
  }
}

async function orderGeo(db: any, order: any) {
  let lat = NaN;
  let lng = NaN;
  let city = '';
  if (order.address_id) {
    const { data: a } = await db.from('addresses').select('lat, lng, city').eq('id', order.address_id).maybeSingle();
    if (a) {
      lat = coord(a.lat);
      lng = coord(a.lng);
      city = String(a.city ?? '');
    }
  }
  const snap = order.address_snapshot && typeof order.address_snapshot === 'object' ? order.address_snapshot : null;
  if (snap) {
    if (!city) city = String(snap.city ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      lat = coord(snap.lat);
      lng = coord(snap.lng);
    }
  }
  return {
    lat,
    lng,
    hasCoords: Number.isFinite(lat) && Number.isFinite(lng),
    city: city.trim().toLowerCase(),
  };
}

async function markAttempt(db: any, orderId: string) {
  await db.from('orders').update({ last_dispatch_at: new Date().toISOString() }).eq('id', orderId);
}

/** Try to assign the best available supplier to a PENDING order. Safe to call repeatedly. */
export async function dispatchOrder(orderId: string): Promise<DispatchResult> {
  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);

    const { data: order } = await db
      .from('orders')
      .select('id, customer_id, status, supplier_id, address_id, address_snapshot, dispatch_attempts')
      .eq('id', orderId)
      .maybeSingle();

    if (!order || order.status !== 'PENDING' || order.supplier_id) {
      return { supplierId: null, reason: 'not_pending' };
    }

    if (!cfg.enabled) {
      await markAttempt(db, orderId);
      await alertAdmins(db, orderId, 'Auto-assign is off. Please assign a supplier manually', 'no_supplier');
      return { supplierId: null, reason: 'disabled' };
    }

    const attempts = Number(order.dispatch_attempts ?? 0);
    if (attempts >= cfg.maxAttempts) {
      await alertAdmins(db, orderId, 'Every supplier tried declined or timed out', 'dispatch_exhausted');
      return { supplierId: null, reason: 'max_attempts' };
    }

    const geo = await orderGeo(db, order);

    const { data: tried } = await db.from('order_dispatch').select('supplier_id').eq('order_id', orderId);
    const triedSet = new Set(((tried ?? []) as { supplier_id: string }[]).map((r) => String(r.supplier_id)));

    const { data: online } = await db
      .from('supplier_settings')
      .select('user_id, zone_radius_km, base_lat, base_lng')
      .eq('is_online', true)
      .limit(500);

    const rows = ((online ?? []) as any[]).filter((r) => r.user_id && !triedSet.has(String(r.user_id)));
    const ids = rows.map((r) => String(r.user_id));

    const noCandidates = async (): Promise<DispatchResult> => {
      await markAttempt(db, orderId);
      await alertAdmins(db, orderId, 'No supplier is available nearby', 'no_supplier');
      return { supplierId: null, reason: 'no_candidates' };
    };

    if (!ids.length) return noCandidates();

    const [profRes, loadRes, lastRes] = await Promise.all([
      db.from('profiles').select('id, role, city, is_active, status, milestone_tier').in('id', ids),
      db.from('orders').select('supplier_id').in('supplier_id', ids).in('status', ['ASSIGNED', 'IN_PROGRESS']),
      db
        .from('orders')
        .select('supplier_id')
        .eq('customer_id', order.customer_id)
        .eq('status', 'COMPLETED')
        .not('supplier_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const profById = new Map<string, any>(((profRes.data ?? []) as any[]).map((p) => [String(p.id), p]));
    const activeLoad = new Map<string, number>();
    for (const r of (loadRes.data ?? []) as { supplier_id: string }[]) {
      const k = String(r.supplier_id);
      activeLoad.set(k, (activeLoad.get(k) ?? 0) + 1);
    }
    const favourite = (lastRes.data as { supplier_id?: string } | null)?.supplier_id
      ? String((lastRes.data as { supplier_id: string }).supplier_id)
      : null;

    type Cand = {
      id: string;
      favourite: boolean;
      group: number; // 0 = within radius by coordinates, 1 = same city, 2 = unknown location
      distance: number | null;
      tier: number;
      load: number;
    };

    const cands: Cand[] = [];
    for (const r of rows) {
      const id = String(r.user_id);
      const p = profById.get(id);
      if (!p) continue;
      if (p.role && String(p.role) !== 'supplier') continue;
      if (p.is_active === false) continue;
      if (p.status && BLOCKED_STATUS.has(String(p.status).toLowerCase())) continue;

      const load = activeLoad.get(id) ?? 0;
      if (load >= cfg.maxActive) continue;

      const radius = posNum(r.zone_radius_km, cfg.defaultRadiusKm);
      const sLat = coord(r.base_lat);
      const sLng = coord(r.base_lng);

      let group = 2;
      let distance: number | null = null;

      if (geo.hasCoords && Number.isFinite(sLat) && Number.isFinite(sLng)) {
        distance = haversineKm(geo.lat, geo.lng, sLat, sLng);
        if (distance > radius) continue; // too far
        group = 0;
      } else {
        const sCity = String(p.city ?? '').trim().toLowerCase();
        if (sCity && geo.city) {
          if (sCity !== geo.city) continue; // different city
          group = 1;
        }
      }

      cands.push({
        id,
        favourite: id === favourite,
        group,
        distance,
        tier: TIER_RANK[String(p.milestone_tier ?? 'starter').toLowerCase()] ?? 0,
        load,
      });
    }

    if (!cands.length) return noCandidates();

    cands.sort(
      (a, b) =>
        Number(b.favourite) - Number(a.favourite) ||
        a.group - b.group ||
        (a.distance ?? 0) - (b.distance ?? 0) ||
        b.tier - a.tier ||
        a.load - b.load
    );

    for (const c of cands) {
      // 1) claim the (order, supplier) pair; a unique violation means it was already tried
      const { error: insErr } = await db.from('order_dispatch').insert({
        order_id: orderId,
        supplier_id: c.id,
        status: 'ASSIGNED',
        distance_km: c.distance === null ? null : Math.round(c.distance * 100) / 100,
      });
      if (insErr) continue;

      // 2) conditional assignment: succeeds only if the order is still unassigned
      const now = new Date().toISOString();
      const { data: won } = await db
        .from('orders')
        .update({
          supplier_id: c.id,
          status: 'ASSIGNED',
          assigned_at: now,
          last_dispatch_at: now,
          dispatch_attempts: attempts + 1,
        })
        .eq('id', orderId)
        .eq('status', 'PENDING')
        .is('supplier_id', null)
        .select('id')
        .maybeSingle();

      if (!won) {
        await db
          .from('order_dispatch')
          .update({ status: 'CANCELLED', responded_at: now })
          .eq('order_id', orderId)
          .eq('supplier_id', c.id);
        return { supplierId: null, reason: 'not_pending' };
      }

      await notify(
        c.id,
        'New order incoming',
        c.distance !== null
          ? `A new delivery about ${c.distance.toFixed(1)} km away needs your confirmation.`
          : 'A new delivery needs your confirmation.',
        'system',
        orderId,
        'assigned'
      );
      return { supplierId: c.id, reason: 'assigned', distanceKm: c.distance };
    }

    return noCandidates();
  } catch (e) {
    console.error('[dispatch] dispatchOrder failed:', e);
    return { supplierId: null, reason: 'error' };
  }
}

/**
 * Take an order back from a supplier (rejected, or no response in time)
 * and immediately offer it to the next best supplier.
 */
export async function releaseAssignment(
  orderId: string,
  supplierId: string,
  why: 'REJECTED' | 'EXPIRED',
  note?: string
): Promise<{ released: boolean; reassigned: boolean }> {
  try {
    const db: any = createServiceClient();

    // Conditional: only if THIS supplier still holds it and has not accepted
    const { data: released } = await db
      .from('orders')
      .update({ supplier_id: null, status: 'PENDING', assigned_at: null })
      .eq('id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .select('id, customer_id')
      .maybeSingle();

    if (!released) return { released: false, reassigned: false };

    await db
      .from('order_dispatch')
      .update({ status: why, responded_at: new Date().toISOString(), reason: note ?? null })
      .eq('order_id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED');

    if (why === 'EXPIRED') {
      await notify(
        supplierId,
        'Order reassigned',
        'You did not respond in time, so the order went to another supplier.',
        'system',
        orderId,
        'expired'
      );
    }

    const next = await dispatchOrder(orderId);

    await notify(
      String(released.customer_id),
      'Finding you a new supplier',
      next.supplierId
        ? 'Your order has been passed to another nearby supplier.'
        : 'We are looking for another supplier for your order.',
      'booking',
      orderId,
      'reassigned'
    );

    return { released: true, reassigned: Boolean(next.supplierId) };
  } catch (e) {
    console.error('[dispatch] releaseAssignment failed:', e);
    return { released: false, reassigned: false };
  }
}

/**
 * Lazy maintenance for one customer's water orders. Called from the order endpoints the app
 * polls every 12-15 seconds, so no cron job is needed (works on the Vercel Hobby plan).
 *  1) Offers nobody answered in time are released and re-dispatched.
 *  2) PENDING orders with no supplier retry (at most every 30 seconds).
 * Never throws.
 */
export async function sweepCustomerOrders(customerId: string): Promise<void> {
  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);
    if (!cfg.enabled) return;

    const staleBefore = new Date(Date.now() - cfg.responseSeconds * 1000).toISOString();
    const { data: stale } = await db
      .from('orders')
      .select('id, supplier_id')
      .eq('customer_id', customerId)
      .eq('service_type', 'water_can')
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .lt('assigned_at', staleBefore)
      .limit(5);

    for (const o of (stale ?? []) as { id: string; supplier_id: string | null }[]) {
      if (o.supplier_id) await releaseAssignment(String(o.id), String(o.supplier_id), 'EXPIRED', 'no response');
    }

    const retryBefore = Date.now() - 30_000;
    const { data: pending } = await db
      .from('orders')
      .select('id, last_dispatch_at, dispatch_attempts')
      .eq('customer_id', customerId)
      .eq('service_type', 'water_can')
      .eq('status', 'PENDING')
      .is('supplier_id', null)
      .limit(5);

    for (const o of (pending ?? []) as { id: string; last_dispatch_at: string | null; dispatch_attempts: number | null }[]) {
      if (Number(o.dispatch_attempts ?? 0) >= cfg.maxAttempts) continue;
      const last = o.last_dispatch_at ? new Date(o.last_dispatch_at).getTime() : 0;
      if (last < retryBefore) await dispatchOrder(String(o.id));
    }
  } catch (e) {
    console.error('[dispatch] sweep failed:', e);
  }
}

/** Supplier confirms an assigned order. Once accepted it is never reassigned. */
export async function acceptAssignment(orderId: string, supplierId: string): Promise<boolean> {
  try {
    const db: any = createServiceClient();
    const now = new Date().toISOString();
    const { data: ok } = await db
      .from('orders')
      .update({ accepted_at: now })
      .eq('id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .select('id, customer_id')
      .maybeSingle();
    if (!ok) return false;

    await db
      .from('order_dispatch')
      .update({ status: 'ACCEPTED', responded_at: now })
      .eq('order_id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED');

    await notify(
      String(ok.customer_id),
      'Supplier confirmed',
      'Your supplier has confirmed your order.',
      'booking',
      orderId,
      'accepted'
    );
    return true;
  } catch (e) {
    console.error('[dispatch] acceptAssignment failed:', e);
    return false;
  }
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
