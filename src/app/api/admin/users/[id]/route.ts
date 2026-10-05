import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireAdmin,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

const VALID_ROLES = new Set([
  'customer',
  'supplier',
  'technician',
  'admin',
]);

const VALID_STATUSES = new Set([
  'active',
  'suspended',
  'pending',
  'pending_approval',
  'rejected',
]);

const MAX_NAME_LENGTH = 120;
const MAX_REJECTION_REASON_LENGTH = 1000;

function isValidUuid(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PUT(
  req: NextRequest,
  ctx: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  const { id } =
    await ctx.params;

  const userId =
    id?.trim();

  if (
    !userId ||
    !isValidUuid(userId)
  ) {
    return jsonErr(
      'Invalid user id',
      400,
    );
  }

  /*
   * Prevent an admin from locking themselves
   * out of the admin system.
   */
  const currentAdminId =
    String(
      auth.ctx.profile.id,
    );

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return jsonErr(
      'Request body must be an object',
      400,
    );
  }

  const input =
    body as Record<
      string,
      unknown
    >;

  /*
   * Reject fields that this endpoint
   * does not explicitly support.
   */
  const allowedFields =
    new Set([
      'role',
      'is_active',
      'full_name',
      'status',
      'rejection_reason',
    ]);

  const unknownFields =
    Object.keys(input).filter(
      (key) =>
        !allowedFields.has(
          key,
        ),
    );

  if (unknownFields.length) {
    return jsonErr(
      `Unsupported field(s): ${unknownFields.join(', ')}`,
      400,
    );
  }

  const sb =
    auth.ctx.supabase;

  /*
   * Load existing user first so that
   * role/status transitions can be checked.
   */
  const {
    data: existingUser,
    error: existingUserError,
  } = await sb
    .from('profiles')
    .select(
      'id, role, status, is_active, full_name',
    )
    .eq('id', userId)
    .maybeSingle();

  if (existingUserError) {
    return jsonErr(
      existingUserError.message,
      502,
    );
  }

  if (!existingUser) {
    return jsonErr(
      'User not found',
      404,
    );
  }

  const patch: Record<
    string,
    unknown
  > = {};

  /*
   * ROLE
   */
  if (
    input.role !== undefined
  ) {
    if (
      typeof input.role !==
      'string'
    ) {
      return jsonErr(
        'role must be a string',
        400,
      );
    }

    const role =
      input.role
        .trim()
        .toLowerCase();

    if (
      !VALID_ROLES.has(role)
    ) {
      return jsonErr(
        `Invalid role "${role}"`,
        400,
      );
    }

    if (
      userId === currentAdminId &&
      role !== 'admin'
    ) {
      return jsonErr(
        'You cannot remove your own admin role',
        409,
      );
    }

    patch.role = role;
  }

  /*
   * FULL NAME
   */
  if (
    input.full_name !==
    undefined
  ) {
    if (
      typeof input.full_name !==
      'string'
    ) {
      return jsonErr(
        'full_name must be a string',
        400,
      );
    }

    const fullName =
      input.full_name.trim();

    if (
      fullName.length >
      MAX_NAME_LENGTH
    ) {
      return jsonErr(
        `full_name must be ${MAX_NAME_LENGTH} characters or fewer`,
        400,
      );
    }

    patch.full_name =
      fullName || null;
  }

  /*
   * STATUS
   */
  let requestedStatus:
    | string
    | undefined;

  if (
    input.status !== undefined
  ) {
    if (
      typeof input.status !==
      'string'
    ) {
      return jsonErr(
        'status must be a string',
        400,
      );
    }

    requestedStatus =
      input.status
        .trim()
        .toLowerCase();

    if (
      !VALID_STATUSES.has(
        requestedStatus,
      )
    ) {
      return jsonErr(
        `Invalid status "${requestedStatus}"`,
        400,
      );
    }

    if (
      userId === currentAdminId &&
      requestedStatus !== 'active'
    ) {
      return jsonErr(
        'You cannot suspend, reject, or deactivate your own admin account',
        409,
      );
    }

    patch.status =
      requestedStatus;

    if (
      requestedStatus ===
      'active'
    ) {
      patch.is_active = true;
      patch.approved_at =
        new Date().toISOString();
      patch.approved_by =
        currentAdminId;
    }

    if (
      requestedStatus ===
      'suspended'
    ) {
      patch.is_active =
        false;
    }

    if (
      requestedStatus ===
      'rejected'
    ) {
      patch.is_active =
        false;
    }

    if (
      requestedStatus ===
        'pending' ||
      requestedStatus ===
        'pending_approval'
    ) {
      patch.is_active =
        false;
    }
  }

  /*
   * EXPLICIT is_active update.
   */
  if (
    input.is_active !==
    undefined
  ) {
    if (
      typeof input.is_active !==
      'boolean'
    ) {
      return jsonErr(
        'is_active must be a boolean',
        400,
      );
    }

    if (
      userId === currentAdminId &&
      input.is_active === false
    ) {
      return jsonErr(
        'You cannot deactivate your own admin account',
        409,
      );
    }

    /*
     * If status was explicitly supplied,
     * its state is authoritative.
     */
    if (
      requestedStatus ===
        undefined ||
      requestedStatus ===
        'active'
    ) {
      patch.is_active =
        input.is_active;
    }
  }

  /*
   * REJECTION REASON
   */
  if (
    input.rejection_reason !==
    undefined
  ) {
    if (
      typeof input.rejection_reason !==
      'string'
    ) {
      return jsonErr(
        'rejection_reason must be a string',
        400,
      );
    }

    const reason =
      input.rejection_reason.trim();

    if (
      reason.length >
      MAX_REJECTION_REASON_LENGTH
    ) {
      return jsonErr(
        `rejection_reason must be ${MAX_REJECTION_REASON_LENGTH} characters or fewer`,
        400,
      );
    }

    /*
     * A rejection reason only makes
     * semantic sense for rejected users.
     */
    if (
      requestedStatus !==
        undefined &&
      requestedStatus !==
        'rejected'
    ) {
      return jsonErr(
        'rejection_reason can only be supplied when status is rejected',
        400,
      );
    }

    patch.rejection_reason =
      reason || null;
  }

  /*
   * If status is already rejected and the
   * caller wants to update the reason without
   * changing status, allow it.
   */
  if (
    input.rejection_reason !==
      undefined &&
    requestedStatus ===
      undefined &&
    String(
      existingUser.status ??
        '',
    ).toLowerCase() !==
      'rejected'
  ) {
    return jsonErr(
      'rejection_reason can only be updated for a rejected user',
      400,
    );
  }

  if (
    Object.keys(patch).length ===
    0
  ) {
    return jsonErr(
      'No valid fields to update',
      400,
    );
  }

  /*
   * Update only explicitly approved fields.
   */
  const {
    data,
    error,
  } = await sb
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    return jsonErr(
      error.message,
      502,
    );
  }

  if (!data) {
    return jsonErr(
      'User not found',
      404,
    );
  }

  /*
   * Best-effort audit record.
   * Do not fail the user update if audit
   * infrastructure has a temporary issue.
   */
  try {
    await sb
      .from('audit_logs')
      .insert({
        actor_id:
          currentAdminId,
        action:
          'UPDATE_USER',
        entity:
          'profile',
        entity_id:
          userId,
        meta: {
          changes:
            patch,
        },
      });
  } catch (error: unknown) {
    console.error(
      '[admin/users] audit log failed:',
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  return jsonOk(data);
}
