import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const REQUEST_TIMEOUT_MS = 7_000;

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
  if (!apiKey) {
    console.error('[geocode/reverse] GOOGLE_MAPS_API_KEY is not configured');
    return jsonErr('Location service is temporarily unavailable', 503);
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
  } catch (error) {
    console.error('[geocode/reverse] Fetch network failure:', error);
    return jsonErr('Unable to connect to mapping service. Please try again.', 502);
  } finally {
    clearTimeout(timeout);
  }

  let data: GoogleGeocodeResponse;
  try {
    data = (await googleResponse.json()) as GoogleGeocodeResponse;
  } catch {
    console.error('[geocode/reverse] Failed to parse Google JSON response');
    return jsonErr('Invalid response from location provider', 502);
  }

  if (!googleResponse.ok || data.status !== 'OK') {
    console.error('[geocode/reverse] Google API Error Status:', data.status, data.error_message);
    if (data.status === 'OVER_QUERY_LIMIT') {
      return jsonErr('Location service is experiencing high traffic. Please try later.', 429);
    }
    return jsonErr('Unable to detect your address at this location', 502);
  }

  const result = data.results?.[0];
  if (!result) {
    return jsonErr('No address found for these coordinates', 404);
  }

  const components = result.address_components ?? [];
  const country = getComponent(components, 'country');
  const state = getComponent(components, 'administrative_area_level_1');
  const city = getComponent(components, 'locality', 'postal_town', 'administrative_area_level_2');
  const area = getComponent(components, 'sublocality_level_1', 'sublocality', 'neighborhood', 'administrative_area_level_3');
  const pincode = getShortComponent(components, 'postal_code');
  const streetNumber = getComponent(components, 'street_number');
  const route = getComponent(components, 'route');

  const normalizedCountry = country.toLowerCase();
  if (normalizedCountry && normalizedCountry !== 'india' && normalizedCountry !== 'in') {
    return jsonErr('AuroWater currently operates and supports addresses in India only', 400);
  }

  const resolvedLat = result.geometry?.location?.lat ?? lat;
  const resolvedLng = result.geometry?.location?.lng ?? lng;

  return jsonOk({
    formattedAddress: result.formatted_address?.trim() || '',
    address: {
      area,
      city,
      state,
      pincode,
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
    return jsonErr(result?.error ?? 'Unable to resolve this location', response.status || 502);
  }

  const address = result.data.address ?? {};
  return jsonOk({
    lat: result.data.location?.lat ?? lat,
    lng: result.data.location?.lng ?? lng,
    formattedAddress: result.data.formattedAddress ?? '',
    area: address.area ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    pincode: address.pincode ?? '',
    country: address.country ?? 'India',
    street: address.street ?? '',
  });
}
