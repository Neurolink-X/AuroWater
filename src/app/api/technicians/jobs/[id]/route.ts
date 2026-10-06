import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

export const runtime = 'nodejs';

type TechnicianProfile = {
  id: string;
  role?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  verification_status?: string | null;
  availability_status?: string | null;
};

function isTechnicianOperational(
  profile: TechnicianProfile,
): boolean {
  if (profile.role !== 'technician') {
    return false;
  }

  if (profile.is_active !== true) {
    return false;
  }

  if (profile.status !== 'active') {
    return false;
  }

  /*
   * New approval model.
   *
   * If verification_status exists, the technician must
   * have been approved by admin.
   */
  if (
    profile.verification_status !== undefined &&
    profile.verification_status !== null &&
    profile.verification_status !== 'approved'
  ) {
    return false;
  }

  return true;
}

/**
 * GET /api/technician/orders/[id]
 *
 * Returns a single order assigned to the authenticated technician.
 *
 * Security boundary:
 *
 *   authenticated user
 *        ↓
 *   technician role
 *        ↓
 *   active + approved
 *        ↓
 *   orders.technician_id = authenticated profile.id
 */
export async function GET(
  req: NextRequest,
  ctx: {
    params: Promise<{ id: string }>;
  },
) {
  // ------------------------------------------------------------
  // 1. Authenticate
  // ------------------------------------------------------------
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  // ------------------------------------------------------------
  // 2. Role authorization
  // ------------------------------------------------------------
  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  // ------------------------------------------------------------
  // 3. Operational authorization
  // ------------------------------------------------------------
  const profile =
    auth.ctx.profile as unknown as TechnicianProfile;

  if (!isTechnicianOperational(profile)) {
    return jsonErr(
      'Your technician account is not approved or active',
      403,
    );
  }

  // ------------------------------------------------------------
  // 4. Resolve route parameter
  // ------------------------------------------------------------
  const { id } = await ctx.params;

  const orderId = id?.trim();

  if (!orderId) {
    return jsonErr(
      'Order ID is required',
      400,
    );
  }

  // ------------------------------------------------------------
  // 5. Fetch ONLY this technician's order
  //
  // Never trust technician_id from the browser.
  // The authenticated profile ID is the ownership boundary.
  // ------------------------------------------------------------
  const {
    data,
    error,
  } = await auth.ctx.supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq(
      'technician_id',
      auth.ctx.profile.id,
    )
    .maybeSingle();

  // ------------------------------------------------------------
  // 6. Database error
  // ------------------------------------------------------------
  if (error) {
    console.error(
      '[technician-order] failed to load job:',
      error,
    );

    return jsonErr(
      'Unable to load this job right now',
      500,
    );
  }

  // ------------------------------------------------------------
  // 7. Not found / not assigned to this technician
  //
  // Deliberately return the same response for both cases.
  // This prevents a technician from probing other order IDs.
  // ------------------------------------------------------------
  if (!data) {
    return jsonErr(
      'Job not found',
      404,
    );
  }

  return jsonOk(data);
}
