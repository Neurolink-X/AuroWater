export type CityStatus = 'active' | 'coming_soon' | 'waitlist';

export type City = {
  id: string;
  name: string;
  slug: string;
  status: CityStatus;
  lat?: number;
  lng?: number;
  radius_km?: number;
  is_featured: boolean;
  sort_order?: number;
};

export const FALLBACK_CITIES: City[] = [
  { id: 'gorakhpur', name: 'Gorakhpur', slug: 'gorakhpur', status: 'active', is_featured: true, sort_order: 1 },
  { id: 'kanpur', name: 'Kanpur', slug: 'kanpur', status: 'active', is_featured: true, sort_order: 2 },
  { id: 'lucknow', name: 'Lucknow', slug: 'lucknow', status: 'active', is_featured: true, sort_order: 3 },
  { id: 'varanasi', name: 'Varanasi', slug: 'varanasi', status: 'coming_soon', is_featured: true, sort_order: 5 },
  { id: 'agra', name: 'Agra', slug: 'agra', status: 'coming_soon', is_featured: false, sort_order: 6 },
  { id: 'prayagraj', name: 'Prayagraj', slug: 'prayagraj', status: 'waitlist', is_featured: false, sort_order: 7 },
  { id: 'meerut', name: 'Meerut', slug: 'meerut', status: 'waitlist', is_featured: false, sort_order: 8 },
  { id: 'mathura', name: 'Mathura', slug: 'mathura', status: 'waitlist', is_featured: false, sort_order: 9 },
  { id: 'bareilly', name: 'Bareilly', slug: 'bareilly', status: 'waitlist', is_featured: false, sort_order: 10 },
  { id: 'aligarh', name: 'Aligarh', slug: 'aligarh', status: 'waitlist', is_featured: false, sort_order: 11 },
  // Visible for expansion discovery; these cities remain non-bookable until operations enable them.
  { id: 'delhi', name: 'Delhi', slug: 'delhi', status: 'coming_soon', is_featured: false, sort_order: 11 },
  // Noida is a restricted Sector 73 pilot; order APIs still enforce the exact service zone.
  { id: 'noida', name: 'Noida', slug: 'noida', status: 'active', is_featured: true, sort_order: 4 },
];

export const ACTIVE_CITY_NAMES = FALLBACK_CITIES.filter((c) => c.status === 'active').map((c) => c.name);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCityUuid(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id));
}
