import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PIN = /^[0-9]{6}$/;
const LIMIT = 100;
/** Postal existence != supplier serviceability. Never advertise postal coverage as live delivery. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const pin = (req.nextUrl.searchParams.get('pincode') || '').trim();
  if (!PIN.test(pin)) return NextResponse.json({ error: 'Enter an exact 6-digit PIN code' }, { status: 400 });

  try {
    const db = createServiceClient();
    const [postal, zones] = await Promise.all([
      db.from('pincode_directory')
        .select('pincode,office_name,district,state,lat,lng', { count: 'exact' })
        .eq('pincode', pin).order('office_name').limit(LIMIT),
      db.from('service_zones').select('slug,city,status')
        .contains('pincodes', [pin]).limit(30),
    ]);
    if (postal.error || zones.error) {
      return NextResponse.json({ error: 'Postal coverage audit unavailable' }, { status: 503 });
    }
    const offices = postal.data ?? [];
    const places = new Map<string, { district: string; state: string }>();
    for (const office of offices) {
      const district = String(office.district ?? '').trim();
      const state = String(office.state ?? '').trim();
      if (district || state) places.set(`${district.toLowerCase()}|${state.toLowerCase()}`, { district, state });
    }
    const eligibleZones = (zones.data ?? []).filter(z => String(z.status).toUpperCase() === 'AVAILABLE');
    return NextResponse.json({
      pincode: pin,
      postal_exists: (postal.count ?? 0) > 0,
      post_office_count: postal.count ?? 0,
      office_preview: offices.slice(0, 15).map(x => ({ name: x.office_name, district: x.district, state: x.state })),
      districts: [...places.values()].slice(0, 10),
      coordinate_coverage: {
        sampled: offices.length,
        with_coordinates: offices.filter(x => Number.isFinite(Number(x.lat)) &&
          Number.isFinite(Number(x.lng)) && x.lat !== null && x.lng !== null).length,
      },
      matching_service_zones: zones.data ?? [],
      available_zones: eligibleZones.length,
      delivery_bookable: null,
      interpretation: 'Postal existence and an AVAILABLE zone do not prove live dispatch capacity. Verify supplier status, stock, and exact delivery address before booking.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Postal intelligence temporarily unavailable' }, { status: 503 });
  }
}
