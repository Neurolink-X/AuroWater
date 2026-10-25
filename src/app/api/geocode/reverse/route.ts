import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const REQUEST_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 500;

type Component = { long_name?: string; short_name?: string; types?: string[] };
type GResult = {
  formatted_address?: string;
  address_components?: Component[];
  types?: string[];
  geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
};
type GResponse = { status?: string; error_message?: string; results?: GResult[] };

type Precision = 'exact' | 'street' | 'area' | 'city' | 'none';

/* Known service regions, used ONLY to name the city when Google is unavailable.
 * We never invent a pincode or area: a wrong guess there sends the order to the wrong place. */
const REGIONS: Array<{ city: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { city: 'Kanpur', minLat: 26.28, maxLat: 26.62, minLng: 80.1, maxLng: 80.55 },
  { city: 'Lucknow', minLat: 26.7, maxLat: 27.0, minLng: 80.8, maxLng: 81.1 },
  { city: 'Gorakhpur', minLat: 26.7, maxLat: 26.9, minLng: 83.3, maxLng: 83.5 },
  // More specific NCR boxes are checked before Delhi so a Noida GPS fix cannot be labelled only "NCR".
  { city: 'Noida', minLat: 28.40, maxLat: 28.66, minLng: 77.30, maxLng: 77.52 },
  { city: 'Ghaziabad', minLat: 28.55, maxLat: 28.85, minLng: 77.32, maxLng: 77.55 },
  { city: 'Delhi', minLat: 28.40, maxLat: 28.90, minLng: 76.82, maxLng: 77.30 },
];

/** Block/category labels such as "Ews", "LIG", "A-12" are not areas a customer would recognise. */
function isJunkAreaName(name: string): boolean {
  const n = name.trim();
  return n.length < 4 || /^(ews|lig|mig|hig)\b/i.test(n) || /^[a-z]?[-\s]?\d+[a-z]?$/i.test(n);
}

/** Readable locality: broad area first (e.g. "Barra World Bank"), plus a recognisable sub-area when there is one. */
function pickArea(results: GResult[]): string {
  const firstGood = (...types: string[]): string => {
    for (const t of types) {
      for (const r of results) {
        const v = pick(r.address_components ?? [], 'long', t);
        if (v && !isJunkAreaName(v)) return v;
      }
    }
    return '';
  };
  const broad = firstGood('sublocality_level_1', 'sublocality');
  const fine = firstGood('sublocality_level_2', 'neighborhood', 'sublocality_level_3');
  if (broad && fine && fine.toLowerCase() !== broad.toLowerCase() && !broad.toLowerCase().includes(fine.toLowerCase())) {
    return `${fine}, ${broad}`.slice(0, 80);
  }
  return (broad || fine).slice(0, 80);
}

const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}\s*,?\s*/i;

function regionCity(lat: number, lng: number): string {
  return REGIONS.find((r) => lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng)?.city ?? '';
}

function pick(components: Component[], kind: 'long' | 'short', ...types: string[]): string {
  for (const t of types) {
    const c = components.find((item) => item.types?.includes(t));
    const v = (kind === 'long' ? c?.long_name : c?.short_name)?.trim();
    if (v) return v;
  }
  return '';
}

/** Looks through every result, most specific first, so a vague top result cannot hide a better one. */
function pickAcross(results: GResult[], kind: 'long' | 'short', ...types: string[]): string {
  for (const r of results) {
    const v = pick(r.address_components ?? [], kind, ...types);
    if (v) return v;
  }
  return '';
}

const SPECIFICITY: Array<[string, number]> = [
  ['street_address', 100], ['premise', 95], ['subpremise', 90], ['establishment', 60],
  ['route', 70], ['neighborhood', 60], ['sublocality_level_2', 58], ['sublocality_level_1', 55],
  ['sublocality', 55], ['locality', 30], ['postal_code', 20], ['plus_code', -100],
];

function score(r: GResult): number {
  let best = 0;
  for (const t of r.types ?? []) {
    const hit = SPECIFICITY.find(([k]) => k === t);
    if (hit && hit[1] > best) best = hit[1];
  }
  if ((r.types ?? []).includes('plus_code')) return -100;
  const lt = r.geometry?.location_type;
  return best + (lt === 'ROOFTOP' ? 10 : lt === 'RANGE_INTERPOLATED' ? 6 : lt === 'GEOMETRIC_CENTER' ? 2 : 0);
}

