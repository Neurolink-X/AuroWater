import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { getDispatchResponseSeconds } from '@/lib/dispatch';

/**
 * GET /api/supplier/orders
 *
 * Lists only orders assigned to the authenticated supplier.
 *
 * Security:
 * - Never expose unassigned orders to suppliers.
 * - Always remove secrets from the raw order row.
 * - Hide private contact/location fields until the supplier accepts the job
 *   or the job is in progress.
 * - Do not log customer PII.
 *
 * Compatibility:
 * - Preserves the existing response fields and response helpers.
 * - Preserves status, limit, before, and X-Next-Before behavior.
 * - Keeps optional service labels and address enrichment resilient.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/** Exact contact details are shown only after acceptance / while work is active. */
const ACTIVE_CONTACT_STATUSES = new Set(['IN_PROGRESS']);

type Row = Record<string, unknown>;

type CustomerProfile = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
};

type ServiceType = {
  id: number;
  key?: string | null;
  name?: string | null;
};

type CustomerAddress = {
  id: string;
  label?: string | null;
  house_flat?: string | null;
  area?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const upper = (value: unknown): string => String(value ?? '').trim().toUpperCase();

/** Fields that must never be returned to a supplier. */
const SECRET_KEY =
  /(^|_)(otp|otp_code|otp_hash|verification_code|service_code|delivery_code|pin|secret|password|token)(_|$)|otp_code|otp_hash|verification_code|service_code|delivery_code/i;

/**
 * Private customer contact/location fields.
 * address_id is intentionally retained as a relational identifier; actual
 * address values and snapshots are hidden until reveal=true.
 */
const PRIVATE_KEY =
  /phone|email|landmark|pincode|postal|latitude|longitude|(^|_)lat($|_)|(^|_)lng($|_)|snapshot|formatted_address|(^|_)address_text$|^address$|^address_line$|^delivery_address$/i;

function redact(order: Row, reveal: boolean): Row {
  const result: Row = {};

  for (const [key, value] of Object.entries(order)) {
    if (SECRET_KEY.test(key)) continue;

    if (!reveal && key !== 'address_id' && PRIVATE_KEY.test(key)) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

const join = (parts: unknown[]): string =>
  parts
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim())
    .join(', ');

function getSnapshot(order: Row): Row {
  const snapshot = order.address_snapshot;
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Row)
    : {};
}

function buildAddress(address: CustomerAddress | undefined, snapshot: Row): {
  full: string | null;
  coarse: string | null;
} {
  const area = address?.area ?? address?.line2;

  const full = address
    ? join([
        address.house_flat ?? address.line1,
        area,
        address.landmark,
        address.city,
        address.state,
        address.pincode,
      ])
    : join([
        snapshot.house_flat,
        snapshot.line1,
        snapshot.area,
        snapshot.landmark,
        snapshot.city,
        snapshot.state,
        snapshot.pincode,
        snapshot.formatted_address,
        snapshot.full_address,
      ]);

  const coarse = address
    ? join([area, address.city])
    : join([snapshot.area, snapshot.city]);

  return {
    full: full || null,
    coarse: coarse || null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;

  if (!requireRole(auth.ctx, 'supplier')) {
    return jsonErr('Forbidden', 403);
  }

  const params = new URL(req.url).searchParams;

  const rawStatus = params.get('status');
  const status = rawStatus?.trim().toUpperCase() || undefined;

  if (status && !/^[A-Z_]{3,30}$/.test(status)) {
    return jsonErr('Invalid status filter.', 400);
  }

  const rawLimit = params.get('limit');
  const parsedLimit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const beforeRaw = params.get('before');
  const before = beforeRaw?.trim() || undefined;

  if (before && !Number.isFinite(Date.parse(before))) {
    return jsonErr('Invalid "before" timestamp.', 400);
  }

  try {
    // IMPORTANT: supplier_id filtering is a security boundary. Do not remove it
    // or replace it with a query that returns all pending/unassigned orders.
    let query = auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('supplier_id', auth.ctx.profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;

    if (error) {
      console.error('[supplier/orders] list failed', {
        code: error.code,
        message: error.message,
      });
      return jsonErr('Could not load your orders. Please try again.', 500);
    }

    const orders = (data ?? []) as Row[];

    if (orders.length === 0) {
      const emptyResponse = jsonOk([]);
      try {
        emptyResponse.headers.set('Cache-Control', 'private, no-store');
      } catch {
        // Response body remains valid if header mutation is unavailable.
      }
      return emptyResponse;
    }

    const service = createServiceClient();

    const customerIds = [
      ...new Set(
        orders
          .map((order) => String(order.customer_id ?? ''))
          .filter((id) => id.length > 0),
      ),
    ];

    const serviceTypeIds = [
      ...new Set(
        orders
          .map((order) => Number(order.service_type_id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];

    const addressIds = [
      ...new Set(
        orders
          .map((order) => String(order.address_id ?? ''))
          .filter((id) => id.length > 0),
      ),
    ];

    const hasOffers = orders.some((order) => {
      const orderStatus = upper(order.status);
      return (
        orderStatus === 'ASSIGNED' &&
        !order.accepted_at &&
        Boolean(order.assigned_at)
      );
    });

    const [
      profilesResult,
      serviceTypesResult,
      addressesResult,
      responseSeconds,
    ] = await Promise.all([
      customerIds.length
        ? service
            .from('profiles')
            .select('id, full_name, phone, city')
            .in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),

      serviceTypeIds.length
        ? service
            .from('service_types')
            .select('id, key, name')
            .in('id', serviceTypeIds)
        : Promise.resolve({ data: [], error: null }),

      addressIds.length
        ? service
            .from('addresses')
            .select(
              'id, label, house_flat, area, line1, line2, city, state, pincode, landmark, lat, lng',
            )
            .in('id', addressIds)
        : Promise.resolve({ data: [], error: null }),

      hasOffers ? getDispatchResponseSeconds() : Promise.resolve(0),
    ]);

    // Customer identity enrichment is required by this endpoint's existing
    // contract. Fail closed rather than returning an incomplete contact record.
    if (profilesResult.error) {
      console.error('[supplier/orders] customer contact lookup failed', {
        code: profilesResult.error.code,
        message: profilesResult.error.message,
      });
      return jsonErr('Unable to load delivery contact details right now', 502);
    }

    // Service labels are optional. The stored service key remains a fallback.
    if (serviceTypesResult.error) {
      console.error('[supplier/orders] service types lookup failed', {
        code: serviceTypesResult.error.code,
        message: serviceTypesResult.error.message,
      });
    }

    // An address lookup may fail for historical orders without an address row.
    // If an accepted/in-progress order needs exact delivery details, fail clearly.
    if (addressesResult.error) {
      console.error('[supplier/orders] addresses lookup failed', {
        code: addressesResult.error.code,
        message: addressesResult.error.message,
      });

      const needsExactAddress = orders.some((order) => {
        const orderStatus = upper(order.status);
        return (
          orderStatus === 'IN_PROGRESS' ||
          (orderStatus === 'ASSIGNED' && Boolean(order.accepted_at))
        );
      });

      if (needsExactAddress) {
        return jsonErr(
          'Unable to load delivery address details. Please retry.',
          502,
        );
      }
    }

    const profileById = new Map<string, CustomerProfile>(
      ((profilesResult.data ?? []) as CustomerProfile[]).map((profile) => [
        String(profile.id),
        profile,
      ]),
    );

    const serviceTypeById = new Map<number, ServiceType>(
      ((serviceTypesResult.data ?? []) as ServiceType[]).map((serviceType) => [
        Number(serviceType.id),
        serviceType,
      ]),
    );

    const addressById = new Map<string, CustomerAddress>(
      ((addressesResult.data ?? []) as CustomerAddress[]).map((address) => [
        String(address.id),
        address,
      ]),
    );

    if (profileById.size < customerIds.length) {
      // IDs/counts only; do not log names, phone numbers, or addresses.
      console.warn('[supplier/orders] some customer profiles were not found', {
        requested: customerIds.length,
        found: profileById.size,
      });
    }

    const lastOrder = orders[orders.length - 1];
    const nextBefore =
      orders.length === limit && typeof lastOrder?.created_at === 'string'
        ? lastOrder.created_at
        : null;

    const response = jsonOk(
      orders.map((order) => {
        const customer = profileById.get(String(order.customer_id ?? ''));
        const serviceType = serviceTypeById.get(Number(order.service_type_id));
        const address = addressById.get(String(order.address_id ?? ''));
        const orderStatus = upper(order.status);

        const reveal =
          ACTIVE_CONTACT_STATUSES.has(orderStatus) ||
          (orderStatus === 'ASSIGNED' && Boolean(order.accepted_at));

        const needsResponse =
          orderStatus === 'ASSIGNED' && !order.accepted_at;

        const assignedMs =
          typeof order.assigned_at === 'string'
            ? Date.parse(order.assigned_at)
            : Number.NaN;

        const respondBy =
          needsResponse &&
          Number.isFinite(assignedMs) &&
          Number.isFinite(responseSeconds) &&
          responseSeconds > 0
            ? new Date(assignedMs + responseSeconds * 1000).toISOString()
            : null;

        const snapshot = getSnapshot(order);
        const { full: fullAddress, coarse: coarseAddress } = buildAddress(
          address,
          snapshot,
        );

        const area = address?.area ?? address?.line2 ?? null;

        return {
          ...redact(order, reveal),

          // Explicitly set these fields to null while private contact is hidden.
          // This preserves the existing client response contract.
          address: reveal ? order.address ?? null : null,
          address_line: reveal ? order.address_line ?? null : null,
          address_snapshot: reveal ? order.address_snapshot ?? null : null,
          contact_phone: reveal ? order.contact_phone ?? null : null,
          lat: reveal ? order.lat ?? null : null,
          lng: reveal ? order.lng ?? null : null,

          booking_id: order.order_number ?? order.booking_id ?? order.id,

          service_type_label:
            text(order.service_type) ??
            text(order.service_type_key) ??
            text(serviceType?.name) ??
            text(serviceType?.key) ??
            'Service',

          customer_name:
            text(customer?.full_name) ??
            text(order.customer_name) ??
            text(order.contact_name),

          customer_phone: reveal
            ? text(customer?.phone) ??
              text(order.contact_phone) ??
              text(order.customer_phone)
            : null,

          customer_city:
            text(customer?.city) ?? text(address?.city) ?? null,

          address_text: reveal ? fullAddress : coarseAddress,

          delivery_address: address
            ? {
                label: text(address.label),
                house_flat: reveal
                  ? text(address.house_flat) ?? text(address.line1)
                  : null,
                area: text(area),
                landmark: reveal ? text(address.landmark) : null,
                city: text(address.city),
                state: text(address.state),
                pincode: reveal ? text(address.pincode) : null,
                lat: reveal ? address.lat ?? null : null,
                lng: reveal ? address.lng ?? null : null,
              }
            : reveal
              ? order.address_snapshot ?? null
              : null,

          needs_response: needsResponse,
          respond_by: respondBy,
        };
      }),
    );

    try {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Vary', 'Cookie, Authorization');
      if (nextBefore) {
        response.headers.set('X-Next-Before', nextBefore);
      }
    } catch {
      // Headers are convenience metadata; preserve the response body.
    }

    return response;
  } catch (error) {
    // Avoid logging the full request URL or customer/order payload.
    console.error('[supplier/orders] unexpected failure', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return jsonErr('Could not load your orders. Please try again.', 500);
  }
}










// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';
// import { getDispatchResponseSeconds } from '@/lib/dispatch';

// /**
//  * GET /api/supplier/orders
//  *
//  * Orders assigned to the signed-in supplier, newest first, enriched with the
//  * delivery contact and address (loaded server-side with the service client,
//  * because customer profiles are protected by RLS).
//  *
//  * Query params (all optional)
//  *   status  filter by order status, e.g. ASSIGNED (case-insensitive)
//  *   limit   page size, 1–200, default 100
//  *   before  ISO timestamp; returns orders created before it (for "load more")
//  *
//  * Privacy: a customer's phone number and exact address are only returned while
//  * the supplier is actually working the order (see CONTACT_STATUSES). Earlier
//  * (not yet accepted) and finished orders get the area and city only.
//  *
//  * Future-proof privacy: instead of trusting a fixed list of columns, the order row is passed
//  * through redact(), which removes anything that looks like a secret (OTP codes, tokens, PINs)
//  * ALWAYS, and anything that looks like private contact data (phone, email, coordinates,
//  * address snapshot) unless the supplier is working the order. A column added to `orders` next
//  * year therefore cannot leak by accident.
//  *
//  * Paging: when a full page is returned, the X-Next-Before response header holds the value to
//  * send as `before` for the next page.
//  *
//  * Added fields (existing fields are unchanged):
//  *   needs_response  true while an offer is waiting for this supplier to accept
//  *   respond_by      ISO deadline for that offer (assigned_at + dispatch_response_seconds),
//  *                   so the app can show a countdown instead of the offer silently vanishing
//  *
//  * Responses: 200 [order…] · 400 bad query · 403 not a supplier · 500/502 failures (logged, not leaked)
//  */

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic'; // per-user data, never cached

// const DEFAULT_LIMIT = 100;
// const MAX_LIMIT = 200;

// /** Statuses during which the supplier may see the customer's phone and exact address. */
// const ACTIVE_CONTACT_STATUSES = new Set(['IN_PROGRESS']);

// type Row = Record<string, unknown>;

// const text = (v: unknown): string | null =>
//   typeof v === 'string' && v.trim() ? v.trim() : null;

// /** Never sent to a supplier, whatever the order status (customer verification codes, tokens, PINs, secrets). */
// const SECRET_KEY = /(^otp$|otp_code|otp_hash|verification_code|service_code|delivery_code|^pin$|secret|password|token)/i;
// /** Private contact data: sent only while the supplier is working the order. */
// const PRIVATE_KEY = /(phone|email|landmark|pincode|postal|latitude|longitude|^lat$|^lng$|snapshot|^address$|address_line)/i;

// /** Copy of the order row without secrets, and without private contact data unless `reveal` is true. */
// function redact(order: Row, reveal: boolean): Row {
//   const out: Row = {};
//   for (const [key, value] of Object.entries(order)) {
//     if (SECRET_KEY.test(key)) continue;
//     if (!reveal && PRIVATE_KEY.test(key)) continue;
//     out[key] = value;
//   }
//   return out;
// }

// const join = (parts: unknown[]): string =>
//   parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim()).join(', ');

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

//   const params = new URL(req.url).searchParams;

//   const status = params.get('status')?.trim().toUpperCase();
//   if (status && !/^[A-Z_]{3,30}$/.test(status)) return jsonErr('Invalid status filter.', 400);

//   const limitRaw = Number(params.get('limit') ?? DEFAULT_LIMIT);
//   const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;

//   const before = params.get('before');
//   if (before && Number.isNaN(Date.parse(before))) return jsonErr('Invalid "before" timestamp.', 400);

//   try {
//     let q = auth.ctx.supabase
//       .from('orders')
//       .select('*')
//       .eq('supplier_id', auth.ctx.profile.id)
//       .order('created_at', { ascending: false })
//       .limit(limit);
//     if (status) q = q.eq('status', status);
//     if (before) q = q.lt('created_at', before);

//     const { data, error } = await q;
//     if (error) {
//       console.error('[supplier/orders] list failed', error.message);
//       return jsonErr('Could not load your orders. Please try again.', 500);
//     }

//     const orders = (data ?? []) as Row[];
//     if (orders.length === 0) return jsonOk([]);

//     const service = createServiceClient();
//     const customerIds = [...new Set(orders.map((o) => String(o.customer_id ?? '')).filter(Boolean))];
//     const serviceTypeIds = [
//       ...new Set(orders.map((o) => Number(o.service_type_id)).filter((n) => Number.isInteger(n) && n > 0)),
//     ];
//     const addressIds = [...new Set(orders.map((o) => String(o.address_id ?? '')).filter(Boolean))];

//     // Only needed when at least one offer is waiting for an answer.
//     const hasOffers = orders.some(
//       (o) => String(o.status ?? '').toUpperCase() === 'ASSIGNED' && !o.accepted_at && Boolean(o.assigned_at),
//     );

//     const [profilesResult, serviceTypesResult, addressesResult, responseSeconds] = await Promise.all([
//       customerIds.length
//         ? service.from('profiles').select('id, full_name, phone, city').in('id', customerIds)
//         : Promise.resolve({ data: [], error: null }),
//       serviceTypeIds.length
//         ? service.from('service_types').select('id, key, name').in('id', serviceTypeIds)
//         : Promise.resolve({ data: [], error: null }),
//       addressIds.length
//         ? service
//             .from('addresses')
//             .select('id, label, house_flat, area, line1, line2, city, state, pincode, landmark, lat, lng')
//             .in('id', addressIds)
//         : Promise.resolve({ data: [], error: null }),
//       hasOffers ? getDispatchResponseSeconds() : Promise.resolve(0),
//     ]);

//     // Contact details are the point of this endpoint: fail loudly if they are missing.
//     if (profilesResult.error) {
//       console.error('[supplier/orders] customer contact lookup failed', profilesResult.error);
//       return jsonErr('Unable to load delivery contact details right now', 502);
//     }
//     if (serviceTypesResult.error) {
//       // Service labels are optional; keep the order visible with its stored service key.
//       console.error('[supplier/orders] service types lookup failed', serviceTypesResult.error);
//     }
//     if (addressesResult.error) {
//       console.error('[supplier/orders] addresses lookup failed', addressesResult.error);
//       // Do not silently return blank delivery details for an active accepted job.
//       const needsExactAddress = orders.some((order) => {
//         const s = String(order.status ?? '').toUpperCase();
//         return s === 'IN_PROGRESS' || (s === 'ASSIGNED' && Boolean(order.accepted_at));
//       });
//       if (needsExactAddress) {
//         return jsonErr('Unable to load delivery address details. Please retry.', 502);
//       }
//     }

//     const profileById = new Map((profilesResult.data ?? []).map((p) => [String(p.id), p]));
//     const serviceTypeById = new Map((serviceTypesResult.data ?? []).map((s) => [Number(s.id), s]));
//     const addressById = new Map((addressesResult.data ?? []).map((a) => [String(a.id), a]));

//     if (profileById.size < customerIds.length) {
//       // Helps diagnose "Customer: —" — orders whose customer_id has no matching profile row.
//       console.warn('[supplier/orders] customers without a profile', {
//         orders: customerIds.length,
//         profiles: profileById.size,
//       });
//     }

//     const nextBefore =
//       orders.length === limit && typeof orders[orders.length - 1]?.created_at === 'string'
//         ? (orders[orders.length - 1].created_at as string)
//         : null;

//     const response = jsonOk(
//       orders.map((order) => {
//         const customer = profileById.get(String(order.customer_id ?? ''));
//         const serviceType = serviceTypeById.get(Number(order.service_type_id));
//         const address = addressById.get(String(order.address_id ?? ''));
//         const orderStatus = String(order.status ?? '').toUpperCase();
//         // Reveal exact contact only after supplier acceptance or while work is in progress.
//         const reveal = ACTIVE_CONTACT_STATUSES.has(orderStatus) ||
//           (orderStatus === 'ASSIGNED' && Boolean(order.accepted_at));

//         const needsResponse = orderStatus === 'ASSIGNED' && !order.accepted_at;
//         const assignedMs = typeof order.assigned_at === 'string' ? Date.parse(order.assigned_at) : NaN;
//         const respondBy =
//           needsResponse && Number.isFinite(assignedMs) && responseSeconds > 0
//             ? new Date(assignedMs + responseSeconds * 1000).toISOString()
//             : null;

//         const area = address?.area ?? address?.line2;
//         const snapshot = (order.address_snapshot && typeof order.address_snapshot === 'object')
//           ? order.address_snapshot as Record<string, unknown>
//           : {};
//         const fullAddress = address
//           ? join([address.house_flat ?? address.line1, area, address.landmark, address.city, address.state, address.pincode])
//           : join([snapshot.house_flat, snapshot.line1, snapshot.area, snapshot.landmark, snapshot.city, snapshot.state, snapshot.pincode, snapshot.formatted_address, snapshot.full_address]);
//         const coarseAddress = address
//           ? join([area, address.city])
//           : join([snapshot.area, snapshot.city]);

//         return {
//           ...redact(order, reveal),
//           // Fields the client already relies on keep their shape: null while hidden.
//           address: reveal ? order.address ?? null : null,
//           address_line: reveal ? order.address_line ?? null : null,
//           address_snapshot: reveal ? order.address_snapshot ?? null : null,
//           contact_phone: reveal ? order.contact_phone ?? null : null,
//           lat: reveal ? order.lat ?? null : null,
//           lng: reveal ? order.lng ?? null : null,
//           booking_id: order.order_number ?? order.booking_id ?? order.id,
//           service_type_label:
//             order.service_type ?? order.service_type_key ?? serviceType?.name ?? serviceType?.key ?? 'Service',
//           // null (not a '—' string) when unknown, so the UI chooses its own placeholder.
//           customer_name: text(customer?.full_name) ?? text(order.customer_name) ?? text(order.contact_name),
//           customer_phone: reveal
//             ? text(customer?.phone) ?? text(order.contact_phone) ?? text(order.customer_phone)
//             : null,
//           customer_city: customer?.city ?? address?.city ?? null,
//           address_text: (reveal ? fullAddress : coarseAddress) || null,
//           delivery_address: address
//             ? {
//                 label: address.label ?? null,
//                 house_flat: reveal ? address.house_flat ?? address.line1 ?? null : null,
//                 area: area ?? null,
//                 landmark: reveal ? address.landmark ?? null : null,
//                 city: address.city ?? null,
//                 state: address.state ?? null,
//                 pincode: reveal ? address.pincode ?? null : null,
//                 lat: reveal ? address.lat ?? null : null,
//                 lng: reveal ? address.lng ?? null : null,
//               }
//             : reveal
//               ? order.address_snapshot ?? null
//               : null,
//           needs_response: needsResponse,
//           respond_by: respondBy,
//           // total_amount, can_count, payment_* and schedule fields come through from the order.
//         };
//       }),
//     );

//     try {
//       response.headers.set('Cache-Control', 'private, no-store');
//       if (nextBefore) response.headers.set('X-Next-Before', nextBefore);
//     } catch {
//       // Headers are a convenience; the body is what matters.
//     }
//     return response;
//   } catch (err) {
//     console.error('[supplier/orders] unexpected failure', err instanceof Error ? err.message : err);
//     return jsonErr('Could not load your orders. Please try again.', 500);
//   }
// }









// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';

// /**
//  * GET /api/supplier/orders
//  *
//  * Orders assigned to the signed-in supplier, newest first, enriched with the
//  * delivery contact and address (loaded server-side with the service client,
//  * because customer profiles are protected by RLS).
//  *
//  * Query params (all optional)
//  *   status  filter by order status, e.g. ASSIGNED (case-insensitive)
//  *   limit   page size, 1–200, default 100
//  *   before  ISO timestamp; returns orders created before it (for "load more")
//  *
//  * Privacy: a customer's phone number and exact address are only returned while
//  * the supplier is actually working the order (see CONTACT_STATUSES). Earlier
//  * (not yet accepted) and finished orders get the area and city only.
//  *
//  * Responses: 200 [order…] · 400 bad query · 403 not a supplier · 500/502 failures (logged, not leaked)
//  */

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic'; // per-user data, never cached

// const DEFAULT_LIMIT = 100;
// const MAX_LIMIT = 200;

// /** Statuses during which the supplier may see the customer's phone and exact address. */
// const ACTIVE_CONTACT_STATUSES = new Set(['IN_PROGRESS']);

// type Row = Record<string, unknown>;

// const text = (v: unknown): string | null =>
//   typeof v === 'string' && v.trim() ? v.trim() : null;

// const join = (parts: unknown[]): string =>
//   parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim()).join(', ');

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

//   const params = new URL(req.url).searchParams;

//   const status = params.get('status')?.trim().toUpperCase();
//   if (status && !/^[A-Z_]{3,30}$/.test(status)) return jsonErr('Invalid status filter.', 400);

//   const limitRaw = Number(params.get('limit') ?? DEFAULT_LIMIT);
//   const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;

//   const before = params.get('before');
//   if (before && Number.isNaN(Date.parse(before))) return jsonErr('Invalid "before" timestamp.', 400);

//   try {
//     let q = auth.ctx.supabase
//       .from('orders')
//       .select('*')
//       .eq('supplier_id', auth.ctx.profile.id)
//       .order('created_at', { ascending: false })
//       .limit(limit);
//     if (status) q = q.eq('status', status);
//     if (before) q = q.lt('created_at', before);

//     const { data, error } = await q;
//     if (error) {
//       console.error('[supplier/orders] list failed', error.message);
//       return jsonErr('Could not load your orders. Please try again.', 500);
//     }

//     const orders = (data ?? []) as Row[];
//     if (orders.length === 0) return jsonOk([]);

//     const service = createServiceClient();
//     const customerIds = [...new Set(orders.map((o) => String(o.customer_id ?? '')).filter(Boolean))];
//     const serviceTypeIds = [
//       ...new Set(orders.map((o) => Number(o.service_type_id)).filter((n) => Number.isInteger(n) && n > 0)),
//     ];
//     const addressIds = [...new Set(orders.map((o) => String(o.address_id ?? '')).filter(Boolean))];

//     const [profilesResult, serviceTypesResult, addressesResult] = await Promise.all([
//       customerIds.length
//         ? service.from('profiles').select('id, full_name, phone, city').in('id', customerIds)
//         : Promise.resolve({ data: [], error: null }),
//       serviceTypeIds.length
//         ? service.from('service_types').select('id, key, name').in('id', serviceTypeIds)
//         : Promise.resolve({ data: [], error: null }),
//       addressIds.length
//         ? service
//             .from('addresses')
//             .select('id, label, house_flat, area, line1, line2, city, state, pincode, landmark, lat, lng')
//             .in('id', addressIds)
//         : Promise.resolve({ data: [], error: null }),
//     ]);

//     // Contact details are the point of this endpoint: fail loudly if they are missing.
//     if (profilesResult.error) {
//       console.error('[supplier/orders] customer contact lookup failed', profilesResult.error);
//       return jsonErr('Unable to load delivery contact details right now', 502);
//     }
//     if (serviceTypesResult.error) {
//       // Service labels are optional; keep the order visible with its stored service key.
//       console.error('[supplier/orders] service types lookup failed', serviceTypesResult.error);
//     }
//     if (addressesResult.error) {
//       console.error('[supplier/orders] addresses lookup failed', addressesResult.error);
//       // Do not silently return blank delivery details for an active accepted job.
//       const needsExactAddress = orders.some((order) => {
//         const status = String(order.status ?? '').toUpperCase();
//         return status === 'IN_PROGRESS' || (status === 'ASSIGNED' && Boolean(order.accepted_at));
//       });
//       if (needsExactAddress) {
//         return jsonErr('Unable to load delivery address details. Please retry.', 502);
//       }
//     }

//     const profileById = new Map((profilesResult.data ?? []).map((p) => [String(p.id), p]));
//     const serviceTypeById = new Map((serviceTypesResult.data ?? []).map((s) => [Number(s.id), s]));
//     const addressById = new Map((addressesResult.data ?? []).map((a) => [String(a.id), a]));

//     if (profileById.size < customerIds.length) {
//       // Helps diagnose "Customer: —" — orders whose customer_id has no matching profile row.
//       console.warn('[supplier/orders] customers without a profile', {
//         orders: customerIds.length,
//         profiles: profileById.size,
//       });
//     }

//     return jsonOk(
//       orders.map((order) => {
//         const customer = profileById.get(String(order.customer_id ?? ''));
//         const serviceType = serviceTypeById.get(Number(order.service_type_id));
//         const address = addressById.get(String(order.address_id ?? ''));
//         const orderStatus = String(order.status ?? '').toUpperCase();
//         // Reveal exact contact only after supplier acceptance or while work is in progress.
//         const reveal = ACTIVE_CONTACT_STATUSES.has(orderStatus) ||
//           (orderStatus === 'ASSIGNED' && Boolean(order.accepted_at));

//         const area = address?.area ?? address?.line2;
//         const snapshot = (order.address_snapshot && typeof order.address_snapshot === 'object')
//           ? order.address_snapshot as Record<string, unknown>
//           : {};
//         const fullAddress = address
//           ? join([address.house_flat ?? address.line1, area, address.landmark, address.city, address.state, address.pincode])
//           : join([snapshot.house_flat, snapshot.line1, snapshot.area, snapshot.landmark, snapshot.city, snapshot.state, snapshot.pincode, snapshot.formatted_address, snapshot.full_address]);
//         const coarseAddress = address
//           ? join([area, address.city])
//           : join([snapshot.area, snapshot.city]);

//         return {
//           ...order,
//           // Remove potentially sensitive legacy/snapshot fields inherited from ...order.
//           address: reveal ? order.address ?? null : null,
//           address_line: reveal ? order.address_line ?? null : null,
//           address_snapshot: reveal ? order.address_snapshot ?? null : null,
//           contact_phone: reveal ? order.contact_phone ?? null : null,
//           lat: reveal ? order.lat ?? null : null,
//           lng: reveal ? order.lng ?? null : null,
//           booking_id: order.order_number ?? order.booking_id ?? order.id,
//           service_type_label:
//             order.service_type ?? order.service_type_key ?? serviceType?.name ?? serviceType?.key ?? 'Service',
//           // null (not a '—' string) when unknown, so the UI chooses its own placeholder.
//           customer_name: text(customer?.full_name) ?? text(order.customer_name) ?? text(order.contact_name),
//           customer_phone: reveal
//             ? text(customer?.phone) ?? text(order.contact_phone) ?? text(order.customer_phone)
//             : null,
//           customer_city: customer?.city ?? address?.city ?? null,
//           address_text: (reveal ? fullAddress : coarseAddress) || null,
//           delivery_address: address
//             ? {
//                 label: address.label ?? null,
//                 house_flat: reveal ? address.house_flat ?? address.line1 ?? null : null,
//                 area: area ?? null,
//                 landmark: reveal ? address.landmark ?? null : null,
//                 city: address.city ?? null,
//                 state: address.state ?? null,
//                 pincode: reveal ? address.pincode ?? null : null,
//                 lat: reveal ? address.lat ?? null : null,
//                 lng: reveal ? address.lng ?? null : null,
//               }
//             : reveal
//               ? order.address_snapshot ?? null
//               : null,
//           // total_amount, can_count, payment_* and schedule fields come through from the order.
//         };
//       }),
//     );
//   } catch (err) {
//     console.error('[supplier/orders] unexpected failure', err instanceof Error ? err.message : err);
//     return jsonErr('Could not load your orders. Please try again.', 500);
//   }
// }
