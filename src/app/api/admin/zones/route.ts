import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import {
  parseZoneInput,
  slugify,
} from '@/lib/zones';

type ServiceZone = {
  id: string;
  city: string;
  name: string;
  slug: string;
  status:
    | 'AVAILABLE'
    | 'LIMITED'
    | 'TEMPORARILY_UNAVAILABLE'
    | 'COMING_SOON';
  pincodes: string[];
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  services: string[] | null;
  is_catch_all: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SupplierZoneLink = {
  zone_id: string;
};

type ServiceZoneResponse =
  ServiceZone & {
    supplier_count: number;
  };

const VALID_STATUSES = new Set([
  'AVAILABLE',
  'LIMITED',
  'TEMPORARILY_UNAVAILABLE',
  'COMING_SOON',
]);

function isValidZoneStatus(
  value: unknown,
): value is ServiceZone['status'] {
  return (
    typeof value === 'string' &&
    VALID_STATUSES.has(value)
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * GET /api/admin/zones
 *
 * Admin-only list of service zones.
 *
 * Uses the service-role client only after the
 * requesting user has been authenticated and
 * verified as an admin.
 */
export async function GET(
  req: NextRequest,
) {
  void req;

  const auth =
    await requireSupabaseAuth(
      req,
    );

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'admin',
    )
  ) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  const db =
    createServiceClient();

  const {
    data: zones,
    error: zonesError,
  } = await db
    .from('service_zones')
    .select('*')
    .order('city', {
      ascending: true,
    })
    .order('name', {
      ascending: true,
    });

  if (zonesError) {
    console.error(
      '[admin/zones] list failed:',
      zonesError,
    );

    return jsonErr(
      'Could not load zones',
      502,
    );
  }

  const {
    data: links,
    error: linksError,
  } = await db
    .from('supplier_zones')
    .select('zone_id');

  if (linksError) {
    console.error(
      '[admin/zones] supplier counts failed:',
      linksError,
    );

    return jsonErr(
      'Could not load zone supplier counts',
      502,
    );
  }

  const supplierCounts =
    new Map<string, number>();

  for (
    const link of
      (links ??
        []) as SupplierZoneLink[]
  ) {
    if (!link.zone_id) {
      continue;
    }

    supplierCounts.set(
      link.zone_id,
      (
        supplierCounts.get(
          link.zone_id,
        ) ?? 0
      ) + 1,
    );
  }

  const result: ServiceZoneResponse[] =
    (
      (zones ??
        []) as ServiceZone[]
    ).map((zone) => ({
      ...zone,
      supplier_count:
        supplierCounts.get(
          zone.id,
        ) ?? 0,
    }));

  return jsonOk(result);
}

/**
 * POST /api/admin/zones
 *
 * Creates a new service zone.
 */
export async function POST(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(
      req,
    );

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'admin',
    )
  ) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  if (!isRecord(body)) {
    return jsonErr(
      'Request body must be an object',
      400,
    );
  }

  /*
   * Reuse the project's existing zone validation
   * instead of creating a second, conflicting schema.
   */
  const parsed =
    parseZoneInput(
      body,
      false,
    );

  if (!parsed.ok) {
    return jsonErr(
      parsed.error,
      422,
    );
  }

  const value =
    parsed.value;

  /*
   * Status is controlled explicitly here.
   * New zones must not accidentally become
   * bookable just because a future parser field
   * changes.
   */
  const requestedStatus =
    body.status;

  if (
    requestedStatus !==
      undefined &&
    !isValidZoneStatus(
      requestedStatus,
    )
  ) {
    return jsonErr(
      'Invalid zone status',
      422,
    );
  }

  const city =
    String(value.city)
      .trim();

  const name =
    String(value.name)
      .trim();

  if (!city || !name) {
    return jsonErr(
      'City and zone name are required',
      422,
    );
  }

  /*
   * The database has a unique slug.
   * Generate it deterministically from city + name.
   */
  const slug =
    slugify(
      `${city}-${name}`,
    );

  if (!slug) {
    return jsonErr(
      'Could not generate a valid zone slug',
      422,
    );
  }

  // Creation is always non-bookable; activation requires a separate review.
  if (requestedStatus === 'AVAILABLE' || requestedStatus === 'LIMITED') {
    return jsonErr('Create the zone as COMING_SOON, then activate it after coverage and capacity verification.', 422);
  }

  const db = createServiceClient();
  const { data: canonicalCity, error: cityLookupError } = await db.from('cities')
    .select('id').ilike('name', city).limit(1).maybeSingle();
  if (cityLookupError) return jsonErr('Could not verify the city directory.',503);
  const row = {
    ...value,
    city,
    city_id: canonicalCity?.id ?? null,
    name,
    slug,

    /*
     * Safe default for a newly-created zone.
     */
    status: 'COMING_SOON',

    /*
     * Ensure an explicit empty array rather
     * than relying on client input/defaults.
     */
    pincodes:
      Array.isArray(
        value.pincodes,
      )
        ? value.pincodes
        : [],
  };



  /*
   * Catch the common duplicate-slug case at
   * database level. The unique constraint remains
   * the final source of truth.
   */
  const {
    data,
    error,
  } = await db
    .from('service_zones')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    if (
      error.code ===
      '23505'
    ) {
      return jsonErr(
        'A zone with this name already exists in this city',
        409,
      );
    }

    console.error(
      '[admin/zones] create failed:',
      error,
    );

    return jsonErr(
      'Could not create the zone',
      502,
    );
  }

  /*
   * Audit logging is best-effort.
   * The zone was already created successfully,
   * so a temporary audit failure should not turn
   * a successful create into a false 500 response.
   */
  try {
    const {
      error: auditError,
    } = await db
      .from('audit_logs')
      .insert({
        actor_id:
          auth.ctx.profile.id,
        action:
          'zone.create',
        entity:
          'service_zones',
        entity_id:
          String(data.id),
        meta: {
          city: data.city,
          name: data.name,
          slug: data.slug,
          status: data.status,
        },
      });

    if (auditError) {
      console.error(
        '[admin/zones] audit failed:',
        auditError,
      );
    }
  } catch (error: unknown) {
    console.error(
      '[admin/zones] audit exception:',
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  return jsonOk(
    data,
    201,
  );
}









// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';
// import { parseZoneInput, slugify } from '@/lib/zones';

// /** Admin only. Role is verified server-side, then the service client performs the read/write. */

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

//   const db: any = createServiceClient();
//   const { data: zones, error } = await db.from('service_zones').select('*').order('city').order('name');
//   if (error) {
//     console.error('[admin/zones] list failed:', error);
//     return jsonErr('Could not load zones', 500);
//   }

//   const { data: links } = await db.from('supplier_zones').select('zone_id');
//   const counts = new Map<string, number>();
//   for (const l of (links ?? []) as { zone_id: string }[]) {
//     counts.set(l.zone_id, (counts.get(l.zone_id) ?? 0) + 1);
//   }

//   return jsonOk(((zones ?? []) as any[]).map((z) => ({ ...z, supplier_count: counts.get(z.id) ?? 0 })));
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

//   let body: Record<string, unknown>;
//   try {
//     body = (await req.json()) as Record<string, unknown>;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   const parsed = parseZoneInput(body, false);
//   if (!parsed.ok) return jsonErr(parsed.error, 422);

//   const v = parsed.value;
//   const row = {
//     status: 'COMING_SOON',
//     pincodes: [],
//     ...v,
//     slug: slugify(`${String(v.city)}-${String(v.name)}`),
//   };

//   const db: any = createServiceClient();
//   const { data, error } = await db.from('service_zones').insert(row).select('*').single();
//   if (error) {
//     if (error.code === '23505') return jsonErr('A zone with this name already exists in that city', 409);
//     console.error('[admin/zones] create failed:', error);
//     return jsonErr('Could not create the zone', 500);
//   }

//   await db.from('audit_logs').insert({
//     actor_id: auth.ctx.profile.id,
//     action: 'zone.create',
//     entity: 'service_zones',
//     entity_id: String(data.id),
//     meta: { city: data.city, name: data.name, status: data.status },
//   });

//   return jsonOk(data, 201);
// }


/** Apply a citywide operational override to every mapped PIN area and the fallback zone. */
export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) return jsonErr('Request body must be an object', 400);
  const cityName = typeof body.city === 'string' ? body.city.trim() : '';
  if (!cityName || cityName.length > 80) return jsonErr('A valid city is required.', 422);

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!isValidZoneStatus(body.status)) return jsonErr('Invalid zone status.', 422);
    updates.status = body.status;
  }
  if (body.services !== undefined) {
    if (body.services !== null && (!Array.isArray(body.services) || body.services.length > 50 || body.services.some((key) => typeof key !== 'string' || key.length > 80))) {
      return jsonErr('Services must be null or a list of at most 50 service keys.', 422);
    }
    updates.services = body.services;
  }
  if (body.customer_message !== undefined) {
    if (body.customer_message !== null && (typeof body.customer_message !== 'string' || body.customer_message.length > 500)) {
      return jsonErr('Customer message must be up to 500 characters.', 422);
    }
    updates.customer_message = typeof body.customer_message === 'string' ? body.customer_message.trim() || null : null;
  }
  if (!Object.keys(updates).length) return jsonErr('Provide a status, service scope, or customer message.', 422);

  const db = createServiceClient();
  const { data: city, error: cityError } = await db.from('cities').select('id,name').ilike('name', cityName).maybeSingle();
  if (cityError) return jsonErr('Could not verify the city.', 503);
  if (!city) return jsonErr('City not found in the live city directory.', 404);

  const { data, error } = await db.from('service_zones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('city_id', city.id)
    .select('id');
  if (error) {
    console.error('[admin/zones] citywide update failed', { code: error.code });
    return jsonErr('Could not update city service controls.', 503);
  }
  const updatedZones = data?.length ?? 0;
  if (!updatedZones) return jsonErr('No service areas are mapped to this city.', 409);

  const { error: auditError } = await db.from('audit_logs').insert({
    actor_id: auth.ctx.profile.id,
    action: 'city.service_controls_update',
    entity: 'cities',
    entity_id: city.id,
    meta: { city: city.name, updated_zones: updatedZones, changed: Object.keys(updates), status: updates.status ?? null, services: updates.services ?? null, customer_message: updates.customer_message ?? null },
  });
  if (auditError) console.error('[admin/zones] citywide audit failed', { code: auditError.code });

  return jsonOk({ city: city.name, updated_zones: updatedZones, applied: Object.keys(updates) });
}
