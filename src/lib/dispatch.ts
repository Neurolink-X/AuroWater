/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/utils/supabase/server';

/**
 * Supplier dispatch engine.
 *   PENDING --dispatchOrder--> ASSIGNED (supplier notified)
 *   ASSIGNED --reject / timeout--> releaseAssignment --> next supplier
 *   ASSIGNED --accept--> accepted_at set (status stays ASSIGNED; never reassigned)
 *
 * All functions use the service client, are safe to call repeatedly, and never throw.
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

/** Outcome of a supplier accepting an order. */
export type AcceptResult = 'accepted' | 'already_accepted' | 'not_assigned' | 'error';

type Cfg = {
  enabled: boolean;
  responseSeconds: number;
  maxAttempts: number;
  maxActive: number;
  defaultRadiusKm: number;
};

/* ───────────────────────── Tunables ───────────────────────── */

const ONLINE_SCAN_LIMIT = 500; // online suppliers considered per dispatch
const TECHNICIAN_MAX_ACTIVE = 3; // concurrent jobs per technician
const PENDING_RETRY_AFTER_MS = 30_000; // minimum gap between dispatch retries of one order
const PG_UNIQUE_VIOLATION = '23505';

const TIER_RANK: Record<string, number> = {
  starter: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

const BLOCKED_STATUS = new Set(['pending', 'pending_approval', 'rejected', 'suspended', 'blocked', 'banned', 'inactive', 'disabled']);

/* ───────────────────────── Helpers ───────────────────────── */

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
  const { data, error } = await db
    .from('settings')
    .select('key, value')
    .in('key', [
      'auto_assign_orders',
      'dispatch_response_seconds',
      'dispatch_max_attempts',
      'supplier_max_active_orders',
      'service_radius_km',
    ]);
  if (error) console.error('[dispatch] settings load failed, using defaults', error.message);
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

/**
 * Tells every admin an order needs manual attention.
 * The dedup key includes the admin id, so EACH admin gets the alert once (a shared key would
 * deliver it to only the first admin), and the audit row is written only when a NEW alert was
 * created, so repeated retries do not flood audit_logs.
 */
async function alertAdmins(db: any, orderId: string, message: string, action: string) {
  try {
    const { data: admins, error: adminError } = await db
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(20);

    if (adminError) {
      console.error('[dispatch] admin lookup failed', adminError.message);
      return;
    }

    const recipients = ((admins ?? []) as { id?: string }[]).filter((a) => a.id);
    if (!recipients.length) return;

    // Database primary key (order_id, action) makes this claim atomic across
    // concurrent cron/API retries. Historical duplicate audit rows are preserved.
    const { error: claimError } = await db
      .from('dispatch_alert_events')
      .insert({ order_id: orderId, action });

    if (claimError) {
      if (claimError.code === PG_UNIQUE_VIOLATION) return;
      console.error('[dispatch] alert dedup claim failed:', claimError.message);
      return;
    }

    let created = false;
    for (const a of recipients) {
      const { error } = await db.from('notifications').insert({
        user_id: a.id,
        title: 'Unassigned order',
        body: `${message} (order ${orderId})`,
        type: 'system',
        order_id: orderId,
        is_read: false,
        dedup_key: `order_${orderId}_${action}_${a.id}`,
      });

      if (!error) created = true;
      else if (error.code !== PG_UNIQUE_VIOLATION) {
        console.error('[dispatch] admin alert failed', error.message);
      }
    }

    if (created) {
      const { error } = await db.from('audit_logs').insert({
        actor_id: null,
        action: `order.${action}`,
        entity: 'orders',
        entity_id: orderId,
        meta: { message },
      });
      if (error) console.error('[dispatch] alert audit failed', error.message);
    }
  } catch (e) {
    console.error('[dispatch] alertAdmins failed', e instanceof Error ? e.message : e);
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
  const { error } = await db.from('orders').update({ last_dispatch_at: new Date().toISOString() }).eq('id', orderId);
  if (error) console.error('[dispatch] markAttempt failed', error.message);
}

/* ───────────────────────── Water dispatch ───────────────────────── */

/** Try to assign the best available supplier to a PENDING order. Safe to call repeatedly. */
export async function dispatchOrder(orderId: string): Promise<DispatchResult> {
  let db: any = null;
  try {
    db = createServiceClient();
    const cfg = await loadCfg(db);

    const { data: order } = await db
      .from('orders')
      .select('id, customer_id, status, supplier_id, address_id, address_snapshot, dispatch_attempts, zone_id, service_type_id, service_type')
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

    // Prefer suppliers explicitly mapped to this service zone. If those suppliers
    // cannot fulfil the order, allow an eligible same-city fallback from another
    // zone (or with no mapping). The order must already have passed customer-side
    // serviceability checks; fallback never enables an unavailable customer zone.
    let coverageBySupplier: Map<string, { zoneId: string; serviceKeys: string[] | null }[]> | null = null;
    if (order.zone_id) {
      const [typeRes, coverageRes] = await Promise.all([
        order.service_type_id
          ? db.from('service_types').select('key').eq('id', order.service_type_id).maybeSingle()
          : db.from('service_types').select('key').eq('key', order.service_type).maybeSingle(),
        db.from('supplier_zones').select('supplier_id, zone_id, service_keys'),
      ]);
      if (typeRes.error || coverageRes.error || !typeRes.data?.key) {
        console.error('[dispatch] service coverage lookup failed', typeRes.error ?? coverageRes.error);
        await markAttempt(db, orderId);
        await alertAdmins(db, orderId, 'Could not verify supplier service-area coverage for this order.', 'coverage_lookup_failed');
        return { supplierId: null, reason: 'error' };
      }
      const serviceKey = String(typeRes.data.key);
      coverageBySupplier = new Map();
      for (const link of (coverageRes.data ?? []) as { supplier_id: string; zone_id: string; service_keys: string[] | null }[]) {
        const id = String(link.supplier_id);
        const links = coverageBySupplier.get(id) ?? [];
        links.push({ zoneId: String(link.zone_id), serviceKeys: link.service_keys ?? null });
        coverageBySupplier.set(id, links);
      }
      (order as any).__serviceKey = serviceKey;
    }

    const { data: tried, error: triedError } = await db.from('order_dispatch').select('supplier_id').eq('order_id', orderId);
    if (triedError) {
      console.error('[dispatch] tried-supplier lookup failed:', triedError.message);
      await markAttempt(db, orderId);
      await alertAdmins(db, orderId, 'Could not check prior supplier offers; dispatch needs retry.', 'dispatch_lookup_failed');
      return { supplierId: null, reason: 'error' };
    }
    const triedSet = new Set(((tried ?? []) as { supplier_id: string }[]).map((r) => String(r.supplier_id)));

    const { data: online, error: onlineError } = await db
      .from('supplier_settings')
      .select('user_id, zone_radius_km, base_lat, base_lng')
      .eq('is_online', true)
      .limit(ONLINE_SCAN_LIMIT);
    if (onlineError) {
      console.error('[dispatch] online-supplier lookup failed:', onlineError.message);
      await markAttempt(db, orderId);
      await alertAdmins(db, orderId, 'Could not load online suppliers; dispatch needs investigation.', 'supplier_lookup_failed');
      return { supplierId: null, reason: 'error' };
    }

    const rows = ((online ?? []) as any[]).filter((r) => r.user_id && !triedSet.has(String(r.user_id)));
    const ids = rows.map((r) => String(r.user_id));

    const noCandidates = async (): Promise<DispatchResult> => {
      await markAttempt(db, orderId);
      await alertAdmins(db, orderId, 'No supplier is available nearby', 'no_supplier');
      return { supplierId: null, reason: 'no_candidates' };
    };

    if (!ids.length) return noCandidates();

    const [profRes, loadRes, lastRes] = await Promise.all([
      db.from('profiles').select('id, role, city, is_active, status, verification_status, milestone_tier').in('id', ids),
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

    if (profRes.error || loadRes.error || lastRes.error) {
      console.error('[dispatch] supplier eligibility lookup failed:', profRes.error ?? loadRes.error ?? lastRes.error);
      await markAttempt(db, orderId);
      await alertAdmins(db, orderId, 'Could not verify supplier eligibility or workload; dispatch needs retry.', 'supplier_eligibility_lookup_failed');
      return { supplierId: null, reason: 'error' };
    }

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
      coverageTier: number; // explicitly mapped first; unconfigured suppliers are fallback only
    };

    const cands: Cand[] = [];
    for (const r of rows) {
      const id = String(r.user_id);
      const p = profById.get(id);
      if (!p) continue;
      if (p.role && String(p.role) !== 'supplier') continue;
      if (p.is_active === false) continue;
      const profileStatus = String(p.status ?? '').trim().toLowerCase();
      if (profileStatus && profileStatus !== 'active') continue;
      if (profileStatus && BLOCKED_STATUS.has(profileStatus)) continue;
      // When the verification field is configured, only an explicit admin
      // approval is eligible for automatic dispatch. NULL remains compatible
      // with older active supplier records that predate this field.
      const verificationStatus = String(p.verification_status ?? '').trim().toLowerCase();
      if (verificationStatus && verificationStatus !== 'approved') continue;

      let coverageTier = 0;
      if (coverageBySupplier) {
        const links = coverageBySupplier.get(id) ?? [];
        const matching = links.find((link) => link.zoneId === String(order.zone_id));
        if (matching) {
          if (matching.serviceKeys !== null &&
              !matching.serviceKeys.includes(String((order as any).__serviceKey))) continue;
        } else {
          // Mapped suppliers for another zone may still be considered as a controlled
          // same-city fallback if this zone's mapped suppliers cannot fulfil the order.
          // The matching-zone suppliers always rank first; cross-city fallback is blocked below.
          coverageTier = 1;
        }
      }

      const load = activeLoad.get(id) ?? 0;
      if (load >= cfg.maxActive) continue;

      const radius = posNum(r.zone_radius_km, cfg.defaultRadiusKm);
      const sLat = coord(r.base_lat);
      const sLng = coord(r.base_lng);

      let group = 2;
      let distance: number | null = null;

      const supplierCity = String(p.city ?? '').trim().toLowerCase().replace(/\s+(nagar|district)$/i, '');
      const orderCity = geo.city.replace(/\s+(nagar|district)$/i, '');
      const sameCity = Boolean(supplierCity && orderCity && supplierCity === orderCity);
      if (coverageTier === 1 && !sameCity) continue;
      if (geo.hasCoords && Number.isFinite(sLat) && Number.isFinite(sLng)) {
        distance = haversineKm(geo.lat, geo.lng, sLat, sLng);
        if (distance <= radius) {
          group = 0;
        } else {
          // Controlled nearby fallback: expand up to 3x the supplier radius (max 20 km),
          // but only within the same city. This never bypasses the customer's zone check.
          const fallbackRadius = Math.min(20, Math.max(radius, radius * 3));
          if (!sameCity || distance > fallbackRadius) continue;
          group = 1;
        }
      } else {
        if (sameCity) {
          group = 2;
        } else {
          continue;
        }
      }

      cands.push({
        id,
        favourite: id === favourite,
        group,
        distance,
        tier: TIER_RANK[String(p.milestone_tier ?? 'starter').toLowerCase()] ?? 0,
        load,
        coverageTier,
      });
    }

    if (!cands.length) return noCandidates();

    cands.sort(
      (a, b) =>
        a.coverageTier - b.coverageTier ||
        a.group - b.group ||
        (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) ||
        Number(b.favourite) - Number(a.favourite) ||
        b.tier - a.tier ||
        a.load - b.load ||
        a.id.localeCompare(b.id)
    );

    for (const c of cands) {
      const { data: reserved, error: reserveError } = await db.rpc('try_assign_supplier_with_stock', {
        p_order_id: orderId,
        p_supplier_id: c.id,
        p_distance_km: c.distance === null ? null : Math.round(c.distance * 100) / 100,
      });

      if (reserveError) {
        console.error('[dispatch] atomic supplier reservation failed:', reserveError);
        continue;
      }

      // False means the supplier lost a race, lacks stock, or the order is no longer pending.
      if (!reserved) continue;

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
    console.error('[dispatch] dispatchOrder failed:', { orderId, error: e instanceof Error ? e.message : e });
    // Make an unhandled dispatch failure visible to the recovery sweep instead of
    // leaving last_dispatch_at NULL forever. The sweep can retry after its interval.
    if (db) {
      await markAttempt(db, orderId).catch((markError) => {
        console.error('[dispatch] failed to record unhandled dispatch failure:', markError);
      });
      await alertAdmins(
        db,
        orderId,
        'Automatic supplier dispatch hit an unexpected error. The order remains pending and will be retried.',
        'dispatch_unhandled_error',
      );
    }
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

    const { data: released, error: releaseError } = await db
      .from('orders')
      .update({ supplier_id: null, status: 'PENDING', assigned_at: null })
      .eq('id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .select('id, customer_id')
      .maybeSingle();

    if (releaseError) {
      console.error('[dispatch] release failed', releaseError.message);
      return { released: false, reassigned: false };
    }
    if (!released) return { released: false, reassigned: false };

    const { error: logError } = await db
      .from('order_dispatch')
      .update({ status: why, responded_at: new Date().toISOString(), reason: note ?? null })
      .eq('order_id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED');
    if (logError) console.error('[dispatch] order_dispatch update failed', logError.message);

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

/* ───────────────────────── Technician dispatch ───────────────────────── */

export type TechnicianDispatchResult = {
  technicianId: string | null;
  reason: 'assigned' | 'not_pending' | 'no_candidates' | 'max_attempts' | 'error';
  distanceKm?: number | null;
};

async function technicianTrustScores(db: any, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const [{ data }, { data: cases }] = await Promise.all([
    db
      .from('orders')
      .select('technician_id, rating, status')
      .in('technician_id', ids)
      .eq('status', 'COMPLETED')
      .limit(5000),
    db
      .from('service_quality_cases')
      .select('technician_id, severity, status')
      .in('technician_id', ids)
      .in('status', ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED', 'ESCALATED'])
      .limit(1000),
  ]);

  const acc = new Map<string, { sum: number; rated: number; completed: number; complaints: number }>();
  for (const row of (data ?? []) as any[]) {
    const id = String(row.technician_id ?? '');
    if (!id) continue;
    const cur = acc.get(id) ?? { sum: 0, rated: 0, completed: 0, complaints: 0 };
    cur.completed += 1;
    const rating = Number(row.rating);
    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      cur.sum += rating;
      cur.rated += 1;
    }
    acc.set(id, cur);
  }

  for (const row of (cases ?? []) as any[]) {
    const id = String(row.technician_id ?? '');
    if (!id) continue;
    const cur = acc.get(id) ?? { sum: 0, rated: 0, completed: 0, complaints: 0 };
    cur.complaints += 1;
    acc.set(id, cur);
  }

  const scores = new Map<string, number>();
  for (const id of ids) {
    const x = acc.get(id);
    if (!x) {
      scores.set(id, 50);
      continue;
    }
    const ratingScore = x.rated ? ((x.sum / x.rated) / 5) * 70 : 50;
    const experienceScore = Math.min(20, x.completed / 20);
    const complaintPenalty = Math.min(25, x.complaints * 5);
    scores.set(id, Math.max(0, Math.round((ratingScore + experienceScore + 10 - complaintPenalty) * 100) / 100));
  }
  return scores;
}

/** Assign a non-water service to the nearest eligible technician with atomic fallback. */
export async function dispatchTechnicianJob(orderId: string): Promise<TechnicianDispatchResult> {
  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);

    const { data: order } = await db
      .from('orders')
      .select('id, customer_id, status, technician_id, address_id, address_snapshot, technician_dispatch_attempts')
      .eq('id', orderId)
      .maybeSingle();

    if (!order || order.status !== 'PENDING' || order.technician_id) {
      return { technicianId: null, reason: 'not_pending' };
    }

    const attempts = Number(order.technician_dispatch_attempts ?? 0);
    const maxAttempts = Math.max(1, Math.min(10, cfg.maxAttempts));
    if (attempts >= maxAttempts) {
      await alertAdmins(db, orderId, 'Technician dispatch attempts exhausted; manual assignment is required.', 'technician_dispatch_exhausted');
      return { technicianId: null, reason: 'max_attempts' };
    }

    const geo = await orderGeo(db, order);
    const { data: tried } = await db.from('technician_job_dispatch').select('technician_id').eq('order_id', orderId);

    const triedSet = new Set(((tried ?? []) as { technician_id: string }[]).map((r) => String(r.technician_id)));

    const { data: techs } = await db
      .from('profiles')
      .select('id, role, city, is_active, status, verification_status, availability_status, current_lat, current_lng, milestone_tier')
      .eq('role', 'technician')
      .eq('is_active', true)
      .in('status', ['active'])
      .limit(ONLINE_SCAN_LIMIT);

    const candidates = ((techs ?? []) as any[]).filter(
      (t) =>
        t.id &&
        !triedSet.has(String(t.id)) &&
        (!t.verification_status || String(t.verification_status).toLowerCase() === 'approved') &&
        ['available', 'online'].includes(String(t.availability_status ?? 'available').toLowerCase()),
    );

    if (!candidates.length) {
      await alertAdmins(db, orderId, 'No eligible technician is currently available.', 'technician_no_candidates');
      return { technicianId: null, reason: 'no_candidates' };
    }

    const ids = candidates.map((t) => String(t.id));
    const [loadRes, scores] = await Promise.all([
      db.from('orders').select('technician_id').in('technician_id', ids).in('status', ['ASSIGNED', 'IN_PROGRESS']),
      technicianTrustScores(db, ids),
    ]);

    const loads = new Map<string, number>();
    for (const row of (loadRes.data ?? []) as any[]) {
      const id = String(row.technician_id ?? '');
      if (id) loads.set(id, (loads.get(id) ?? 0) + 1);
    }

    type Candidate = { id: string; distance: number | null; cityMatch: boolean; load: number; trust: number; tier: number };
    const ranked: Candidate[] = [];

    for (const t of candidates) {
      const id = String(t.id);
      const load = loads.get(id) ?? 0;
      if (load >= TECHNICIAN_MAX_ACTIVE) continue;

      const lat = coord(t.current_lat);
      const lng = coord(t.current_lng);
      let distance: number | null = null;
      let cityMatch = false;

      if (geo.hasCoords && Number.isFinite(lat) && Number.isFinite(lng)) {
        distance = haversineKm(geo.lat, geo.lng, lat, lng);
        if (distance > cfg.defaultRadiusKm) continue;
      } else {
        cityMatch = Boolean(geo.city && String(t.city ?? '').trim().toLowerCase() === geo.city);
        if (!cityMatch) continue;
      }

      ranked.push({
        id,
        distance,
        cityMatch,
        load,
        trust: scores.get(id) ?? 50,
        tier: TIER_RANK[String(t.milestone_tier ?? 'starter').toLowerCase()] ?? 0,
      });
    }

    if (!ranked.length) {
      await alertAdmins(db, orderId, 'No eligible technician matched the service area.', 'technician_no_candidates');
      return { technicianId: null, reason: 'no_candidates' };
    }

    ranked.sort(
      (a, b) =>
        (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) ||
        Number(b.cityMatch) - Number(a.cityMatch) ||
        b.trust - a.trust ||
        a.load - b.load ||
        b.tier - a.tier ||
        a.id.localeCompare(b.id)
    );

    for (const candidate of ranked) {
      const { data: won, error } = await db.rpc('try_assign_technician', {
        p_order_id: orderId,
        p_technician_id: candidate.id,
        p_distance_km: candidate.distance == null ? null : Math.round(candidate.distance * 100) / 100,
        p_trust_score: candidate.trust,
      });

      if (error) {
        console.error('[dispatch] technician atomic assignment failed:', error);
        continue;
      }
      if (!won) continue;

      await notify(
        candidate.id,
        'New service job available',
        candidate.distance != null
          ? `A new service job is about ${candidate.distance.toFixed(1)} km away.`
          : 'A new service job is available in your area.',
        'booking',
        orderId,
        'technician_assigned',
      );

      await notify(
        String(order.customer_id),
        'Technician assigned',
        'A verified technician has been assigned to your service.',
        'booking',
        orderId,
        'technician_assigned',
      );

      return { technicianId: candidate.id, reason: 'assigned', distanceKm: candidate.distance };
    }

    await alertAdmins(db, orderId, 'Eligible technicians were found but assignment lost a concurrency race or was rejected.', 'technician_assignment_failed');
    return { technicianId: null, reason: 'no_candidates' };
  } catch (e) {
    console.error('[dispatch] technician dispatch failed:', e);
    return { technicianId: null, reason: 'error' };
  }
}

/** Release a technician offer and automatically try the next ranked technician. */
export async function releaseTechnicianAssignment(
  orderId: string,
  technicianId: string,
  why: 'REJECTED' | 'EXPIRED',
): Promise<{ released: boolean; reassigned: boolean }> {
  try {
    const db: any = createServiceClient();

    const { data: released, error } = await db.rpc('release_technician_assignment', {
      p_order_id: orderId,
      p_technician_id: technicianId,
      p_reason: why,
    });

    if (error || !released) return { released: false, reassigned: false };

    const next = await dispatchTechnicianJob(orderId);

    await notify(
      technicianId,
      why === 'EXPIRED' ? 'Job reassigned' : 'Job declined',
      why === 'EXPIRED'
        ? 'You did not respond in time, so this job was offered to another technician.'
        : 'You declined the job. We are finding the next eligible technician.',
      'system',
      orderId,
      why === 'EXPIRED' ? 'expired' : 'rejected',
    );

    return { released: true, reassigned: Boolean(next.technicianId) };
  } catch (e) {
    console.error('[dispatch] technician release failed:', e);
    return { released: false, reassigned: false };
  }
}

/* ───────────────────────── Maintenance sweeps ───────────────────────── */

/** Hands back water orders a supplier never answered, then offers them to the next supplier. */
async function expireStaleAssignments(db: any, cfg: Cfg, limit: number, customerId?: string): Promise<number> {
  const staleBefore = new Date(Date.now() - cfg.responseSeconds * 1000).toISOString();
  let q = db
    .from('orders')
    .select('id, supplier_id')
    .eq('service_type', 'water_can')
    .eq('status', 'ASSIGNED')
    .is('accepted_at', null)
    .lt('assigned_at', staleBefore)
    .order('assigned_at', { ascending: true })
    .limit(limit);
  if (customerId) q = q.eq('customer_id', customerId);

  const { data: stale, error } = await q;
  if (error) {
    console.error('[dispatch] stale lookup failed', error.message);
    return 0;
  }

  let n = 0;
  for (const o of (stale ?? []) as { id: string; supplier_id: string | null }[]) {
    if (!o.supplier_id) continue;
    const r = await releaseAssignment(String(o.id), String(o.supplier_id), 'EXPIRED', 'no response');
    if (r.released) n += 1;
  }
  return n;
}

/** Re-offers PENDING water orders that no supplier holds, at most once per PENDING_RETRY_AFTER_MS each. */
async function retryPendingOrders(db: any, cfg: Cfg, limit: number, customerId?: string): Promise<number> {
  let q = db
    .from('orders')
    .select('id, last_dispatch_at, dispatch_attempts')
    .eq('service_type', 'water_can')
    .eq('status', 'PENDING')
    .is('supplier_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (customerId) q = q.eq('customer_id', customerId);

  const { data: pending, error } = await q;
  if (error) {
    console.error('[dispatch] pending lookup failed', error.message);
    return 0;
  }

  const retryBefore = Date.now() - PENDING_RETRY_AFTER_MS;
  let n = 0;
  for (const o of (pending ?? []) as { id: string; last_dispatch_at: string | null; dispatch_attempts: number | null }[]) {
    if (Number(o.dispatch_attempts ?? 0) >= cfg.maxAttempts) continue;
    const last = o.last_dispatch_at ? new Date(o.last_dispatch_at).getTime() : 0;
    if (last < retryBefore) {
      await dispatchOrder(String(o.id));
      n += 1;
    }
  }
  return n;
}

/** Lazy maintenance for one customer's water orders (runs when they open their orders). Never throws. */
export async function sweepCustomerOrders(customerId: string): Promise<void> {
  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);
    if (!cfg.enabled) return;
    await expireStaleAssignments(db, cfg, 5, customerId);
    await retryPendingOrders(db, cfg, 5, customerId);
  } catch (e) {
    console.error('[dispatch] sweep failed:', e);
  }
}

/**
 * Maintenance for ALL customers. Call it from a scheduled job (see api/cron/dispatch-sweep).
 * sweepCustomerOrders only runs when a customer opens the app, so without a schedule an order
 * a supplier ignores stays stuck until its customer comes back.
 */
export async function sweepStaleOrders(limit = 25): Promise<{ expired: number; retried: number }> {
  try {
    const db: any = createServiceClient();
    const cfg = await loadCfg(db);
    if (!cfg.enabled) return { expired: 0, retried: 0 };
    const expired = await expireStaleAssignments(db, cfg, limit);
    const retried = await retryPendingOrders(db, cfg, limit);
    return { expired, retried };
  } catch (e) {
    console.error('[dispatch] global sweep failed:', e);
    return { expired: 0, retried: 0 };
  }
}

/* ───────────────────────── Accepting an order ───────────────────────── */

/**
 * Supplier confirms an assigned order. Once accepted it is never reassigned.
 * Idempotent: confirming an order you already confirmed returns 'already_accepted', not a failure.
 */
export async function acceptAssignmentDetailed(orderId: string, supplierId: string): Promise<AcceptResult> {
  try {
    const db: any = createServiceClient();
    const now = new Date().toISOString();

    const { data: ok, error } = await db
      .from('orders')
      .update({ accepted_at: now })
      .eq('id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED')
      .is('accepted_at', null)
      .select('id, customer_id')
      .maybeSingle();

    if (error) {
      console.error('[dispatch] acceptAssignment update failed', error.message);
      return 'error';
    }

    if (!ok) {
      // Nothing changed: work out WHY, so the caller can answer precisely.
      const { data: cur, error: curError } = await db
        .from('orders')
        .select('supplier_id, status, accepted_at')
        .eq('id', orderId)
        .maybeSingle();
      if (curError) {
        console.error('[dispatch] acceptAssignment lookup failed', curError.message);
        return 'error';
      }
      const mine = cur && String(cur.supplier_id ?? '') === supplierId;
      const live = cur && ['ASSIGNED', 'IN_PROGRESS'].includes(String(cur.status ?? '').toUpperCase());
      return mine && live && cur.accepted_at ? 'already_accepted' : 'not_assigned';
    }

    const { error: logError } = await db
      .from('order_dispatch')
      .update({ status: 'ACCEPTED', responded_at: now })
      .eq('order_id', orderId)
      .eq('supplier_id', supplierId)
      .eq('status', 'ASSIGNED');
    if (logError) console.error('[dispatch] order_dispatch accept update failed', logError.message);

    await notify(
      String(ok.customer_id),
      'Supplier confirmed',
      'Your supplier has confirmed your order.',
      'booking',
      orderId,
      'accepted'
    );
    return 'accepted';
  } catch (e) {
    console.error('[dispatch] acceptAssignment failed:', e);
    return 'error';
  }
}

/** Boolean form kept for existing callers: true only when THIS call accepted the order. */
export async function acceptAssignment(orderId: string, supplierId: string): Promise<boolean> {
  return (await acceptAssignmentDetailed(orderId, supplierId)) === 'accepted';
}











// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { createServiceClient } from '@/utils/supabase/server';

// /**
//  * Supplier dispatch engine.
//  *   PENDING --dispatchOrder--> ASSIGNED (supplier notified)
//  *   ASSIGNED --reject / timeout--> releaseAssignment --> next supplier
//  *   ASSIGNED --accept--> accepted_at set (never reassigned)
//  */

// export type DispatchReason =
//   | 'assigned'
//   | 'disabled'
//   | 'not_pending'
//   | 'no_candidates'
//   | 'max_attempts'
//   | 'error';

// export type DispatchResult = {
//   supplierId: string | null;
//   reason: DispatchReason;
//   distanceKm?: number | null;
// };

// type Cfg = {
//   enabled: boolean;
//   responseSeconds: number;
//   maxAttempts: number;
//   maxActive: number;
//   defaultRadiusKm: number;
// };

// const TIER_RANK: Record<string, number> = {
//   starter: 0,
//   bronze: 1,
//   silver: 2,
//   gold: 3,
//   platinum: 4,
// };

// const BLOCKED_STATUS = new Set(['pending', 'rejected', 'suspended', 'blocked', 'banned', 'inactive', 'disabled']);

// function posNum(v: unknown, d: number): number {
//   const n = Number(v);
//   return Number.isFinite(n) && n > 0 ? n : d;
// }

// function coord(v: unknown): number {
//   if (v === null || v === undefined || v === '') return NaN;
//   return Number(v);
// }

// function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
//   const R = 6371;
//   const toRad = (x: number) => (x * Math.PI) / 180;
//   const dLat = toRad(bLat - aLat);
//   const dLng = toRad(bLng - aLng);
//   const s =
//     Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
//   return 2 * R * Math.asin(Math.sqrt(s));
// }

// async function loadCfg(db: any): Promise<Cfg> {
//   const { data } = await db
//     .from('settings')
//     .select('key, value')
//     .in('key', [
//       'auto_assign_orders',
//       'dispatch_response_seconds',
//       'dispatch_max_attempts',
//       'supplier_max_active_orders',
//       'service_radius_km',
//     ]);
//   const m: Record<string, string> = {};
//   for (const r of (data ?? []) as { key: string; value: unknown }[]) m[r.key] = String(r.value);
//   return {
//     enabled: String(m.auto_assign_orders ?? 'true').toLowerCase() !== 'false',
//     responseSeconds: posNum(m.dispatch_response_seconds, 300),
//     maxAttempts: Math.floor(posNum(m.dispatch_max_attempts, 5)),
//     maxActive: Math.floor(posNum(m.supplier_max_active_orders, 5)),
//     defaultRadiusKm: posNum(m.service_radius_km, 10),
//   };
// }

// async function notify(
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
//     console.error('[dispatch] notify failed', event, e);
//   }
// }

// async function alertAdmins(db: any, orderId: string, message: string, action: string) {
//   try {
//     const { data: admins } = await db.from('profiles').select('id').eq('role', 'admin').limit(20);
//     for (const a of (admins ?? []) as { id?: string }[]) {
//       if (!a.id) continue;
//       await db.from('notifications').insert({
//         user_id: a.id,
//         title: 'Unassigned order',
//         body: `${message} (order ${orderId})`,
//         type: 'system',
//         order_id: orderId,
//         is_read: false,
//         dedup_key: `order_${orderId}_${action}`,
//       });
//     }
//     await db.from('audit_logs').insert({
//       actor_id: null,
//       action: `order.${action}`,
//       entity: 'orders',
//       entity_id: orderId,
//       meta: { message },
//     });
//   } catch {
//     /* best-effort; duplicates are expected */
//   }
// }

// async function orderGeo(db: any, order: any) {
//   let lat = NaN;
//   let lng = NaN;
//   let city = '';
//   if (order.address_id) {
//     const { data: a } = await db.from('addresses').select('lat, lng, city').eq('id', order.address_id).maybeSingle();
//     if (a) {
//       lat = coord(a.lat);
//       lng = coord(a.lng);
//       city = String(a.city ?? '');
//     }
//   }
//   const snap = order.address_snapshot && typeof order.address_snapshot === 'object' ? order.address_snapshot : null;
//   if (snap) {
//     if (!city) city = String(snap.city ?? '');
//     if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
//       lat = coord(snap.lat);
//       lng = coord(snap.lng);
//     }
//   }
//   return {
//     lat,
//     lng,
//     hasCoords: Number.isFinite(lat) && Number.isFinite(lng),
//     city: city.trim().toLowerCase(),
//   };
// }

// async function markAttempt(db: any, orderId: string) {
//   await db.from('orders').update({ last_dispatch_at: new Date().toISOString() }).eq('id', orderId);
// }

// /** Try to assign the best available supplier to a PENDING order. Safe to call repeatedly. */
// export async function dispatchOrder(orderId: string): Promise<DispatchResult> {
//   try {
//     const db: any = createServiceClient();
//     const cfg = await loadCfg(db);

//     const { data: order } = await db
//       .from('orders')
//       .select('id, customer_id, status, supplier_id, address_id, address_snapshot, dispatch_attempts')
//       .eq('id', orderId)
//       .maybeSingle();

//     if (!order || order.status !== 'PENDING' || order.supplier_id) {
//       return { supplierId: null, reason: 'not_pending' };
//     }

//     if (!cfg.enabled) {
//       await markAttempt(db, orderId);
//       await alertAdmins(db, orderId, 'Auto-assign is off. Please assign a supplier manually', 'no_supplier');
//       return { supplierId: null, reason: 'disabled' };
//     }

//     const attempts = Number(order.dispatch_attempts ?? 0);
//     if (attempts >= cfg.maxAttempts) {
//       await alertAdmins(db, orderId, 'Every supplier tried declined or timed out', 'dispatch_exhausted');
//       return { supplierId: null, reason: 'max_attempts' };
//     }

//     const geo = await orderGeo(db, order);

//     const { data: tried } = await db.from('order_dispatch').select('supplier_id').eq('order_id', orderId);
//     const triedSet = new Set(((tried ?? []) as { supplier_id: string }[]).map((r) => String(r.supplier_id)));

//     const { data: online } = await db
//       .from('supplier_settings')
//       .select('user_id, zone_radius_km, base_lat, base_lng')
//       .eq('is_online', true)
//       .limit(500);

//     const rows = ((online ?? []) as any[]).filter((r) => r.user_id && !triedSet.has(String(r.user_id)));
//     const ids = rows.map((r) => String(r.user_id));

//     const noCandidates = async (): Promise<DispatchResult> => {
//       await markAttempt(db, orderId);
//       await alertAdmins(db, orderId, 'No supplier is available nearby', 'no_supplier');
//       return { supplierId: null, reason: 'no_candidates' };
//     };

//     if (!ids.length) return noCandidates();

//     const [profRes, loadRes, lastRes] = await Promise.all([
//       db.from('profiles').select('id, role, city, is_active, status, milestone_tier').in('id', ids),
//       db.from('orders').select('supplier_id').in('supplier_id', ids).in('status', ['ASSIGNED', 'IN_PROGRESS']),
//       db
//         .from('orders')
//         .select('supplier_id')
//         .eq('customer_id', order.customer_id)
//         .eq('status', 'COMPLETED')
//         .not('supplier_id', 'is', null)
//         .order('created_at', { ascending: false })
//         .limit(1)
//         .maybeSingle(),
//     ]);

//     const profById = new Map<string, any>(((profRes.data ?? []) as any[]).map((p) => [String(p.id), p]));
//     const activeLoad = new Map<string, number>();
//     for (const r of (loadRes.data ?? []) as { supplier_id: string }[]) {
//       const k = String(r.supplier_id);
//       activeLoad.set(k, (activeLoad.get(k) ?? 0) + 1);
//     }
//     const favourite = (lastRes.data as { supplier_id?: string } | null)?.supplier_id
//       ? String((lastRes.data as { supplier_id: string }).supplier_id)
//       : null;

//     type Cand = {
//       id: string;
//       favourite: boolean;
//       group: number; // 0 = within radius by coordinates, 1 = same city, 2 = unknown location
//       distance: number | null;
//       tier: number;
//       load: number;
//     };

//     const cands: Cand[] = [];
//     for (const r of rows) {
//       const id = String(r.user_id);
//       const p = profById.get(id);
//       if (!p) continue;
//       if (p.role && String(p.role) !== 'supplier') continue;
//       if (p.is_active === false) continue;
//       if (p.status && BLOCKED_STATUS.has(String(p.status).toLowerCase())) continue;

//       const load = activeLoad.get(id) ?? 0;
//       if (load >= cfg.maxActive) continue;

//       const radius = posNum(r.zone_radius_km, cfg.defaultRadiusKm);
//       const sLat = coord(r.base_lat);
//       const sLng = coord(r.base_lng);

//       let group = 2;
//       let distance: number | null = null;

//       if (geo.hasCoords && Number.isFinite(sLat) && Number.isFinite(sLng)) {
//         distance = haversineKm(geo.lat, geo.lng, sLat, sLng);
//         if (distance > radius) continue;
//         group = 0;
//       } else {
//         const sCity = String(p.city ?? '').trim().toLowerCase();
//         if (sCity && geo.city) {
//           if (sCity !== geo.city) continue;
//           group = 1;
//         }
//       }

//       cands.push({
//         id,
//         favourite: id === favourite,
//         group,
//         distance,
//         tier: TIER_RANK[String(p.milestone_tier ?? 'starter').toLowerCase()] ?? 0,
//         load,
//       });
//     }

//     if (!cands.length) return noCandidates();

//     cands.sort(
//       (a, b) =>
//         a.group - b.group ||
//         (a.distance ?? Number.POSITIVE_INFINITY) -
//           (b.distance ?? Number.POSITIVE_INFINITY) ||
//         Number(b.favourite) - Number(a.favourite) ||
//         b.tier - a.tier ||
//         a.load - b.load ||
//         a.id.localeCompare(b.id)
//     );

//     for (const c of cands) {
//       const { data: reserved, error: reserveError } = await db.rpc(
//         'try_assign_supplier_with_stock',
//         {
//           p_order_id: orderId,
//           p_supplier_id: c.id,
//           p_distance_km:
//             c.distance === null ? null : Math.round(c.distance * 100) / 100,
//         }
//       );

//       if (reserveError) {
//         console.error('[dispatch] atomic supplier reservation failed:', reserveError);
//         continue;
//       }

//       // False means the supplier lost a race, lacks stock, or the order is no
//       // longer pending. Continue to the next ranked supplier when appropriate.
//       if (!reserved) {
//         continue;
//       }

//       await notify(
//         c.id,
//         'New order incoming',
//         c.distance !== null
//           ? `A new delivery about ${c.distance.toFixed(1)} km away needs your confirmation.`
//           : 'A new delivery needs your confirmation.',
//         'system',
//         orderId,
//         'assigned'
//       );

//       return { supplierId: c.id, reason: 'assigned', distanceKm: c.distance };
//     }

//     return noCandidates();
//   } catch (e) {
//     console.error('[dispatch] dispatchOrder failed:', e);
//     return { supplierId: null, reason: 'error' };
//   }
// }

// /** Take an order back from a supplier (rejected / no response) and offer it to the next one. */
// export async function releaseAssignment(
//   orderId: string,
//   supplierId: string,
//   why: 'REJECTED' | 'EXPIRED',
//   note?: string
// ): Promise<{ released: boolean; reassigned: boolean }> {
//   try {
//     const db: any = createServiceClient();

//     const { data: released } = await db
//       .from('orders')
//       .update({ supplier_id: null, status: 'PENDING', assigned_at: null })
//       .eq('id', orderId)
//       .eq('supplier_id', supplierId)
//       .eq('status', 'ASSIGNED')
//       .is('accepted_at', null)
//       .select('id, customer_id')
//       .maybeSingle();

//     if (!released) return { released: false, reassigned: false };

//     await db
//       .from('order_dispatch')
//       .update({ status: why, responded_at: new Date().toISOString(), reason: note ?? null })
//       .eq('order_id', orderId)
//       .eq('supplier_id', supplierId)
//       .eq('status', 'ASSIGNED');

//     if (why === 'EXPIRED') {
//       await notify(
//         supplierId,
//         'Order reassigned',
//         'You did not respond in time, so the order went to another supplier.',
//         'system',
//         orderId,
//         'expired'
//       );
//     }

//     const next = await dispatchOrder(orderId);

//     await notify(
//       String(released.customer_id),
//       'Finding you a new supplier',
//       next.supplierId
//         ? 'Your order has been passed to another nearby supplier.'
//         : 'We are looking for another supplier for your order.',
//       'booking',
//       orderId,
//       'reassigned'
//     );

//     return { released: true, reassigned: Boolean(next.supplierId) };
//   } catch (e) {
//     console.error('[dispatch] releaseAssignment failed:', e);
//     return { released: false, reassigned: false };
//   }
// }

// export type TechnicianDispatchResult = {
//   technicianId: string | null;
//   reason: 'assigned' | 'not_pending' | 'no_candidates' | 'max_attempts' | 'error';
//   distanceKm?: number | null;
// };

// async function technicianTrustScores(db: any, ids: string[]) {
//   if (!ids.length) return new Map<string, number>();
//   const [{ data }, { data: cases }] = await Promise.all([
//     db
//       .from('orders')
//       .select('technician_id, rating, status')
//       .in('technician_id', ids)
//       .eq('status', 'COMPLETED')
//       .limit(5000),
//     db
//       .from('service_quality_cases')
//       .select('technician_id, severity, status')
//       .in('technician_id', ids)
//       .in('status', ['OPEN','ASSIGNED','INVESTIGATING','ACTION_REQUIRED','ESCALATED'])
//       .limit(1000),
//   ]);

//   const acc = new Map<string, { sum: number; rated: number; completed: number; complaints: number }>();
//   for (const row of (data ?? []) as any[]) {
//     const id = String(row.technician_id ?? '');
//     if (!id) continue;
//     const cur = acc.get(id) ?? { sum: 0, rated: 0, completed: 0, complaints: 0 };
//     cur.completed += 1;
//     const rating = Number(row.rating);
//     if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
//       cur.sum += rating;
//       cur.rated += 1;
//     }
//     acc.set(id, cur);
//   }

//   for (const row of (cases ?? []) as any[]) {
//     const id = String(row.technician_id ?? '');
//     if (!id) continue;
//     const cur = acc.get(id) ?? { sum: 0, rated: 0, completed: 0, complaints: 0 };
//     cur.complaints += 1;
//     acc.set(id, cur);
//   }

//   const scores = new Map<string, number>();
//   for (const id of ids) {
//     const x = acc.get(id);
//     if (!x) {
//       scores.set(id, 50);
//       continue;
//     }
//     const ratingScore = x.rated ? (x.sum / x.rated) / 5 * 70 : 50;
//     const experienceScore = Math.min(20, x.completed / 20);
//     const complaintPenalty = Math.min(25, x.complaints * 5);
//     scores.set(id, Math.max(0, Math.round((ratingScore + experienceScore + 10 - complaintPenalty) * 100) / 100));
//   }
//   return scores;
// }

// /** Assign a non-water service to the nearest eligible technician with atomic fallback. */
// export async function dispatchTechnicianJob(orderId: string): Promise<TechnicianDispatchResult> {
//   try {
//     const db: any = createServiceClient();
//     const cfg = await loadCfg(db);

//     const { data: order } = await db
//       .from('orders')
//       .select('id, customer_id, status, technician_id, address_id, address_snapshot, technician_dispatch_attempts')
//       .eq('id', orderId)
//       .maybeSingle();

//     if (!order || order.status !== 'PENDING' || order.technician_id) {
//       return { technicianId: null, reason: 'not_pending' };
//     }

//     const attempts = Number(order.technician_dispatch_attempts ?? 0);
//     const maxAttempts = Math.max(1, Math.min(10, cfg.maxAttempts));
//     if (attempts >= maxAttempts) {
//       await alertAdmins(db, orderId, 'Technician dispatch attempts exhausted; manual assignment is required.', 'technician_dispatch_exhausted');
//       return { technicianId: null, reason: 'max_attempts' };
//     }

//     const geo = await orderGeo(db, order);
//     const { data: tried } = await db
//       .from('technician_job_dispatch')
//       .select('technician_id')
//       .eq('order_id', orderId);

//     const triedSet = new Set(
//       ((tried ?? []) as { technician_id: string }[]).map((r) => String(r.technician_id)),
//     );

//     const { data: techs } = await db
//       .from('profiles')
//       .select('id, role, city, is_active, status, verification_status, availability_status, current_lat, current_lng, milestone_tier')
//       .eq('role', 'technician')
//       .eq('is_active', true)
//       .in('status', ['active'])
//       .limit(500);

//     const candidates = ((techs ?? []) as any[]).filter((t) =>
//       t.id && !triedSet.has(String(t.id)) &&
//       (!t.verification_status || String(t.verification_status).toLowerCase() === 'approved') &&
//       ['available', 'online'].includes(String(t.availability_status ?? 'available').toLowerCase()),
//     );

//     if (!candidates.length) {
//       await alertAdmins(db, orderId, 'No eligible technician is currently available.', 'technician_no_candidates');
//       return { technicianId: null, reason: 'no_candidates' };
//     }

//     const ids = candidates.map((t) => String(t.id));
//     const [loadRes, scores] = await Promise.all([
//       db.from('orders').select('technician_id').in('technician_id', ids).in('status', ['ASSIGNED', 'IN_PROGRESS']),
//       technicianTrustScores(db, ids),
//     ]);

//     const loads = new Map<string, number>();
//     for (const row of (loadRes.data ?? []) as any[]) {
//       const id = String(row.technician_id ?? '');
//       if (id) loads.set(id, (loads.get(id) ?? 0) + 1);
//     }

//     type Candidate = { id: string; distance: number | null; cityMatch: boolean; load: number; trust: number; tier: number };
//     const ranked: Candidate[] = [];

//     for (const t of candidates) {
//       const id = String(t.id);
//       const load = loads.get(id) ?? 0;
//       if (load >= 3) continue;

//       const lat = coord(t.current_lat);
//       const lng = coord(t.current_lng);
//       let distance: number | null = null;
//       let cityMatch = false;

//       if (geo.hasCoords && Number.isFinite(lat) && Number.isFinite(lng)) {
//         distance = haversineKm(geo.lat, geo.lng, lat, lng);
//         if (distance > cfg.defaultRadiusKm) continue;
//       } else {
//         cityMatch = Boolean(geo.city && String(t.city ?? '').trim().toLowerCase() === geo.city);
//         if (!cityMatch) continue;
//       }

//       ranked.push({
//         id,
//         distance,
//         cityMatch,
//         load,
//         trust: scores.get(id) ?? 50,
//         tier: TIER_RANK[String(t.milestone_tier ?? 'starter').toLowerCase()] ?? 0,
//       });
//     }

//     if (!ranked.length) {
//       await alertAdmins(db, orderId, 'No eligible technician matched the service area.', 'technician_no_candidates');
//       return { technicianId: null, reason: 'no_candidates' };
//     }

//     ranked.sort((a,b) =>
//       (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) ||
//       Number(b.cityMatch) - Number(a.cityMatch) ||
//       b.trust - a.trust ||
//       a.load - b.load ||
//       b.tier - a.tier ||
//       a.id.localeCompare(b.id)
//     );

//     for (const candidate of ranked) {
//       const { data: won, error } = await db.rpc('try_assign_technician', {
//         p_order_id: orderId,
//         p_technician_id: candidate.id,
//         p_distance_km: candidate.distance == null ? null : Math.round(candidate.distance * 100) / 100,
//         p_trust_score: candidate.trust,
//       });

//       if (error) {
//         console.error('[dispatch] technician atomic assignment failed:', error);
//         continue;
//       }
//       if (!won) continue;

//       await notify(
//         candidate.id,
//         'New service job available',
//         candidate.distance != null
//           ? `A new service job is about ${candidate.distance.toFixed(1)} km away.`
//           : 'A new service job is available in your area.',
//         'booking',
//         orderId,
//         'technician_assigned',
//       );

//       await notify(
//         String(order.customer_id),
//         'Technician assigned',
//         'A verified technician has been assigned to your service.',
//         'booking',
//         orderId,
//         'technician_assigned',
//       );

//       return {
//         technicianId: candidate.id,
//         reason: 'assigned',
//         distanceKm: candidate.distance,
//       };
//     }

//     await alertAdmins(db, orderId, 'Eligible technicians were found but assignment lost a concurrency race or was rejected.', 'technician_assignment_failed');
//     return { technicianId: null, reason: 'no_candidates' };
//   } catch (e) {
//     console.error('[dispatch] technician dispatch failed:', e);
//     return { technicianId: null, reason: 'error' };
//   }
// }

// /** Release a technician offer and automatically try the next ranked technician. */
// export async function releaseTechnicianAssignment(
//   orderId: string,
//   technicianId: string,
//   why: 'REJECTED' | 'EXPIRED',
// ): Promise<{ released: boolean; reassigned: boolean }> {
//   try {
//     const db: any = createServiceClient();

//     const { data: released, error } = await db.rpc('release_technician_assignment', {
//       p_order_id: orderId,
//       p_technician_id: technicianId,
//       p_reason: why,
//     });

//     if (error || !released) {
//       return { released: false, reassigned: false };
//     }

//     const next = await dispatchTechnicianJob(orderId);

//     await notify(
//       technicianId,
//       why === 'EXPIRED' ? 'Job reassigned' : 'Job declined',
//       why === 'EXPIRED'
//         ? 'You did not respond in time, so this job was offered to another technician.'
//         : 'You declined the job. We are finding the next eligible technician.',
//       'system',
//       orderId,
//       why === 'EXPIRED' ? 'expired' : 'rejected',
//     );

//     return { released: true, reassigned: Boolean(next.technicianId) };
//   } catch (e) {
//     console.error('[dispatch] technician release failed:', e);
//     return { released: false, reassigned: false };
//   }
// }

// /** Lazy maintenance for one customer's water orders (no cron needed). Never throws. */
// export async function sweepCustomerOrders(customerId: string): Promise<void> {
//   try {
//     const db: any = createServiceClient();
//     const cfg = await loadCfg(db);
//     if (!cfg.enabled) return;

//     const staleBefore = new Date(Date.now() - cfg.responseSeconds * 1000).toISOString();
//     const { data: stale } = await db
//       .from('orders')
//       .select('id, supplier_id')
//       .eq('customer_id', customerId)
//       .eq('service_type', 'water_can')
//       .eq('status', 'ASSIGNED')
//       .is('accepted_at', null)
//       .lt('assigned_at', staleBefore)
//       .limit(5);

//     for (const o of (stale ?? []) as { id: string; supplier_id: string | null }[]) {
//       if (o.supplier_id) await releaseAssignment(String(o.id), String(o.supplier_id), 'EXPIRED', 'no response');
//     }

//     const retryBefore = Date.now() - 30_000;
//     const { data: pending } = await db
//       .from('orders')
//       .select('id, last_dispatch_at, dispatch_attempts')
//       .eq('customer_id', customerId)
//       .eq('service_type', 'water_can')
//       .eq('status', 'PENDING')
//       .is('supplier_id', null)
//       .limit(5);

//     for (const o of (pending ?? []) as { id: string; last_dispatch_at: string | null; dispatch_attempts: number | null }[]) {
//       if (Number(o.dispatch_attempts ?? 0) >= cfg.maxAttempts) continue;
//       const last = o.last_dispatch_at ? new Date(o.last_dispatch_at).getTime() : 0;
//       if (last < retryBefore) await dispatchOrder(String(o.id));
//     }
//   } catch (e) {
//     console.error('[dispatch] sweep failed:', e);
//   }
// }

// /** Supplier confirms an assigned order. Once accepted it is never reassigned. */
// export async function acceptAssignment(orderId: string, supplierId: string): Promise<boolean> {
//   try {
//     const db: any = createServiceClient();
//     const now = new Date().toISOString();
//     const { data: ok } = await db
//       .from('orders')
//       .update({ accepted_at: now })
//       .eq('id', orderId)
//       .eq('supplier_id', supplierId)
//       .eq('status', 'ASSIGNED')
//       .is('accepted_at', null)
//       .select('id, customer_id')
//       .maybeSingle();
//     if (!ok) return false;

//     await db
//       .from('order_dispatch')
//       .update({ status: 'ACCEPTED', responded_at: now })
//       .eq('order_id', orderId)
//       .eq('supplier_id', supplierId)
//       .eq('status', 'ASSIGNED');

//     await notify(
//       String(ok.customer_id),
//       'Supplier confirmed',
//       'Your supplier has confirmed your order.',
//       'booking',
//       orderId,
//       'accepted'
//     );
//     return true;
//   } catch (e) {
//     console.error('[dispatch] acceptAssignment failed:', e);
//     return false;
//   }
// }
