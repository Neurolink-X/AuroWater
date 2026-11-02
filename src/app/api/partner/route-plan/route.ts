import { NextRequest } from 'next/server';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';
import { planNearbyRoute, type RouteStop } from '@/lib/routing/slot-safe-route';

export const dynamic = 'force-dynamic';

type AssignedOrder = {
  id: string;
  status: string;
  service_type: string;
  scheduled_at: string | null;
  accepted_at: string | null;
  address_id: string | null;
};
const MAX_STOPS = 30;
const isTechnician = (role: string) => role === 'technician' || role === 'plumber';
const serviceMinutes = (service: string): number =>
  service === 'water_can' ? 8 :
  service === 'borewell' ? 120 :
  service === 'tank_cleaning' ? 90 : 45;

/**
 * Preview only. Provider scoped by authenticated profile, not query parameters.
 * Awaiting acceptance never exposes private addresses; confirmed appointment
 * windows do not exist in the persisted order schema, so no invented slot end.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  const role = String(auth.ctx.profile.role ?? '').toLowerCase();
  if (role !== 'supplier' && !isTechnician(role)) return jsonErr('Provider only', 403);
  const db = createServiceClient();
  const id = auth.ctx.profile.id;
  const field = role === 'supplier' ? 'supplier_id' : 'technician_id';
  const since = new Date(Date.now() - 4 * 3600_000).toISOString();
  const until = new Date(Date.now() + 48 * 3600_000).toISOString();
  const { data, error } = await db.from('orders')
    .select('id,status,service_type,scheduled_at,accepted_at,address_id')
    .eq(field, id).in('status', ['ASSIGNED', 'IN_PROGRESS'])
    .gte('scheduled_at', since).lte('scheduled_at', until)
    .order('scheduled_at', { ascending: true }).limit(MAX_STOPS + 1);
  if (error) return jsonErr('Schedule temporarily unavailable', 503);

  const orders = ((data ?? []) as AssignedOrder[]).slice(0, MAX_STOPS);
  const limited = (data?.length ?? 0) > MAX_STOPS;
  let acceptedIds = new Set<string>();
  if (isTechnician(role) && orders.length) {
    const { data: entries, error: dispatchError } = await db.from('technician_job_dispatch')
      .select('order_id,status')
      .eq('technician_id', id)
      .in('order_id', orders.map(order => order.id))
      .eq('status', 'ACCEPTED');
    if (dispatchError) return jsonErr('Could not confirm accepted job status', 503);
    acceptedIds = new Set((entries ?? []).map(entry => String(entry.order_id)));
  }
  const confirmed = (order: AssignedOrder) =>
    order.status === 'IN_PROGRESS' || Boolean(order.accepted_at) ||
    (isTechnician(role) && acceptedIds.has(order.id));
  const accepted = orders.filter(confirmed);
  const stats = {
    awaiting_acceptance: orders.length - accepted.length,
    accepted: accepted.filter(order => order.status === 'ASSIGNED').length,
    in_progress: accepted.filter(order => order.status === 'IN_PROGRESS').length,
    without_verified_location: 0,
    without_schedule: 0,
    limited,
  };
  const ids = [...new Set(accepted.map(order => order.address_id).filter((value): value is string => Boolean(value)))];
  const addressById = new Map<string, { lat: number | null; lng: number | null; pincode: string | null; area: string | null }>();
  if (ids.length) {
    const {data: addresses, error: addressError} = await db.from('addresses')
      .select('id,lat,lng,pincode,area').in('id', ids).limit(MAX_STOPS);
    if (addressError) return jsonErr('Verified locations unavailable', 503);
    for (const a of addresses ?? []) {
      addressById.set(a.id, {
        lat: a.lat === null ? null : Number(a.lat),
        lng: a.lng === null ? null : Number(a.lng),
        pincode: a.pincode,
        area: a.area,
      });
    }
  }
  const rows = accepted.map(order => {
    const address = order.address_id ? addressById.get(order.address_id) : undefined;
    const start = order.scheduled_at ? Date.parse(order.scheduled_at) : NaN;
    return {
      id: order.id,
      lat: address?.lat ?? null, lng: address?.lng ?? null,
      scheduledAt: Number.isFinite(start) ? new Date(start).toISOString() : null,
      // No reliable slot-end field exists; do NOT manufacture a one-hour promise.
      slotEndAt: null,
      serviceMinutes: serviceMinutes(order.service_type),
      label: [address?.area, address?.pincode].filter(Boolean).join(' · ') || 'Verified location',
    } satisfies RouteStop;
  });
  const result = planNearbyRoute(rows, new Date());
  stats.without_verified_location = result.excluded.length;
  const statusById = new Map(accepted.map(order => [order.id, {
    status: order.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ACCEPTED',
    service: order.service_type,
  }]));
  const response = jsonOk({
    stops: result.stops.map(stop => ({
      order_id: stop.id, sequence: stop.sequence, area: stop.label,
      estimated_arrival: stop.estimatedArrival,
      estimated_travel_km: stop.travelKm,
      scheduled_at: stop.scheduledAt,
      late_risk: stop.lateRisk,
      slot_end_verified: stop.slotEndAt !== null && stop.slotEndAt !== undefined,
      ...statusById.get(stop.id),
    })),
    stats, checked_at: new Date().toISOString(), mode: 'advisory',
    note: limited
      ? 'Showing only the first 30 upcoming jobs. Open Orders for the remaining assignments.'
      : 'Planning estimate only: straight-line distance, no verified traffic or slot-end times. Check customer time slots and navigation before departure.',
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
