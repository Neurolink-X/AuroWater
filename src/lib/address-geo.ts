/**
 * src/lib/address-geo.ts   (NEW FILE: safe to import in browser AND server)
 *
 * How exact is a saved delivery location? We rank every address by HOW its
 * coordinates were obtained. The server decides what quality is good enough.
 *
 *   map_pin       customer dragged a pin to their door      (best)
 *   gps           device GPS / network location
 *   pincode_area  centre of the customer's pincode area     (approximate, ~1-3 km)
 *   pincode_city  centre of the whole city                  (coarse: never enough to order)
 */

export type GeoSource = 'map_pin' | 'gps' | 'pincode_area' | 'pincode_city';

export const GEO_QUALITY: Record<GeoSource, number> = {
  map_pin: 4,
  gps: 3,
  pincode_area: 2,
  pincode_city: 1,
};

/** Water-can orders need at least this quality (pincode area or better). */
export const MIN_QUALITY_FOR_WATER = GEO_QUALITY.pincode_area;

/** Rough bounding box of India. Rejects 0,0 and swapped lat/lng. */
const INDIA = { latMin: 6, latMax: 37.5, lngMin: 68, lngMax: 97.5 } as const;

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  return Number(v);
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  const a = toNumber(lat);
  const b = toNumber(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  return a >= INDIA.latMin && a <= INDIA.latMax && b >= INDIA.lngMin && b <= INDIA.lngMax;
}

export function isGeoSource(v: unknown): v is GeoSource {
  return v === 'map_pin' || v === 'gps' || v === 'pincode_area' || v === 'pincode_city';
}
