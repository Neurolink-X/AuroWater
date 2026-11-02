/**
 * Supplier planning helpers. Read-only: never used to approve coverage, assign orders,
 * reserve stock, confirm a payment, or change a live serviceability decision.
 */
export type SupplierOrderSample = {
  id: string;
  status: string | null;
  service_type: string | null;
  can_count: number | null;
  created_at: string | null;
  scheduled_at: string | null;
  completed_at?: string | null;
  accepted_at?: string | null;
  address_id?: string | null;
  zone_id?: string | null;
};

export type OfferSample = { status: string | null };
export type StockSample = {
  cans_available?: number | null;
  reserved_cans?: number | null;
  reservation_buffer_cans?: number | null;
};

const DAY_MS = 86_400_000;
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const IST = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: '2-digit', hourCycle: 'h23',
});

export function istSlot(value: string | number | Date | null | undefined) {
  if (value == null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const p = Object.fromEntries(IST.formatToParts(date).map(part => [part.type, part.value]));
  const weekday = WEEKDAY[p.weekday];
  if (weekday === undefined) return null;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    weekday,
  };
}

export function tomorrowInIST(now: Date = new Date()) {
  // Noon IST avoids UTC-midnight ambiguity for a local calendar-day boundary.
  const t = istSlot(new Date(now.getTime() + DAY_MS));
  return t;
}

function cans(order: SupplierOrderSample): number {
  const qty = Number(order.can_count ?? 0);
  return Number.isSafeInteger(qty) && qty > 0 && qty <= 500 ? qty : 0;
}

export function forecastSupplierStock(
  orders: readonly SupplierOrderSample[],
  stock: StockSample | null,
  now: Date = new Date(),
) {
  const targetDay = tomorrowInIST(now);
  const current = Math.max(0, Number(stock?.cans_available ?? 0));
  const reserved = Math.max(0, Number(stock?.reserved_cans ?? 0));
  const buffer = Math.max(0, Number(stock?.reservation_buffer_cans ?? 0));
  // Existing stock reservation has authority; this is only a refill suggestion.
  const available = Math.max(0, Math.floor(current - reserved - buffer));
  if (!targetDay) return {
    estimated_cans: null, confirmed_cans: 0, suggested_target: 0,
    free_stock: available, refill_suggestion: 0, confidence: 'insufficient' as const,
    historical_deliveries: 0,
  };

  const recentCutoff = now.getTime() - 56 * DAY_MS;
  const deliveries = orders.filter(o =>
    o.service_type === 'water_can' && o.status === 'COMPLETED' &&
    cans(o) > 0 && o.scheduled_at &&
    Date.parse(o.scheduled_at) >= recentCutoff && Date.parse(o.scheduled_at) <= now.getTime()
  );
  // Include zero-demand days; otherwise a few unusually busy days inflate forecasts.
  const weekdayDaily = new Array<number>(8).fill(0);
  const all28 = new Array<number>(28).fill(0);
  for (const order of deliveries) {
    const t = Date.parse(order.scheduled_at!);
    const daysAgo = Math.floor((now.getTime() - t) / DAY_MS);
    const local = istSlot(order.scheduled_at);
    if (!local || daysAgo < 0 || daysAgo >= 56) continue;
    if (local.weekday === targetDay.weekday) {
      const weekIndex = Math.min(7, Math.floor(daysAgo / 7));
      weekdayDaily[weekIndex] += cans(order);
    }
    if (daysAgo < 28) all28[daysAgo] += cans(order);
  }
  const weightTotal = weekdayDaily.reduce((sum, _v, i) => sum + (i < 4 ? 2 : 1), 0);
  const sameWeekday = weekdayDaily.reduce((sum, v, i) => sum + v * (i < 4 ? 2 : 1), 0) / weightTotal;
  const dailyAverage = all28.reduce((sum, n) => sum + n, 0) / 28;
  const hasHistory = deliveries.length >= 3;
  const estimate = hasHistory ? Math.max(0, Math.ceil(sameWeekday * 0.7 + dailyAverage * 0.3)) : null;

  const confirmed = orders
    .filter(o => o.service_type === 'water_can' && ['ASSIGNED', 'IN_PROGRESS'].includes(o.status ?? '') &&
      istSlot(o.scheduled_at)?.date === targetDay.date)
    .reduce((sum, o) => sum + cans(o), 0);
  const target = Math.max(confirmed, estimate === null ? 0 : Math.ceil(estimate * 1.15));
  return {
    estimated_cans: estimate,
    confirmed_cans: confirmed,
    suggested_target: target,
    free_stock: available,
    refill_suggestion: Math.max(0, target - available),
    confidence: deliveries.length >= 15 ? 'moderate' as const : hasHistory ? 'low' as const : 'insufficient' as const,
    historical_deliveries: deliveries.length,
  };
}

