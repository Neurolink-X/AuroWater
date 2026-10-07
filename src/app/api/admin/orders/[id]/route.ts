import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { checkAndUpgradeMilestone } from '@/lib/milestone';

const VALID_STATUSES = new Set([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);

const VALID_PAYMENT_STATUSES = new Set([
  'unpaid',
  'paid',
  'refunded',
]);

const ALLOWED_UPDATE_FIELDS = [
  'status',
  'supplier_id',
  'technician_id',
  'scheduled_date',
  'time_slot',
  'payment_status',
  'notes',
  'total_amount',
  'base_amount',
  'gst_amount',
] as const;

function formatAddressSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return '';

  const o = snapshot as Record<string, unknown>;

  const parts = [o.house_flat, o.area, o.city, o.pincode, o.landmark]
    .filter((x) => typeof x === 'string' && x.trim())
    .map((x) => (x as string).trim());

  return parts.join(', ');
}

function isValidNonNegativeNumber(value: unknown): boolean {
  const n = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(n) && n >= 0;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) return auth.response;

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  if (!id?.trim()) {
    return jsonErr('Order id is required', 400);
  }

  const sb = auth.ctx.supabase;

  const { data: order, error } = await sb
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 502);
  }

  if (!order) {
    return jsonErr('Order not found', 404);
  }

  const row = order as Record<string, unknown>;

  const customerId =
    row.customer_id != null ? String(row.customer_id) : '';

  const technicianId =
    row.technician_id != null ? String(row.technician_id) : '';

  let customer_name: string | null = null;
  let customer_phone: string | null = null;

  if (customerId) {
    const { data: customer } = await sb
      .from('profiles')
      .select('full_name, phone')
      .eq('id', customerId)
      .maybeSingle();

    customer_name =
      customer?.full_name != null
        ? String(customer.full_name)
        : null;

    customer_phone =
      customer?.phone != null
        ? String(customer.phone)
        : null;
  }

  let technician_name: string | null = null;
  let technician_phone: string | null = null;

  if (technicianId) {
    const { data: technician } = await sb
      .from('profiles')
      .select('full_name, phone')
      .eq('id', technicianId)
      .maybeSingle();

    technician_name =
      technician?.full_name != null
        ? String(technician.full_name)
        : null;

    technician_phone =
      technician?.phone != null
        ? String(technician.phone)
        : null;
  }

  let service_name: string | null = null;
  let service_key: string | null = null;

  if (row.service_type_id != null) {
    const { data: service } = await sb
      .from('service_types')
      .select('key, name')
      .eq('id', row.service_type_id as number)
      .maybeSingle();

    if (service?.name != null) {
      service_name = String(service.name);
    }

    if (service?.key != null) {
      service_key = String(service.key);
    }
  }

  const flatAddress =
    typeof row.address === 'string' && row.address.trim()
      ? row.address.trim()
      : '';

  const address_text =
    flatAddress || formatAddressSnapshot(row.address_snapshot);

  return jsonOk({
    ...order,
    customer_name,
    customer_phone,
    technician_name,
    technician_phone,
    service_name,
    service_key,
    address_text,
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) return auth.response;

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const { id } = await ctx.params;

  if (!id?.trim()) {
    return jsonErr('Order id is required', 400);
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const patch: Record<string, unknown> = {};

  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (body[key] !== undefined) {
      patch[key] = body[key];
    }
  }

  if (Object.keys(patch).length === 0) {
    return jsonErr('No updatable fields provided', 400);
  }

  /* Validate order status */
  if (patch.status !== undefined) {
    if (
      typeof patch.status !== 'string' ||
      !VALID_STATUSES.has(patch.status.toUpperCase())
    ) {
      return jsonErr(
        `Invalid status. Allowed: ${[...VALID_STATUSES].join(', ')}`,
        400,
      );
    }

    patch.status = patch.status.toUpperCase();
  }

  /* Validate payment status */
  if (patch.payment_status !== undefined) {
    if (
      typeof patch.payment_status !== 'string' ||
      !VALID_PAYMENT_STATUSES.has(
        patch.payment_status.toLowerCase(),
      )
    ) {
      return jsonErr(
        `Invalid payment_status. Allowed: ${[
          ...VALID_PAYMENT_STATUSES,
        ].join(', ')}`,
        400,
      );
    }

    patch.payment_status = patch.payment_status.toLowerCase();
  }

  /* Validate financial values */
  for (const key of [
    'total_amount',
    'base_amount',
    'gst_amount',
  ] as const) {
    if (patch[key] === undefined) continue;

    if (!isValidNonNegativeNumber(patch[key])) {
      return jsonErr(
        `${key} must be a valid non-negative number`,
        400,
      );
    }

    patch[key] = Number(patch[key]);
  }

  const sb = auth.ctx.supabase;

  /*
   * Fetch current order before update.
   * This allows us to detect a real transition into COMPLETED.
   */
  const { data: before, error: beforeErr } = await sb
    .from('orders')
    .select(
      'id, status, supplier_id, customer_id, can_quantity',
    )
    .eq('id', id)
    .maybeSingle();

  if (beforeErr) {
    return jsonErr(beforeErr.message, 502);
  }

  if (!before) {
    return jsonErr('Order not found', 404);
  }

  const beforeRow = before as Record<string, unknown>;

  const previousStatus = String(
    beforeRow.status ?? '',
  );

  const requestedStatus =
    typeof patch.status === 'string'
      ? patch.status
      : '';

  /*
   * Set completion timestamp only on the actual
   * transition into COMPLETED.
   */
  if (
    previousStatus !== 'COMPLETED' &&
    requestedStatus === 'COMPLETED'
  ) {
    patch.completed_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(error.message, 502);
  }

  if (!data) {
    return jsonErr('Order not found', 404);
  }

  const updatedRow = data as Record<string, unknown>;

  const nextStatus = String(
    updatedRow.status ?? '',
  );

  const supplierIdRaw = updatedRow.supplier_id;

  const supplierId =
    supplierIdRaw != null
      ? String(supplierIdRaw)
      : '';

  /*
   * COMPLETED transition side effects.
   */
  if (
    previousStatus !== 'COMPLETED' &&
    nextStatus === 'COMPLETED' &&
    supplierId
  ) {
    /*
     * Increment supplier completed-order count.
     */
    const { error: incrementError } = await sb.rpc(
      'increment_supplier_completed_orders',
      {
        p_supplier_id: supplierId,
      },
    );

    if (incrementError) {
      /*
       * Fallback for environments where the RPC
       * has not been installed.
       *
       * This is intentionally best-effort.
       */
      const { data: profile } = await sb
        .from('profiles')
        .select('completed_orders')
        .eq('id', supplierId)
        .maybeSingle();

      const currentCompletedOrders = Number(
        (
          profile as {
            completed_orders?: number;
          } | null
        )?.completed_orders ?? 0,
      );

      await sb
        .from('profiles')
        .update({
          completed_orders:
            currentCompletedOrders + 1,
        })
        .eq('id', supplierId);
    }

    /*
     * Supplier milestone upgrade.
     */
    try {
      await checkAndUpgradeMilestone(
        supplierId,
        sb,
      );
    } catch (error) {
      console.error(
        '[milestone upgrade]',
        error instanceof Error
          ? error.message
          : String(error),
      );
    }

    /*
     * Stock is consumed atomically by the database reservation trigger.
     * Keep this API side-effect free so completion cannot double-decrement inventory.
     */
  }

  /*
   * Customer completion notification.
   *
   * Runs only once when status actually changes
   * into COMPLETED.
   */
  if (
    previousStatus !== 'COMPLETED' &&
    nextStatus === 'COMPLETED'
  ) {
    try {
      const customerId = String(
        beforeRow.customer_id ?? '',
      );

      if (customerId) {
        const {
          createNotification,
        } = await import('@/lib/notifications');

        await createNotification(
          customerId,
          'Order delivered!',
          'Your order has been delivered. Thank you for choosing AuroWater.',
          'booking',
          String(id),
          'completed',
        );
      }
    } catch (error) {
      console.error(
        '[admin/orders] customer notification failed',
        error,
      );
    }
  }

  return jsonOk(data);
}
