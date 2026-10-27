export type IntelligenceOrder = {
  id?: string | number;
  created_at?: string | null;
  status?: string | null;
  supplier_id?: string | null;
  total_amount?: number | string | null;
  service_type?: string | null;
  address?: string | null;
  address_snapshot?: unknown;
};

export type SupplierProfile = {
  id: string;
  role?: string | null;
  is_active?: boolean | null;
  status?: string | null;
  verification_status?: string | null;
};

export type SupplierZoneLink = {
  supplier_id: string;
  zone_id: string;
  service_keys?: string[] | null;
};

export type ServiceZone = {
  id: string;
  city?: string | null;
  name?: string | null;
  status?: string | null;
  pincodes?: unknown;
};

export type LocalDemandRow = {
  pincode: string;
  city: string;
  orders: number;
  cancelled: number;
  cancellationRate: number;
  assignedOrders: number;
  unassignedOrders: number;
  mappedSuppliers: number;
  coverageGap: boolean;
};

export type LocalIntelligenceSummary = {
  windowDays: number;
  ordersReviewed: number;
  ordersWithPincode: number;
  ordersWithoutPincode: number;
  cancelledOrders: number;
  cancellationRate: number;
  unassignedOrders: number;
  peakHour: number | null;
  peakHourOrders: number;
  demandByPincode: LocalDemandRow[];
  serviceMix: Array<{ service: string; orders: number }>;
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function normalizePincode(value: unknown): string | null {
  const digits = normalizeText(value).replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function isDispatchEligibleSupplier(profile: SupplierProfile): boolean {
  if (profile.role && profile.role.toLowerCase() !== 'supplier') return false;
  if (profile.is_active === false) return false;
  const status = normalizeText(profile.status).toLowerCase();
  if (status && status !== 'active') return false;
  // Keep compatibility with older active supplier records whose verification field is NULL.
  const verification = normalizeText(profile.verification_status).toLowerCase();
  if (verification && verification !== 'approved') return false;
  return true;
}

function locationFromOrder(order: IntelligenceOrder): { pincode: string | null; city: string } {
  const snapshot = order.address_snapshot && typeof order.address_snapshot === 'object'
    ? order.address_snapshot as Record<string, unknown>
    : {};
  const pincode = normalizePincode(snapshot.pincode)
    ?? normalizePincode(snapshot.postal_code)
    ?? normalizePincode(order.address?.match(/(?:^|\D)(\d{6})(?:\D|$)/)?.[1]);
  const city = normalizeText(snapshot.city)
    || normalizeText(snapshot.district)
    || normalizeText(snapshot.area)
    || 'Unknown';
  return { pincode, city };
}

function hourInIndia(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const hour = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  const parsed = Number(hour);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}

const CANCELLED = new Set(['CANCELLED', 'CANCELED', 'FAILED']);
const UNASSIGNED = new Set(['PENDING']);

export function summarizeLocalDemand(
  orders: IntelligenceOrder[],
  mappedSupplierCountByPincode: Map<string, number>,
  windowDays = 30,
): LocalIntelligenceSummary {
  const byPin = new Map<string, { city: string; orders: number; cancelled: number; assigned: number; unassigned: number }>();
  const serviceCounts = new Map<string, number>();
  const hours = new Map<number, number>();
  let ordersWithPincode = 0;
  let cancelledOrders = 0;
  let unassignedOrders = 0;

  for (const order of orders) {
    const status = normalizeText(order.status).toUpperCase();
    const location = locationFromOrder(order);
    if (location.pincode) {
      ordersWithPincode += 1;
      const row = byPin.get(location.pincode) ?? {
        city: location.city, orders: 0, cancelled: 0, assigned: 0, unassigned: 0,
      };
      row.orders += 1;
      if (CANCELLED.has(status)) row.cancelled += 1;
      if (normalizeText(order.supplier_id)) row.assigned += 1;
      else row.unassigned += 1;
      byPin.set(location.pincode, row);
    }
    if (CANCELLED.has(status)) cancelledOrders += 1;
    if (UNASSIGNED.has(status) && !normalizeText(order.supplier_id)) unassignedOrders += 1;

    const service = normalizeText(order.service_type) || 'unknown';
    serviceCounts.set(service, (serviceCounts.get(service) ?? 0) + 1);
    const hour = hourInIndia(order.created_at);
    if (hour !== null) hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }

  const demandByPincode = [...byPin.entries()].map(([pincode, row]) => {
    const mappedSuppliers = mappedSupplierCountByPincode.get(pincode) ?? 0;
    const cancellationRate = row.orders ? Math.round((row.cancelled / row.orders) * 1000) / 10 : 0;
    return {
      pincode, city: row.city, orders: row.orders, cancelled: row.cancelled,
      cancellationRate, assignedOrders: row.assigned, unassignedOrders: row.unassigned,
      mappedSuppliers,
      // Operational signal, not an automatic supplier ranking or dispatch decision.
      coverageGap: row.orders >= 3 && mappedSuppliers < 2,
    };
  }).sort((a, b) => b.orders - a.orders || a.pincode.localeCompare(b.pincode));

  const peak = [...hours.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return {
    windowDays,
    ordersReviewed: orders.length,
    ordersWithPincode,
    ordersWithoutPincode: orders.length - ordersWithPincode,
    cancelledOrders,
    cancellationRate: orders.length ? Math.round((cancelledOrders / orders.length) * 1000) / 10 : 0,
    unassignedOrders,
    peakHour: peak?.[0] ?? null,
    peakHourOrders: peak?.[1] ?? 0,
    demandByPincode,
    serviceMix: [...serviceCounts.entries()]
      .map(([service, count]) => ({ service, orders: count }))
      .sort((a, b) => b.orders - a.orders),
  };
}
