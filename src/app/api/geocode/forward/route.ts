import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export const runtime = 'nodejs';

const PINCODE = /^[0-9]{6}$/;

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, ['customer', 'supplier', 'technician'])) {
    return jsonErr('Forbidden', 403);
  }

  let body: Record<string, unknown>;
  try {
    const value: unknown = await req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return jsonErr('Invalid request body', 400);
    }
    body = value as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const house = typeof body.house_flat === 'string' ? body.house_flat.trim() : '';
  const area = typeof body.area === 'string' ? body.area.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
  if (!house || !area || !city || !PINCODE.test(pincode)) {
    return jsonErr('Enter house/flat, area, city and a valid 6-digit pincode.', 400);
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return jsonErr('Address lookup is temporarily unavailable. Please try again or use the map pin.', 503);

  const address = [house, area, city, pincode, 'Uttar Pradesh', 'India'].filter(Boolean).join(', ');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'in');
  url.searchParams.set('components', 'country:IN|postal_code:' + pincode);
  url.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return jsonErr('Address lookup failed. Check your details and retry.', 502);
    const result = await response.json() as {
      status?: string;
      results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } }; address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }> }>;
    };
    const match = result.results?.[0];
    const lat = match?.geometry?.location?.lat;
    const lng = match?.geometry?.location?.lng;
    if (result.status !== 'OK' || typeof lat !== 'number' || typeof lng !== 'number' ||
        !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      return jsonErr('We could not verify this address on the map. Correct the address or select a map pin.', 422);
    }
    const components = match?.address_components ?? [];
    const component = (type: string) => components.find((x) => x.types?.includes(type))?.long_name ?? '';
    if (component('country') && component('country').toLowerCase() !== 'india') {
      return jsonErr('AuroTap currently supports addresses in India.', 422);
    }
    if (component('postal_code') && component('postal_code') !== pincode) {
      return jsonErr('The address does not match this pincode. Please correct it.', 422);
    }
    return jsonOk({
      lat, lng, formattedAddress: match?.formatted_address ?? address,
      area: component('sublocality') || component('neighborhood') || area,
      city: component('locality') || component('administrative_area_level_2') || city,
      state: component('administrative_area_level_1') || 'Uttar Pradesh',
      pincode: component('postal_code') || pincode,
    });
  } catch {
    return jsonErr('Address lookup timed out. Check your details and try again.', 504);
  } finally {
    clearTimeout(timeout);
  }
}
