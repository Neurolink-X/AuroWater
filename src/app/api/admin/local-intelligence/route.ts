import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import {
  isDispatchEligibleSupplier,
  normalizePincode,
  summarizeLocalDemand,
  type ServiceZone,
  type SupplierProfile,
  type SupplierZoneLink,
} from '@/lib/local-intelligence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOW_DAYS = 30;
const MAX_ORDERS = 1000;

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const url = new URL(req.url);
  const rawDays = Number(url.searchParams.get('days') ?? WINDOW_DAYS);
  const windowDays = Number.isInteger(rawDays) && rawDays > 0 ? Math.min(rawDays, 90) : WINDOW_DAYS;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const db = createServiceClient();

  const ordersResult = await db
    .from('orders')
    .select('id, created_at, status, supplier_id, total_amount, service_type, address, address_snapshot')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_ORDERS);

  if (ordersResult.error) {
    console.error('[admin/local-intelligence] order query failed', {
      code: ordersResult.error.code,
      message: ordersResult.error.message,
    });
    return jsonErr('Local demand data is temporarily unavailable.', 503);
  }

  const [profilesResult, linksResult, zonesResult] = await Promise.all([
    db.from('profiles')
      .select('id, role, is_active, status, verification_status')
      .eq('role', 'supplier')
      .limit(5000),
    db.from('supplier_zones').select('supplier_id, zone_id, service_keys').limit(10000),
    db.from('service_zones').select('id, city, name, status, pincodes').limit(5000),
  ]);

  const warnings: string[] = [];
  if (profilesResult.error) {
    console.error('[admin/local-intelligence] supplier profiles unavailable', profilesResult.error.code);
    warnings.push('Supplier verification data unavailable; coverage counts are incomplete.');
  }
  if (linksResult.error) {
    console.error('[admin/local-intelligence] supplier-zone mappings unavailable', linksResult.error.code);
    warnings.push('Supplier-area mappings unavailable; coverage-gap signals are incomplete.');
  }
  if (zonesResult.error) {
    console.error('[admin/local-intelligence] service zones unavailable', zonesResult.error.code);
    warnings.push('Service-zone status unavailable; coverage-gap signals are incomplete.');
  }

  const eligibleSupplierIds = new Set(
    ((profilesResult.data ?? []) as SupplierProfile[])
      .filter(isDispatchEligibleSupplier)
      .map((profile) => String(profile.id)),
  );
  const zonesById = new Map(
    ((zonesResult.data ?? []) as ServiceZone[]).map((zone) => [String(zone.id), zone]),
  );
  const mappedSupplierCountByPincode = new Map<string, number>();
  const seenSupplierPin = new Set<string>();

  for (const link of (linksResult.data ?? []) as SupplierZoneLink[]) {
    const supplierId = String(link.supplier_id);
    if (!eligibleSupplierIds.has(supplierId)) continue;
    const zone = zonesById.get(String(link.zone_id));
    if (!zone) continue;
    const zoneStatus = String(zone.status ?? '').trim().toUpperCase();
    // Coverage is only considered operational when the admin has marked the zone Available/Limited.
    if (!['AVAILABLE', 'LIMITED'].includes(zoneStatus)) continue;
    const pins = Array.isArray(zone.pincodes) ? zone.pincodes : [];
    for (const rawPin of pins) {
      const pincode = normalizePincode(rawPin);
      if (!pincode) continue;
      const key = `${supplierId}:${pincode}`;
      if (seenSupplierPin.has(key)) continue;
      seenSupplierPin.add(key);
      mappedSupplierCountByPincode.set(
        pincode,
        (mappedSupplierCountByPincode.get(pincode) ?? 0) + 1,
      );
    }
  }

  const summary = summarizeLocalDemand(
    (ordersResult.data ?? []).map((order) => ({
      id: order.id,
      created_at: order.created_at,
      status: order.status,
      supplier_id: order.supplier_id,
      total_amount: order.total_amount,
      service_type: order.service_type,
      address: order.address,
      address_snapshot: order.address_snapshot,
    })),
    mappedSupplierCountByPincode,
    windowDays,
  );

  return jsonOk({
    ...summary,
    dataLimited: (ordersResult.data?.length ?? 0) >= MAX_ORDERS,
    source: 'orders + admin-approved supplier coverage mappings',
    timezone: 'Asia/Kolkata',
    warnings,
    generatedAt: new Date().toISOString(),
  });
}
