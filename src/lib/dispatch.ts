/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/utils/supabase/server';

/**
 * Supplier dispatch engine.
 *   PENDING --dispatchOrder--> ASSIGNED (supplier notified)
 *   ASSIGNED --reject / timeout--> releaseAssignment --> next supplier
 *   ASSIGNED --accept--> accepted_at set (never reassigned)
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
      .select('id, customer_id, status, supplier_id, address_id, address_snapshot, dispatch_attempts, can_quantity, service_type_id')
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
    const { data: serviceType } = await db
      .from('service_types')
      .select('key')
      .eq('id', order.service_type_id)
      .maybeSingle();
    const requiresCanStock = String(serviceType?.key ?? '').toLowerCase() === 'water_can';
    const requiredCanQty = Math.max(1, Number(order.can_quantity ?? 1));

    const { data: tried } = await db.from('order_dispatch').select('supplier_id').eq('order_id', orderId);
    const triedSet = new Set(((tried ?? []) as { supplier_id: string }[]).map((r) => String(r.supplier_id)));

    const { data: online } = await db
      .from('supplier_settings')
      .select('user_id, zone_radius_km')
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

    const [profRes, loadRes, lastRes, stockRes] = await Promise.all([
      db.from('profiles').select('id, role, city, is_active, status, milestone_tier, current_lat, current_lng').in('id', ids),
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
      requiresCanStock
        ? db
            .from('supplier_stock')
            .select('supplier_id, cans_available')
            .in('supplier_id', ids)
        : Promise.resolve({ data: [] }),
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
    const stockBySupplier = new Map(
      ((stockRes.data ?? []) as { supplier_id: string; cans_available: number }[]).map((row) => [
        String(row.supplier_id),
        Number(row.cans_available ?? 0),
      ]),
    );

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
      if (requiresCanStock && (stockBySupplier.get(id) ?? 0) < requiredCanQty) continue;

      const radius = posNum(r.zone_radius_km, cfg.defaultRadiusKm);
      const sLat = coord(p.current_lat);
      const sLng = coord(p.current_lng);

      let group = 2;
      let distance: number | null = null;

      if (geo.hasCoords && Number.isFinite(sLat) && Number.isFinite(sLng)) {
        distance = haversineKm(geo.lat, geo.lng, sLat, sLng);
        if (distance > radius) continue;
        group = 0;
      } else {
        const sCity = String(p.city ?? '').trim().toLowerCase();
        if (sCity && geo.city) {
          if (sCity !== geo.city) continue;
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
      const { error: insErr } = await db.from('order_dispatch').insert({
        order_id: orderId,
        supplier_id: c.id,
        status: 'ASSIGNED',
        distance_km: c.distance === null ? null : Math.round(c.distance * 100) / 100,
      });
      if (insErr) continue;

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

/** Take an order back from a supplier (rejected / no response) and offer it to the next one. */
export async function releaseAssignment(
  orderId: string,
  supplierId: string,
  why: 'REJECTED' | 'EXPIRED',
  note?: string
): Promise<{ released: boolean; reassigned: boolean }> {
  try {
    const db: any = createServiceClient();

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

/** Lazy maintenance for one customer's water orders (no cron needed). Never throws. */
/**
 * Global dispatch recovery worker.
 * This is intended for a scheduled job and must not depend on a customer page being opened.
 */
export async function sweepDispatchQueue(maxOrders = 100): Promise<{
  expired: number;
  retried: number;
  reassigned: number;
  exhausted: number;
}> {
  const summary = {
    expired: 0,
    retried: 0,
    reassigned: 0,
    exhausted: 0,
  };

  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);
    if (!cfg.enabled) return summary;

    const { data: dispatchServices } = await db
      .from('service_types')
      .select('id, key')
      .in('key', ['water_can', 'water_tanker']);

    const waterServiceIds = (dispatchServices ?? [])
      .map((row: { id?: number }) => Number(row.id))
      .filter((id: number) => Number.isInteger(id) && id > 0);

    if (!waterServiceIds.length) return summary;

    const staleBefore = new Date(Date.now() - cfg.responseSeconds * 1000).toISOString();

    const { data: stale } = await db
      .from('orders')
      .select('id, supplier_id')
      .in('service_type_id', waterServiceIds)
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .not('supplier_id', 'is', null)
      .lt('assigned_at', staleBefore)
      .order('assigned_at', { ascending: true })
      .limit(maxOrders);

    for (const order of (stale ?? []) as { id: string; supplier_id: string | null }[]) {
      if (!order.supplier_id) continue;
      summary.expired += 1;
      const result = await releaseAssignment(
        String(order.id),
        String(order.supplier_id),
        'EXPIRED',
        'supplier response timeout'
      );
      if (result.reassigned) summary.reassigned += 1;
    }

    const retryBefore = new Date(Date.now() - 30_000).toISOString();
    const { data: pending } = await db
      .from('orders')
      .select('id, dispatch_attempts, last_dispatch_at')
      .in('service_type', ['water_can', 'water_tanker'])
      .eq('status', 'PENDING')
      .is('supplier_id', null)
      .order('created_at', { ascending: true })
      .limit(maxOrders);

    for (const order of (pending ?? []) as {
      id: string;
      dispatch_attempts: number | null;
      last_dispatch_at: string | null;
    }[]) {
      if (Number(order.dispatch_attempts ?? 0) >= cfg.maxAttempts) {
        summary.exhausted += 1;
        continue;
      }

      if (order.last_dispatch_at && order.last_dispatch_at > retryBefore) {
        continue;
      }

      summary.retried += 1;
      await dispatchOrder(String(order.id));
    }

    return summary;
  } catch (e) {
    console.error('[dispatch] global sweep failed:', e);
    return summary;
  }
}

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

