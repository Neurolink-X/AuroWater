import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

import type { ProfileRole } from '@/lib/db/types';

import {
  resolveServiceability,
} from '@/lib/zones';

import { resolveAddressLocation } from '@/lib/address-geo.server';
import { MIN_QUALITY_FOR_WATER } from '@/lib/address-geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Roles allowed to check serviceability.
 *
 * Keep this explicitly typed so TypeScript cannot widen the
 * values to string[] and accidentally bypass the ProfileRole contract.
 */
const SERVICEABILITY_ROLES: ProfileRole[] = [
  'customer',
  'supplier',
  'technician',
];

/**
 * Defensive input limits.
 *
 * These are intentionally conservative because address_id and service
 * are identifiers, not free-form content.
 */
const MAX_ADDRESS_ID_LENGTH = 100;
const MAX_SERVICE_KEY_LENGTH = 100;
const SERVICE_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // This endpoint only answers:
  // "Can this authenticated user's address receive this service?"
  //
  // It does NOT authorize:
  // - accepting orders
  // - fulfilling orders
  // - modifying orders
  // - receiving payouts
  // - reading another user's address
  // ============================================================
  if (!requireRole(auth.ctx, SERVICEABILITY_ROLES)) {
    return jsonErr('Forbidden', 403);
  }

  // ============================================================
  // 3. READ & VALIDATE QUERY PARAMETERS
  // ============================================================
  const searchParams = req.nextUrl.searchParams;

  const addressId =
    searchParams.get('address_id')?.trim() ?? '';

  const rawService =
    searchParams.get('service')?.trim() ?? '';

  const service = rawService || undefined;

  if (!addressId) {
    return jsonErr('address_id is required', 400);
  }

   if (addressId.length > MAX_ADDRESS_ID_LENGTH || !UUID_PATTERN.test(addressId)) {
    return jsonErr('Invalid address ID', 400);
  }

  if (service && service.length > MAX_SERVICE_KEY_LENGTH) {
    return jsonErr('Invalid service', 400);
  }

  if (service && !SERVICE_KEY_PATTERN.test(service)) {
    return jsonErr('Invalid service', 400);
  }

  // ============================================================
  // 4. LOAD ONLY THE AUTHENTICATED USER'S ADDRESS
  //
  // Current AuroWater schema:
  //     addresses.user_id
  //
  // The ownership check is performed server-side using the
  // authenticated profile. Never trust user_id/customer_id from
  // browser input.
  // ============================================================
  const {
    data: address,
    error: addressError,
  } = await auth.ctx.supabase
    .from('addresses')
    .select('*')
    .eq('id', addressId)
    .eq('customer_id', auth.ctx.profile.id)
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
    return jsonErr('Address not found', 404);
  }

  // ============================================================
  // 5. SERVER-SIDE SERVICEABILITY RESOLUTION
  //
  // resolveServiceability() is the single source of truth for:
  // - configured service zones
  // - pincode matching
  // - coordinate/radius matching
  // - catch-all zones
  // - zone status
  // - service-specific restrictions
  // - legacy city/geofence fallback
  //
  // The browser never decides the final serviceability result.
  // ============================================================
  try {
    const row = address as Record<string, unknown>;
    const geo = await resolveAddressLocation(row);

    const result = await resolveServiceability(
      geo.ok ? { ...row, lat: geo.lat, lng: geo.lng } : row,
      service,
    );

    if (result.status === 'LOOKUP_ERROR') {
      return jsonErr(result.message, 503, 'SERVICEABILITY_LOOKUP_FAILED');
    }

    const location = geo.ok
      ? {
          source: geo.source,
          quality: geo.quality,
          can_order_water: geo.quality >= MIN_QUALITY_FOR_WATER,
          warning: geo.warning,
        }
      : { source: null, quality: 0, can_order_water: false, warning: null };

    return jsonOk({ ...result, location });
  } catch (error) {
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
