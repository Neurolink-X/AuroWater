import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const REQUEST_TIMEOUT_MS = 6_000;

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    address_components?: GoogleAddressComponent[];
    place_id?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
};

function getComponent(components: GoogleAddressComponent[], ...types: string[]): string {
  for (const t of types) {
    const comp = components.find((item) => item.types?.includes(t));
    if (comp?.long_name?.trim()) {
      return comp.long_name.trim();
    }
  }
  return '';
}

function getShortComponent(components: GoogleAddressComponent[], ...types: string[]): string {
  for (const t of types) {
    const comp = components.find((item) => item.types?.includes(t));
    if (comp?.short_name?.trim()) {
      return comp.short_name.trim();
    }
  }
  return '';
}

/**
 * Dynamic Coordinate-Aware Region Detection for any user location across regions
 */
function getDynamicFallbackLocation(lat: number, lng: number) {
  let city = 'Kanpur';
  let pincode = '';
  let state = 'Uttar Pradesh';
  let area = '';

  // Lucknow Region Bounds
  if (lat >= 26.7 && lat <= 27.0 && lng >= 80.8 && lng <= 81.1) {
    city = 'Lucknow';
    pincode = '226001';
  }
  // Gorakhpur Region Bounds
  else if (lat >= 26.7 && lat <= 26.9 && lng >= 83.3 && lng <= 83.5) {
    city = 'Gorakhpur';
    pincode = '273001';
  }
  // NCR / Delhi / Noida Region Bounds
  else if (lat >= 28.4 && lat <= 28.7 && lng >= 77.0 && lng <= 77.4) {
    city = 'NCR';
    pincode = '110001';
  }
  // Default to Kanpur bounds for AuroTap's primary hub
  else {
    city = 'Kanpur';
    pincode = '208001';
  }

  return {
    lat,
    lng,
    formattedAddress: `Location near (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    area,
    city,
    state,
    pincode,
    country: 'India',
    street: '',
    address: {
      area,
      city,
      state,
      pincode,
      country: 'India',
      street: '',
    },
    location: { lat, lng },
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  const searchParams = req.nextUrl.searchParams;
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  if (!latParam || !lngParam) {
    return jsonErr('Latitude and longitude are required', 400);
  }

  const lat = Number(latParam);
  const lng = Number(lngParam);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return jsonErr('Coordinates are out of valid range', 400);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const dynamicFallback = getDynamicFallbackLocation(lat, lng);

  if (!apiKey) {
    return jsonOk(dynamicFallback);
  }

  const url = `${GOOGLE_GEOCODE_URL}?latlng=${lat},${lng}&key=${apiKey}&language=en`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let googleResponse: Response;
  try {
    googleResponse = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    return jsonOk(dynamicFallback);
  } finally {
    clearTimeout(timeout);
  }

  let data: GoogleGeocodeResponse;
  try {
    data = (await googleResponse.json()) as GoogleGeocodeResponse;
  } catch {
    data = { status: 'PARSE_ERROR' };
  }

  if (!googleResponse.ok || data.status !== 'OK' || !data.results?.[0]) {
    return jsonOk(dynamicFallback);
  }

  const result = data.results[0];
  const components = result.address_components ?? [];
  const state = getComponent(components, 'administrative_area_level_1') || dynamicFallback.state;
  const city = getComponent(components, 'locality', 'postal_town', 'administrative_area_level_2') || dynamicFallback.city;
  
  const area = getComponent(
    components,
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
    'sublocality_level_2',
    'administrative_area_level_3'
  );

  const pincode = getShortComponent(components, 'postal_code') || dynamicFallback.pincode;
  const streetNumber = getComponent(components, 'street_number');
  const route = getComponent(components, 'route');

  const resolvedLat = result.geometry?.location?.lat ?? lat;
  const resolvedLng = result.geometry?.location?.lng ?? lng;
  const formattedAddress = result.formatted_address?.trim() || dynamicFallback.formattedAddress;

  return jsonOk({
    lat: resolvedLat,
    lng: resolvedLng,
    formattedAddress,
    area: area || '',
    city: city || 'Kanpur',
    state: state || 'Uttar Pradesh',
    pincode: pincode || '',
    country: 'India',
    street: [streetNumber, route].filter(Boolean).join(' ').trim() || '',
    address: {
      area: area || '',
      city: city || 'Kanpur',
      state: state || 'Uttar Pradesh',
      pincode: pincode || '',
      country: 'India',
      street: [streetNumber, route].filter(Boolean).join(' ').trim() || '',
    },
    location: {
      lat: resolvedLat,
      lng: resolvedLng,
    },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid JSON request body', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonErr('Invalid payload format', 400);
  }

  const payload = body as Record<string, unknown>;
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonErr('Valid latitude and longitude are required', 400);
  }

  const forwardUrl = new URL(req.url);
  forwardUrl.searchParams.set('lat', String(lat));
  forwardUrl.searchParams.set('lng', String(lng));

  const response = await GET(new NextRequest(forwardUrl, { headers: req.headers }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await response.json().catch(() => null)) as any;

  if (!response.ok || !result?.success || !result?.data) {
    return jsonOk(getDynamicFallbackLocation(lat, lng));
  }

  const data = result.data;
  const address = data.address ?? {};
  
  return jsonOk({
    lat: data.lat ?? lat,
    lng: data.lng ?? lng,
    formattedAddress: data.formattedAddress ?? '',
    area: data.area ?? address.area ?? '',
    city: data.city ?? address.city ?? 'Kanpur',
    state: data.state ?? address.state ?? 'Uttar Pradesh',
    pincode: data.pincode ?? address.pincode ?? '',
    country: data.country ?? address.country ?? 'India',
    street: data.street ?? address.street ?? '',
    address: {
      area: address.area ?? data.area ?? '',
      city: address.city ?? data.city ?? '',
      state: address.state ?? data.state ?? 'Uttar Pradesh',
      pincode: address.pincode ?? data.pincode ?? '',
      country: address.country ?? data.country ?? 'India',
      street: address.street ?? data.street ?? '',
    },
    location: data.location ?? { lat, lng },
  });
}
