import 'server-only';
import { cache } from 'react';
import { createServiceClient } from '@/utils/supabase/server';
import type { City } from '@/lib/cities';
import { mergePublicCityDirectory } from '@/lib/public-city-directory';

/**
 * Public directory read, shared by server-rendered service-area and water
 * delivery pages. It follows the same admin-managed cities.status values as
 * /api/cities. For booking, always validate exact address/service in checkout.
 *
 * Share a read within one server render, including metadata and page content.
 * Each new request reads current admin state. A slow directory has a bounded wait.
 */
export const getPublicServiceCities = cache(async (): Promise<City[]> => {
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from('cities')
      .select('id,name,slug,status,is_featured,sort_order')
      .order('sort_order', { ascending: true })
      .limit(500)
      .abortSignal(AbortSignal.timeout(5_000));
    if (error) {
      console.error('[public-city-directory] failed to read cities', { code: error.code });
      return mergePublicCityDirectory([], []);
    }
    return mergePublicCityDirectory(data ?? [], []);
  } catch {
    return mergePublicCityDirectory([], []);
  }
});
