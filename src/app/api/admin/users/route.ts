
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
const RELATED_PAGE_SIZE = 1000;

const COMPLETED_STATUSES = new Set(['COMPLETED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'CANCELED']);

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
  verification_status: string | null;

  order_count: number | null;
  total_spent: number | null;

  average_rating: number | null;
  review_count: number;
  low_rating_count: number;

  completed_work_count: number | null;
  cancelled_work_count: number | null;

  application_status: string | null;
  application_type: string | null;
}

interface WorkStats {
  completed: number;
  cancelled: number;
}

interface CustomerStats {
  order_count: number;
  total_spent: number;
}

interface RatingStats {
  total: number;
  count: number;
  low: number;
}

interface ApplicationStats {
  status: string;
  type: string;
  updatedAt: number;
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

function parseISODate(raw: string | null): string | null {
  if (!raw) return null;

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/*
 * Escape special characters in PostgREST filter expressions.
 */
function escapePostgrestSearch(value: string): string {
  return value
    .replace(/[%]/g, '\\%')
    .replace(/[,]/g, '\\,')
    .replace(/[()]/g, '\\$&');
}

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function toSafeAmount(value: unknown): number {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function getWorkStats(
  map: Map<string, WorkStats>,
  id: string,
): WorkStats {
  const existing = map.get(id);

  if (existing) return existing;

  const initial = { completed: 0, cancelled: 0 };
  map.set(id, initial);

  return initial;
}

function getCustomerStats(
  map: Map<string, CustomerStats>,
  id: string,
): CustomerStats {
  const existing = map.get(id);

  if (existing) return existing;

  const initial = { order_count: 0, total_spent: 0 };
  map.set(id, initial);

  return initial;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSupabaseAuth(req);

    if (!auth.ok) {
      return auth.response;
    }

    if (!requireAdmin(auth.ctx)) {
      return jsonErr('Forbidden', 403);
    }

    const params = new URL(req.url).searchParams;

    const rawSearch = params.get('search')?.trim() ?? '';

    if (rawSearch.length > MAX_SEARCH_LENGTH) {
      return jsonErr(
        `Search must be ${MAX_SEARCH_LENGTH} characters or fewer`,
        400,
      );
    }

    const search = rawSearch || null;
    const role = params.get('role')?.trim().toLowerCase() || null;
    const status = params.get('status')?.trim().toLowerCase() || null;
    const sortBy = params.get('sort_by')?.trim() || 'created_at';
    const sort = params.get('sort')?.trim().toLowerCase();
    const ascending = sort === 'asc';

    const limit = Math.min(
      parseNonNegativeInt(params.get('limit'), DEFAULT_LIMIT) ||
        DEFAULT_LIMIT,
      MAX_LIMIT,
    );

    const offset = parseNonNegativeInt(params.get('offset'), 0);
    const cursor = params.get('cursor')?.trim() || null;
    const from = parseISODate(params.get('from'));
    const to = parseISODate(params.get('to'));

    if (role && !VALID_ROLES.has(role)) {
      return jsonErr(`Invalid role "${role}"`, 400);
    }

    if (status && !VALID_STATUSES.has(status)) {
      return jsonErr(`Invalid status "${status}"`, 400);
    }

    if (!VALID_SORT_FIELDS.has(sortBy)) {
      return jsonErr(`Invalid sort_by "${sortBy}"`, 400);
    }

    if (params.has('sort') && sort !== 'asc' && sort !== 'desc') {
      return jsonErr('sort must be "asc" or "desc"', 400);
    }

    if (params.has('from') && !from) {
      return jsonErr('Invalid "from" date', 400);
    }

    if (params.has('to') && !to) {
      return jsonErr('Invalid "to" date', 400);
    }

    if (from && to && from > to) {
      return jsonErr('"from" must be before or equal to "to"', 400);
    }

    if (!cursor && offset > MAX_OFFSET) {
      return jsonErr(`offset cannot exceed ${MAX_OFFSET}`, 400);
    }

    const sb = auth.ctx.supabase;

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
          updated_at,
          verification_status
        `,
        { count: 'exact' },
      )
      .order(sortBy, {
        ascending,
        nullsFirst: false,
      })
      .order('id', { ascending });

    if (role) {
      query = query.eq('role', role);
    }

    if (status === 'active' || status === 'suspended') {
      query = query.eq('status', status);
    }

    if (status === 'pending' || status === 'pending_approval') {
      query = query.in('status', ['pending', 'pending_approval']);
    }

    if (status === 'rejected') {
      query = query.eq('status', 'rejected');
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    if (search) {
      const safeSearch = escapePostgrestSearch(search);

      query = query.or(
        [
          `full_name.ilike.%${safeSearch}%`,
          `phone.ilike.%${safeSearch}%`,
          `email.ilike.%${safeSearch}%`,
        ].join(','),
      );
    }

    /*
     * Keep the existing cursor contract backward compatible.
     * For reliable traversal when timestamps collide, a future
     * API version should use a composite created_at + id cursor.
     */
    if (cursor) {
      const cursorDate = parseISODate(cursor);

      if (!cursorDate) {
        return jsonErr('Invalid cursor', 400);
      }

      query = ascending
        ? query.gt('created_at', cursorDate)
        : query.lt('created_at', cursorDate);

      query = query.limit(limit);
    } else {
      query = query.range(offset, offset + limit - 1);
    }

    const {
      data: profiles,
      error: profileError,
      count,
    } = await query;

    if (profileError) {
      console.error('[admin/users] Profile query failed');
      return jsonErr('Could not load users', 502);
    }

    const rows = profiles ?? [];
    const pageIds = rows.map((row) => String(row.id));

    const customerIds = rows
      .filter((row) => String(row.role) === 'customer')
      .map((row) => String(row.id));

    const supplierIds = rows
      .filter((row) => String(row.role) === 'supplier')
      .map((row) => String(row.id));

    const technicianIds = rows
      .filter((row) => String(row.role) === 'technician')
      .map((row) => String(row.id));

    const customerStats = new Map<string, CustomerStats>();
    const supplierWorkStats = new Map<string, WorkStats>();
    const technicianWorkStats = new Map<string, WorkStats>();
    const ratingStats = new Map<string, RatingStats>();
    const applicationStats = new Map<string, ApplicationStats>();

    /*
     * Customer metrics: only completed orders count as completed
     * purchases or spending. Related records are paged to avoid
     * silently truncating results at the REST API row limit.
     */
    if (customerIds.length > 0) {
      for (
        let start = 0;
        ;
        start += RELATED_PAGE_SIZE
      ) {
        const { data, error } = await sb
          .from('orders')
          .select('customer_id, total_amount, status')
          .in('customer_id', customerIds)
          .range(start, start + RELATED_PAGE_SIZE - 1);

        if (error) {
          console.error('[admin/users] Customer order metrics failed');
          return jsonErr('Could not load customer metrics', 502);
        }

        const batch = data ?? [];

        for (const order of batch) {
          if (!COMPLETED_STATUSES.has(normalizeStatus(order.status))) {
            continue;
          }

          if (!order.customer_id) continue;

          const id = String(order.customer_id);
          const stats = getCustomerStats(customerStats, id);

          stats.order_count += 1;
          stats.total_spent += toSafeAmount(order.total_amount);
        }

        if (batch.length < RELATED_PAGE_SIZE) break;
      }
    }

    /*
     * Supplier work metrics.
     */
    if (supplierIds.length > 0) {
      for (
        let start = 0;
        ;
        start += RELATED_PAGE_SIZE
      ) {
        const { data, error } = await sb
          .from('orders')
          .select('supplier_id, status')
          .in('supplier_id', supplierIds)
          .range(start, start + RELATED_PAGE_SIZE - 1);

        if (error) {
          console.error('[admin/users] Supplier work metrics failed');
          return jsonErr('Could not load supplier metrics', 502);
        }

        const batch = data ?? [];

        for (const order of batch) {
          if (!order.supplier_id) continue;

          const stats = getWorkStats(
            supplierWorkStats,
            String(order.supplier_id),
          );

          const orderStatus = normalizeStatus(order.status);

          if (COMPLETED_STATUSES.has(orderStatus)) {
            stats.completed += 1;
          } else if (CANCELLED_STATUSES.has(orderStatus)) {
            stats.cancelled += 1;
          }
        }

        if (batch.length < RELATED_PAGE_SIZE) break;
      }
    }

    /*
     * Technician work metrics. No technician rating is fabricated:
     * reviews currently link to suppliers, not technicians.
     */
    if (technicianIds.length > 0) {
      for (
        let start = 0;
        ;
        start += RELATED_PAGE_SIZE
      ) {
        const { data, error } = await sb
          .from('orders')
          .select('technician_id, status')
          .in('technician_id', technicianIds)
          .range(start, start + RELATED_PAGE_SIZE - 1);

        if (error) {
          console.error('[admin/users] Technician work metrics failed');
          return jsonErr('Could not load technician metrics', 502);
        }

        const batch = data ?? [];

        for (const order of batch) {
          if (!order.technician_id) continue;

          const stats = getWorkStats(
            technicianWorkStats,
            String(order.technician_id),
          );

          const orderStatus = normalizeStatus(order.status);

          if (COMPLETED_STATUSES.has(orderStatus)) {
            stats.completed += 1;
          } else if (CANCELLED_STATUSES.has(orderStatus)) {
            stats.cancelled += 1;
          }
        }

        if (batch.length < RELATED_PAGE_SIZE) break;
      }
    }

    /*
     * Supplier ratings from the confirmed reviews schema.
     * Invalid ratings are ignored rather than affecting the average.
     */
    if (supplierIds.length > 0) {
      for (
        let start = 0;
        ;
        start += RELATED_PAGE_SIZE
      ) {
        const { data, error } = await sb
          .from('reviews')
          .select('supplier_id, stars')
          .in('supplier_id', supplierIds)
          .range(start, start + RELATED_PAGE_SIZE - 1);

        if (error) {
          console.error('[admin/users] Supplier ratings query failed');
          return jsonErr('Could not load supplier ratings', 502);
        }

        const batch = data ?? [];

        for (const review of batch) {
          if (!review.supplier_id) continue;

          const stars = Number(review.stars);

          if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            continue;
          }

          const id = String(review.supplier_id);
          const stats = ratingStats.get(id) ?? {
            total: 0,
            count: 0,
            low: 0,
          };

          stats.total += stars;
          stats.count += 1;

          if (stars <= 2) {
            stats.low += 1;
          }

          ratingStats.set(id, stats);
        }

        if (batch.length < RELATED_PAGE_SIZE) break;
      }
    }

    /*
     * Use the most recently updated application per user.
     * No application is represented as null, not "approved".
     */
    if (pageIds.length > 0) {
      for (
        let start = 0;
        ;
        start += RELATED_PAGE_SIZE
      ) {
        const { data, error } = await sb
          .from('applications')
          .select('user_id, type, status, updated_at, created_at')
          .in('user_id', pageIds)
          .range(start, start + RELATED_PAGE_SIZE - 1);

        if (error) {
          console.error('[admin/users] Application query failed');
          return jsonErr('Could not load verification applications', 502);
        }

        const batch = data ?? [];

        for (const application of batch) {
          if (!application.user_id) continue;

          const id = String(application.user_id);
          const timestamp = new Date(
            application.updated_at ??
              application.created_at ??
              0,
          ).getTime();

          const previous = applicationStats.get(id);

          if (!previous || timestamp >= previous.updatedAt) {
            applicationStats.set(id, {
              status: String(application.status ?? 'unknown'),
              type: String(application.type ?? 'unknown'),
              updatedAt: timestamp,
            });
          }
        }

        if (batch.length < RELATED_PAGE_SIZE) break;
      }
    }

    const users: UserRow[] = rows.map((row) => {
      const id = String(row.id);
      const roleValue = String(row.role ?? 'customer');

      const customer = customerStats.get(id);
      const supplierWork = supplierWorkStats.get(id);
      const technicianWork = technicianWorkStats.get(id);
      const rating = ratingStats.get(id);
      const application = applicationStats.get(id);

      const isWorker =
        roleValue === 'supplier' || roleValue === 'technician';

      const work =
        roleValue === 'supplier'
          ? supplierWork
          : roleValue === 'technician'
            ? technicianWork
            : undefined;

      return {
        id,
        full_name: row.full_name != null ? String(row.full_name) : null,
        phone: row.phone != null ? String(row.phone) : null,
        email: row.email != null ? String(row.email) : null,
        role: roleValue,
        status: row.status != null ? String(row.status) : null,
        is_active: row.is_active != null ? Boolean(row.is_active) : null,
        city: row.city != null ? String(row.city) : null,
        created_at: String(row.created_at ?? ''),
        updated_at: row.updated_at != null ? String(row.updated_at) : null,

        verification_status:
          row.verification_status != null
            ? String(row.verification_status)
            : null,

        order_count:
          roleValue === 'customer'
            ? customer?.order_count ?? 0
            : null,

        total_spent:
          roleValue === 'customer'
            ? customer?.total_spent ?? 0
            : null,

        average_rating:
          roleValue === 'supplier' && rating && rating.count > 0
            ? Number((rating.total / rating.count).toFixed(2))
            : null,

        review_count:
          roleValue === 'supplier' ? rating?.count ?? 0 : 0,

        low_rating_count:
          roleValue === 'supplier' ? rating?.low ?? 0 : 0,

        completed_work_count:
          isWorker ? work?.completed ?? 0 : null,

        cancelled_work_count:
          isWorker ? work?.cancelled ?? 0 : null,

        application_status: application?.status ?? null,
        application_type: application?.type ?? null,
      };
    });

    const nextCursor =
      users.length === limit
        ? users[users.length - 1]?.created_at ?? null
        : null;

    return NextResponse.json(
      {
        ok: true,
        data: users,
        meta: {
          total: count ?? 0,
          limit,
          offset: cursor ? null : offset,
          next_cursor: nextCursor,
          has_more: users.length === limit,
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
  } catch {
    console.error('[admin/users] Unexpected request failure');

    return jsonErr('An unexpected error occurred while loading users', 500);
  }
}














// import { NextRequest, NextResponse } from 'next/server';

// import { jsonErr } from '@/lib/api/json-response';
// import {
//   requireAdmin,
//   requireSupabaseAuth,
// } from '@/lib/api/supabase-request';

// const VALID_ROLES = new Set([
//   'customer',
//   'supplier',
//   'technician',
//   'admin',
// ]);

// const VALID_STATUSES = new Set([
//   'active',
//   'suspended',
//   'pending',
//   'pending_approval',
//   'rejected',
// ]);

// const VALID_SORT_FIELDS = new Set([
//   'created_at',
//   'full_name',
//   'role',
//   'updated_at',
// ]);

// const MAX_LIMIT = 200;
// const DEFAULT_LIMIT = 50;
// const MAX_OFFSET = 100_000;
// const MAX_SEARCH_LENGTH = 100;

// interface UserRow {
//   id: string;
//   full_name: string | null;
//   phone: string | null;
//   email: string | null;
//   role: string;
//   status: string | null;
//   is_active: boolean | null;
//   city: string | null;
//   created_at: string;
//   updated_at: string | null;
//   order_count: number | null;
//   total_spent: number | null;
// }

// function parseNonNegativeInt(
//   raw: string | null,
//   fallback: number,
// ): number {
//   if (raw == null || raw.trim() === '') {
//     return fallback;
//   }

//   if (!/^\d+$/.test(raw.trim())) {
//     return fallback;
//   }

//   const value = Number(raw);

//   if (!Number.isSafeInteger(value) || value < 0) {
//     return fallback;
//   }

//   return value;
// }

// function parseISODate(
//   raw: string | null,
// ): string | null {
//   if (!raw) {
//     return null;
//   }

//   const date = new Date(raw);

//   if (Number.isNaN(date.getTime())) {
//     return null;
//   }

//   return date.toISOString();
// }

// /*
//  * Escape characters that have special meaning
//  * inside PostgREST filter expressions.
//  */
// function escapePostgrestSearch(
//   value: string,
// ): string {
//   return value
//     .replace(/[%]/g, '\\%')
//     .replace(/[,]/g, '\\,')
//     .replace(/[()]/g, '\\$&');
// }

// export async function GET(
//   req: NextRequest,
// ) {
//   const auth =
//     await requireSupabaseAuth(req);

//   if (!auth.ok) {
//     return auth.response;
//   }

//   if (!requireAdmin(auth.ctx)) {
//     return jsonErr('Forbidden', 403);
//   }

//   const params =
//     new URL(req.url).searchParams;

//   const rawSearch =
//     params.get('search')?.trim() ?? '';

//   if (rawSearch.length > MAX_SEARCH_LENGTH) {
//     return jsonErr(
//       `Search must be ${MAX_SEARCH_LENGTH} characters or fewer`,
//       400,
//     );
//   }

//   const search =
//     rawSearch || null;

//   const role =
//     params.get('role')?.trim().toLowerCase() ||
//     null;

//   const status =
//     params.get('status')?.trim().toLowerCase() ||
//     null;

//   const sortBy =
//     params.get('sort_by')?.trim() ||
//     'created_at';

//   const sort =
//     params.get('sort')?.trim().toLowerCase();

//   const ascending =
//     sort === 'asc';

//   const limit = Math.min(
//     parseNonNegativeInt(
//       params.get('limit'),
//       DEFAULT_LIMIT,
//     ) || DEFAULT_LIMIT,
//     MAX_LIMIT,
//   );

//   const offset =
//     parseNonNegativeInt(
//       params.get('offset'),
//       0,
//     );

//   const cursor =
//     params.get('cursor')?.trim() || null;

//   const from =
//     parseISODate(params.get('from'));

//   const to =
//     parseISODate(params.get('to'));

//   /*
//    * Explicit validation.
//    */
//   if (
//     role &&
//     !VALID_ROLES.has(role)
//   ) {
//     return jsonErr(
//       `Invalid role "${role}"`,
//       400,
//     );
//   }

//   if (
//     status &&
//     !VALID_STATUSES.has(status)
//   ) {
//     return jsonErr(
//       `Invalid status "${status}"`,
//       400,
//     );
//   }

//   if (
//     !VALID_SORT_FIELDS.has(sortBy)
//   ) {
//     return jsonErr(
//       `Invalid sort_by "${sortBy}"`,
//       400,
//     );
//   }

//   if (
//     params.has('sort') &&
//     sort !== 'asc' &&
//     sort !== 'desc'
//   ) {
//     return jsonErr(
//       'sort must be "asc" or "desc"',
//       400,
//     );
//   }

//   if (
//     params.has('from') &&
//     !from
//   ) {
//     return jsonErr(
//       'Invalid "from" date',
//       400,
//     );
//   }

//   if (
//     params.has('to') &&
//     !to
//   ) {
//     return jsonErr(
//       'Invalid "to" date',
//       400,
//     );
//   }

//   if (
//     from &&
//     to &&
//     from > to
//   ) {
//     return jsonErr(
//       '"from" must be before or equal to "to"',
//       400,
//     );
//   }

//   if (
//     !cursor &&
//     offset > MAX_OFFSET
//   ) {
//     return jsonErr(
//       `offset cannot exceed ${MAX_OFFSET}`,
//       400,
//     );
//   }

//   const sb =
//     auth.ctx.supabase;

//   let query = sb
//     .from('profiles')
//     .select(
//       `
//       id,
//       full_name,
//       phone,
//       email,
//       role,
//       status,
//       is_active,
//       city,
//       created_at,
//       updated_at
//       `,
//       {
//         count: 'exact',
//       },
//     )
//     .order(sortBy, {
//       ascending,
//       nullsFirst: false,
//     })
//     /*
//      * Stable secondary ordering.
//      * This is especially important when several
//      * profiles have the same created_at.
//      */
//     .order('id', {
//       ascending,
//     });

//   if (role) {
//     query = query.eq(
//       'role',
//       role,
//     );
//   }

//   if (status === 'active') {
//     query = query.eq(
//       'status',
//       'active',
//     );
//   }

//   if (status === 'suspended') {
//     query = query.eq(
//       'status',
//       'suspended',
//     );
//   }

//   if (
//     status === 'pending' ||
//     status === 'pending_approval'
//   ) {
//     query = query.in(
//       'status',
//       [
//         'pending',
//         'pending_approval',
//       ],
//     );
//   }

//   if (status === 'rejected') {
//     query = query.eq(
//       'status',
//       'rejected',
//     );
//   }

//   if (from) {
//     query = query.gte(
//       'created_at',
//       from,
//     );
//   }

//   if (to) {
//     query = query.lte(
//       'created_at',
//       to,
//     );
//   }

//   if (search) {
//     const safeSearch =
//       escapePostgrestSearch(
//         search,
//       );

//     query = query.or(
//       [
//         `full_name.ilike.%${safeSearch}%`,
//         `phone.ilike.%${safeSearch}%`,
//         `email.ilike.%${safeSearch}%`,
//       ].join(','),
//     );
//   }

//   /*
//    * Cursor mode currently uses created_at.
//    * Keep offset mode fully backward compatible.
//    */
//   if (cursor) {
//     const cursorDate =
//       parseISODate(cursor);

//     if (!cursorDate) {
//       return jsonErr(
//         'Invalid cursor',
//         400,
//       );
//     }

//     query = ascending
//       ? query.gt(
//           'created_at',
//           cursorDate,
//         )
//       : query.lt(
//           'created_at',
//           cursorDate,
//         );

//     query = query.limit(limit);
//   } else {
//     query = query.range(
//       offset,
//       offset + limit - 1,
//     );
//   }

//   const {
//     data: profiles,
//     error,
//     count,
//   } = await query;

//   if (error) {
//     return jsonErr(
//       error.message,
//       502,
//     );
//   }

//   const rows =
//     profiles ?? [];

//   /*
//    * Only customers need customer-order
//    * spending statistics.
//    */
//   const customerIds =
//     rows
//       .filter(
//         (row) =>
//           String(row.role) ===
//           'customer',
//       )
//       .map(
//         (row) =>
//           String(row.id),
//       );

//   const statsMap =
//     new Map<
//       string,
//       {
//         order_count: number;
//         total_spent: number;
//       }
//     >();

//   if (customerIds.length) {
//     const {
//       data: orders,
//       error: orderStatsError,
//     } = await sb
//       .from('orders')
//       .select(
//         'customer_id, total_amount',
//       )
//       .in(
//         'customer_id',
//         customerIds,
//       )
//       .eq(
//         'status',
//         'COMPLETED',
//       );

//     if (orderStatsError) {
//       return jsonErr(
//         orderStatsError.message,
//         502,
//       );
//     }

//     for (
//       const order of orders ?? []
//     ) {
//       const customerId =
//         order.customer_id != null
//           ? String(
//               order.customer_id,
//             )
//           : '';

//       if (!customerId) {
//         continue;
//       }

//       const previous =
//         statsMap.get(
//           customerId,
//         ) ?? {
//           order_count: 0,
//           total_spent: 0,
//         };

//       const amount =
//         Number(
//           order.total_amount ?? 0,
//         );

//       statsMap.set(
//         customerId,
//         {
//           order_count:
//             previous.order_count + 1,
//           total_spent:
//             previous.total_spent +
//             (
//               Number.isFinite(
//                 amount,
//               )
//                 ? amount
//                 : 0
//             ),
//         },
//       );
//     }
//   }

//   const users: UserRow[] =
//     rows.map((row) => {
//       const id =
//         String(row.id);

//       const stats =
//         statsMap.get(id);

//       return {
//         id,
//         full_name:
//           row.full_name != null
//             ? String(
//                 row.full_name,
//               )
//             : null,
//         phone:
//           row.phone != null
//             ? String(row.phone)
//             : null,
//         email:
//           row.email != null
//             ? String(row.email)
//             : null,
//         role:
//           String(
//             row.role ??
//               'customer',
//           ),
//         status:
//           row.status != null
//             ? String(row.status)
//             : null,
//         is_active:
//           row.is_active != null
//             ? Boolean(
//                 row.is_active,
//               )
//             : null,
//         city:
//           row.city != null
//             ? String(row.city)
//             : null,
//         created_at:
//           String(
//             row.created_at ??
//               '',
//           ),
//         updated_at:
//           row.updated_at != null
//             ? String(
//                 row.updated_at,
//               )
//             : null,
//         order_count:
//           stats?.order_count ??
//           null,
//         total_spent:
//           stats?.total_spent ??
//           null,
//       };
//     });

//   const nextCursor =
//     users.length === limit
//       ? (
//           users[
//             users.length - 1
//           ]?.created_at ?? null
//         )
//       : null;

//   const hasMore =
//     users.length === limit;

//   return NextResponse.json(
//     {
//       ok: true,
//       data: users,
//       meta: {
//         total: count ?? 0,
//         limit,
//         offset:
//           cursor
//             ? null
//             : offset,
//         next_cursor:
//           nextCursor,
//         has_more:
//           hasMore,
//       },
//     },
//     {
//       status: 200,
//       headers: {
//         'X-Total-Count':
//           String(count ?? 0),
//         'Cache-Control':
//           'private, no-store',
//       },
//     },
//   );
// }
