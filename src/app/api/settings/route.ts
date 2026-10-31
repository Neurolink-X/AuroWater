import { resolveEffectivePriceBook, validateEffectivePriceBook } from '@/lib/pricing/resolve-effective';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import { isSupabaseConfigured } from '@/lib/db/supabase';
import { successResponse } from '@/lib/utils/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE = {
  'Cache-Control': 'private, no-store, max-age=0',
};


function defaultPayload(): Record<string, unknown> {
  return {
    default_can_price: 20,
    chilled_can_price: 25,
    subscription_can_price: 20,
    bulk_can_price: 20,
    bulk_threshold: 50,
    market_can_price: 20,
    convenience_fee: 0,
    emergency_surcharge: 0,
    surge_charge: 0,
    gst_rate: 0,
    service_base_prices: { water_tanker: 299, ro_service: 349, plumbing: 149, plumbing_mistri: 700, borewell: 499, borewell_drilling_4_5: 100, borewell_drilling_6: 180, borewell_drilling_6_5: 180, borewell_drilling_8: 350, motor_pump: 299, tank_cleaning: 599, ro_service_filter_change: 49, ro_service_amc: 149, ro_service_new_installation: 599, plumbing_drainage: 49, plumbing_new_fitting: 99, water_tanker_1000: 50, water_tanker_2000: 120, water_tanker_custom: 80 },
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
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Pricing configuration unavailable.' }, { status: 503, headers: CACHE });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ success: false, error: 'Pricing credentials unavailable.' }, { status: 503, headers: CACHE });
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
      console.error('[settings] authoritative settings unavailable', { code: error.code });
      return NextResponse.json({ success: false, error: 'Live settings temporarily unavailable.' }, { status: 503, headers: CACHE });
    }

    const payload: Record<string, unknown> = {
      ...defaultPayload(),
      ...rowsToSettingsPayload(data),
    };

    // Public prices follow the same effective immutable version as server checkout.
    // Fail closed if the authoritative version table is unavailable.
    const { data: activeVersion, error: versionError } = await supabase
      .from('pricing_versions')
      .select('version, effective_from, config')
      .lte('effective_from', new Date().toISOString())
      .order('effective_from', { ascending: false })
      .order('version', { ascending: false })
      .limit(1)
      .abortSignal(controller.signal)
      .maybeSingle();

    if (versionError) {
      console.error('[settings] active pricing lookup failed', { code: versionError.code });
      return NextResponse.json({ success: false, error: 'Live pricing temporarily unavailable.' }, { status: 503, headers: CACHE });
    }
    if (!activeVersion?.config || typeof activeVersion.config !== 'object') {
      return NextResponse.json({ success: false, error: 'No active published pricing version.' }, { status: 503, headers: CACHE });
    }
    if (activeVersion?.config && typeof activeVersion.config === 'object') {
      const config = resolveEffectivePriceBook(activeVersion.config, req.nextUrl.searchParams.get('city'));
      if (!config || validateEffectivePriceBook(config).length) {
        return NextResponse.json({ success: false, error: 'Published pricing configuration invalid.' }, { status: 503, headers: CACHE });
      }
      const servicePrices = config.services;
      payload.pricing_version = activeVersion.version;
      payload.pricing_effective_from = activeVersion.effective_from;
      if (typeof config.water_normal === 'number') payload.default_can_price = config.water_normal;
      if (typeof config.water_chilled === 'number') payload.chilled_can_price = config.water_chilled;
      if (typeof config.water_subscription === 'number') payload.subscription_can_price = config.water_subscription;
      if (typeof config.bulk_can_price === 'number') payload.bulk_can_price = config.bulk_can_price;
      if (typeof config.bulk_threshold === 'number') payload.bulk_threshold = config.bulk_threshold;
      if (typeof config.convenience_fee === 'number') payload.convenience_fee = config.convenience_fee;
      if (typeof config.delivery_fee === 'number') payload.delivery_fee = config.delivery_fee;
      if (typeof config.surge_charge === 'number') payload.surge_charge = config.surge_charge;
      if (typeof config.emergency_surcharge === 'number') payload.emergency_surcharge = config.emergency_surcharge;
      if (typeof config.gst_rate === 'number') payload.gst_rate = config.gst_rate;
      payload.service_base_prices = servicePrices;
      payload.pricing_city_key = config.city_key;
    }
    return ok(payload);
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      console.warn('[settings] authoritative pricing lookup timed out');
    }
    return NextResponse.json({ success: false, error: 'Live settings temporarily unavailable.' }, { status: 503, headers: CACHE });
  } finally {
    clearTimeout(timeout);
  }
}
