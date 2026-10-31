import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { CITIES } from '@/lib/marketing-pricing';
import { summarizePublicCities } from '@/lib/public-city-status';

export const revalidate = 300;

type PublicCity = { name: string; status: 'available' | 'limited' | 'coming-soon' };

const FALLBACK: PublicCity[] = CITIES.map((city) => ({
  name: city.name,
  status: city.status === 'live' ? 'available' : 'coming-soon',
}));

/**
 * Public discovery only; not an authorization or serviceability decision.
 * Booking must still verify the exact address and service against the DB.
 */
export async function GET() {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('service_zones')
      .select('city,status')
      .limit(1000);

    if (error) throw error;

    const cities = summarizePublicCities(data ?? []);

    return NextResponse.json(
      { cities: cities.length ? cities : FALLBACK, source: cities.length ? 'zones' : 'fallback' },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json(
      { cities: FALLBACK, source: 'fallback' },
      { headers: { 'Cache-Control': 'public, s-maxage=60' } },
    );
  }
}
