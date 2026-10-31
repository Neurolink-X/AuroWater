import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { FALLBACK_CITIES, type City } from '@/lib/cities';
import { isSupabaseConfigured } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control':
    'no-store, max-age=0',
};

const CITY_SELECT =
  'id, name, slug, status, lat, lng, radius_km, is_featured, sort_order';

/** Keep the database as the source of truth, but retain fallback cities missing from it.
 * This makes expansion cities discoverable during partial DB configuration/outages without
 * upgrading their fallback status to bookable.
 */
function mergeWithFallback(data: City[]): City[] {
  const merged = new Map<string, City>();
  for (const city of data) {
    if (!city || typeof city.name !== 'string' || !['active', 'coming_soon', 'waitlist'].includes(city.status)) continue;
    const key = String(city.slug || city.name).trim().toLowerCase();
    if (key) {
      // Database status is authoritative. Do not mark Noida active merely
      // because a pilot zone exists; operational supplier readiness is separate.
      merged.set(key, city);
    }
  }
  // Never append fallback active cities to an authoritative DB response.
  // An administrator may have deliberately removed or deactivated a city.
  return [...merged.values()].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
}

function ok(data: unknown) {
  return NextResponse.json(
    data,
    {
      headers: CACHE_HEADERS,
    },
  );
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return ok(FALLBACK_CITIES);
  }

  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  /*
   * Public city data should never require
   * the Supabase service-role key.
   */
  if (!url || !key) {
    return ok(FALLBACK_CITIES);
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      5000,
    );

  try {
    const supabase =
      createClient(
        url,
        key,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    const {
      data,
      error,
    } = await supabase
      .from('cities')
      .select(CITY_SELECT)
      .order(
        'sort_order',
        {
          ascending: true,
        },
      )
      .abortSignal(
        controller.signal,
      );

    if (error || !data) {
      return NextResponse.json({ error: 'Live city directory unavailable' }, { status: 503, headers: CACHE_HEADERS });
    }

    return ok(mergeWithFallback(data as City[]));
  } catch {
    /*
     * Public city discovery should remain
     * available even if Supabase is temporarily
     * unavailable.
     */
    return NextResponse.json({ error: 'Live city directory unavailable' }, { status: 503, headers: CACHE_HEADERS });
  } finally {
    clearTimeout(timeout);
  }
}
