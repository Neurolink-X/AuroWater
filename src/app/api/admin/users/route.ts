import { NextRequest, NextResponse } from 'next/server';

import { jsonErr } from '@/lib/api/json-response';
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

const VALID_SORT_FIELDS = new Set([
  'created_at',
  'full_name',
  'role',
  'updated_at',
]);

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const MAX_OFFSET = 100_000;
const MAX_SEARCH_LENGTH = 100;

interface UserRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  status: string | null;
  is_active: boolean | null;
  city: string | null;
  created_at: string;
  updated_at: string | null;
  order_count: number | null;
  total_spent: number | null;
}

function parseNonNegativeInt(
  raw: string | null,
  fallback: number,
): number {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }

  if (!/^\d+$/.test(raw.trim())) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < 0) {
    return fallback;
  }

  return value;
}

function parseISODate(
  raw: string | null,
): string | null {
  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/*
 * Escape characters that have special meaning
 * inside PostgREST filter expressions.
 */
function escapePostgrestSearch(
  value: string,
): string {
  return value
    .replace(/[%]/g, '\\%')
    .replace(/[,]/g, '\\,')
    .replace(/[()]/g, '\\$&');
}

export async function GET(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const params =
    new URL(req.url).searchParams;

  const rawSearch =
    params.get('search')?.trim() ?? '';

  if (rawSearch.length > MAX_SEARCH_LENGTH) {
    return jsonErr(
      `Search must be ${MAX_SEARCH_LENGTH} characters or fewer`,
      400,
    );
  }

  const search =
    rawSearch || null;

  const role =
    params.get('role')?.trim().toLowerCase() ||
    null;

  const status =
    params.get('status')?.trim().toLowerCase() ||
    null;

  const sortBy =
    params.get('sort_by')?.trim() ||
    'created_at';

  const sort =
    params.get('sort')?.trim().toLowerCase();

  const ascending =
    sort === 'asc';

  const limit = Math.min(
    parseNonNegativeInt(
      params.get('limit'),
      DEFAULT_LIMIT,
    ) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const offset =
    parseNonNegativeInt(
      params.get('offset'),
      0,
    );

  const cursor =
    params.get('cursor')?.trim() || null;

  const from =
    parseISODate(params.get('from'));

  const to =
    parseISODate(params.get('to'));

  /*
   * Explicit validation.
   */
  if (
    role &&
    !VALID_ROLES.has(role)
  ) {
    return jsonErr(
      `Invalid role "${role}"`,
      400,
    );
  }

  if (
    status &&
    !VALID_STATUSES.has(status)
  ) {
    return jsonErr(
      `Invalid status "${status}"`,
      400,
    );
  }

  if (
    !VALID_SORT_FIELDS.has(sortBy)
  ) {
    return jsonErr(
      `Invalid sort_by "${sortBy}"`,
      400,
    );
  }

  if (
    params.has('sort') &&
    sort !== 'asc' &&
    sort !== 'desc'
  ) {
    return jsonErr(
      'sort must be "asc" or "desc"',
      400,
    );
  }

  if (
    params.has('from') &&
    !from
  ) {
    return jsonErr(
      'Invalid "from" date',
      400,
    );
  }

  if (
    params.has('to') &&
    !to
  ) {
    return jsonErr(
      'Invalid "to" date',
      400,
    );
  }

  if (
    from &&
    to &&
    from > to
  ) {
    return jsonErr(
      '"from" must be before or equal to "to"',
      400,
    );
  }

  if (
    !cursor &&
    offset > MAX_OFFSET
  ) {
    return jsonErr(
      `offset cannot exceed ${MAX_OFFSET}`,
      400,
    );
  }

  const sb =
    auth.ctx.supabase;

  let query = sb
    .from('profiles')
    .select(
      `
      id,
      full_name,
      phone,
      email,
      role,
      status,
      is_active,
      city,
      created_at,
      updated_at
      `,
      {
        count: 'exact',
      },
    )
    .order(sortBy, {
      ascending,
      nullsFirst: false,
    })
    /*
     * Stable secondary ordering.
     * This is especially important when several
     * profiles have the same created_at.
     */
    .order('id', {
      ascending,
    });

  if (role) {
    query = query.eq(
      'role',
      role,
    );
  }

  if (status === 'active') {
    query = query.eq(
      'status',
      'active',
    );
  }

  if (status === 'suspended') {
    query = query.eq(
      'status',
      'suspended',
    );
  }

  if (
    status === 'pending' ||
    status === 'pending_approval'
  ) {
    query = query.in(
      'status',
      [
        'pending',
        'pending_approval',
      ],
    );
  }

  if (status === 'rejected') {
    query = query.eq(
      'status',
      'rejected',
    );
  }

  if (from) {
    query = query.gte(
      'created_at',
      from,
    );
  }

  if (to) {
    query = query.lte(
      'created_at',
      to,
    );
  }

  if (search) {
    const safeSearch =
      escapePostgrestSearch(
        search,
      );

    query = query.or(
      [
        `full_name.ilike.%${safeSearch}%`,
        `phone.ilike.%${safeSearch}%`,
        `email.ilike.%${safeSearch}%`,
      ].join(','),
    );
  }

  /*
   * Cursor mode currently uses created_at.
   * Keep offset mode fully backward compatible.
   */
  if (cursor) {
    const cursorDate =
      parseISODate(cursor);

    if (!cursorDate) {
      return jsonErr(
        'Invalid cursor',
        400,
      );
    }

    query = ascending
      ? query.gt(
          'created_at',
          cursorDate,
        )
      : query.lt(
          'created_at',
          cursorDate,
        );

    query = query.limit(limit);
  } else {
    query = query.range(
      offset,
      offset + limit - 1,
    );
  }

  const {
    data: profiles,
    error,
    count,
  } = await query;

  if (error) {
    return jsonErr(
      error.message,
      502,
    );
  }

  const rows =
    profiles ?? [];

  /*
   * Only customers need customer-order
   * spending statistics.
   */
  const customerIds =
    rows
      .filter(
        (row) =>
          String(row.role) ===
          'customer',
      )
      .map(
        (row) =>
          String(row.id),
      );

  const statsMap =
    new Map<
      string,
      {
        order_count: number;
        total_spent: number;
      }
    >();

  if (customerIds.length) {
    const {
      data: orders,
      error: orderStatsError,
    } = await sb
      .from('orders')
      .select(
        'customer_id, total_amount',
      )
      .in(
        'customer_id',
        customerIds,
      )
      .eq(
        'status',
        'COMPLETED',
      );

    if (orderStatsError) {
      return jsonErr(
        orderStatsError.message,
        502,
      );
    }

    for (
      const order of orders ?? []
    ) {
      const customerId =
        order.customer_id != null
          ? String(
              order.customer_id,
            )
          : '';

      if (!customerId) {
        continue;
      }

      const previous =
        statsMap.get(
          customerId,
        ) ?? {
          order_count: 0,
          total_spent: 0,
        };

      const amount =
        Number(
          order.total_amount ?? 0,
        );

      statsMap.set(
        customerId,
        {
          order_count:
            previous.order_count + 1,
          total_spent:
            previous.total_spent +
            (
              Number.isFinite(
                amount,
              )
                ? amount
                : 0
            ),
        },
      );
    }
  }

  const users: UserRow[] =
    rows.map((row) => {
      const id =
        String(row.id);

      const stats =
        statsMap.get(id);

      return {
        id,
        full_name:
          row.full_name != null
            ? String(
                row.full_name,
              )
            : null,
        phone:
          row.phone != null
            ? String(row.phone)
            : null,
        email:
          row.email != null
            ? String(row.email)
            : null,
        role:
          String(
            row.role ??
              'customer',
          ),
        status:
          row.status != null
            ? String(row.status)
            : null,
        is_active:
          row.is_active != null
            ? Boolean(
                row.is_active,
              )
            : null,
        city:
          row.city != null
            ? String(row.city)
            : null,
        created_at:
          String(
            row.created_at ??
              '',
          ),
        updated_at:
          row.updated_at != null
            ? String(
                row.updated_at,
              )
            : null,
        order_count:
          stats?.order_count ??
          null,
        total_spent:
          stats?.total_spent ??
          null,
      };
    });

  const nextCursor =
    users.length === limit
      ? (
          users[
            users.length - 1
          ]?.created_at ?? null
        )
      : null;

  const hasMore =
    users.length === limit;

  return NextResponse.json(
    {
      ok: true,
      data: users,
      meta: {
        total: count ?? 0,
        limit,
        offset:
          cursor
            ? null
            : offset,
        next_cursor:
          nextCursor,
        has_more:
          hasMore,
      },
    },
    {
      status: 200,
      headers: {
        'X-Total-Count':
          String(count ?? 0),
        'Cache-Control':
          'private, no-store',
      },
    },
  );
}
