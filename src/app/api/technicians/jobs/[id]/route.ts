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

/**
 * PUT /api/technician/orders/[id]
 *
 * Advances a technician job without allowing browser-supplied ownership.
 * Completion requires payment confirmation when the order is still unpaid.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) return auth.response;
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

  const { id } = await ctx.params;
  const orderId = id?.trim();

  if (!orderId) {
    return jsonErr('Order ID is required', 400);
  }

  let body: {
    status?: 'IN_PROGRESS' | 'COMPLETED';
    payment_confirmed?: boolean;
    payment_reference?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  if (body.status !== 'IN_PROGRESS' && body.status !== 'COMPLETED') {
    return jsonErr('Invalid status transition', 400);
  }

  const sb = auth.ctx.supabase;

  const { data: before, error: beforeError } = await sb
    .from('orders')
    .select('id, technician_id, status, customer_id, payment_status, payment_method, total_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (beforeError) return jsonErr(beforeError.message, 502);
  if (!before) return jsonErr('Job not found', 404);

  if (String(before.technician_id ?? '') !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }

  const previousStatus = String(before.status ?? '');
  const nextStatus = body.status;

  const allowed =
    (previousStatus === 'ASSIGNED' && nextStatus === 'IN_PROGRESS') ||
    (previousStatus === 'IN_PROGRESS' && nextStatus === 'COMPLETED');

  if (!allowed) {
    return jsonErr('Invalid status transition', 400);
  }

  const patch: Record<string, unknown> = {
    status: nextStatus,
  };

  if (nextStatus === 'IN_PROGRESS') {
    patch.dispatched_at = new Date().toISOString();
  }

  if (nextStatus === 'COMPLETED') {
    const paymentStatus = String(before.payment_status ?? 'unpaid').toLowerCase();
    const paymentMethod = String(before.payment_method ?? 'cash').toLowerCase();
    const reference = typeof body.payment_reference === 'string'
      ? body.payment_reference.trim()
      : '';

    if (paymentStatus !== 'paid' && body.payment_confirmed !== true) {
      return jsonErr('Confirm payment received before completing this service.', 400);
    }

    if (paymentStatus !== 'paid' && paymentMethod === 'upi' && !reference) {
      return jsonErr('Enter the UPI transaction reference before completing this service.', 400);
    }

    if (paymentStatus !== 'paid') {
      patch.payment_status = 'paid';
    }

    patch.completed_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from('orders')
    .update(patch)
    .eq('id', orderId)
    .eq('technician_id', auth.ctx.profile.id)
    .eq('status', previousStatus)
    .select('*')
    .single();

  if (error) return jsonErr(error.message, 502);

  if (nextStatus === 'COMPLETED' && String(before.payment_status ?? 'unpaid').toLowerCase() !== 'paid') {
    try {
      await sb.from('audit_logs').insert({
        actor_id: auth.ctx.profile.id,
        action: 'order.payment_received',
        entity: 'orders',
        entity_id: orderId,
        meta: {
          method: String(before.payment_method ?? 'cash').toLowerCase(),
          reference:
            typeof body.payment_reference === 'string'
              ? body.payment_reference.trim() || null
              : null,
          amount: Number(before.total_amount ?? 0),
        },
      });
    } catch (e) {
      console.error('[technician-order] payment audit failed', e);
    }
  }

  return jsonOk(data);
}