/** Supplier confirms an assigned order and atomically reserves required stock. */
export type SupplierAcceptResult = {
  accepted: boolean;
  reason?: 'not_assignable' | 'insufficient_stock' | 'error';
  customerId?: string;
  reservedQty?: number;
};

export async function acceptAssignment(
  orderId: string,
  supplierId: string
): Promise<SupplierAcceptResult> {
  try {
    const db: any = createServiceClient();
    const { data, error } = await db.rpc('supplier_accept_order', {
      p_order_id: orderId,
      p_supplier_id: supplierId,
    });

    if (error) {
      console.error('[dispatch] supplier_accept_order failed:', error);
      return { accepted: false, reason: 'error' };
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      reason?: SupplierAcceptResult['reason'];
      customer_id?: string;
      reserved_qty?: number;
    };

    if (!result.ok) {
      return {
        accepted: false,
        reason:
          result.reason === 'insufficient_stock'
            ? 'insufficient_stock'
            : 'not_assignable',
      };
    }

    if (result.customer_id) {
      await notify(
        String(result.customer_id),
        'Supplier confirmed',
        'Your supplier has confirmed your order.',
        'booking',
        orderId,
        'accepted'
      );
    }

    return {
      accepted: true,
      customerId: result.customer_id ? String(result.customer_id) : undefined,
      reservedQty: Number(result.reserved_qty ?? 0),
    };
  } catch (e) {
    console.error('[dispatch] acceptAssignment failed:', e);
    return { accepted: false, reason: 'error' };
  }
}

/** Start a supplier delivery. Only an accepted assignment can enter IN_PROGRESS. */
export async function startSupplierOrder(
  orderId: string,
  supplierId: string
): Promise<{ ok: boolean; reason?: string; customerId?: string }> {
  try {
    const db: any = createServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await db
      .from('orders')
      .update({
        status: 'IN_PROGRESS',
        dispatched_at: now,
      })
      .eq('id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED')
      .not('accepted_at', 'is', null)
      .select('id, customer_id')
      .maybeSingle();

    if (error) {
      console.error('[dispatch] startSupplierOrder failed:', error);
      return { ok: false, reason: 'database_error' };
    }

    if (!data) {
      return { ok: false, reason: 'invalid_transition' };
    }

    await notify(
      String(data.customer_id),
      'Delivery started',
      'Your supplier has started the delivery.',
      'booking',
      orderId,
      'in_progress'
    );

    return { ok: true, customerId: String(data.customer_id) };
  } catch (e) {
    console.error('[dispatch] startSupplierOrder failed:', e);
    return { ok: false, reason: 'error' };
  }
}

/** Complete a supplier delivery and atomically consume any reserved stock. */
export async function completeSupplierOrder(
  orderId: string,
  supplierId: string
): Promise<{ ok: boolean; reason?: string; customerId?: string }> {
  try {
    const db: any = createServiceClient();
    const { data, error } = await db.rpc('supplier_complete_order', {
      p_order_id: orderId,
      p_supplier_id: supplierId,
    });

    if (error) {
      console.error('[dispatch] supplier_complete_order failed:', error);
      return { ok: false, reason: 'database_error' };
    }

    const result = (data ?? {}) as {
      ok?: boolean;
      reason?: string;
      customer_id?: string;
    };

    if (!result.ok) {
      return { ok: false, reason: result.reason ?? 'invalid_transition' };
    }

    if (result.customer_id) {
      await notify(
        String(result.customer_id),
        'Delivery completed',
        'Your water delivery has been marked complete.',
        'booking',
        orderId,
        'completed'
      );
    }

    return {
      ok: true,
      customerId: result.customer_id ? String(result.customer_id) : undefined,
    };
  } catch (e) {
    console.error('[dispatch] completeSupplierOrder failed:', e);
    return { ok: false, reason: 'error' };
  }
}
