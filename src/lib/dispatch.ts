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
export async function dispatchOrder(orderId: string, preferredSupplierId?: string | null): Promise<DispatchResult> {
  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);

    const { data: order } = await db
      .from('orders')
      .select('id, customer_id, status, supplier_id, address_id, address_snapshot, dispatch_attempts, can_count')
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

    const [profRes, loadRes, lastRes, stockRes] = await Promise.all([
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
      db.from('supplier_stock').select('supplier_id, cans_available, reserved_cans').in('supplier_id', ids),
    ]);

    const profById = new Map<string, any>(((profRes.data ?? []) as any[]).map((p) => [String(p.id), p]));
    const stockById = new Map<string, any>(((stockRes.data ?? []) as any[]).map((r) => [String(r.supplier_id), r]));
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

      // Water orders require enough unreserved stock before assignment.
      const requiredQty = Math.max(0, Number(order.can_count ?? 0));
      if (requiredQty > 0) {
        const stock = stockById.get(id);
        const available = Math.max(
          0,
          Number(stock?.cans_available ?? 0) - Number(stock?.reserved_cans ?? 0)
        );
        if (available < requiredQty) continue;
      }

      const radius = posNum(r.zone_radius_km, cfg.defaultRadiusKm);
      const sLat = coord(r.base_lat);
      const sLng = coord(r.base_lng);

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
        Number((preferredSupplierId && a.id === preferredSupplierId) ? 1 : 0) - Number((preferredSupplierId && b.id === preferredSupplierId) ? 1 : 0) ||
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

    const { data: current } = await db
      .from('orders')
      .select('id, customer_id, status, supplier_id, accepted_at, can_count, service_type, total_amount, supplier_payout')
      .eq('id', orderId)
      .maybeSingle();

    if (!current || String(current.supplier_id ?? '') !== supplierId || String(current.status ?? '') !== 'ASSIGNED' || current.accepted_at) {
      return false;
    }

    const qty = Math.max(0, Number(current.can_count ?? 0));
    if (qty > 0 && String(current.service_type ?? '') === 'water_can') {
      const { data: reserved, error: reserveError } = await db.rpc('reserve_supplier_stock', {
        p_supplier_id: supplierId,
        p_quantity: qty,
      });
      if (reserveError || reserved !== true) {
        await notify(
          supplierId,
          'Order cannot be accepted',
          'Your available stock is not sufficient for this order. The order will be offered to another supplier.',
          'system',
          orderId,
          'stock_unavailable'
        );
        return false;
      }
    }

    const { data: supplierRateRow } = await db.rpc('get_supplier_commission_rate', {
      p_supplier_id: supplierId,
    });
    const rawSupplierRate = Number(supplierRateRow ?? 30);
    const supplierShare = Math.max(0, Math.min(1, rawSupplierRate > 1 ? rawSupplierRate / 100 : rawSupplierRate));
    const totalAmount = Math.max(0, Number(current.total_amount ?? 0));
    const supplierPayout = Number(current.supplier_payout ?? 0) > 0
      ? Number(current.supplier_payout)
      : Math.round(totalAmount * supplierShare * 100) / 100;

    const { data: ok } = await db
      .from('orders')
      .update({
        accepted_at: now,
        supplier_payout: supplierPayout,
        payout_status: supplierPayout > 0 ? 'pending' : 'pending',
      })
      .eq('id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .select('id, customer_id')
      .maybeSingle();

    if (!ok) {
      if (qty > 0 && String(current.service_type ?? '') === 'water_can') {
        await db.rpc('release_reserved_supplier_stock', {
          p_supplier_id: supplierId,
          p_quantity: qty,
        });
      }
      return false;
    }

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