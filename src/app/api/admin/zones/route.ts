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

  const row = {
    ...value,
    city,
    name,
    slug,

    /*
     * Safe default for a newly-created zone.
     */
    status:
      requestedStatus ??
      'COMING_SOON',

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

  const db =
    createServiceClient();

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
