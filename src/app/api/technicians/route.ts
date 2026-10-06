src/components/layout/Header.tsximport { jsonOk, jsonErr } from '@/lib/api/json-response';
import {
  createSupabaseAnonClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

export const runtime = 'nodejs';

/**
 * Technician discovery is backed by live Supabase data.
 * Do not allow Next.js to statically optimize this endpoint.
 */
export const dynamic = 'force-dynamic';

/**
 * Supported service categories returned by the public
 * technician-discovery endpoint.
 *
 * These keys are application-level service identifiers;
 * they are not database role values.
 */
type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

/**
 * Shape used by the public technician discovery layer.
 *
 * IMPORTANT:
 * This is intentionally separate from the database schema.
 * The public API must never expose the complete profiles row.
 */
type TechnicianRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_active: boolean | null;
  status: string | null;
  city: string | null;
  vehicle_type: string | null;

  /*
   * Optional fields.
   *
   * These are supported by the response mapper when the
   * corresponding columns are available in the database.
   */
  verification_status?: string | null;
  availability_status?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
};

/**
 * Public discovery must only return operational technicians.
 *
 * Keep this as a readonly tuple so it cannot accidentally
 * be mutated elsewhere in the module.
 */
const OPERATIONAL_ROLES =
  ['technician'] as const;

/**
 * Convert technician vehicle/speciality information into
 * the application's service key.
 *
 * This preserves the existing fallback behaviour:
 * unknown technician specialities are treated as plumbing.
 */
function guessService(
  vehicle: string | null,
  city: string | null,
): ServiceKey {
  const value =
    (vehicle ?? '')
      .trim()
      .toLowerCase();

  if (value.includes('ro')) {
    return 'ro_service';
  }

  if (value.includes('bore')) {
    return 'borewell';
  }

  if (
    value.includes('motor') ||
    value.includes('pump')
  ) {
    return 'motor_pump';
  }

  if (value.includes('tanker')) {
    return 'water_tanker';
  }

  if (value.includes('tank')) {
    return 'tank_cleaning';
  }

  /*
   * Existing fallback behaviour.
   *
   * Keep the city argument for compatibility with the current
   * service-classification contract. At present, both paths
   * intentionally resolve to plumbing.
   */
  if (city) {
    return 'plumbing';
  }

  return 'plumbing';
}

/**
 * Generate compact initials for the technician card/avatar
 * fallback.
 */
function getInitials(
  name: string,
): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part
        .charAt(0)
        .toUpperCase(),
    )
    .join('');
}

/**
 * Normalize a technician's display name.
 */
function normalizeName(
  value: string | null,
): string {
  const name =
    value
      ?.replace(/\s+/g, ' ')
      .trim();

  if (!name) {
    return 'Technician';
  }

  return name;
}

/**
 * Normalize a city for public display.
 */
function normalizeCity(
  value: string | null,
): string {
  const city =
    value
      ?.replace(/\s+/g, ' ')
      .trim();

  return city || 'Uttar Pradesh';
}

/**
 * Keep ratings within a sensible public-display range.
 *
 * Database values are treated as untrusted application data.
 * Invalid values are returned as null instead of being
 * fabricated.
 */
function normalizeRating(
  value: unknown,
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  if (
    value < 0 ||
    value > 5
  ) {
    return null;
  }

  return value;
}

/**
 * Normalize completed-job counts.
 *
 * Negative or non-integer values are considered invalid.
 */
function normalizeCompletedJobs(
  value: unknown,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return 0;
  }

  return value;
}

/**
 * Determine whether a technician is approved for
 * public discovery.
 *
 * New approval model:
 *
 * account:
 *   is_active = true
 *   status = active
 *
 * verification:
 *   approved
 *
 * Backward compatibility:
 * If verification_status is not present in the returned
 * object, status=active is accepted.
 *
 * SECURITY NOTE:
 * This is an additional application-level filter.
 * The Supabase query already restricts the role, active
 * state and status.
 */
function isApprovedTechnician(
  row: TechnicianRow,
): boolean {
  if (!row.is_active) {
    return false;
  }

  if (
    row.status !== 'active'
  ) {
    return false;
  }

  if (
    row.verification_status !==
      undefined &&
    row.verification_status !==
      null &&
    row.verification_status !==
      'approved'
  ) {
    return false;
  }

  return true;
}

/**
 * Determine whether a technician is currently available.
 *
 * If availability_status exists, it becomes authoritative.
 *
 * If the field is absent, preserve the existing behaviour:
 * an approved active technician is considered available.
 */
