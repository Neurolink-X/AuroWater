import { NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { CITIES } from '@/lib/marketing-pricing';

export const revalidate = 300;

type PublicCity = { name: string; status: 'available' | 'limited' | 'coming-soon' };

const FALLBACK: PublicCity[] = CITIES.map((city) => ({
  name: city.name,
  status: city.status === 'live' ? 'available' : 'coming-soon',
}));

function normalizeCity(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

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

    const byCity = new Map<string, { name: string; statuses: Set<string> }>();
    for (const row of data ?? []) {
      if (typeof row.city !== 'string' || typeof row.status !== 'string') continue;
      const name = normalizeCity(row.city);
      if (!name || name.length > 100) continue;
      const key = name.toLocaleLowerCase('en-IN');
      const existing = byCity.get(key) ?? { name, statuses: new Set<string>() };
      existing.statuses.add(row.status);
      byCity.set(key, existing);
    }

    const cities: PublicCity[] = [...byCity.values()]
      .map(({ name, statuses }) => ({
        name,
        status: statuses.has('AVAILABLE')
          ? 'available' as const
          : statuses.has('LIMITED')
            ? 'limited' as const
            : 'coming-soon' as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en-IN'));

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
