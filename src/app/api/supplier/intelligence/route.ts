import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import {
  forecastSupplierStock,
  supplierPerformance,
  groupAcceptedDeliveries,
  rankCoverageOpportunities,
  type SupplierOrderSample,
  type ZoneSample,
} from '@/lib/supplier/intelligence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;

const OWN_LIMIT = 500;
const DEMAND_LIMIT = 500;
const ZONE_LIMIT = 150;
const LINK_LIMIT = 500;
const LOOKBACK_DAYS = 56;

const number = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || !Number.isFinite(n) ? null : n;
};

/**
 * Read-only supplier insights. Auth identity comes exclusively from verified server session.
 * The response NEVER contains customer ids, contact details, residential addresses,
 * other suppliers' identities, or the full postal directory.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const supplierId = auth.ctx.profile.id;
  const start = Date.now();
  const db = createServiceClient();
  const historyFrom = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const demandFrom = new Date(Date.now() - 30 * 86_400_000).toISOString();
  try {
    const [ordersResult, offersResult, settingsResult, stockResult] = await Promise.all([
      db.from('orders')
        .select('id,status,service_type,can_count,created_at,scheduled_at,completed_at,accepted_at,address_id,zone_id')
        .eq('supplier_id', supplierId).gte('created_at', historyFrom)
        .order('created_at', { ascending: false }).limit(OWN_LIMIT + 1),
      db.from('order_dispatch').select('status').eq('supplier_id', supplierId)
        .gte('created_at', historyFrom).limit(OWN_LIMIT + 1),
      db.from('supplier_settings').select('base_lat,base_lng,is_online,pincode')
        .eq('user_id', supplierId).maybeSingle(),
      db.from('supplier_stock').select('cans_available,reserved_cans,reservation_buffer_cans,low_stock_alert')
        .eq('supplier_id', supplierId).maybeSingle(),
    ]);
    if (ordersResult.error || offersResult.error || settingsResult.error || stockResult.error) {
      console.error('[supplier/intelligence] core query failed', {
        orders: ordersResult.error?.code, offers: offersResult.error?.code,
        settings: settingsResult.error?.code, stock: stockResult.error?.code,
      });
      return jsonErr('Your operational insights could not be refreshed. Your orders remain unchanged.', 503);
    }
    const ownTruncated = (ordersResult.data?.length ?? 0) > OWN_LIMIT ||
      (offersResult.data?.length ?? 0) > OWN_LIMIT;
    const own = ((ordersResult.data ?? []).slice(0, OWN_LIMIT)) as SupplierOrderSample[];
    const offers = (offersResult.data ?? []).slice(0, OWN_LIMIT);
    const stock = stockResult.data;
    const forecast = ownTruncated ? null : forecastSupplierStock(own, stock);
    const performance = ownTruncated ? null : supplierPerformance(own, offers);

    // Route batches only include accepted supplier assignments. Addresses are read
    // on the server with the service client but return PIN-level GROUP COUNTS only.
    const routeOrders = own.filter(order =>
      order.service_type === 'water_can' &&
      (order.status === 'IN_PROGRESS' || (order.status === 'ASSIGNED' && order.accepted_at)) &&
      Boolean(order.address_id));
    const ids = [...new Set(routeOrders.map(order => order.address_id).filter((id): id is string => !!id))];
    let pins: Record<string, string> = {};
    let routeComplete = !ownTruncated;
    if (ids.length) {
      const addressResult = await db.from('addresses').select('id,pincode')
        .in('id', ids).limit(OWN_LIMIT + 1);
      if (addressResult.error || (addressResult.data?.length ?? 0) > OWN_LIMIT) {
        routeComplete = false;
      } else {
        pins = Object.fromEntries((addressResult.data ?? []).map(row => [row.id, row.pincode]));
      }
    }
    const batches = routeComplete ? groupAcceptedDeliveries(routeOrders, pins) : [];

    // Opportunity suggestions are city-limited and privacy-thresholded (>=5 unique
    // customers AND >=5 recent bookings per zone). They do not change service zones.
    const city = String(auth.ctx.profile.city ?? '').trim();
    let opportunities: ReturnType<typeof rankCoverageOpportunities> = [];
    let coverageComplete = false;
    if (city.length > 0) {
      const zonesResult = await db.from('service_zones')
        .select('id,name,city,status,center_lat,center_lng,services')
        .ilike('city', city).limit(ZONE_LIMIT + 1);
      if (!zonesResult.error && zonesResult.data && zonesResult.data.length <= ZONE_LIMIT) {
        const zones = zonesResult.data as ZoneSample[];
        const zoneIds = zones.filter(z => ['AVAILABLE', 'LIMITED'].includes(String(z.status).toUpperCase()))
          .map(z => z.id);
        if (zoneIds.length > 0) {
          const [demand, coverage] = await Promise.all([
            db.from('orders').select('zone_id,customer_id,service_type,status')
              .in('zone_id', zoneIds).gte('created_at', demandFrom)
              .limit(DEMAND_LIMIT + 1),
            db.from('supplier_zones').select('zone_id,supplier_id,service_keys')
              .in('zone_id', zoneIds).limit(LINK_LIMIT + 1),
          ]);
          coverageComplete = !demand.error && !coverage.error &&
            (demand.data?.length ?? 0) <= DEMAND_LIMIT &&
            (coverage.data?.length ?? 0) <= LINK_LIMIT;
          const lat = number(settingsResult.data?.base_lat);
          const lng = number(settingsResult.data?.base_lng);
          const location = lat !== null && lng !== null &&
            lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
          opportunities = rankCoverageOpportunities(
            zones, demand.data ?? [], coverage.data ?? [], supplierId, location,
            coverageComplete && Boolean(location),
          );
        } else {
          coverageComplete = true;
        }
      }
    }

    const response = jsonOk({
      checked_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      supplier_online: settingsResult.data?.is_online === true,
      stock: {
        available: number(stock?.cans_available) ?? 0,
        reserved: number(stock?.reserved_cans) ?? 0,
        buffer: number(stock?.reservation_buffer_cans) ?? 0,
        low_stock_alert: number(stock?.low_stock_alert) ?? 0,
      },
      forecast, performance,
      route_groups: batches,
      coverage_opportunities: opportunities,
      data_quality: {
        own_history_complete: !ownTruncated,
        route_groups_complete: routeComplete,
        coverage_sample_complete: coverageComplete,
        forecast_note: 'Planning estimate only; 56-day supplier history, weekday mix and confirmed assignments. No delivery guarantee.',
        coverage_note: '30-day zone demand, >=5 unique customers. No competitor or customer identity is shared. A suggestion requires admin approval.',
        route_note: 'Accepted assignments only. Grouped by postal PIN and broad IST time-of-day, not an optimized navigation route.',
      },
    });
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Vary', 'Authorization, Cookie');
    return response;
  } catch (error) {
    console.error('[supplier/intelligence] unexpected', error instanceof Error ? error.name : 'unknown');
    return jsonErr('Your operational insights could not be verified. Existing orders are unaffected.', 503);
  }
}
