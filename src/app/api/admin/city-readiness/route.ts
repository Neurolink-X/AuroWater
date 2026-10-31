import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Admin-only operational indicators for every configured service city.
 * This is deliberately a conservative snapshot, not permission to launch a city:
 * dispatch and checkout must independently validate the customer's exact address.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);
  try {
    const db = createServiceClient();
    const [zoneResult, supplierResult] = await Promise.all([
      db.from('service_zones').select('id,city,name,status,pincodes').order('city').limit(2000),
      db.from('profiles').select('id,city').eq('role', 'supplier').eq('is_active', true)
        .eq('verification_status', 'approved').limit(2000),
    ]);
    if (zoneResult.error || supplierResult.error) {
      console.error('[admin/city-readiness] core read failed', {
        zones: zoneResult.error?.code, suppliers: supplierResult.error?.code,
      });
      return jsonErr('City readiness temporarily unavailable. Please retry.', 503);
    }
    const zones = zoneResult.data ?? [];
    const suppliers = supplierResult.data ?? [];
    const ids = suppliers.map(s => s.id);
    const [settingsResult, stockResult, assignmentsResult] = ids.length
      ? await Promise.all([
          db.from('supplier_settings').select('user_id,is_online').in('user_id', ids),
          db.from('supplier_stock').select('supplier_id,cans_available,reserved_cans,reservation_buffer_cans').in('supplier_id', ids),
          db.from('supplier_zones').select('supplier_id,zone_id').in('supplier_id', ids),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (settingsResult.error || stockResult.error || assignmentsResult.error) {
      console.error('[admin/city-readiness] capacity read failed', {
        settings: settingsResult.error?.code,
        stock: stockResult.error?.code,
        assignments: assignmentsResult.error?.code,
      });
      return jsonErr('Supplier capacity temporarily unavailable. Please retry.', 503);
    }
    const onlineIds = new Set((settingsResult.data ?? []).filter(s => s.is_online).map(s => s.user_id));
    const stockedIds = new Set((stockResult.data ?? []).filter(s =>
      Number(s.cans_available ?? 0) > Number(s.reserved_cans ?? 0) + Number(s.reservation_buffer_cans ?? 0)
    ).map(s => s.supplier_id));
    const readySupplierIds = new Set(ids.filter(id => onlineIds.has(id) && stockedIds.has(id)));
    const assignments = assignmentsResult.data ?? [];
    const normalize = (value: string | null) => (value ?? '').trim().toLocaleLowerCase('en-IN');
    const cityNames = [...new Set(zones.map(z => z.city?.trim()).filter((v): v is string => !!v))];
    const cities = cityNames.map(city => {
      const cityZones = zones.filter(z => normalize(z.city) === normalize(city));
      const citySuppliers = suppliers.filter(s => normalize(s.city) === normalize(city));
      const eligibleZones = cityZones.filter(z =>
        z.status === 'AVAILABLE' && Array.isArray(z.pincodes) && z.pincodes.length > 0);
      const eligibleZoneIds = new Set(eligibleZones.map(z => z.id));
      const linkedSupplierIds = new Set(assignments.filter(a => eligibleZoneIds.has(a.zone_id)).map(a => a.supplier_id));
      const readyAssignedSuppliers = citySuppliers.filter(s =>
        readySupplierIds.has(s.id) && linkedSupplierIds.has(s.id)).length;
      return {
        city,
        zones: cityZones.length,
        available_zones: eligibleZones.length,
        approved_suppliers: citySuppliers.length,
        online_stocked_assigned_suppliers: readyAssignedSuppliers,
        zones_missing_pincodes: cityZones.filter(z =>
          z.status === 'AVAILABLE' && (!Array.isArray(z.pincodes) || z.pincodes.length === 0))
          .map(z => ({ id: z.id, name: z.name })),
        operational_signal: eligibleZones.length > 0 && readyAssignedSuppliers > 0,
      };
    });
    return jsonOk({
      cities,
      checked_at: new Date().toISOString(),
      note: 'A positive operational signal is not citywide launch approval. Confirm service-specific coverage, supplier assignments and exact address at checkout.',
    });
  } catch (error) {
    console.error('[admin/city-readiness] unexpected', error instanceof Error ? error.name : 'unknown');
    return jsonErr('Could not load city readiness.', 503);
  }
}
