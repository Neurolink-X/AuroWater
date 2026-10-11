/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * src/lib/address-geo.server.ts   (NEW FILE: SERVER ONLY, import from API routes only)
 *
 * resolveAddressLocation(address) answers: "what is the best map point we have
 * for this address, and how trustworthy is it?"
 *
 * Order of trust:
 *   1. Coordinates saved on the address (map_pin / gps)
 *   2. Pincode area centre   ← official India Post directory table, then service_zones centre
 *   3. City centre           ← coarse, only for cities that are LIVE in lib/geo.ts
 *
 * It never throws. NCR (Delhi, Gurugram, Faridabad…) automatically stays
 * disabled until you add that city to SERVICE_ZONES in lib/geo.ts.
 */

import { createServiceClient } from '@/utils/supabase/server';
import { SERVICE_ZONES, haversineKm } from '@/lib/geo';
import {
  GEO_QUALITY,
  isGeoSource,
  isValidCoord,
  toNumber,
  type GeoSource,
} from '@/lib/address-geo';

export type AddressGeoOk = {
  ok: true;
  lat: number;
  lng: number;
  source: GeoSource;
  quality: number;
  label: string | null;
  /** The saved point is far from where its pincode says it should be. */
  warning: 'PIN_FAR_FROM_PINCODE' | null;
};
export type AddressGeo = AddressGeoOk | { ok: false; reason: 'NO_LOCATION' };

const PIN_RE = /^[0-9]{6}$/;
const PIN_MISMATCH_KM = 15;
const CACHE_TTL_MS = 10 * 60 * 1000;

/** First 3 digits → city. Coarse on purpose; only used for the city-centre fallback. */
const PREFIX_TO_CITY: Record<string, string> = {
  '208': 'Kanpur',
  '209': 'Kanpur',
  '273': 'Gorakhpur',
  '226': 'Lucknow',
  '227': 'Lucknow',
  // NCR (inactive until the city is added to SERVICE_ZONES in lib/geo.ts)
  '110': 'Delhi',
  '121': 'Faridabad',
  '122': 'Gurugram',
};

type Centroid = { lat: number; lng: number; label: string };
const cache = new Map<string, { at: number; value: Centroid | null }>();

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Centre of a pincode area. Directory table first, then a configured zone centre. */
async function pincodeCentroid(pin: string): Promise<Centroid | null> {
  if (!PIN_RE.test(pin)) return null;

  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let value: Centroid | null = null;
  let failed = false;

  try {
    const db: any = createServiceClient();

    // 1) Official directory (median of all post offices sharing the pincode)
    const dir = await db
      .from('pincode_directory')
      .select('office_name, lat, lng')
      .eq('pincode', pin)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(50);

    if (!dir.error && Array.isArray(dir.data) && dir.data.length) {
      const pts = (dir.data as any[])
        .map((r) => ({ lat: Number(r.lat), lng: Number(r.lng), name: String(r.office_name ?? '') }))
        .filter((p) => isValidCoord(p.lat, p.lng));
      if (pts.length) {
        value = {
          lat: median(pts.map((p) => p.lat)),
          lng: median(pts.map((p) => p.lng)),
          label: pts[0].name || pin,
        };
      }
    } else if (dir.error && !/does not exist|schema cache|relation/i.test(String(dir.error.message ?? ''))) {
      failed = true;
    }

    // 2) A configured service zone that lists this pincode AND has a centre
    if (!value) {
      const z = await db
        .from('service_zones')
        .select('name, center_lat, center_lng')
        .contains('pincodes', [pin])
        .not('center_lat', 'is', null)
        .not('center_lng', 'is', null)
        .limit(1);
      const row = z?.data?.[0];
      if (row && isValidCoord(row.center_lat, row.center_lng)) {
        value = { lat: Number(row.center_lat), lng: Number(row.center_lng), label: String(row.name ?? pin) };
      }
    }
  } catch (e) {
    failed = true;
    console.error('[address-geo] pincode lookup failed:', e);
  }

  if (!failed) cache.set(pin, { at: Date.now(), value }); // never cache a transient failure
  return value;
}

/** City centre, only for cities that are live in lib/geo.ts SERVICE_ZONES. */
function cityCentre(pin: string, city: string): Centroid | null {
  const wanted = city.trim().toLowerCase();
  const byPin = PIN_RE.test(pin) ? PREFIX_TO_CITY[pin.slice(0, 3)] : undefined;

  // Pincode says one city, address says another → do not guess.
  if (byPin && wanted && byPin.toLowerCase() !== wanted) return null;

  const name = byPin ?? (wanted ? SERVICE_ZONES.find((z) => z.city.toLowerCase() === wanted)?.city : undefined);
  const zone = SERVICE_ZONES.find((z) => z.city === name);
  return zone ? { lat: zone.lat, lng: zone.lng, label: zone.city } : null;
}

/** Best available map point for a saved address row. Never throws. */
export async function resolveAddressLocation(addr: Record<string, unknown>): Promise<AddressGeo> {
  const lat = toNumber(addr.lat);
  const lng = toNumber(addr.lng);
  const pincode = String(addr.pincode ?? '').trim();
  const city = String(addr.city ?? '').trim();

  // 1) Coordinates already saved on the address
  if (isValidCoord(lat, lng)) {
    const saved = addr.geo_source;
    const source: GeoSource = isGeoSource(saved) ? saved : 'gps'; // old rows had GPS only

    let warning: AddressGeoOk['warning'] = null;
    if (source === 'gps' || source === 'map_pin') {
      const centre = await pincodeCentroid(pincode);
      if (centre && haversineKm(lat, lng, centre.lat, centre.lng) > PIN_MISMATCH_KM) {
        warning = 'PIN_FAR_FROM_PINCODE';
      }
    }
    return { ok: true, lat, lng, source, quality: GEO_QUALITY[source], label: null, warning };
  }

  // 2) Pincode area
  const area = await pincodeCentroid(pincode);
  if (area) {
    return {
      ok: true,
      lat: area.lat,
      lng: area.lng,
      source: 'pincode_area',
      quality: GEO_QUALITY.pincode_area,
      label: area.label,
      warning: null,
    };
  }

  // 3) City centre (coarse)
  const cc = cityCentre(pincode, city);
  if (cc) {
    return {
      ok: true,
      lat: cc.lat,
      lng: cc.lng,
      source: 'pincode_city',
      quality: GEO_QUALITY.pincode_city,
      label: cc.label,
      warning: null,
    };
  }

  return { ok: false, reason: 'NO_LOCATION' };
}

/**
 * Self-heal: save a derived point onto an address that has none, so every
 * other screen and API sees valid coordinates from now on. Best effort.
 */
export async function healAddressLocation(
  addressId: string,
  customerId: string,
  geo: AddressGeoOk,
): Promise<void> {
  try {
    const db: any = createServiceClient();
    const base = { lat: geo.lat, lng: geo.lng };

    let { error } = await db
      .from('addresses')
      .update({ ...base, geo_source: geo.source })
      .eq('id', addressId)
      .eq('customer_id', customerId)
      .or('lat.is.null,lng.is.null');

    // geo_source column not created yet → save the coordinates only
    if (error && /geo_source/i.test(String(error.message ?? ''))) {
      ({ error } = await db
        .from('addresses')
        .update(base)
        .eq('id', addressId)
        .eq('customer_id', customerId)
        .or('lat.is.null,lng.is.null'));
    }
    if (error) console.error('[address-geo] heal failed:', error);
  } catch (e) {
    console.error('[address-geo] heal threw:', e);
  }
}
