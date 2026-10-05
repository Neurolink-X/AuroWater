import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { FALLBACK_CITIES } from '@/lib/cities';
import { isSupabaseConfigured } from '@/lib/db/supabase';

export const revalidate = 300;

const CACHE_HEADERS = {
  'Cache-Control':
    'public, s-maxage=300, stale-while-revalidate=600',
};

const CITY_SELECT =
  'id, name, slug, status, lat, lng, radius_km, is_featured, sort_order';

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

    if (
      error ||
      !data ||
      data.length === 0
    ) {
      return ok(
        FALLBACK_CITIES,
      );
    }

    return ok(data);
  } catch {
    /*
     * Public city discovery should remain
     * available even if Supabase is temporarily
     * unavailable.
     */
    return ok(
      FALLBACK_CITIES,
    );
  } finally {
    clearTimeout(timeout);
  }
}
