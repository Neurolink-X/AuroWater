import { jsonOk, jsonErr } from '@/lib/api/json-response';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';

export const runtime = 'nodejs';

type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

type TechnicianRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_active: boolean | null;
  status: string | null;
  city: string | null;
  vehicle_type: string | null;

  // Supported only if these columns exist in your profiles table.
  verification_status?: string | null;
  availability_status?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
};

const OPERATIONAL_ROLES = ['technician'] as const;

function guessService(
  vehicle: string | null,
  city: string | null,
): ServiceKey {
  const value = (vehicle ?? '').trim().toLowerCase();

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

  // Existing fallback behaviour.
  if (city) {
    return 'plumbing';
  }

  return 'plumbing';
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function normalizeName(
  value: string | null,
): string {
  const name = value?.trim();

  if (!name) {
    return 'Technician';
  }

  return name;
}

function isApprovedTechnician(
  row: TechnicianRow,
): boolean {
  /*
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
   * If verification_status does not exist in the
   * returned object, status=active is accepted.
   */
  if (!row.is_active) {
    return false;
  }

  if (row.status !== 'active') {
    return false;
  }

  if (
    row.verification_status !== undefined &&
    row.verification_status !== null &&
    row.verification_status !== 'approved'
  ) {
    return false;
  }

  return true;
}

function isTechnicianAvailable(
  row: TechnicianRow,
): boolean {
  if (!isApprovedTechnician(row)) {
    return false;
  }

  /*
   * If your database has availability_status,
   * use it. Otherwise preserve the current
   * active-technician behaviour.
   */
  if (
    row.availability_status !== undefined &&
    row.availability_status !== null
  ) {
    return row.availability_status === 'available';
  }

  return true;
}

export async function GET() {
  // ------------------------------------------------------------
  // 1. Supabase configuration
  // ------------------------------------------------------------
  if (!isSupabaseConfigured()) {
    console.error(
      '[technicians] Supabase is not configured',
    );

    return jsonErr(
      'Technician service is temporarily unavailable',
      503,
    );
  }

  try {
    const supabase = createSupabaseAnonClient();

    // ----------------------------------------------------------
    // 2. Public technician discovery
    //
    // IMPORTANT:
    // Do NOT expose sensitive technician information.
    //
    // Removed:
    //   license_number
    //
    // Never expose:
    //   phone
    //   email
    //   internal verification documents
    //   government IDs
    //   private addresses
    // ----------------------------------------------------------
    const { data, error } = await supabase
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
      .eq('role', OPERATIONAL_ROLES[0])
      .eq('is_active', true)
      .eq('status', 'active');

    if (error) {
      console.error(
        '[technicians] database query failed:',
        error,
      );

      /*
       * Do not silently hide a real database failure.
       * Returning 503 lets the frontend distinguish:
       *
       *   []  → no technicians
       *   503 → technician service unavailable
       */
      return jsonErr(
        'Unable to load technicians right now',
        503,
      );
    }

    // ----------------------------------------------------------
    // 3. Build safe public technician objects
    // ----------------------------------------------------------
    const technicians = (
      (data ?? []) as TechnicianRow[]
    )
      .filter(isApprovedTechnician)
      .map((row) => {
        const name = normalizeName(row.full_name);

        const preferredServiceKey = guessService(
          row.vehicle_type,
          row.city,
        );

        const available = isTechnicianAvailable(row);

        return {
          id: row.id,

          name,

          initials: getInitials(name),

          avatar_url: row.avatar_url ?? null,

          city:
            row.city?.trim() ||
            'Uttar Pradesh',

          skills: [
            row.vehicle_type?.trim() ||
              'Plumbing',
          ],

          /*
           * Use real database values when available.
           * Do not manufacture ratings in production.
           */
          rating:
            typeof row.rating === 'number'
              ? row.rating
              : null,

          jobs:
            typeof row.completed_jobs === 'number'
              ? row.completed_jobs
              : 0,

          verified: true,

          available,

          preferredServiceKey,

          speciality:
            row.vehicle_type?.trim() ||
            'AuroWater technician',

          experience: 'On platform',
        };
      });

    return jsonOk(technicians);
  } catch (error) {
    console.error(
      '[technicians] unexpected error:',
      error,
    );

    return jsonErr(
      'Unable to load technicians right now',
      503,
    );
  }
}
