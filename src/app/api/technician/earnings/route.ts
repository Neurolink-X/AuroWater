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
  role?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  verification_status?: string | null;
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

  if (
    profile.verification_status !== undefined &&
    profile.verification_status !== null &&
    profile.verification_status !== 'approved'
  ) {
    return false;
  }

  return true;
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const profile =
    auth.ctx.profile as unknown as TechnicianProfile;

  if (!isTechnicianOperational(profile)) {
    return jsonErr(
      'Your technician account is not approved or active',
      403,
    );
  }

  /*
   * Financial data is always scoped to the authenticated
   * technician. No technician_id is accepted from the client.
   *
   * Do not expose internal payout/settlement fields here.
   */
  const { data: rows, error } = await auth.ctx.supabase
    .from('orders')
    .select(
      'total_amount, status, payment_status',
    )
    .eq(
      'technician_id',
      auth.ctx.profile.id,
    )
    .eq('status', 'COMPLETED');

  if (error) {
    console.error(
      '[technician-earnings] query failed:',
      error,
    );

    return jsonErr(
      'Unable to load earnings right now',
      500,
    );
  }

  let grossTotal = 0;

  for (const order of rows ?? []) {
    const amount = Number(
      order.total_amount ?? 0,
    );

    if (
      Number.isFinite(amount) &&
      amount >= 0
    ) {
      grossTotal += amount;
    }
  }

  return jsonOk({
    completed_jobs: rows?.length ?? 0,
    gross_total: Number(
      grossTotal.toFixed(2),
    ),

    /*
     * Gross order value is NOT technician payout.
     *
     * Final settlement should come from the finance/
     * payout system, not be calculated by the frontend.
     */
    note:
      'Gross order value only. Final technician settlement is calculated by admin finance.',
  });
}
