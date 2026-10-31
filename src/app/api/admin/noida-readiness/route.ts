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
      db.from('service_zones').select('slug, status, pincodes').ilike('slug', 'noida%').limit(30),
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
    const readyZones = (zones ?? []).filter((z) => String(z.status).toUpperCase() === 'AVAILABLE' && Array.isArray(z.pincodes) && z.pincodes.length > 0);
    const ready = readyZones.length > 0 && readySuppliers > 0;
    return jsonOk({
      city: 'Noida',
      launch_ready: ready,
      scope: 'Verified eligible Noida suppliers and active pilot zones only; not citywide coverage',
      verified_suppliers: ids.length,
      online_stocked_suppliers: readySuppliers,
      available_pilot_zones: readyZones.map((z) => z.slug),
      missing: [
        ...(readyZones.length ? [] : ['An available pilot service zone with configured delivery PIN codes']),
        ...(readySuppliers ? [] : ['At least one approved online Noida supplier with free stock']),
      ],
      note: 'Do not advertise citywide availability. Final coverage and dispatch eligibility must be checked for each customer address and PIN code.',
    });
  } catch (error) {
    console.error('[noida-readiness] unexpected error', error instanceof Error ? error.name : 'unknown');
    return jsonErr('Noida readiness could not be checked.', 503);
  }
}
