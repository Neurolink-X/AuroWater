/**
 * Authorization for supplier dispatch in regions with overlapping PIN zones.
 *
 * Three explicitly-approved levels, in priority order:
 * 0. The order's exact approved zone.
 * 1. A different admin-approved zone listing the customer's exact six-digit PIN.
 * 2. An explicitly admin-approved citywide zone (is_catch_all=true).
 *
 * A radius alone never grants coverage. A catch-all city is still constrained
 * by the supplier's own delivery radius, online status, capacity and stock.
 * Newly added PIN-directory zones do not inherit 25 km pilot-zone approval.
 */
export type ApprovedSupplierZone = {
  zoneId: string;
  serviceKeys: string[] | null;
};
export type SupplierZoneCoverage = {
  id: string;
  city: string | null;
  status: string | null;
  is_catch_all: boolean | null;
  pincodes: string[] | null;
  services: string[] | null;
};
export type CoverageDecision =
  | { allowed: true; tier: 0 | 1 | 2; mode: 'exact_zone' | 'approved_pin' | 'approved_citywide' }
  | { allowed: false; reason: 'zone_not_approved' | 'service_not_covered' };

const cityKey = (city: string) =>
  city.trim().toLocaleLowerCase('en-IN').replace(/\s+(nagar|district)$/i, '');
const verifiedPin = (pin: string) => /^\d{6}$/.test(pin.trim()) ? pin.trim() : '';

export function matchApprovedSupplierCoverage(
  orderZoneId: string,
  customerPin: string,
  customerCity: string,
  serviceKey: string,
  links: readonly ApprovedSupplierZone[],
  zones: ReadonlyMap<string, SupplierZoneCoverage>,
): CoverageDecision {
  if (!orderZoneId || !serviceKey || links.length === 0) {
    return { allowed: false, reason: 'zone_not_approved' };
  }
  const exact = links.find(link => link.zoneId === orderZoneId);
  if (exact && (exact.serviceKeys === null || exact.serviceKeys.includes(serviceKey))) {
    return { allowed: true, tier: 0, mode: 'exact_zone' };
  }

  const pin = verifiedPin(customerPin);
  const customer = cityKey(customerCity);
  if (pin && customer) {
    for (const link of links) {
      if (link.zoneId === orderZoneId) continue;
      if (link.serviceKeys !== null && !link.serviceKeys.includes(serviceKey)) continue;
      const zone = zones.get(link.zoneId);
      if (!zone || cityKey(zone.city ?? '') !== customer) continue;
      if (!['AVAILABLE', 'LIMITED'].includes(String(zone.status ?? '').toUpperCase())) continue;
      if (zone.services !== null && !zone.services.includes(serviceKey)) continue;
      if (!zone.is_catch_all && Array.isArray(zone.pincodes) && zone.pincodes.includes(pin)) {
        return { allowed: true, tier: 1, mode: 'approved_pin' };
      }
    }
    for (const link of links) {
      if (link.zoneId === orderZoneId) continue;
      if (link.serviceKeys !== null && !link.serviceKeys.includes(serviceKey)) continue;
      const zone = zones.get(link.zoneId);
      if (!zone || cityKey(zone.city ?? '') !== customer) continue;
      if (!['AVAILABLE', 'LIMITED'].includes(String(zone.status ?? '').toUpperCase())) continue;
      if (zone.services !== null && !zone.services.includes(serviceKey)) continue;
      if (zone.is_catch_all === true) {
        return { allowed: true, tier: 2, mode: 'approved_citywide' };
      }
    }
  }
  return {
    allowed: false,
    reason: exact ? 'service_not_covered' : 'zone_not_approved',
  };
}
