/**
 * Safe public projection of operational service zones.
 *
 * This module is deliberately independent of Next.js and database clients.
 * It can be tested without credentials and reused by server components.
 * City discovery is NOT the same as confirming that an address is serviceable.
 */
export type ZoneStatus =
  | 'AVAILABLE'
  | 'LIMITED'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'COMING_SOON';

export type PublicCityStatus = 'available' | 'limited' | 'coming-soon';

export interface ZoneRecord {
  city: unknown;
  status: unknown;
  id?: unknown;
  name?: unknown;
}

export interface PublicCity {
  name: string;
  status: PublicCityStatus;
  zoneCount: number;
  availableZones: number;
  limitedZones: number;
}

const STATUS_RANK: Record<ZoneStatus, number> = {
  AVAILABLE: 3,
  LIMITED: 2,
  TEMPORARILY_UNAVAILABLE: 1,
  COMING_SOON: 0,
};

export function normalizeCityName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > 100) return null;
  // Reject markup, control characters and dangerous separators.
  if (/[<>\u0000-\u001F\u007F]/.test(cleaned)) return null;
  return cleaned;
}

export function normalizeZoneStatus(value: unknown): ZoneStatus | null {
  if (typeof value !== 'string') return null;
  const status = value.trim().toUpperCase();
  if (Object.hasOwn(STATUS_RANK, status)) return status as ZoneStatus;
  return null;
}

export function cityKey(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-IN');
}

export function publicCityStatus(status: ZoneStatus): PublicCityStatus {
  if (status === 'AVAILABLE') return 'available';
  if (status === 'LIMITED') return 'limited';
  return 'coming-soon';
}

export function summarizePublicCities(
  records: readonly ZoneRecord[],
  limit = 100,
): PublicCity[] {
  type Accumulator = {
    name: string;
    rank: number;
    zoneCount: number;
    availableZones: number;
    limitedZones: number;
  };
  const groups = new Map<string, Accumulator>();
  for (const record of records) {
    const name = normalizeCityName(record.city);
    const status = normalizeZoneStatus(record.status);
    if (!name || !status) continue;
    const key = cityKey(name);
    const existing = groups.get(key) ?? {
      name,
      rank: -1,
      zoneCount: 0,
      availableZones: 0,
      limitedZones: 0,
    };
    existing.rank = Math.max(existing.rank, STATUS_RANK[status]);
    existing.zoneCount += 1;
    if (status === 'AVAILABLE') existing.availableZones += 1;
    if (status === 'LIMITED') existing.limitedZones += 1;
    groups.set(key, existing);
  }
  return [...groups.values()]
    .map((group): PublicCity => ({
      name: group.name,
      status: group.rank === 3
        ? 'available'
        : group.rank === 2
          ? 'limited'
          : 'coming-soon',
      zoneCount: group.zoneCount,
      availableZones: group.availableZones,
      limitedZones: group.limitedZones,
    }))
    .sort((a, b) => {
      const priority = { available: 0, limited: 1, 'coming-soon': 2 };
      const statusOrder = priority[a.status] - priority[b.status];
      return statusOrder || a.name.localeCompare(b.name, 'en-IN');
    })
    .slice(0, Math.max(0, Math.min(limit, 1000)));
}

export function isPublicCityStatus(value: unknown): value is PublicCityStatus {
  return value === 'available' || value === 'limited' || value === 'coming-soon';
}

export function sanitizePublicCities(value: unknown): PublicCity[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry): PublicCity[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const name = normalizeCityName(row.name);
    if (!name || !isPublicCityStatus(row.status)) return [];
    return [{
      name,
      status: row.status,
      zoneCount: boundedCount(row.zoneCount),
      availableZones: boundedCount(row.availableZones),
      limitedZones: boundedCount(row.limitedZones),
    }];
  });
}

function boundedCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10000, Math.floor(value)));
}

export function cityAvailabilityLabel(city: Pick<PublicCity, 'status'>): string {
  if (city.status === 'available') return 'Service area';
  if (city.status === 'limited') return 'Limited coverage';
  return 'Coming soon';
}

export function cityAvailabilityDescription(city: PublicCity): string {
  switch (city.status) {
    case 'available':
      return 'Service operates in selected areas. Confirm availability using your address.';
    case 'limited':
      return 'Only selected PIN codes and services may be available.';
    case 'coming-soon':
      return 'Not currently open for bookings. Check again for launch updates.';
  }
}
