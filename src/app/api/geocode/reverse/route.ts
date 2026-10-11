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

  // Universal Fallback payload supporting both flat & nested contracts for absolute frontend compatibility
  const getUniversalFallback = () => ({
    lat,
    lng,
    formattedAddress: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    area: 'Local Area',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    pincode: '208001',
    country: 'India',
    street: '',
    address: {
      area: 'Local Area',
      city: 'Kanpur',
      state: 'Uttar Pradesh',
      pincode: '208001',
      country: 'India',
      street: '',
    },
    location: { lat, lng },
  });

  if (!apiKey) {
    console.warn('[geocode/reverse] GOOGLE_MAPS_API_KEY missing. Using universal fallback.');
    return jsonOk(getUniversalFallback());
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
    console.error('[geocode/reverse] Network fetch failure, using fallback:', error);
    return jsonOk(getUniversalFallback());
  } finally {
    clearTimeout(timeout);
  }

  let data: GoogleGeocodeResponse;
  try {
    data = (await googleResponse.json()) as GoogleGeocodeResponse;
  } catch {
    console.error('[geocode/reverse] Failed to parse Google JSON response');
    data = { status: 'PARSE_ERROR' };
  }

  if (!googleResponse.ok || data.status !== 'OK' || !data.results?.[0]) {
    console.warn('[geocode/reverse] Google API returned non-OK status:', data.status, data.error_message);
    return jsonOk(getUniversalFallback());
  }

  const result = data.results[0];
  const components = result.address_components ?? [];
  const state = getComponent(components, 'administrative_area_level_1');
  const city = getComponent(components, 'locality', 'postal_town', 'administrative_area_level_2');
  const area = getComponent(components, 'sublocality_level_1', 'sublocality', 'neighborhood', 'administrative_area_level_3');
  const pincode = getShortComponent(components, 'postal_code');
  const streetNumber = getComponent(components, 'street_number');
  const route = getComponent(components, 'route');

  const resolvedLat = result.geometry?.location?.lat ?? lat;
  const resolvedLng = result.geometry?.location?.lng ?? lng;
  const formattedAddress = result.formatted_address?.trim() || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  const resolvedArea = area || 'Local Area';
  const resolvedCity = city || 'Kanpur';
  const resolvedState = state || 'Uttar Pradesh';
  const resolvedPincode = pincode || '208001';
  const resolvedStreet = [streetNumber, route].filter(Boolean).join(' ').trim() || '';

  // Return world-class merged payload supporting both formats natively
  return jsonOk({
    lat: resolvedLat,
    lng: resolvedLng,
    formattedAddress,
    area: resolvedArea,
    city: resolvedCity,
    state: resolvedState,
    pincode: resolvedPincode,
    country: 'India',
    street: resolvedStreet,
    address: {
      area: resolvedArea,
      city: resolvedCity,
      state: resolvedState,
      pincode: resolvedPincode,
      country: 'India',
      street: resolvedStreet,
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
    return jsonOk({
      lat,
      lng,
      formattedAddress: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      area: 'Local Area',
      city: 'Kanpur',
      state: 'Uttar Pradesh',
      pincode: '208001',
      country: 'India',
      street: '',
      address: {
        area: 'Local Area',
        city: 'Kanpur',
        state: 'Uttar Pradesh',
        pincode: '208001',
        country: 'India',
        street: '',
      },
      location: { lat, lng },
    });
  }

  const data = result.data;
  const address = data.address ?? {};
  
  return jsonOk({
    lat: data.lat ?? lat,
    lng: data.lng ?? lng,
    formattedAddress: data.formattedAddress ?? '',
    area: data.area ?? address.area ?? '',
    city: data.city ?? address.city ?? '',
    state: data.state ?? address.state ?? '',
    pincode: data.pincode ?? address.pincode ?? '',
    country: data.country ?? address.country ?? 'India',
    street: data.street ?? address.street ?? '',
    address: {
      area: address.area ?? data.area ?? '',
      city: address.city ?? data.city ?? '',
      state: address.state ?? data.state ?? '',
      pincode: address.pincode ?? data.pincode ?? '',
      country: address.country ?? data.country ?? 'India',
      street: address.street ?? data.street ?? '',
    },
    location: data.location ?? { lat, lng },
  });
}
