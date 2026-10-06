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

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

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

  const { searchParams } = new URL(req.url);

  const status =
    searchParams.get('status')?.trim() || undefined;

  const rawPage = Number(
    searchParams.get('page') ?? '1',
  );

  const rawLimit = Number(
    searchParams.get('limit') ??
      String(DEFAULT_LIMIT),
  );

  const page =
    Number.isFinite(rawPage) &&
    rawPage >= 1
      ? Math.floor(rawPage)
      : 1;

  const limit =
    Number.isFinite(rawLimit) &&
    rawLimit >= 1
      ? Math.min(
          MAX_LIMIT,
          Math.floor(rawLimit),
        )
      : DEFAULT_LIMIT;

  const offset = (page - 1) * limit;

  /*
   * Only retrieve orders belonging to the authenticated
   * technician.
   *
   * Never accept technician_id from query parameters.
   */
  let query = auth.ctx.supabase
    .from('orders')
    .select('*', {
      count: 'exact',
    })
    .eq(
      'technician_id',
      auth.ctx.profile.id,
    )
    .order('created_at', {
      ascending: false,
    })
    .range(
      offset,
      offset + limit - 1,
    );

  if (status) {
    query = query.eq(
      'status',
      status,
    );
  }

  const {
    data,
    error,
    count,
  } = await query;

  if (error) {
    console.error(
      '[technician-orders] history query failed:',
      error,
    );

    return jsonErr(
      'Unable to load your orders right now',
      500,
    );
  }

  const total = count ?? 0;

  return jsonOk({
    data: data ?? [],
    total,
    page,
    limit,
    totalPages:
      total === 0
        ? 0
        : Math.ceil(
            total / limit,
          ),
  });
}
