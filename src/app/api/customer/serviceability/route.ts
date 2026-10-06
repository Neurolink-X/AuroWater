import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

import {
  resolveServiceability,
} from '@/lib/zones';

export const runtime = 'nodejs';

const SERVICEABILITY_ROLES = [
  'customer',
  'supplier',
  'technician',
];

const MAX_ADDRESS_ID_LENGTH = 100;
const MAX_SERVICE_KEY_LENGTH = 100;

export async function GET(req: NextRequest) {
  // ============================================================
  // 1. AUTHENTICATION
  // ============================================================
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  // ============================================================
  // 2. AUTHORIZATION
  //
  // CUSTOMER:
  //   Can check serviceability before booking.
  //
  // SUPPLIER:
  //   Can buy/book water for themselves.
  //
  // TECHNICIAN:
  //   Can check service/location context for assigned work.
  //
  // IMPORTANT:
  // This endpoint ONLY answers:
  // "Can this address receive this service?"
  //
  // It does NOT give anyone permission to:
  // - accept orders
  // - fulfill orders
  // - modify orders
  // - receive payouts
  // - access another user's address
  // ============================================================
  if (!requireRole(auth.ctx, SERVICEABILITY_ROLES)) {
    return jsonErr('Forbidden', 403);
  }

  // ============================================================
  // 3. READ & VALIDATE QUERY PARAMETERS
  // ============================================================
  const searchParams = new URL(req.url).searchParams;

  const addressId =
    searchParams.get('address_id')?.trim() ?? '';

  const service =
    searchParams.get('service')?.trim() || undefined;

  if (!addressId) {
    return jsonErr(
      'address_id is required',
      400,
    );
  }

  if (addressId.length > MAX_ADDRESS_ID_LENGTH) {
    return jsonErr(
      'Invalid address ID',
      400,
    );
  }

  if (
    service &&
    service.length > MAX_SERVICE_KEY_LENGTH
  ) {
    return jsonErr(
      'Invalid service',
      400,
    );
  }

  // ============================================================
  // 4. LOAD ONLY THE AUTHENTICATED USER'S ADDRESS
  //
  // AuroWater's current addresses schema uses:
  //
  //     addresses.user_id
  //
  // NOT:
  //
  //     addresses.customer_id
  //
  // Never accept user_id/customer_id from the browser.
  //
  // The authenticated profile is the ownership boundary.
  // ============================================================
  const {
    data: address,
    error: addressError,
  } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('id', addressId)
    .eq('user_id', auth.ctx.profile.id)
    .maybeSingle();

  if (addressError) {
    console.error(
      '[serviceability] address lookup failed:',
      addressError,
    );

    return jsonErr(
      'Could not check this address right now',
      500,
    );
  }

  if (!address) {
    return jsonErr(
      'Address not found',
      404,
    );
  }

  // ============================================================
  // 5. SERVER-SIDE SERVICEABILITY RESOLUTION
  //
  // resolveServiceability() handles:
  //
  // 1. Configured service zones
  // 2. Pincode matching
  // 3. Coordinate/radius matching
  // 4. Catch-all zones
  // 5. AVAILABLE / LIMITED / COMING_SOON /
  //    TEMPORARILY_UNAVAILABLE
  // 6. Service-specific restrictions
  // 7. Legacy city/geofence fallback
  //
  // The browser never decides the final result.
  // ============================================================
  try {
    const result = await resolveServiceability(
      address as Record<string, unknown>,
      service,
    );

    return jsonOk(result);
  } catch (error) {
    // resolveServiceability is designed not to throw,
    // but keep this boundary for future-proofing.
    console.error(
      '[serviceability] unexpected resolution error:',
      error,
    );

    return jsonErr(
      'Could not determine service availability right now',
      500,
    );
  }
}
