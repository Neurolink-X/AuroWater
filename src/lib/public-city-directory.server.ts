import 'server-only';
import { createServiceClient } from '@/utils/supabase/server';
import { FALLBACK_CITIES, type City } from '@/lib/cities';
import { mergePublicCityDirectory } from '@/lib/public-city-directory';

/**
 * Public directory read, shared by server-rendered service-area and water
 * delivery pages. It follows the same admin-managed cities.status values as
 * /api/cities. For booking, always validate exact address/service in checkout.
 *
 * No caching here: the public page can opt in to Next.js caching independently.
 * This avoids stale activation state after an admin changes city status.
 */
export async function getPublicServiceCities(): Promise<City[]> {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('cities')
      .select('id,name,slug,status,is_featured,sort_order')
      .order('sort_order', { ascending: true })
      .limit(500);
    if (error) {
      console.error('[public-city-directory] failed to read cities', { code: error.code });
      return mergePublicCityDirectory([], FALLBACK_CITIES);
    }
    return mergePublicCityDirectory(data ?? [], FALLBACK_CITIES);
  } catch {
    return mergePublicCityDirectory([], FALLBACK_CITIES);
  }
}
