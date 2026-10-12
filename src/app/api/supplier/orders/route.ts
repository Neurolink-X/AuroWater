import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

/**
 * GET /api/supplier/orders
 *
 * Orders assigned to the signed-in supplier, newest first, enriched with the
 * delivery contact and address (loaded server-side with the service client,
 * because customer profiles are protected by RLS).
 *
 * Query params (all optional)
 *   status  filter by order status, e.g. ASSIGNED (case-insensitive)
 *   limit   page size, 1–200, default 100
 *   before  ISO timestamp; returns orders created before it (for "load more")
 *
 * Privacy: a customer's phone number and exact address are only returned while
 * the supplier is actually working the order (see CONTACT_STATUSES). Earlier
 * (not yet accepted) and finished orders get the area and city only.
 *
 * Responses: 200 [order…] · 400 bad query · 403 not a supplier · 500/502 failures (logged, not leaked)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // per-user data, never cached

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/** Statuses during which the supplier may see the customer's phone and exact address. */
const CONTACT_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS']);

type Row = Record<string, unknown>;

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const join = (parts: unknown[]): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim()).join(', ');

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const params = new URL(req.url).searchParams;

  const status = params.get('status')?.trim().toUpperCase();
  if (status && !/^[A-Z_]{3,30}$/.test(status)) return jsonErr('Invalid status filter.', 400);

  const limitRaw = Number(params.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;

  const before = params.get('before');
  if (before && Number.isNaN(Date.parse(before))) return jsonErr('Invalid "before" timestamp.', 400);

  try {
    let q = auth.ctx.supabase
      .from('orders')
      .select('*')
      .eq('supplier_id', auth.ctx.profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) q = q.eq('status', status);
    if (before) q = q.lt('created_at', before);

    const { data, error } = await q;
    if (error) {
      console.error('[supplier/orders] list failed', error.message);
      return jsonErr('Could not load your orders. Please try again.', 500);
    }

    const orders = (data ?? []) as Row[];
    if (orders.length === 0) return jsonOk([]);

    const service = createServiceClient();
    const customerIds = [...new Set(orders.map((o) => String(o.customer_id ?? '')).filter(Boolean))];
    const serviceTypeIds = [
      ...new Set(orders.map((o) => Number(o.service_type_id)).filter((n) => Number.isInteger(n) && n > 0)),
    ];
    const addressIds = [...new Set(orders.map((o) => String(o.address_id ?? '')).filter(Boolean))];

    const [profilesResult, serviceTypesResult, addressesResult] = await Promise.all([
      customerIds.length
        ? service.from('profiles').select('id, full_name, phone, city').in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      serviceTypeIds.length
        ? service.from('service_types').select('id, key, name').in('id', serviceTypeIds)
        : Promise.resolve({ data: [], error: null }),
      addressIds.length
        ? service
            .from('addresses')
            .select('id, label, house_flat, area, line1, line2, city, state, pincode, landmark, lat, lng')
            .in('id', addressIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Contact details are the point of this endpoint: fail loudly if they are missing.
    if (profilesResult.error) {
      console.error('[supplier/orders] customer contact lookup failed', profilesResult.error);
      return jsonErr('Unable to load delivery contact details right now', 502);
    }
    // Labels and addresses degrade gracefully, but are never swallowed silently.
    if (serviceTypesResult.error) console.error('[supplier/orders] service types lookup failed', serviceTypesResult.error);
    if (addressesResult.error) console.error('[supplier/orders] addresses lookup failed', addressesResult.error);

    const profileById = new Map((profilesResult.data ?? []).map((p) => [String(p.id), p]));
    const serviceTypeById = new Map((serviceTypesResult.data ?? []).map((s) => [Number(s.id), s]));
    const addressById = new Map((addressesResult.data ?? []).map((a) => [String(a.id), a]));

    if (profileById.size < customerIds.length) {
      // Helps diagnose "Customer: —" — orders whose customer_id has no matching profile row.
      console.warn('[supplier/orders] customers without a profile', {
        orders: customerIds.length,
        profiles: profileById.size,
      });
    }

    return jsonOk(
      orders.map((order) => {
        const customer = profileById.get(String(order.customer_id ?? ''));
        const serviceType = serviceTypeById.get(Number(order.service_type_id));
        const address = addressById.get(String(order.address_id ?? ''));
        const reveal = CONTACT_STATUSES.has(String(order.status ?? '').toUpperCase());

        const area = address?.area ?? address?.line2;
        const fullAddress = address
          ? join([address.house_flat ?? address.line1, area, address.landmark, address.city, address.state, address.pincode])
          : '';
        const coarseAddress = address ? join([area, address.city]) : '';

        return {
          ...order,
          booking_id: order.order_number ?? order.booking_id ?? order.id,
          service_type_label:
            order.service_type ?? order.service_type_key ?? serviceType?.name ?? serviceType?.key ?? 'Service',
          // null (not a '—' string) when unknown, so the UI chooses its own placeholder.
          customer_name: text(customer?.full_name) ?? text(order.customer_name) ?? text(order.contact_name),
          customer_phone: reveal
            ? text(customer?.phone) ?? text(order.contact_phone) ?? text(order.customer_phone)
            : null,
          customer_city: customer?.city ?? address?.city ?? null,
          address_text: (reveal ? fullAddress : coarseAddress) || null,
          delivery_address: address
            ? {
                label: address.label ?? null,
                house_flat: reveal ? address.house_flat ?? address.line1 ?? null : null,
                area: area ?? null,
                landmark: reveal ? address.landmark ?? null : null,
                city: address.city ?? null,
                state: address.state ?? null,
                pincode: address.pincode ?? null,
                lat: reveal ? address.lat ?? null : null,
                lng: reveal ? address.lng ?? null : null,
              }
            : reveal
              ? order.address_snapshot ?? null
              : null,
          // total_amount, can_count, payment_* and schedule fields come through from the order.
        };
      }),
    );
  } catch (err) {
    console.error('[supplier/orders] unexpected failure', err instanceof Error ? err.message : err);
    return jsonErr('Could not load your orders. Please try again.', 500);
  }
}
