import { createServiceClient } from '@/utils/supabase/server';

/**
 * Booking readiness checks only the customer's requested CITY + exact approved service.
 * Device GPS alone cannot override a professional's registered operating city.
 * This is a booking-time safety check; actual assignment still uses atomic dispatch.
 */
export const SPECIALIST_BOOKING_SERVICES = new Set([
  'plumbing', 'ro_service', 'borewell', 'motor_pump', 'tank_cleaning',
]);

type Readiness = { ok: true } | { ok: false; unavailable: boolean; message: string };

const canonical = (value: unknown) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
const numberOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const distanceKm = (la: number, lo: number, lb: number, lon: number) => {
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const d1 = toRad(lb - la), d2 = toRad(lon - lo);
  const a = Math.sin(d1/2) ** 2 + Math.cos(toRad(la)) * Math.cos(toRad(lb)) * Math.sin(d2/2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Never assume "city active" means that a qualified worker is available. */
export async function checkLocalSpecialistBooking(
  service: string,
  requestedCity: unknown,
  latitude?: number | null,
  longitude?: number | null,
): Promise<Readiness> {
  if (!SPECIALIST_BOOKING_SERVICES.has(service)) return { ok: true };
  const city = canonical(requestedCity);
  if (!city) return { ok: false, unavailable: true, message: 'Please select a valid service city and address before booking.' };

  try {
    const db = createServiceClient();
    // City must match; do not select a distant worker based solely on their mobile GPS.
    const { data: people, error: profileError } = await db.from('profiles')
      .select('id,city,current_lat,current_lng')
      .eq('role','technician').eq('status','active').eq('is_active',true)
      .eq('verification_status','approved')
      .in('availability_status',['available','online'])
      .ilike('city', city.replace(/[\\%_]/g, '\\$&'))
      .limit(500);
    if (profileError) throw profileError;
    const candidates = (people ?? []).filter(p=>canonical(p.city)===city);
    if (candidates.length === 0) return { ok: false, unavailable: true, message: `No verified local professional is available for this service in ${String(requestedCity).trim()} yet. No booking or payment was created. Choose another address in a supported area, check coverage, or contact support.` };

    const ids = candidates.map(p=>String(p.id));
    const { data: skills, error: skillError } = await db.from('technician_service_capabilities')
      .select('technician_id')
      .in('technician_id',ids).eq('service_key',service).eq('status','approved');
    if (skillError) throw skillError;
    const approvedIds = new Set((skills ?? []).map(s=>String(s.technician_id)));
    const { data: config, error: configError } = await db.from('settings')
      .select('value').eq('key','service_radius_km').maybeSingle();
    if (configError) throw configError;
    const radius = Number(config?.value);
    const radiusKm = Number.isFinite(radius) && radius > 0 ? Math.min(radius,100) : 10;
    const hasCustomerPoint = typeof latitude === 'number' && Number.isFinite(latitude) &&
      typeof longitude === 'number' && Number.isFinite(longitude);

    const found = candidates.some(p=>{
      if (!approvedIds.has(String(p.id))) return false;
      const techLat=numberOrNull(p.current_lat),techLng=numberOrNull(p.current_lng);
      // If location is missing, the dispatch engine uses verified same-city fallback.
      if (!hasCustomerPoint || techLat===null || techLng===null) return true;
      return distanceKm(latitude,longitude,techLat,techLng)<=radiusKm;
    });
    if (!found) return { ok: false, unavailable: true, message: `No approved ${service.replace(/_/g,' ')} specialist is currently available near this address in ${String(requestedCity).trim()}. Your booking has not been placed. Try another nearby address or contact support for availability.` };
    return { ok: true };
  } catch (err) {
    console.error('[booking/specialist-readiness] eligibility verification failed', { code: (err as { code?: string })?.code });
    return { ok: false, unavailable: false, message: 'We could not verify a local specialist right now. Your booking has not been placed; please retry shortly.' };
  }
}
