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
  { city: 'NCR', minLat: 28.4, maxLat: 28.7, minLng: 77.0, maxLng: 77.4 },
];

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
async function osmReverse(lat: number, lng: number): Promise<{ area: string; city: string; pincode: string; display: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1', 'accept-language': 'en' });
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
      display: json.display_name ?? '',
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
    if (!osm) return fallbackLocation(lat, lng, diag);
    const city = osm.city || regionCity(lat, lng);
    const value = build({
      lat, lng, formattedAddress: osm.display, area: osm.area, city,
      state: city ? 'Uttar Pradesh' : '', pincode: osm.pincode, street: '',
    }, 'osm', osm.area ? 'area' : 'city', diag);
    cache.set(key, { at: Date.now(), value });
    return value;
  }

  const results = [...(data?.results ?? [])].sort((a, b) => score(b) - score(a));
  const top = results[0];

  let area = pickAcross(results, 'long', 'neighborhood', 'sublocality_level_2', 'sublocality_level_1', 'sublocality');
  const city =
    pickAcross(results, 'long', 'locality', 'postal_town', 'administrative_area_level_2') || regionCity(lat, lng);
  const state = pickAcross(results, 'long', 'administrative_area_level_1') || (city ? 'Uttar Pradesh' : '');
  let pincode = /^\d{6}$/.test(pickAcross(results, 'short', 'postal_code')) ? pickAcross(results, 'short', 'postal_code') : '';
  let source: 'google' | 'google+osm' = 'google';
  if (!area || !pincode) {
    // Google answered but left a gap: fill only the gap from OpenStreetMap.
    const osm = await osmReverse(lat, lng);
    diag.osm = osm ? 'OK' : 'FAILED';
    if (osm) {
      if (!area && osm.area) { area = osm.area; source = 'google+osm'; }
      if (!pincode && osm.pincode) { pincode = osm.pincode; source = 'google+osm'; }
    }
  }
  const street = [pickAcross(results, 'long', 'street_number'), pickAcross(results, 'long', 'route')].filter(Boolean).join(' ');

  const topScore = score(top);
  const precision: Precision =
    topScore >= 90 ? 'exact' : topScore >= 70 ? 'street' : topScore >= 55 ? 'area' : 'city';

  const value = build({
    lat: top.geometry?.location?.lat ?? lat,
    lng: top.geometry?.location?.lng ?? lng,
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








// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireSupabaseAuth } from '@/lib/api/supabase-request';

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic';

// const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
// const REQUEST_TIMEOUT_MS = 6_000;
// const CACHE_TTL_MS = 10 * 60_000;
// const CACHE_MAX = 500;

// type Component = { long_name?: string; short_name?: string; types?: string[] };
// type GResult = {
//   formatted_address?: string;
//   address_components?: Component[];
//   types?: string[];
//   geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
// };
// type GResponse = { status?: string; error_message?: string; results?: GResult[] };

// type Precision = 'exact' | 'street' | 'area' | 'city' | 'none';

// /* Known service regions, used ONLY to name the city when Google is unavailable.
//  * We never invent a pincode or area: a wrong guess there sends the order to the wrong place. */
// const REGIONS: Array<{ city: string; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
//   { city: 'Kanpur', minLat: 26.28, maxLat: 26.62, minLng: 80.1, maxLng: 80.55 },
//   { city: 'Lucknow', minLat: 26.7, maxLat: 27.0, minLng: 80.8, maxLng: 81.1 },
//   { city: 'Gorakhpur', minLat: 26.7, maxLat: 26.9, minLng: 83.3, maxLng: 83.5 },
//   { city: 'NCR', minLat: 28.4, maxLat: 28.7, minLng: 77.0, maxLng: 77.4 },
// ];

// const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}\s*,?\s*/i;

// function regionCity(lat: number, lng: number): string {
//   return REGIONS.find((r) => lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng)?.city ?? '';
// }

// function pick(components: Component[], kind: 'long' | 'short', ...types: string[]): string {
//   for (const t of types) {
//     const c = components.find((item) => item.types?.includes(t));
//     const v = (kind === 'long' ? c?.long_name : c?.short_name)?.trim();
//     if (v) return v;
//   }
//   return '';
// }

// /** Looks through every result, most specific first, so a vague top result cannot hide a better one. */
// function pickAcross(results: GResult[], kind: 'long' | 'short', ...types: string[]): string {
//   for (const r of results) {
//     const v = pick(r.address_components ?? [], kind, ...types);
//     if (v) return v;
//   }
//   return '';
// }

// const SPECIFICITY: Array<[string, number]> = [
//   ['street_address', 100], ['premise', 95], ['subpremise', 90], ['establishment', 60],
//   ['route', 70], ['neighborhood', 60], ['sublocality_level_2', 58], ['sublocality_level_1', 55],
//   ['sublocality', 55], ['locality', 30], ['postal_code', 20], ['plus_code', -100],
// ];

// function score(r: GResult): number {
//   let best = 0;
//   for (const t of r.types ?? []) {
//     const hit = SPECIFICITY.find(([k]) => k === t);
//     if (hit && hit[1] > best) best = hit[1];
//   }
//   if ((r.types ?? []).includes('plus_code')) return -100;
//   const lt = r.geometry?.location_type;
//   return best + (lt === 'ROOFTOP' ? 10 : lt === 'RANGE_INTERPOLATED' ? 6 : lt === 'GEOMETRIC_CENTER' ? 2 : 0);
// }

// async function googleGeocode(lat: number, lng: number, apiKey: string, filtered: boolean): Promise<GResponse | null> {
//   const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: apiKey, language: 'en', region: 'in' });
//   if (filtered) {
//     params.set('result_type', 'street_address|premise|subpremise|route|sublocality|neighborhood');
//   }
//   const controller = new AbortController();
//   const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
//   try {
//     const res = await fetch(`${GOOGLE_GEOCODE_URL}?${params.toString()}`, {
//       headers: { Accept: 'application/json' },
//       signal: controller.signal,
//       cache: 'no-store',
//     });
//     if (!res.ok) return null;
//     return (await res.json()) as GResponse;
//   } catch {
//     return null;
//   } finally {
//     clearTimeout(timer);
//   }
// }

// function fallbackLocation(lat: number, lng: number) {
//   const city = regionCity(lat, lng);
//   return build({ lat, lng, formattedAddress: '', area: '', city, state: city ? 'Uttar Pradesh' : '', pincode: '', street: '' },
//     'fallback', city ? 'city' : 'none');
// }

// function build(
//   v: { lat: number; lng: number; formattedAddress: string; area: string; city: string; state: string; pincode: string; street: string },
//   source: 'google' | 'fallback',
//   precision: Precision,
// ) {
//   const address = { area: v.area, city: v.city, state: v.state, pincode: v.pincode, country: 'India', street: v.street };
//   return {
//     lat: v.lat, lng: v.lng,
//     formattedAddress: v.formattedAddress,
//     ...address,
//     address,
//     location: { lat: v.lat, lng: v.lng },
//     source,
//     precision,
//   };
// }

// const cache = new Map<string, { at: number; value: ReturnType<typeof build> }>();

// async function resolveLocation(lat: number, lng: number) {
//   const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
//   const hit = cache.get(key);
//   if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   if (!apiKey) return fallbackLocation(lat, lng);

//   // 1) ask for street/area level results only; 2) if none, accept anything (city level)
//   let data = await googleGeocode(lat, lng, apiKey, true);
//   if (!data || data.status !== 'OK' || !data.results?.length) {
//     data = await googleGeocode(lat, lng, apiKey, false);
//   }
//   if (!data || data.status !== 'OK' || !data.results?.length) {
//     if (data?.status && data.status !== 'ZERO_RESULTS') console.error('[geocode] google status:', data.status);
//     return fallbackLocation(lat, lng);
//   }

//   const results = [...data.results].sort((a, b) => score(b) - score(a));
//   const top = results[0];

//   const area = pickAcross(results, 'long', 'neighborhood', 'sublocality_level_2', 'sublocality_level_1', 'sublocality');
//   const city =
//     pickAcross(results, 'long', 'locality', 'postal_town', 'administrative_area_level_2') || regionCity(lat, lng);
//   const state = pickAcross(results, 'long', 'administrative_area_level_1') || (city ? 'Uttar Pradesh' : '');
//   const pincode = /^\d{6}$/.test(pickAcross(results, 'short', 'postal_code')) ? pickAcross(results, 'short', 'postal_code') : '';
//   const street = [pickAcross(results, 'long', 'street_number'), pickAcross(results, 'long', 'route')].filter(Boolean).join(' ');

//   const topScore = score(top);
//   const precision: Precision =
//     topScore >= 90 ? 'exact' : topScore >= 70 ? 'street' : topScore >= 55 ? 'area' : 'city';

//   const value = build({
//     lat: top.geometry?.location?.lat ?? lat,
//     lng: top.geometry?.location?.lng ?? lng,
//     formattedAddress: (top.formatted_address ?? '').replace(PLUS_CODE, '').trim(),
//     area, city, state, pincode, street,
//   }, 'google', precision);

//   if (cache.size >= CACHE_MAX) {
//     const oldest = cache.keys().next().value;
//     if (oldest !== undefined) cache.delete(oldest);
//   }
//   cache.set(key, { at: Date.now(), value });
//   return value;
// }

// function parseCoords(latRaw: unknown, lngRaw: unknown): { lat: number; lng: number } | null {
//   if (latRaw === null || latRaw === undefined || latRaw === '' || lngRaw === null || lngRaw === undefined || lngRaw === '') return null;
//   const lat = Number(latRaw);
//   const lng = Number(lngRaw);
//   if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
//   return { lat, lng };
// }

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;

//   const coords = parseCoords(req.nextUrl.searchParams.get('lat'), req.nextUrl.searchParams.get('lng'));
//   if (!coords) return jsonErr('Valid latitude and longitude are required', 400);

//   return jsonOk(await resolveLocation(coords.lat, coords.lng));
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;

//   let body: unknown;
//   try {
//     body = await req.json();
//   } catch {
//     return jsonErr('Invalid JSON request body', 400);
//   }
//   if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Invalid payload format', 400);

//   const payload = body as Record<string, unknown>;
//   const coords = parseCoords(payload.lat, payload.lng);
//   if (!coords) return jsonErr('Valid latitude and longitude are required', 400);

//   return jsonOk(await resolveLocation(coords.lat, coords.lng));
// }








// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireSupabaseAuth } from '@/lib/api/supabase-request';

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic';

// const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
// const REQUEST_TIMEOUT_MS = 6_000;

// type GoogleAddressComponent = {
//   long_name?: string;
//   short_name?: string;
//   types?: string[];
// };

// type GoogleGeocodeResponse = {
//   status?: string;
//   error_message?: string;
//   results?: Array<{
//     formatted_address?: string;
//     address_components?: GoogleAddressComponent[];
//     place_id?: string;
//     geometry?: {
//       location?: {
//         lat?: number;
//         lng?: number;
//       };
//     };
//   }>;
// };

// function getComponent(components: GoogleAddressComponent[], ...types: string[]): string {
//   for (const t of types) {
//     const comp = components.find((item) => item.types?.includes(t));
//     if (comp?.long_name?.trim()) {
//       return comp.long_name.trim();
//     }
//   }
//   return '';
// }

// function getShortComponent(components: GoogleAddressComponent[], ...types: string[]): string {
//   for (const t of types) {
//     const comp = components.find((item) => item.types?.includes(t));
//     if (comp?.short_name?.trim()) {
//       return comp.short_name.trim();
//     }
//   }
//   return '';
// }

// /**
//  * Dynamic Coordinate-Aware Region Detection for any user location across regions
//  */
// function getDynamicFallbackLocation(lat: number, lng: number) {
//   let city = 'Kanpur';
//   let pincode = '';
//   let state = 'Uttar Pradesh';
//   let area = '';

//   // Lucknow Region Bounds
//   if (lat >= 26.7 && lat <= 27.0 && lng >= 80.8 && lng <= 81.1) {
//     city = 'Lucknow';
//     pincode = '226001';
//   }
//   // Gorakhpur Region Bounds
//   else if (lat >= 26.7 && lat <= 26.9 && lng >= 83.3 && lng <= 83.5) {
//     city = 'Gorakhpur';
//     pincode = '273001';
//   }
//   // NCR / Delhi / Noida Region Bounds
//   else if (lat >= 28.4 && lat <= 28.7 && lng >= 77.0 && lng <= 77.4) {
//     city = 'NCR';
//     pincode = '110001';
//   }
//   // Default to Kanpur bounds for AuroTap's primary hub
//   else {
//     city = 'Kanpur';
//     pincode = '208001';
//   }

//   return {
//     lat,
//     lng,
//     formattedAddress: `Location near (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
//     area,
//     city,
//     state,
//     pincode,
//     country: 'India',
//     street: '',
//     address: {
//       area,
//       city,
//       state,
//       pincode,
//       country: 'India',
//       street: '',
//     },
//     location: { lat, lng },
//   };
// }

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;

//   const searchParams = req.nextUrl.searchParams;
//   const latParam = searchParams.get('lat');
//   const lngParam = searchParams.get('lng');

//   if (!latParam || !lngParam) {
//     return jsonErr('Latitude and longitude are required', 400);
//   }

//   const lat = Number(latParam);
//   const lng = Number(lngParam);

//   if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
//     return jsonErr('Coordinates are out of valid range', 400);
//   }

//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;
//   const dynamicFallback = getDynamicFallbackLocation(lat, lng);

//   if (!apiKey) {
//     return jsonOk(dynamicFallback);
//   }

//   const url = `${GOOGLE_GEOCODE_URL}?latlng=${lat},${lng}&key=${apiKey}&language=en`;
//   const controller = new AbortController();
//   const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

//   let googleResponse: Response;
//   try {
//     googleResponse = await fetch(url, {
//       method: 'GET',
//       headers: { Accept: 'application/json' },
//       signal: controller.signal,
//       cache: 'no-store',
//     });
//   } catch {
//     return jsonOk(dynamicFallback);
//   } finally {
//     clearTimeout(timeout);
//   }

//   let data: GoogleGeocodeResponse;
//   try {
//     data = (await googleResponse.json()) as GoogleGeocodeResponse;
//   } catch {
//     data = { status: 'PARSE_ERROR' };
//   }

//   if (!googleResponse.ok || data.status !== 'OK' || !data.results?.[0]) {
//     return jsonOk(dynamicFallback);
//   }

//   const result = data.results[0];
//   const components = result.address_components ?? [];
//   const state = getComponent(components, 'administrative_area_level_1') || dynamicFallback.state;
//   const city = getComponent(components, 'locality', 'postal_town', 'administrative_area_level_2') || dynamicFallback.city;
  
//   const area = getComponent(
//     components,
//     'sublocality_level_1',
//     'sublocality',
//     'neighborhood',
//     'sublocality_level_2',
//     'administrative_area_level_3'
//   );

//   const pincode = getShortComponent(components, 'postal_code') || dynamicFallback.pincode;
//   const streetNumber = getComponent(components, 'street_number');
//   const route = getComponent(components, 'route');

//   const resolvedLat = result.geometry?.location?.lat ?? lat;
//   const resolvedLng = result.geometry?.location?.lng ?? lng;
//   const formattedAddress = result.formatted_address?.trim() || dynamicFallback.formattedAddress;

//   return jsonOk({
//     lat: resolvedLat,
//     lng: resolvedLng,
//     formattedAddress,
//     area: area || '',
//     city: city || 'Kanpur',
//     state: state || 'Uttar Pradesh',
//     pincode: pincode || '',
//     country: 'India',
//     street: [streetNumber, route].filter(Boolean).join(' ').trim() || '',
//     address: {
//       area: area || '',
//       city: city || 'Kanpur',
//       state: state || 'Uttar Pradesh',
//       pincode: pincode || '',
//       country: 'India',
//       street: [streetNumber, route].filter(Boolean).join(' ').trim() || '',
//     },
//     location: {
//       lat: resolvedLat,
//       lng: resolvedLng,
//     },
//   });
// }

// export async function POST(req: NextRequest) {
//   let body: unknown;
//   try {
//     body = await req.json();
//   } catch {
//     return jsonErr('Invalid JSON request body', 400);
//   }

//   if (!body || typeof body !== 'object' || Array.isArray(body)) {
//     return jsonErr('Invalid payload format', 400);
//   }

//   const payload = body as Record<string, unknown>;
//   const lat = Number(payload.lat);
//   const lng = Number(payload.lng);

//   if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
//     return jsonErr('Valid latitude and longitude are required', 400);
//   }

//   const forwardUrl = new URL(req.url);
//   forwardUrl.searchParams.set('lat', String(lat));
//   forwardUrl.searchParams.set('lng', String(lng));

//   const response = await GET(new NextRequest(forwardUrl, { headers: req.headers }));
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   const result = (await response.json().catch(() => null)) as any;

//   if (!response.ok || !result?.success || !result?.data) {
//     return jsonOk(getDynamicFallbackLocation(lat, lng));
//   }

//   const data = result.data;
//   const address = data.address ?? {};
  
//   return jsonOk({
//     lat: data.lat ?? lat,
//     lng: data.lng ?? lng,
//     formattedAddress: data.formattedAddress ?? '',
//     area: data.area ?? address.area ?? '',
//     city: data.city ?? address.city ?? 'Kanpur',
//     state: data.state ?? address.state ?? 'Uttar Pradesh',
//     pincode: data.pincode ?? address.pincode ?? '',
//     country: data.country ?? address.country ?? 'India',
//     street: data.street ?? address.street ?? '',
//     address: {
//       area: address.area ?? data.area ?? '',
//       city: address.city ?? data.city ?? '',
//       state: address.state ?? data.state ?? 'Uttar Pradesh',
//       pincode: address.pincode ?? data.pincode ?? '',
//       country: address.country ?? data.country ?? 'India',
//       street: address.street ?? data.street ?? '',
//     },
//     location: data.location ?? { lat, lng },
//   });
// }