export function supplierPerformance(
  orders: readonly SupplierOrderSample[],
  offers: readonly OfferSample[],
) {
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const cancelled = orders.filter(o => o.status === 'CANCELLED');
  const pending = orders.filter(o => ['ASSIGNED', 'IN_PROGRESS'].includes(o.status ?? ''));
  const acceptedOffers = offers.filter(o => o.status === 'ACCEPTED').length;
  const declinedOffers = offers.filter(o => ['REJECTED', 'EXPIRED'].includes(o.status ?? '')).length;
  return {
    completed_orders: completed.length,
    completed_water_cans: completed.filter(o => o.service_type === 'water_can').reduce((sum, o) => sum + cans(o), 0),
    cancelled_orders: cancelled.length,
    active_orders: pending.length,
    accepted_offers: acceptedOffers,
    rejected_or_expired_offers: declinedOffers,
    // This is an offer response, NOT a sale lost or unfulfilled order.
    offer_acceptance_pct: acceptedOffers + declinedOffers > 0 ?
      Math.round(100 * acceptedOffers / (acceptedOffers + declinedOffers)) : null,
  };
}

export function groupAcceptedDeliveries(
  orders: readonly SupplierOrderSample[],
  pins: Readonly<Record<string, string>>,
  now: Date = new Date(),
) {
  const cutoff = now.getTime() - DAY_MS;
  const end = now.getTime() + 7 * DAY_MS;
  const batches = new Map<string, { date: string; slot: string; pincode: string; orders: number; cans: number }>();
  for (const order of orders) {
    // Do not expose address/PIN for assigned-but-unaccepted orders.
    if (order.service_type !== 'water_can' ||
      !(order.status === 'IN_PROGRESS' || (order.status === 'ASSIGNED' && order.accepted_at))) continue;
    const scheduled = order.scheduled_at ? Date.parse(order.scheduled_at) : NaN;
    if (!Number.isFinite(scheduled) || scheduled < cutoff || scheduled > end) continue;
    const local = istSlot(order.scheduled_at);
    const pin = order.address_id ? pins[order.address_id] : null;
    if (!local || !pin || !/^\d{6}$/.test(pin)) continue;
    const slot = local.hour < 12 ? 'Morning' : local.hour < 17 ? 'Afternoon' : 'Evening';
    const key = `${local.date}:${slot}:${pin}`;
    const previous = batches.get(key) ?? { date: local.date, slot, pincode: pin, orders: 0, cans: 0 };
    previous.orders += 1;
    previous.cans += cans(order);
    batches.set(key, previous);
  }
  return [...batches.values()].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    ['Morning', 'Afternoon', 'Evening'].indexOf(a.slot) - ['Morning', 'Afternoon', 'Evening'].indexOf(b.slot) ||
    a.pincode.localeCompare(b.pincode)).slice(0, 30);
}

export type ZoneSample = {
  id: string;
  name: string;
  city: string;
  status: string | null;
  center_lat: number | null;
  center_lng: number | null;
  services: string[] | null;
};
export type DemandSample = {
  zone_id: string | null;
  customer_id: string | null;
  service_type: string | null;
  status: string | null;
};
export type CoverageLink = { zone_id: string; supplier_id: string; service_keys: string[] | null };

function geoDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const z = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(z)));
}

/**
 * Area-level performance from the authenticated supplier's own orders ONLY.
 * No customer identifiers, addresses or individual order records leave this aggregation.
 */
