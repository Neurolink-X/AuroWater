import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

export const runtime = 'nodejs';

const listStatusSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .optional();

const acceptJobSchema = z.object({
  order_id: z
    .string()
    .trim()
    .min(1, 'order_id is required')
    .max(100, 'Invalid order ID'),
});

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ACCEPTABLE_TECHNICIAN_STATUSES = [
  'PENDING',
] as const;

/**
 * Only approved, active technicians should be able
 * to receive/accept operational jobs.
 *
 * This is intentionally checked server-side.
 */
function isTechnicianOperational(
  profile: Record<string, unknown>,
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
   * If verification_status exists, it must be approved.
   *
   * The undefined/null compatibility branch prevents an immediate
   * breaking change if an older profile row does not yet contain
   * the new field.
   */
  if (
    profile.verification_status !== undefined &&
    profile.verification_status !== null &&
    profile.verification_status !== 'approved'
  ) {
    return false;
  }

  /*
   * If availability_status exists, technician must be available.
   */
  if (
    profile.availability_status !== undefined &&
    profile.availability_status !== null &&
    profile.availability_status !== 'available'
  ) {
    return false;
  }

  return true;
}

/**
 * GET
 *
 * Lists only orders currently assigned to the authenticated
 * technician.
 *
 * The browser cannot provide technician_id.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const profile =
    auth.ctx.profile as unknown as Record<
      string,
      unknown
    >;

  if (!isTechnicianOperational(profile)) {
    return jsonErr(
      'Your technician account is not approved or active',
      403,
    );
  }

  const { searchParams } = new URL(req.url);

  // ------------------------------------------------------------
  // Optional status filter
  // ------------------------------------------------------------
  const rawStatus =
    searchParams.get('status')?.trim() || undefined;

  const parsedStatus =
    listStatusSchema.safeParse(rawStatus);

  if (!parsedStatus.success) {
    return jsonErr('Invalid status', 400);
  }

  const status = parsedStatus.data;

  // ------------------------------------------------------------
  // Pagination
  // ------------------------------------------------------------
  const rawPage = Number(
    searchParams.get('page') ?? '1',
  );

  const rawLimit = Number(
    searchParams.get('limit') ??
      String(DEFAULT_LIMIT),
  );

  const page =
    Number.isFinite(rawPage) && rawPage > 0
      ? Math.floor(rawPage)
      : 1;

  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(
          MAX_LIMIT,
          Math.floor(rawLimit),
        )
      : DEFAULT_LIMIT;

  const offset = (page - 1) * limit;

  // ------------------------------------------------------------
  // Query only this technician's orders.
  // ------------------------------------------------------------
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
    query = query.eq('status', status);
  }

  const {
    data,
    error,
    count,
  } = await query;

  if (error) {
    console.error(
      '[technician-orders] list failed:',
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
        : Math.ceil(total / limit),
  });
}

/**
 * POST
 *
 * Accept a pending technician job.
 *
 * This operation must be atomic:
 *
 *   PENDING → ASSIGNED
 *
 * Only the first eligible technician should be able
 * to successfully claim the order.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireRole(auth.ctx, 'technician')) {
    return jsonErr('Forbidden', 403);
  }

  const profile =
    auth.ctx.profile as unknown as Record<
      string,
      unknown
    >;

  // ------------------------------------------------------------
  // 1. Technician operational authorization
  // ------------------------------------------------------------
  if (!isTechnicianOperational(profile)) {
    return jsonErr(
      'Your technician account must be approved, active and available to accept jobs',
      403,
    );
  }

  // ------------------------------------------------------------
  // 2. Parse request body
  // ------------------------------------------------------------
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const parsed =
    acceptJobSchema.safeParse(body);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ??
        'Invalid request',
      422,
    );
  }

  const { order_id: orderId } =
    parsed.data;

  const now = new Date().toISOString();

  // ------------------------------------------------------------
  // 3. Atomically claim the order.
  //
  // The important condition is:
  //
  //     id = orderId
  //     status = PENDING
  //
  // Therefore two technicians cannot both successfully
  // transition the same PENDING order through this operation.
  // ------------------------------------------------------------
  const {
    data,
    error,
  } = await auth.ctx.supabase
    .from('orders')
    .update({
      technician_id:
        auth.ctx.profile.id,

      status: 'ASSIGNED',

      assigned_at: now,

      updated_at: now,
    })
    .eq('id', orderId)
    .eq('status', 'PENDING')
    .is('technician_id', null)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error(
      '[technician-orders] accept failed:',
      error,
    );

    return jsonErr(
      'Unable to accept this job right now',
      500,
    );
  }

  // ------------------------------------------------------------
  // 4. Nothing updated = job was already claimed,
  // cancelled, completed, or does not exist.
  // ------------------------------------------------------------
  if (!data) {
    return jsonErr(
      'This job is no longer available',
      409,
    );
  }

  return jsonOk(data);
}
