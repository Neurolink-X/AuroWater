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

// City availability is database-managed. Never maintain a static active-city list here.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCityUuid(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id));
}
