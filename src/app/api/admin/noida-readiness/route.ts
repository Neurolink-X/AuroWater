import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/** Administrative launch gate. A zone flag alone is NOT supply readiness. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  try {
    const db = createServiceClient();
    const [{ data: zones, error: zoneError }, { data: suppliers, error: supplierError }] = await Promise.all([
      db.from('service_zones').select('slug, status, pincodes, is_catch_all').ilike('slug', 'noida%').limit(30),
      db.from('profiles').select('id').eq('role', 'supplier')
        .ilike('city', '%noida%').eq('is_active', true).eq('verification_status', 'approved').limit(500),
    ]);
    if (zoneError || supplierError) {
      console.error('[noida-readiness] base query failed', { zoneCode: zoneError?.code, supplierCode: supplierError?.code });
      return jsonErr('Noida readiness data is unavailable.', 503);
    }
    const ids = (suppliers ?? []).map((s) => s.id);
    const [settings, stock] = ids.length ? await Promise.all([
      db.from('supplier_settings').select('user_id, is_online').in('user_id', ids),
      db.from('supplier_stock').select('supplier_id, cans_available, reserved_cans, reservation_buffer_cans').in('supplier_id', ids),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (settings.error || stock.error) {
      console.error('[noida-readiness] supplier query failed', { settingsCode: settings.error?.code, stockCode: stock.error?.code });
      return jsonErr('Noida supplier readiness is unavailable.', 503);
    }
    const online = new Set((settings.data ?? []).filter((s) => s.is_online).map((s) => s.user_id));
    const stocked = new Set((stock.data ?? []).filter((s) =>
      Number(s.cans_available) > Number(s.reserved_cans) + Number(s.reservation_buffer_cans ?? 0)
    ).map((s) => s.supplier_id));
    const readySuppliers = ids.filter((id) => online.has(id) && stocked.has(id)).length;
    const availableZones = (zones ?? []).filter((z) => String(z.status).toUpperCase() === 'AVAILABLE');
    const citywideCoverageActive = availableZones.some((z) => z.is_catch_all);
    return jsonOk({
      city: 'Noida',
      launch_ready: citywideCoverageActive,
      citywide_coverage_active: citywideCoverageActive,
      dispatch_ready: readySuppliers > 0,
      scope: 'Citywide booking coverage; supplier matching continues after order placement and does not gate order creation.',
      verified_suppliers: ids.length,
      online_stocked_suppliers: readySuppliers,
      available_zones: availableZones.map((z) => z.slug),
      missing: citywideCoverageActive ? [] : ['An AVAILABLE citywide catch-all service zone'],
      note: 'All Noida areas accept requests. Supplier matching and assignment continue through dispatch after order creation.',
    });
  } catch (error) {
    console.error('[noida-readiness] unexpected error', error instanceof Error ? error.name : 'unknown');
    return jsonErr('Noida readiness could not be checked.', 503);
  }
}
