/**
 * GET /api/admin/orders
 *
 * Fix applied (lines 140-143):
 *   Supabase embedded FK selects always return an ARRAY, never a single object.
 *   `profiles!orders_customer_id_fkey` → `{ full_name: string }[]`
 *   Previous cast to `{ full_name: string } | null` was structurally incompatible.
 *   Fixed: type as array, access [0] to get the first (and only) joined profile.
 *
 * All other upgrades retained:
 *  ✓ X-Total-Count response header
 *  ✓ Status enum whitelist — prevents bad DB queries
 *  ✓ ISO date validation — returns 400 instead of 500
 *  ✓ Cursor-based pagination for infinite scroll
 *  ✓ DB-level service_type filter (no post-filter JS hack)
 *  ✓ Sort direction param
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

/* ── Constants ───────────────────────────────────────────────────────────── */

const VALID_STATUSES = new Set([
  'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED',
]);

const MAX_LIMIT      = 200;
const DEFAULT_LIMIT  = 50;

/* ── Output type ─────────────────────────────────────────────────────────── */

interface OrderRow {
  id:               string;
  status:           string;
  total_amount:     number | null;
  platform_fee:     number | null;
  created_at:       string;
  updated_at:       string | null;
  service_type:     string | null;
  address:          string | null;
  is_emergency:     boolean | null;
  customer_id:      string | null;
  technician_id:    string | null;
  payment_status:   string | null;
  /** Flattened from the joined profiles row */
  customer_name:    string | null;
  technician_name:  string | null;
}

/**
 * The raw shape Supabase returns for an embedded FK select.
 * Supabase ALWAYS returns the related rows as an array, even for to-one relations.
 * e.g. `profiles!orders_customer_id_fkey ( full_name )` → `{ full_name: string }[]`
 */
interface RawOrderRow {
  id:              unknown;
  status:          unknown;
  total_amount:    unknown;
  platform_fee:    unknown;
  created_at:      unknown;
  updated_at:      unknown;
  service_type:    unknown;
  address:         unknown;
  is_emergency:    unknown;
  customer_id:     unknown;
  technician_id:   unknown;
  payment_status:  unknown;
  /** Array — Supabase FK join, never a plain object */
  customer:        Array<{ full_name: string }> | null;
  /** Array — Supabase FK join, never a plain object */
  technician:      Array<{ full_name: string }> | null;
}

/* ── Param helpers ───────────────────────────────────────────────────────── */

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return isNaN(n) || n < 0 ? fallback : n;
}

function parseISODate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ── Route handler ───────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const sp = new URL(req.url).searchParams;

  /* Parse + validate params */
  const status  = sp.get('status')?.toUpperCase() ?? undefined;
  const service = sp.get('service') ?? undefined;
  const sortDir = sp.get('sort') === 'asc';
  const limit   = Math.min(parsePositiveInt(sp.get('limit'),  DEFAULT_LIMIT), MAX_LIMIT);
  const offset  = parsePositiveInt(sp.get('offset'), 0);
  const cursor  = sp.get('cursor') ?? undefined;
  const from    = parseISODate(sp.get('from'));
  const to      = parseISODate(sp.get('to'));

  if (status && !VALID_STATUSES.has(status)) {
    return jsonErr(
      `Invalid status "${status}". Allowed: ${[...VALID_STATUSES].join(', ')}`,
      400
    );
  }
  if (sp.get('from') && !from) return jsonErr('Invalid "from" date — use ISO 8601', 400);
  if (sp.get('to')   && !to)   return jsonErr('Invalid "to" date — use ISO 8601',   400);
  if (from && to && from > to) return jsonErr('"from" must be before "to"',          400);

  const sb = auth.ctx.supabase;

  /* Build query — single round-trip with joined names */
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
      { count: 'exact' }
    )
    .order('created_at', { ascending: sortDir });

  if (status)  q = q.eq('status', status);
  if (service) q = q.eq('service_type', service);
  if (from)    q = q.gte('created_at', from);
  if (to)      q = q.lte('created_at', to);

  if (cursor) {
    /* Cursor pagination — no offset drift on live data */
    q = sortDir ? q.gt('created_at', cursor) : q.lt('created_at', cursor);
    q = q.limit(limit);
  } else {
    q = q.range(offset, offset + limit - 1);
  }

  const { data: raw, error, count } = await q;

  if (error) return jsonErr(error.message, 500);

  /* ── Normalize: flatten the Supabase array-join into a flat name string ── */
  const orders: OrderRow[] = (raw ?? []).map((r) => {
    /*
     * THE FIX:
     * Supabase returns FK-joined rows as arrays, so we type them explicitly
     * as `Array<{ full_name: string }> | null` and access index [0].
     * Casting directly to `{ full_name: string } | null` fails at compile time
     * because the types do not overlap — arrays are not assignable to plain objects.
     */
    const row = r as unknown as RawOrderRow;

    return {
      id:              String(row.id ?? ''),
      status:          String(row.status ?? ''),
      total_amount:    row.total_amount != null ? Number(row.total_amount) : null,
      platform_fee:    row.platform_fee != null ? Number(row.platform_fee) : null,
      created_at:      String(row.created_at ?? ''),
      updated_at:      row.updated_at != null ? String(row.updated_at) : null,
      service_type:    row.service_type != null ? String(row.service_type) : null,
      address:         row.address != null ? String(row.address) : null,
      is_emergency:    row.is_emergency != null ? Boolean(row.is_emergency) : null,
      customer_id:     row.customer_id != null ? String(row.customer_id) : null,
      technician_id:   row.technician_id != null ? String(row.technician_id) : null,
      payment_status:  row.payment_status != null ? String(row.payment_status) : null,
      /* Access [0] — FK joins are arrays even for to-one relations */
      customer_name:   row.customer?.[0]?.full_name ?? null,
      technician_name: row.technician?.[0]?.full_name ?? null,
    };
  });

  const nextCursor = orders.length === limit
    ? (orders[orders.length - 1]?.created_at ?? null)
    : null;

  return NextResponse.json(
    {
      ok:   true,
      data: orders,
      meta: {
        total:       count ?? 0,
        limit,
        offset:      cursor ? null : offset,
        next_cursor: nextCursor,
        has_more:    orders.length === limit,
      },
    },
    {
      status: 200,
      headers: {
        'X-Total-Count': String(count ?? 0),
        'Cache-Control':  'private, no-store',
      },
    }
  );
}


// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireAdmin(auth.ctx)) {
//     return jsonErr('Forbidden', 403);
//   }

//   const { searchParams } = new URL(req.url);
//   const status = searchParams.get('status') ?? undefined;
//   const service = searchParams.get('service') ?? undefined;
//   const from = searchParams.get('from') ?? undefined;
//   const to = searchParams.get('to') ?? undefined;
//   const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 200);
//   const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

//   let q = auth.ctx.supabase.from('orders').select('*').order('created_at', { ascending: false });

//   if (status) {
//     q = q.eq('status', status);
//   }
//   if (from) {
//     q = q.gte('created_at', from);
//   }
//   if (to) {
//     q = q.lte('created_at', to);
//   }

//   const { data: orders, error } = await q.range(offset, offset + limit - 1);

//   if (error) {
//     return jsonErr(error.message, 500);
//   }

//   let list = orders ?? [];
//   if (service) {
//     const { data: st } = await auth.ctx.supabase
//       .from('service_types')
//       .select('id')
//       .eq('key', service)
//       .maybeSingle();
//     if (st?.id != null) {
//       list = list.filter((o) => Number(o.service_type_id) === Number(st.id));
//     }
//   }

//   return jsonOk(list);
// }
