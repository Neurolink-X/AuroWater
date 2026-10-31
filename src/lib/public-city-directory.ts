import type { City, CityStatus } from '@/lib/cities';

/**
 * Centralised public projection of the admin-managed city directory.
 *
 * A city being "active" means the city passed the admin readiness gate.
 * It does NOT imply every PIN code, service type, delivery slot or supplier
 * is available. Booking must continue to call address-level serviceability.
 */
const PUBLIC_STATUSES: readonly CityStatus[] = ['active', 'coming_soon', 'waitlist'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPublicCityStatus(status: unknown): status is CityStatus {
  return typeof status === 'string' && PUBLIC_STATUSES.includes(status as CityStatus);
}

export function normalizePublicCity(input: unknown): City | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (typeof row.name !== 'string' || typeof row.slug !== 'string' ||
      typeof row.id !== 'string' || !isPublicCityStatus(row.status)) return null;

  const name = row.name.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const slug = row.slug.trim().toLowerCase();
  if (name.length < 2 || name.length > 80 || /[<>\u0000-\u001f\u007f]/.test(name) ||
      !SLUG.test(slug) || slug.length > 100) return null;

  const safeNum = (value: unknown, low: number, high: number): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high
      ? value : undefined;

  return {
    id: row.id,
    name,
    slug,
    status: row.status,
    is_featured: row.is_featured === true,
    ...(safeNum(row.sort_order, 0, 100_000) !== undefined
      ? { sort_order: row.sort_order as number } : {}),
    ...(safeNum(row.lat, -90, 90) !== undefined ? { lat: row.lat as number } : {}),
    ...(safeNum(row.lng, -180, 180) !== undefined ? { lng: row.lng as number } : {}),
    ...(safeNum(row.radius_km, 0, 500) !== undefined
      ? { radius_km: row.radius_km as number } : {}),
  };
}

export function mergePublicCityDirectory(
  databaseRows: unknown,
  fallbackRows: readonly City[],
): City[] {
  const directory = new Map<string, City>();
  if (Array.isArray(databaseRows)) {
    for (const entry of databaseRows.slice(0, 500)) {
      const city = normalizePublicCity(entry);
      if (city && !directory.has(city.slug)) directory.set(city.slug, city);
    }
  }

  // Legacy core cities remain discoverable during partial data migrations.
  // Do not promote an admin-disabled city: database state takes precedence.
  for (const candidate of fallbackRows) {
    const city = normalizePublicCity(candidate);
    if (city && !directory.has(city.slug)) directory.set(city.slug, city);
  }

  const priority: Record<CityStatus, number> = {
    active: 0,
    coming_soon: 1,
    waitlist: 2,
  };

  return [...directory.values()].sort((a, b) =>
    priority[a.status] - priority[b.status] ||
    Number(b.is_featured) - Number(a.is_featured) ||
    (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
    a.name.localeCompare(b.name, 'en-IN')
  );
}

/** Do not allow a long city directory to turn into a giant footer. */
export function selectFooterCities(
  cities: readonly City[],
  maxActive = 6,
  maxUpcoming = 2,
): { active: City[]; upcoming: City[]; remaining: number } {
  const active = cities.filter(city => city.status === 'active');
  const upcoming = cities.filter(city => city.status !== 'active');
  const visibleActive = active.slice(0, Math.max(0, maxActive));
  const visibleUpcoming = upcoming.slice(0, Math.max(0, maxUpcoming));
  return {
    active: visibleActive,
    upcoming: visibleUpcoming,
    remaining: Math.max(0, cities.length - visibleActive.length - visibleUpcoming.length),
  };
}

export function cityAvailabilityLabel(city: Pick<City, 'status'>): string {
  switch (city.status) {
    case 'active': return 'Check coverage';
    case 'coming_soon': return 'Coming soon';
    case 'waitlist': return 'Join waitlist';
  }
}
