import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export const runtime = 'nodejs';

const GOOGLE_GEOCODE_URL =
  'https://geocode.googleapis.com/v4/geocode/location';

const REQUEST_TIMEOUT_MS = 8_000;

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GoogleGeocodeResponse = {
  results?: Array<{
    formattedAddress?: string;
    addressComponents?: GoogleAddressComponent[];
  }>;
};

function getComponent(
  components: GoogleAddressComponent[],
  type: string,
): string {
  const component = components.find((item) =>
    item.types?.includes(type),
  );

  return component?.longText?.trim() ?? '';
}

function getShortComponent(
  components: GoogleAddressComponent[],
  type: string,
): string {
  const component = components.find((item) =>
    item.types?.includes(type),
  );

  return component?.shortText?.trim() ?? '';
}

export async function GET(req: NextRequest) {
  // ------------------------------------------------------------
  // 1. Authenticate the request
  // ------------------------------------------------------------
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  // ------------------------------------------------------------
  // 2. Location/address functionality is available to:
  //
  // CUSTOMER  → can book water/services
  // SUPPLIER  → can also buy/book water
  // TECHNICIAN → needs location for jobs/service operations
  //
  // ADMIN does not need this customer-facing endpoint.
  // ------------------------------------------------------------
  if (
    !requireRole(auth.ctx, [
      'customer',
      'supplier',
      'technician',
    ])
  ) {
    return jsonErr('Forbidden', 403);
  }

  // ------------------------------------------------------------
  // 3. Read coordinates
  // ------------------------------------------------------------
  const searchParams = new URL(req.url).searchParams;

  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');

  if (!latParam || !lngParam) {
    return jsonErr('lat and lng are required', 400);
  }

  const lat = Number(latParam);
  const lng = Number(lngParam);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonErr('Invalid coordinates', 400);
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return jsonErr('Coordinates are out of range', 400);
  }

  // ------------------------------------------------------------
  // 4. Google Maps API key
  // ------------------------------------------------------------
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error(
      '[geocode/reverse] GOOGLE_MAPS_API_KEY is not configured',
    );

    return jsonErr(
      'Location service is temporarily unavailable',
      503,
    );
  }

  // ------------------------------------------------------------
  // 5. Call Google Geocoding API
  // ------------------------------------------------------------
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let googleResponse: Response;

  try {
    googleResponse = await fetch(GOOGLE_GEOCODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'results.formattedAddress,results.addressComponents',
      },
      body: JSON.stringify({
        location: {
          latitude: lat,
          longitude: lng,
        },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    console.error(
      '[geocode/reverse] Google request failed:',
      error,
    );

    return jsonErr(
      'Unable to detect your location right now',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }

  // ------------------------------------------------------------
  // 6. Handle Google API errors
  // ------------------------------------------------------------
  if (!googleResponse.ok) {
    let googleError: unknown = null;

    try {
      googleError = await googleResponse.json();
    } catch {
      // Ignore invalid/non-JSON Google error body.
    }

    console.error(
      '[geocode/reverse] Google API error:',
      googleResponse.status,
      googleError,
    );

    return jsonErr(
      'Unable to detect your address right now',
      502,
    );
  }

  // ------------------------------------------------------------
  // 7. Parse Google response
  // ------------------------------------------------------------
  let data: GoogleGeocodeResponse;

  try {
    data = (await googleResponse.json()) as GoogleGeocodeResponse;
  } catch (error) {
    console.error(
      '[geocode/reverse] Invalid Google response:',
      error,
    );

    return jsonErr(
      'Invalid location service response',
      502,
    );
  }

  const result = data.results?.[0];

  if (!result) {
    return jsonErr(
      'No address could be found for this location',
      404,
    );
  }

  const components = result.addressComponents ?? [];

  // ------------------------------------------------------------
  // 8. Extract address components
  // ------------------------------------------------------------
  const country = getComponent(components, 'country');

  const state =
    getComponent(components, 'administrative_area_level_1') ||
    getComponent(components, 'administrative_area_level_2');

  const city =
    getComponent(components, 'locality') ||
    getComponent(components, 'postal_town') ||
    getComponent(
      components,
      'administrative_area_level_2',
    );

  const area =
    getComponent(components, 'sublocality') ||
    getComponent(components, 'sublocality_level_1') ||
    getComponent(components, 'neighborhood') ||
    getComponent(components, 'administrative_area_level_3');

  const pincode = getShortComponent(
    components,
    'postal_code',
  );

  const streetNumber = getComponent(
    components,
    'street_number',
  );

  const route = getComponent(components, 'route');

  // ------------------------------------------------------------
  // 9. AuroWater currently operates in India.
  // Do not silently create an Indian address from another country.
  // ------------------------------------------------------------
  const normalizedCountry = country.toLowerCase();

  if (
    normalizedCountry !== 'india' &&
    normalizedCountry !== 'in'
  ) {
    return jsonErr(
      'AuroWater currently supports addresses in India',
      400,
    );
  }

  // ------------------------------------------------------------
  // 10. Return normalized address data
  // ------------------------------------------------------------
  return jsonOk({
    formattedAddress:
      result.formattedAddress?.trim() || '',

    address: {
      area,
      city,
      state,
      pincode,
      country: 'India',
      street:
        [streetNumber, route]
          .filter(Boolean)
          .join(' ')
          .trim() || '',
    },

    location: {
      lat,
      lng,
    },
  });
}

















// import { NextRequest } from 'next/server';

// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireSupabaseAuth } from '@/lib/api/supabase-request';

// export const runtime = 'nodejs';

// const GOOGLE_GEOCODING_URL =
//   'https://geocode.googleapis.com/v4/geocode/location';

// const MAX_LAT = 90;
// const MAX_LNG = 180;

// type GoogleAddressComponent = {
//   longText?: string;
//   shortText?: string;
//   types?: string[];
// };

// type GoogleGeocodeResult = {
//   placeId?: string;
//   formattedAddress?: string;
//   addressComponents?: GoogleAddressComponent[];
//   types?: string[];
//   location?: {
//     latitude?: number;
//     longitude?: number;
//   };
// };

// type GoogleGeocodeResponse = {
//   results?: GoogleGeocodeResult[];
//   error?: {
//     code?: number;
//     message?: string;
//     status?: string;
//   };
// };

// function isValidCoordinate(value: unknown): value is number {
//   return (
//     typeof value === 'number' &&
//     Number.isFinite(value)
//   );
// }

// function getComponent(
//   components: GoogleAddressComponent[],
//   ...types: string[]
// ): string | null {
//   for (const type of types) {
//     const component = components.find((item) =>
//       item.types?.includes(type)
//     );

//     if (component?.longText?.trim()) {
//       return component.longText.trim();
//     }
//   }

//   return null;
// }

// function getFirstResult(
//   response: GoogleGeocodeResponse
// ): GoogleGeocodeResult | null {
//   const results = Array.isArray(response.results)
//     ? response.results
//     : [];

//   return results[0] ?? null;
// }

// export async function POST(req: NextRequest) {
//   /*
//    * Location detection is part of the authenticated booking flow.
//    * Keeping this route authenticated prevents anonymous users from
//    * turning our Google API proxy into an unrestricted geocoding proxy.
//    */
//   const auth = await requireSupabaseAuth(req);

//   if (!auth.ok) {
//     return auth.response;
//   }

//   if (auth.ctx.profile.role !== 'customer') {
//     return jsonErr('Forbidden', 403);
//   }

//   let body: unknown;

//   try {
//     body = await req.json();
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   if (
//     !body ||
//     typeof body !== 'object' ||
//     Array.isArray(body)
//   ) {
//     return jsonErr('Invalid request body', 400);
//   }

//   const payload = body as Record<string, unknown>;

//   const lat =
//     typeof payload.lat === 'number'
//       ? payload.lat
//       : Number(payload.lat);

//   const lng =
//     typeof payload.lng === 'number'
//       ? payload.lng
//       : Number(payload.lng);

//   if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
//     return jsonErr(
//       'Valid latitude and longitude are required',
//       400
//     );
//   }

//   if (
//     lat < -MAX_LAT ||
//     lat > MAX_LAT ||
//     lng < -MAX_LNG ||
//     lng > MAX_LNG
//   ) {
//     return jsonErr(
//       'Latitude or longitude is outside the valid range',
//       400
//     );
//   }

//   const apiKey = process.env.GOOGLE_MAPS_API_KEY;

//   if (!apiKey) {
//     console.error(
//       '[geocode:reverse] GOOGLE_MAPS_API_KEY is not configured'
//     );

//     return jsonErr(
//       'Location service is temporarily unavailable',
//       503
//     );
//   }

//   const url =
//     `${GOOGLE_GEOCODING_URL}/` +
//     `${encodeURIComponent(lat)},${encodeURIComponent(lng)}` +
//     `?languageCode=en`;

//   const controller = new AbortController();
//   const timeout = setTimeout(() => {
//     controller.abort();
//   }, 8000);

//   let googleResponse: Response;

//   try {
//     googleResponse = await fetch(url, {
//       method: 'GET',
//       headers: {
//         Accept: 'application/json',
//         'X-Goog-Api-Key': apiKey,
//         'X-Goog-FieldMask':
//           'results.placeId,' +
//           'results.formattedAddress,' +
//           'results.addressComponents,' +
//           'results.types,' +
//           'results.location',
//       },
//       cache: 'no-store',
//       signal: controller.signal,
//     });
//   } catch (error) {
//     console.error(
//       '[geocode:reverse:fetch]',
//       error instanceof Error ? error.message : error
//     );

//     return jsonErr(
//       'Unable to determine your location right now',
//       502
//     );
//   } finally {
//     clearTimeout(timeout);
//   }

//   let data: GoogleGeocodeResponse;

//   try {
//     data =
//       (await googleResponse.json()) as GoogleGeocodeResponse;
//   } catch {
//     console.error(
//       '[geocode:reverse] Google returned invalid JSON'
//     );

//     return jsonErr(
//       'Location service returned an invalid response',
//       502
//     );
//   }

//   if (!googleResponse.ok) {
//     console.error(
//       '[geocode:reverse:google]',
//       googleResponse.status,
//       data.error?.status,
//       data.error?.message
//     );

//     if (googleResponse.status === 429) {
//       return jsonErr(
//         'Location service is busy. Please try again in a moment.',
//         429
//       );
//     }

//     return jsonErr(
//       'Unable to determine your address from this location',
//       502
//     );
//   }

//   const result = getFirstResult(data);

//   if (!result) {
//     return jsonErr(
//       'We could not find an address at this location. Please enter your address manually.',
//       404
//     );
//   }

//   const components = Array.isArray(
//     result.addressComponents
//   )
//     ? result.addressComponents
//     : [];

//   const houseNumber = getComponent(
//     components,
//     'street_number'
//   );

//   const route = getComponent(
//     components,
//     'route'
//   );

//   const area =
//     getComponent(
//       components,
//       'sublocality_level_1',
//       'sublocality',
//       'neighborhood'
//     ) ??
//     route ??
//     getComponent(
//       components,
//       'administrative_area_level_3'
//     );

//   const city =
//     getComponent(
//       components,
//       'locality',
//       'postal_town'
//     ) ??
//     getComponent(
//       components,
//       'administrative_area_level_2'
//     );

//   const state = getComponent(
//     components,
//     'administrative_area_level_1'
//   );

//   const pincode = getComponent(
//     components,
//     'postal_code'
//   );

//   const country = getComponent(
//     components,
//     'country'
//   );

//   /*
//    * AuroWater currently operates in India.
//    * Reject an accidental location outside India rather than
//    * populating the booking form with an unrelated country.
//    */
//   const countryCode =
//     getComponent(components, 'country')?.toLowerCase() ?? '';

//   if (
//     countryCode &&
//     !['india', 'in'].includes(countryCode)
//   ) {
//     return jsonErr(
//       'AuroWater currently supports locations in India.',
//       400
//     );
//   }

//   const resolvedLat =
//     isValidCoordinate(result.location?.latitude)
//       ? result.location!.latitude!
//       : lat;

//   const resolvedLng =
//     isValidCoordinate(result.location?.longitude)
//       ? result.location!.longitude!
//       : lng;

//   return jsonOk({
//     lat: resolvedLat,
//     lng: resolvedLng,
//     placeId: result.placeId ?? null,
//     formattedAddress:
//       result.formattedAddress ?? null,
//     houseNumber,
//     route,
//     area,
//     city,
//     state,
//     pincode,
//     country,
//     types: Array.isArray(result.types)
//       ? result.types
//       : [],
//   });
// }


/**
 * Backward-compatible POST contract used by existing booking/location clients.
 * The canonical handler is GET; keep both verbs supported while clients migrate.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonErr('Invalid request body', 400);
  }

  const payload = body as Record<string, unknown>;
  const lat = typeof payload.lat === 'number' ? payload.lat : Number(payload.lat);
  const lng = typeof payload.lng === 'number' ? payload.lng : Number(payload.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return jsonErr('Valid latitude and longitude are required', 400);
  }

  const url = new URL(req.url);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  const response = await GET(new NextRequest(url, { headers: req.headers }));
  const result = await response.json().catch(() => null) as
    | { success?: boolean; data?: { formattedAddress?: string; address?: Record<string, unknown>; location?: { lat?: number; lng?: number } }; error?: string }
    | null;

  if (!response.ok || !result?.success || !result.data) {
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
