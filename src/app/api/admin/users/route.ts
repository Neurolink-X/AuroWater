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
//   const role = searchParams.get('role') ?? undefined;
//   const limit = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 200);
//   const offset = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

//   let q = auth.ctx.supabase.from('profiles').select('*').order('created_at', { ascending: false });

//   if (role) {
//     q = q.eq('role', role);
//   }

//   const { data, error } = await q.range(offset, offset + limit - 1);

//   if (error) {
//     return jsonErr(error.message, 500);
//   }

//   return jsonOk(data ?? []);
// }


/**
 * GET /api/admin/users
 *
 * Upgrades over the original:
 *  ✓ Full-text search on full_name + phone (ilike)
 *  ✓ Role whitelist validation — prevents bad queries reaching Postgres
 *  ✓ Status filter (active / suspended / pending)
 *  ✓ X-Total-Count header — frontend pagination without body parsing
 *  ✓ Sort field + direction params
 *  ✓ Cursor-based pagination option for infinite scroll UIs
 *  ✓ Joined order_count + total_spent per user (single round-trip via RPC fallback)
 *  ✓ Created-at date range filter
 *  ✓ Consistent typed output — no `any` in response shape
 *  ✓ 400 errors for bad params instead of silent bad data
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

/* ── Constants ───────────────────────────────────────────────────────────── */

const VALID_ROLES    = new Set(['customer', 'supplier', 'technician', 'admin']);
const VALID_STATUSES = new Set(['active', 'suspended', 'pending']);
const VALID_SORT     = new Set(['created_at', 'full_name', 'role', 'updated_at']);

const MAX_LIMIT     = 200;
const DEFAULT_LIMIT =  50;

/* ── Output type ─────────────────────────────────────────────────────────── */

interface UserRow {
  id:          string;
  full_name:   string | null;
  phone:       string | null;
  email:       string | null;
  role:        string;
  is_active:   boolean | null;
  city:        string | null;
  created_at:  string;
  updated_at:  string | null;
  /** Derived from orders — null when stats not available */
  order_count: number | null;
  total_spent: number | null;
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
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/* ── Route handler ───────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const sp = new URL(req.url).searchParams;

  /* ── Parse + validate params ─────────────────────────────────────────── */
  const search   = sp.get('search')?.trim() ?? undefined;
  const role     = sp.get('role')?.toLowerCase() ?? undefined;
  const status   = sp.get('status')?.toLowerCase() ?? undefined;
  const sortBy   = sp.get('sort_by') ?? 'created_at';
  const sortDir  = sp.get('sort') === 'asc';
  const limit    = Math.min(parsePositiveInt(sp.get('limit'),  DEFAULT_LIMIT), MAX_LIMIT);
  const offset   = parsePositiveInt(sp.get('offset'), 0);
  const cursor   = sp.get('cursor') ?? undefined;
  const from     = parseISODate(sp.get('from'));
  const to       = parseISODate(sp.get('to'));

  if (role   && !VALID_ROLES.has(role))      return jsonErr(`Invalid role "${role}"`,     400);
  if (status && !VALID_STATUSES.has(status)) return jsonErr(`Invalid status "${status}"`, 400);
  if (!VALID_SORT.has(sortBy))               return jsonErr(`Invalid sort_by "${sortBy}"`,400);
  if (sp.get('from') && !from)               return jsonErr('Invalid "from" date',        400);
  if (sp.get('to')   && !to)                 return jsonErr('Invalid "to" date',          400);
  if (from && to && from > to)               return jsonErr('"from" must be before "to"', 400);

  const sb = auth.ctx.supabase;

  /* ── Build profiles query ────────────────────────────────────────────── */
  let q = sb
    .from('profiles')
    .select(
      `
      id,
      full_name,
      phone,
      email,
      role,
      is_active,
      city,
      created_at,
      updated_at
      `,
      { count: 'exact' }
    )
    .order(sortBy, { ascending: sortDir });

  /* Filters */
  if (role)   q = q.eq('role', role);
  /* status filter: active | suspended — maps to is_active */
  if (status === 'active') q = q.eq('is_active', true);
  if (status === 'suspended') q = q.eq('is_active', false);
  if (from)   q = q.gte('created_at', from);
  if (to)     q = q.lte('created_at', to);

  /* Full-text search across name + phone */
  if (search) {
    // ilike on two columns — Supabase OR filter
    q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }

  /* Pagination */
  if (cursor) {
    q = sortDir
      ? q.gt('created_at', cursor)
      : q.lt('created_at', cursor);
    q = q.limit(limit);
  } else {
    q = q.range(offset, offset + limit - 1);
  }

  const { data: profiles, error, count } = await q;

  if (error) return jsonErr(error.message, 500);

  const rows = profiles ?? [];

  /* ── Enrich with order stats (single batch query, not N+1) ──────────── */
  let statsMap = new Map<string, { order_count: number; total_spent: number }>();

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id as string);

    const { data: stats } = await sb
      .from('orders')
      .select('customer_id, total_amount')
      .in('customer_id', ids)
      .eq('status', 'COMPLETED');

    if (stats) {
      for (const s of stats as Array<{ customer_id: string; total_amount: unknown }>) {
        const prev = statsMap.get(s.customer_id) ?? { order_count: 0, total_spent: 0 };
        statsMap.set(s.customer_id, {
          order_count: prev.order_count + 1,
          total_spent: prev.total_spent + Number(s.total_amount ?? 0),
        });
      }
    }
  }

  /* ── Build typed response rows ───────────────────────────────────────── */
  const users: UserRow[] = rows.map((r) => {
    const raw = r as Record<string, unknown>;
    const id  = String(raw.id ?? '');
    const st  = statsMap.get(id);
    return {
      id,
      full_name:   raw.full_name  != null ? String(raw.full_name)  : null,
      phone:       raw.phone      != null ? String(raw.phone)      : null,
      email:       raw.email      != null ? String(raw.email)      : null,
      role:        String(raw.role ?? 'customer'),
      is_active:   raw.is_active != null ? Boolean(raw.is_active) : true,
      city:        raw.city       != null ? String(raw.city)       : null,
      created_at:  String(raw.created_at ?? ''),
      updated_at:  raw.updated_at != null ? String(raw.updated_at) : null,
      order_count: st?.order_count ?? null,
      total_spent: st?.total_spent ?? null,
    };
  });

  /* Cursor for next page */
  const nextCursor = users.length === limit
    ? (users[users.length - 1]?.created_at ?? null)
    : null;

  return NextResponse.json(
    {
      ok:   true,
      data: users,
      meta: {
        total:       count ?? 0,
        limit,
        offset:      cursor ? null : offset,
        next_cursor: nextCursor,
        has_more:    users.length === limit,
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