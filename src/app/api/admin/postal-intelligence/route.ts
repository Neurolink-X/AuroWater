import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PIN = /^[0-9]{6}$/;
const LIMIT = 100;
const MAX_ZONES = 100;
const MAX_SUPPLIERS = 200;

// Postal identity, active zones and supplier capacity are deliberately separate signals.
// No customer addresses, payment data or supplier identities leave this admin-only API.
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const pin = (req.nextUrl.searchParams.get('pincode') || '').trim();
  if (!PIN.test(pin)) return NextResponse.json({ error: 'Enter an exact 6-digit PIN code' }, { status: 400 });

  try {
    const started = Date.now();
    const db = createServiceClient();
    const [postal, zones] = await Promise.all([
      db.from('pincode_directory')
        .select('pincode,office_name,district,state,lat,lng', { count: 'exact' })
        .eq('pincode', pin).order('office_name').limit(LIMIT),
      db.from('service_zones').select('id,slug,city,city_id,status,services')
        .contains('pincodes', [pin]).limit(MAX_ZONES),
    ]);
    if (postal.error || zones.error) {
      console.error('[postal-intelligence] lookup failure', {
        postal: postal.error?.code, zones: zones.error?.code,
      });
      return NextResponse.json({ error: 'Postal coverage audit could not be verified.' }, { status: 503 });
    }

    const offices = postal.data ?? [];
    const zoneRows = zones.data ?? [];
    const placeCounts = new Map<string, { district: string; state: string; offices: number }>();
    for (const office of offices) {
      const district = String(office.district ?? '').trim();
      const state = String(office.state ?? '').trim();
      if (!district && !state) continue;
      const key = `${district.toLowerCase()}|${state.toLowerCase()}`;
      const prev = placeCounts.get(key);
      placeCounts.set(key, { district, state, offices: (prev?.offices ?? 0) + 1 });
    }

    const liveZones = zoneRows.filter(z => ['AVAILABLE', 'LIMITED'].includes(String(z.status).toUpperCase()));
    const zoneIds = liveZones.map(z => z.id);
    const cityIds = [...new Set(zoneRows.map(z => z.city_id).filter((id): id is string => typeof id === 'string' && !!id))];
    const [linked, cityStatus] = await Promise.all([
      zoneIds.length ? db.from('supplier_zones').select('supplier_id,zone_id,service_keys')
        .in('zone_id', zoneIds).limit(MAX_SUPPLIERS) : Promise.resolve({ data: [], error: null }),
      cityIds.length ? db.from('cities').select('id,name,status').in('id', cityIds).limit(MAX_ZONES)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const capacityVerified = !linked.error && !cityStatus.error &&
      (linked.data?.length ?? 0) < MAX_SUPPLIERS && zoneRows.length < MAX_ZONES;
    if (linked.error || cityStatus.error) {
      console.error('[postal-intelligence] capacity lookup failure', {
        suppliers: linked.error?.code, cities: cityStatus.error?.code,
      });
    }
    const byCityId = new Map((cityStatus.data ?? []).map(c => [c.id, c]));
    // A missing city_id is a legacy zone: never infer city activation from spelling alone.
    const activeZones = liveZones.filter(z => z.city_id && byCityId.get(z.city_id)?.status === 'active');
    const activeZoneIds = new Set(activeZones.map(z => z.id));
    const candidateLinks = (linked.data ?? []).filter(l => activeZoneIds.has(l.zone_id));
    const candidateIds = [...new Set(candidateLinks.map(l => l.supplier_id))];
    const [settings, profiles, stocks] = await Promise.all([
      candidateIds.length ? db.from('supplier_settings').select('user_id,is_online').in('user_id', candidateIds)
        : Promise.resolve({ data: [], error: null }),
      candidateIds.length ? db.from('profiles').select('id,role,is_active,status,verification_status').in('id', candidateIds)
        : Promise.resolve({ data: [], error: null }),
      candidateIds.length ? db.from('supplier_stock').select('supplier_id,cans_available,reserved_cans,reservation_buffer_cans').in('supplier_id', candidateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const capacityComplete = capacityVerified && !settings.error && !profiles.error && !stocks.error &&
      zoneRows.every(z => z.city_id && byCityId.has(z.city_id));
    const online = new Set((settings.data ?? []).filter(s => s.is_online === true).map(s => s.user_id));
    const eligible = new Set((profiles.data ?? []).filter(p =>
      p.role === 'supplier' && p.is_active !== false &&
      String(p.status ?? 'active').toLowerCase() === 'active' &&
      (!p.verification_status || String(p.verification_status).toLowerCase() === 'approved')
    ).map(p => p.id));
    const stocked = new Set((stocks.data ?? []).filter(st =>
      Number(st.cans_available ?? 0) - Number(st.reserved_cans ?? 0) -
        Number(st.reservation_buffer_cans ?? 0) > 0
    ).map(st => st.supplier_id));
    const potentialWaterSuppliers = candidateLinks.filter(link =>
      (!Array.isArray(link.service_keys) || link.service_keys.includes('water_can')) &&
      online.has(link.supplier_id) && eligible.has(link.supplier_id) && stocked.has(link.supplier_id)
    );
    const potentialCount = new Set(potentialWaterSuppliers.map(l => l.supplier_id)).size;

    return NextResponse.json({
      pincode: pin,
      postal_exists: (postal.count ?? 0) > 0,
      post_office_count: postal.count ?? 0,
      postal_result_capped: (postal.count ?? 0) > LIMIT,
      office_preview: offices.slice(0, 15).map(x => ({
        name: x.office_name, district: x.district, state: x.state,
      })),
      districts: [...placeCounts.values()].sort((a, b) => b.offices - a.offices).slice(0, 10),
      conflicting_districts: placeCounts.size > 1,
      coordinate_coverage: {
        sampled: offices.length,
        with_coordinates: offices.filter(x => x.lat !== null && x.lng !== null &&
          Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))).length,
      },
      matching_service_zones: zoneRows.map(z => ({
        slug: z.slug, city: z.city, status: z.status,
        city_status: z.city_id ? byCityId.get(z.city_id)?.status ?? 'unknown' : 'unlinked',
      })),
      available_zones: liveZones.length,
      active_city_zones: activeZones.length,
      potential_water_suppliers: capacityComplete ? potentialCount : null,
      supplier_signal_verified: capacityComplete,
      delivery_bookable: null,
      lookup_ms: Date.now() - started,
      interpretation: 'This is a postal and operational diagnostic, not a booking guarantee. Verify exact address, service eligibility, stock and dispatch atomically at checkout.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[postal-intelligence] unexpected', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Postal intelligence could not be verified.' }, { status: 503 });
  }
}