export function supplierAreaPerformance(
  orders: readonly SupplierOrderSample[],
  zones: readonly Pick<ZoneSample, 'id' | 'name' | 'city'>[],
) {
  const map = new Map(zones.map(zone => [zone.id, zone]));
  const counts = new Map<string, {
    zone_id: string; zone_name: string; city: string;
    completed: number; cancelled: number; active: number; delivered_cans: number;
  }>();
  for (const order of orders) {
    if (!order.zone_id) continue;
    const zone = map.get(order.zone_id);
    if (!zone) continue;
    const row = counts.get(zone.id) ?? {
      zone_id: zone.id, zone_name: zone.name, city: zone.city,
      completed: 0, cancelled: 0, active: 0, delivered_cans: 0,
    };
    if (order.status === 'COMPLETED') {
      row.completed++;
      if (order.service_type === 'water_can') row.delivered_cans += cans(order);
    } else if (order.status === 'CANCELLED') {
      row.cancelled++;
    } else if (order.status === 'ASSIGNED' || order.status === 'IN_PROGRESS') {
      row.active++;
    }
    counts.set(zone.id, row);
  }
  return [...counts.values()]
    .sort((a, b) => b.completed + b.cancelled + b.active - a.completed - a.cancelled - a.active ||
      a.zone_name.localeCompare(b.zone_name))
    .slice(0, 20);
}

export function rankCoverageOpportunities(
  zones: readonly ZoneSample[],
  orders: readonly DemandSample[],
  links: readonly CoverageLink[],
  supplierId: string,
  supplierLocation: { lat: number; lng: number } | null,
  complete: boolean,
) {
  // Partial scans and small demand samples must NOT be presented as a reliable ranking.
  if (!complete) return [];
  const byZone = new Map<string, { customers: Set<string>; requests: number; cancellations: number }>();
  for (const o of orders) {
    if (!o.zone_id || !o.customer_id || o.service_type !== 'water_can') continue;
    const item = byZone.get(o.zone_id) ?? { customers: new Set<string>(), requests: 0, cancellations: 0 };
    item.customers.add(o.customer_id);
    item.requests += 1;
    if (o.status === 'CANCELLED') item.cancellations += 1;
    byZone.set(o.zone_id, item);
  }
  const results = [];
  for (const zone of zones) {
    if (!['AVAILABLE', 'LIMITED'].includes(String(zone.status).toUpperCase()) ||
      (Array.isArray(zone.services) && !zone.services.includes('water_can'))) continue;
    const activity = byZone.get(zone.id);
    if (!activity || activity.customers.size < 5 || activity.requests < 5) continue; // Privacy threshold.
    const activeLinks = links.filter(link => link.zone_id === zone.id &&
      (!link.service_keys || link.service_keys.includes('water_can')));
    const mapped = new Set(activeLinks.map(link => link.supplier_id));
    const alreadyMapped = mapped.has(supplierId);
    const lat = Number(zone.center_lat), lng = Number(zone.center_lng);
    const distance = supplierLocation && zone.center_lat != null && zone.center_lng != null &&
      Number.isFinite(lat) && Number.isFinite(lng)
      ? geoDistanceKm(supplierLocation.lat, supplierLocation.lng, lat, lng) : null;
    // Avoid recommending unsupported long-distance zones; unknown geodata is shown separately.
    if (distance !== null && distance > 20) continue;
    if (mapped.size > 2) continue;
    results.push({
      zone_id: zone.id, zone_name: zone.name, city: zone.city,
      request_count_30d: activity.requests, mapped_supplier_count: mapped.size,
      distance_km: distance === null ? null : Math.round(distance * 10) / 10,
      already_mapped: alreadyMapped,
      action: alreadyMapped ? 'review_stock_and_online_status' : 'request_coverage',
      score: activity.requests / (mapped.size + 1),
    });
  }
  return results.sort((a, b) => b.score - a.score || a.zone_name.localeCompare(b.zone_name))
    .slice(0, 8).map(({ score: _score, ...item }) => item);
}
