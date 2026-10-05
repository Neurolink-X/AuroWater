/**
 * GET /api/admin/orders
 *
 * Admin-only order listing endpoint.
 *
 * Features:
 * - Status whitelist
 * - ISO date validation
 * - DB-level service filter
 * - Offset pagination
 * - Cursor pagination
 * - Stable cursor ordering using created_at + id
 * - X-Total-Count response header
 * - Supabase FK joins normalized from arrays
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

const VALID_STATUSES = new Set([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

interface OrderRow {
  id: string;
  status: string;
  total_amount: number | null;
  platform_fee: number | null;
  created_at: string;
  updated_at: string | null;
  service_type: string | null;
  address: string | null;
  is_emergency: boolean | null;
  customer_id: string | null;
  technician_id: string | null;
  payment_status: string | null;
  customer_name: string | null;
  technician_name: string | null;
}

interface RawOrderRow {
  id: unknown;
  status: unknown;
  total_amount: unknown;
  platform_fee: unknown;
  created_at: unknown;
  updated_at: unknown;
  service_type: unknown;
  address: unknown;
  is_emergency: unknown;
  customer_id: unknown;
  technician_id: unknown;
  payment_status: unknown;
  customer: Array<{ full_name: string }> | null;
  technician: Array<{ full_name: string }> | null;
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;

  const n = Number(raw);

  if (!Number.isInteger(n) || n < 0) {
    return fallback;
  }

  return n;
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;

  const n = Number(raw);

  if (!Number.isInteger(n) || n < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(n, MAX_LIMIT);
}

function parseISODate(raw: string | null): string | null {
  if (!raw) return null;

  const d = new Date(raw);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

/**
 * Cursor format:
 *   created_at|id
 *
 * Both values are encoded with encodeURIComponent so timestamps/UUIDs
 * remain safe inside a query parameter.
 */
function parseCursor(raw: string | null): { createdAt: string; id: string } | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf('|');

  if (separator <= 0 || separator === raw.length - 1) {
    return null;
  }

  const createdAt = raw.slice(0, separator);
  const id = raw.slice(separator + 1);

  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime()) || !id.trim()) {
    return null;
  }

  return {
    createdAt: parsedDate.toISOString(),
    id: id.trim(),
  };
}

function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) return auth.response;

  if (!requireAdmin(auth.ctx)) {
    return jsonErr('Forbidden', 403);
  }

  const sp = new URL(req.url).searchParams;

  const status = sp.get('status')?.toUpperCase() ?? undefined;
  const service = sp.get('service')?.trim() || undefined;
  const sortAscending = sp.get('sort') === 'asc';

  const limit = parseLimit(sp.get('limit'));
  const offset = parsePositiveInt(sp.get('offset'), 0);

  const cursorRaw = sp.get('cursor');
  const cursor = parseCursor(cursorRaw);

  const fromRaw = sp.get('from');
  const toRaw = sp.get('to');

  const from = parseISODate(fromRaw);
  const to = parseISODate(toRaw);

  if (status && !VALID_STATUSES.has(status)) {
    return jsonErr(
      `Invalid status "${status}". Allowed: ${[...VALID_STATUSES].join(', ')}`,
      400,
    );
  }

  if (fromRaw && !from) {
    return jsonErr('Invalid "from" date — use ISO 8601', 400);
  }

  if (toRaw && !to) {
    return jsonErr('Invalid "to" date — use ISO 8601', 400);
  }

  if (from && to && from > to) {
    return jsonErr('"from" must be before "to"', 400);
  }

  if (cursorRaw && !cursor) {
    return jsonErr('Invalid "cursor"', 400);
  }

  const sb = auth.ctx.supabase;

  let q = sb
    .from('orders')
    .select(
      `
      id,
      status,
      total_amount,
      platform_fee,
      created_at,
      updated_at,
      service_type,
      address,
      is_emergency,
      customer_id,
      technician_id,
      payment_status,
      customer:profiles!orders_customer_id_fkey ( full_name ),
      technician:profiles!orders_technician_id_fkey ( full_name )
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: sortAscending })
    .order('id', { ascending: sortAscending });

  if (status) {
    q = q.eq('status', status);
  }

  if (service) {
    q = q.eq('service_type', service);
  }

  if (from) {
    q = q.gte('created_at', from);
  }

  if (to) {
    q = q.lte('created_at', to);
  }

  /*
   * Cursor pagination uses a stable composite key:
   *
   * ASC: (created_at > cursorDate)
   *   OR (created_at = cursorDate AND id > cursorId)
   *
   * DESC:
   *   OR (created_at = cursorDate AND id < cursorId)
   *
   * This prevents duplicate/skipped rows when several orders share
   * the same created_at timestamp.
   */
  if (cursor) {
    const comparison = sortAscending ? 'gt' : 'lt';
    const idComparison = sortAscending ? 'gt' : 'lt';

    q = q.or(
      `created_at.${comparison}.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.${idComparison}.${cursor.id})`,
    );

    q = q.limit(limit);
  } else {
    q = q.range(offset, offset + limit - 1);
  }

  const { data: raw, error, count } = await q;

  if (error) {
    return jsonErr(error.message, 502);
  }

  const orders: OrderRow[] = (raw ?? []).map((r) => {
    const row = r as unknown as RawOrderRow;

    return {
      id: String(row.id ?? ''),
      status: String(row.status ?? ''),
      total_amount:
        row.total_amount != null ? Number(row.total_amount) : null,
      platform_fee:
        row.platform_fee != null ? Number(row.platform_fee) : null,
      created_at: String(row.created_at ?? ''),
      updated_at:
        row.updated_at != null ? String(row.updated_at) : null,
      service_type:
        row.service_type != null ? String(row.service_type) : null,
      address: row.address != null ? String(row.address) : null,
      is_emergency:
        row.is_emergency != null ? Boolean(row.is_emergency) : null,
      customer_id:
        row.customer_id != null ? String(row.customer_id) : null,
      technician_id:
        row.technician_id != null ? String(row.technician_id) : null,
      payment_status:
        row.payment_status != null ? String(row.payment_status) : null,
      customer_name: row.customer?.[0]?.full_name ?? null,
      technician_name: row.technician?.[0]?.full_name ?? null,
    };
  });

  const lastOrder = orders[orders.length - 1];

  const nextCursor =
    orders.length === limit && lastOrder
      ? encodeCursor(lastOrder.created_at, lastOrder.id)
      : null;

  return NextResponse.json(
    {
      ok: true,
      data: orders,
      meta: {
        total: count ?? 0,
        limit,
        offset: cursor ? null : offset,
        next_cursor: nextCursor,
        has_more: orders.length === limit,
      },
    },
    {
      status: 200,
      headers: {
        'X-Total-Count': String(count ?? 0),
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
