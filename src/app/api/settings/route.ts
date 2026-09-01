import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import { isSupabaseConfigured } from '@/lib/db/supabase';
import { successResponse } from '@/lib/utils/helpers';

export const revalidate = 60;

const CACHE = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
};

function defaultPayload(): Record<string, unknown> {
  return {
    default_can_price: 12,
    subscription_can_price: 10,
    can_price_small: 1000,
    can_price_large: 1200,
    delivery_fee: 0,
    free_delivery_threshold: 0,
    subscription_discount_percent: 10,
    city_gorakhpur: true,
    city_kanpur: true,
    city_lucknow: true,
    maintenance_mode: false,
  };
}

function ok(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(successResponse(data), { status, headers: CACHE });
}

/**
 * Public settings. Never 502, never wait more than 5s.
 * `settings` is a key/value table — do not use `.single()`.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return ok(defaultPayload());
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return ok(defaultPayload());
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .abortSignal(controller.signal);

    if (error) {
      return ok(defaultPayload());
    }

    const payload = {
      ...defaultPayload(),
      ...rowsToSettingsPayload(data),
    };
    return ok(payload);
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      /* timed out — serve defaults */
    }
    return ok(defaultPayload());
  } finally {
    clearTimeout(timeout);
  }
}