function isTechnicianAvailable(
  row: TechnicianRow,
): boolean {
  if (!isApprovedTechnician(row)) {
    return false;
  }

  if (
    row.availability_status !==
      undefined &&
    row.availability_status !==
      null
  ) {
    return (
      row.availability_status ===
      'available'
    );
  }

  return true;
}

/**
 * Build the exact public response object.
 *
 * This is an explicit allowlist. A future column added to
 * profiles will not automatically become public API data.
 */
function toPublicTechnician(
  row: TechnicianRow,
) {
  const name =
    normalizeName(
      row.full_name,
    );

  const available =
    isTechnicianAvailable(row);

  const preferredServiceKey =
    guessService(
      row.vehicle_type,
      row.city,
    );

  const vehicle =
    row.vehicle_type
      ?.replace(/\s+/g, ' ')
      .trim() || null;

  return {
    id: row.id,

    name,

    initials:
      getInitials(name),

    avatar_url:
      row.avatar_url ?? null,

    city:
      normalizeCity(row.city),

    skills: [
      vehicle ||
        'Plumbing',
    ],

    /*
     * Never manufacture a rating.
     * If a real numeric rating is unavailable or invalid,
     * return null so the UI can display an honest state.
     */
    rating:
      normalizeRating(
        row.rating,
      ),

    jobs:
      normalizeCompletedJobs(
        row.completed_jobs,
      ),

    /*
     * This object has already passed the approval filter.
     */
    verified: true,

    available,

    preferredServiceKey,

    speciality:
      vehicle ||
      'AuroWater technician',

    /*
     * Do not invent a numeric experience value.
     * This existing label is intentionally retained.
     */
    experience:
      'On platform',
  };
}

export async function GET() {
  // ------------------------------------------------------------
  // 1. Supabase configuration
  // ------------------------------------------------------------

  if (
    !isSupabaseConfigured()
  ) {
    console.error(
      '[technicians] Supabase is not configured',
    );

    return jsonErr(
      'Technician service is temporarily unavailable',
      503,
    );
  }

  try {
    const supabase =
      createSupabaseAnonClient();

    // ----------------------------------------------------------
    // 2. Public technician discovery
    //
    // IMPORTANT:
    // Do NOT expose sensitive technician information.
    //
    // Never expose:
    //   phone
    //   email
    //   license_number
    //   internal verification documents
    //   government IDs
    //   private addresses
    //   payout information
    //   private metadata
    //
    // Only fields required to construct the public technician
    // card are requested.
    // ----------------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from('profiles')
      .select(
        [
          'id',
          'full_name',
          'avatar_url',
          'role',
          'is_active',
          'status',
          'city',
          'vehicle_type',
          'verification_status',
          'availability_status',
          'rating',
          'completed_jobs',
        ].join(', '),
      )
      .eq(
        'role',
        OPERATIONAL_ROLES[0],
      )
      .eq(
        'is_active',
        true,
      )
      .eq(
        'status',
        'active',
      );

    if (error) {
      console.error(
        '[technicians] database query failed:',
        error,
      );

      /*
       * Do not silently turn a database failure into [].
       *
       * []  -> successful request, no technicians
       * 503 -> technician service unavailable
       *
       * This distinction is important for frontend retry and
       * operational monitoring.
       */
      return jsonErr(
        'Unable to load technicians right now',
        503,
      );
    }

    // ----------------------------------------------------------
    // 3. Build safe public technician objects
    // ----------------------------------------------------------

    /*
     * The project currently reports a Supabase generated
     * GenericStringError[] type for this selected row shape.
     *
     * The query has already restricted the selected columns,
     * and the mapper below performs defensive runtime
     * normalization before anything is returned.
     *
     * Therefore the cast intentionally crosses through unknown
     * rather than using an unsafe direct structural assertion.
     */
    const rows =
      (data ?? []) as unknown as TechnicianRow[];

    const technicians =
      rows
        .filter(
          isApprovedTechnician,
        )
        .map(
          toPublicTechnician,
        );

    // ----------------------------------------------------------
    // 4. Successful response
    // ----------------------------------------------------------

    return jsonOk(
      technicians,
    );
  } catch (error) {
    // ----------------------------------------------------------
    // 5. Unexpected server failure
    // ----------------------------------------------------------

    console.error(
      '[technicians] unexpected error:',
      error,
    );

    /*
     * Never expose raw exception/database information to the
     * public API.
     */
    return jsonErr(
      'Unable to load technicians right now',
      503,
    );
  }
}