async function googleGeocode(lat: number, lng: number, apiKey: string, filtered: boolean): Promise<GResponse | null> {
  const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: apiKey, language: 'en', region: 'in' });
  if (filtered) {
    params.set('result_type', 'street_address|premise|subpremise|route|sublocality|neighborhood');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as GResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fallbackLocation(lat: number, lng: number, diag: Record<string, string> = {}) {
  const city = regionCity(lat, lng);
  return build({ lat, lng, formattedAddress: '', area: '', city, state: city ? 'Uttar Pradesh' : '', pincode: '', street: '' },
    'fallback', city ? 'city' : 'none', diag);
}

type OsmAddress = Record<string, string | undefined>;

/** Second opinion from OpenStreetMap (no key needed). Used to fill gaps Google leaves, e.g. area or pincode. */
async function osmReverseAt(lat: number, lng: number, zoom: number): Promise<{ area: string; city: string; pincode: string; display: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: String(zoom), addressdetails: '1', 'accept-language': 'en' });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AuroTap/1.0 (https://aurotap.in)' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: OsmAddress; display_name?: string };
    const a = json.address ?? {};
    const pin = String(a.postcode ?? '').replace(/\s+/g, '');
    return {
      area: a.neighbourhood || a.suburb || a.city_district || a.quarter || a.village || a.hamlet || '',
      city: a.city || a.town || a.state_district || a.county || '',
      pincode: /^\d{6}$/.test(pin) ? pin : '',
      // OSM postcodes are frequently the nearest/central one, so we never pass them on; display text is stripped of them too.
      display: (json.display_name ?? '').replace(/,?\s*\b\d{6}\b/g, ''),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function build(
  v: { lat: number; lng: number; formattedAddress: string; area: string; city: string; state: string; pincode: string; street: string },
  source: 'google' | 'osm' | 'google+osm' | 'fallback',
  precision: Precision,
  diag: Record<string, string> = {},
) {
  const address = { area: v.area, city: v.city, state: v.state, pincode: v.pincode, country: 'India', street: v.street };
  return {
    lat: v.lat, lng: v.lng,
    formattedAddress: v.formattedAddress,
    ...address,
    address,
    location: { lat: v.lat, lng: v.lng },
    source,
    precision,
    // Harmless debugging aid: open DevTools → Network → reverse to see why a field is empty.
    diag,
  };
}

/** Street-level first; if OSM has no named area there, retry at suburb level (zoom 14). */
async function osmReverse(lat: number, lng: number) {
  const fine = await osmReverseAt(lat, lng, 18);
  if (fine && fine.area && fine.pincode) return fine;
  const coarse = await osmReverseAt(lat, lng, 14);
  if (!fine) return coarse;
  if (!coarse) return fine;
  return { area: fine.area || coarse.area, city: fine.city || coarse.city, pincode: fine.pincode || coarse.pincode, display: fine.display || coarse.display };
}

function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest named locality/colony from OpenStreetMap place nodes. Works where polygons are missing. */
async function nearestPlaceName(lat: number, lng: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const query = `[out:json][timeout:6];node(around:2500,${lat},${lng})[place~"^(suburb|neighbourhood|quarter|village|locality)$"][name];out 30;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AuroTap/1.0 (https://aurotap.in)' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const json = (await res.json()) as { elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }> };
    let best = '';
    let bestD = Infinity;
    for (const el of json.elements ?? []) {
      const name = (el.tags?.['name:en'] || el.tags?.name || '').trim();
      if (!name || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
      const d = distMeters(lat, lng, el.lat, el.lon);
      if (d < bestD) { bestD = d; best = name; }
    }
    return best;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map<string, { at: number; value: ReturnType<typeof build> }>();

async function resolveLocation(lat: number, lng: number) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const diag: Record<string, string> = { google: apiKey ? 'pending' : 'NO_API_KEY' };

  // 1) ask for street/area level results only; 2) if none, accept anything (city level)
  let data: GResponse | null = null;
  if (apiKey) {
    data = await googleGeocode(lat, lng, apiKey, true);
    if (!data || data.status !== 'OK' || !data.results?.length) {
      data = await googleGeocode(lat, lng, apiKey, false);
    }
    diag.google = data ? `${data.status ?? 'UNKNOWN'}${data.error_message ? `: ${data.error_message}` : ''}` : 'NETWORK_ERROR';
    if (data?.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      // Shows up in Vercel runtime logs, e.g. REQUEST_DENIED when the key is restricted or the API is not enabled.
      console.error('[geocode] google status:', data.status, data.error_message ?? '');
    }
  }
  const googleOk = !!data && data.status === 'OK' && !!data.results?.length;

  if (!googleOk) {
    const osm = await osmReverse(lat, lng);
    diag.osm = osm ? 'OK' : 'FAILED';
    const placeName = osm?.area ? '' : await nearestPlaceName(lat, lng);
    diag.place = placeName ? 'OK' : osm?.area ? 'SKIPPED' : 'NONE';
    if (!osm && !placeName) return fallbackLocation(lat, lng, diag);
    const city = osm?.city || regionCity(lat, lng);
    const value = build({
      lat, lng, formattedAddress: osm?.display ?? '', area: osm?.area || placeName, city,
      state: city ? 'Uttar Pradesh' : '', pincode: '', street: '',
    }, 'osm', osm?.area || placeName ? 'area' : 'city', diag);
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  // Reverse-geocoder providers occasionally return a stale/distant match. Only accept
  // results whose own geometry is close to the user's GPS point; never replace the
  // original GPS coordinates with a geocoder's centroid.
  const nearbyResults = (data?.results ?? []).filter((r) => {
    const point = r.geometry?.location;
    return typeof point?.lat === 'number' && typeof point?.lng === 'number' &&
      distMeters(lat, lng, point.lat, point.lng) <= 5_000;
  });
  if (!nearbyResults.length) {
    const osm = await osmReverse(lat, lng);
    const placeName = osm?.area ? '' : await nearestPlaceName(lat, lng);
    const localCity = regionCity(lat, lng) || osm?.city || '';
    const value = build({
      lat, lng, formattedAddress: osm?.display ?? '', area: osm?.area || placeName,
      city: localCity, state: localCity ? 'Uttar Pradesh' : '', pincode: '', street: '',
    }, osm || placeName ? 'osm' : 'fallback', osm?.area || placeName ? 'area' : localCity ? 'city' : 'none',
    { ...diag, rejected_distant_geocoder_result: 'true' });
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  const results = [...nearbyResults].sort((a, b) => score(b) - score(a));
  const top = results[0];

  let area = pickArea(results);
  const geocodedCity = pickAcross(results, 'long', 'locality', 'postal_town', 'administrative_area_level_2');
  // Coordinates win over a contradictory city label; don't retain a mismatched postal code.
  const coordinateCity = regionCity(lat, lng);
  const city = coordinateCity || geocodedCity;
  const state = pickAcross(results, 'long', 'administrative_area_level_1') || (city ? 'Uttar Pradesh' : '');
  const candidatePin = pickAcross(results, 'short', 'postal_code');
  const pincode = /^\d{6}$/.test(candidatePin) &&
    (!coordinateCity || !geocodedCity || coordinateCity.toLowerCase() === geocodedCity.toLowerCase())
      ? candidatePin : '';
  let source: 'google' | 'google+osm' = 'google';
  if (!area) {
    // Google answered but left a gap: fill only the gap from OpenStreetMap.
    const osm = await osmReverse(lat, lng);
    diag.osm = osm ? 'OK' : 'FAILED';
    if (osm?.area) { area = osm.area; source = 'google+osm'; }
    if (!area) {
      const placeName = await nearestPlaceName(lat, lng);
      if (placeName) { area = placeName; source = 'google+osm'; }
    }
  }
  const street = [pickAcross(results, 'long', 'street_number'), pickAcross(results, 'long', 'route')].filter(Boolean).join(' ');

  const topScore = score(top);
  const precision: Precision =
    topScore >= 90 ? 'exact' : topScore >= 70 ? 'street' : topScore >= 55 ? 'area' : 'city';

  const value = build({
    lat,
    lng,
    formattedAddress: (top.formatted_address ?? '').replace(PLUS_CODE, '').trim(),
    area, city, state, pincode, street,
  }, source, precision, diag);

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

function parseCoords(latRaw: unknown, lngRaw: unknown): { lat: number; lng: number } | null {
  if (latRaw === null || latRaw === undefined || latRaw === '' || lngRaw === null || lngRaw === undefined || lngRaw === '') return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  const coords = parseCoords(req.nextUrl.searchParams.get('lat'), req.nextUrl.searchParams.get('lng'));
  if (!coords) return jsonErr('Valid latitude and longitude are required', 400);

  return jsonOk(await resolveLocation(coords.lat, coords.lng));
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid JSON request body', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Invalid payload format', 400);

  const payload = body as Record<string, unknown>;
  const coords = parseCoords(payload.lat, payload.lng);
  if (!coords) return jsonErr('Valid latitude and longitude are required', 400);

  return jsonOk(await resolveLocation(coords.lat, coords.lng));
}
