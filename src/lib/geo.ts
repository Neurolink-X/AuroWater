export type ServiceZone = {
  city: string;
  state: 'UP';
  lat: number;
  lng: number;
  radiusKm: number;
};

export const SERVICE_ZONES: readonly ServiceZone[] = [
  { city: 'Gorakhpur', state: 'UP', lat: 26.7606, lng: 83.3732, radiusKm: 25 },
  { city: 'Kanpur', state: 'UP', lat: 26.4499, lng: 80.3319, radiusKm: 30 },
  { city: 'Lucknow', state: 'UP', lat: 26.8467, lng: 80.9462, radiusKm: 30 },
] as const;

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function getServiceZone(lat: number, lng: number): ServiceZone | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: { zone: ServiceZone; km: number } | null = null;
  for (const zone of SERVICE_ZONES) {
    const km = haversineKm(lat, lng, zone.lat, zone.lng);
    if (km <= zone.radiusKm && (!best || km < best.km)) {
      best = { zone, km };
    }
  }
  return best?.zone ?? null;
}

export const OUT_OF_ZONE_MESSAGE =
  "Sorry, we don't deliver to this area yet. We currently serve Gorakhpur, Kanpur & Lucknow within 30km of city center.";

export const SUPPLIER_MAX_KM = 15;

export function isCityServed(city: string): boolean {
  const c = city.trim().toLowerCase();
  return SERVICE_ZONES.some((z) => z.city.toLowerCase() === c);
}

export function isAddressServiceable(
  lat?: number | null,
  lng?: number | null,
  city?: string | null
): boolean {
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return getServiceZone(lat, lng) !== null;
  }
  return city ? isCityServed(city) : false;
}
