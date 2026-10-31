import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import { isSupabaseConfigured } from '@/lib/db/supabase';
import { successResponse } from '@/lib/utils/helpers';

export const revalidate = 60;

const CACHE = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
};

function normalizePricingCity(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase();
  const aliases: Array<[string, string]> = [['gurgaon','gurugram'],['ghaziabad','ghaziabad'],['gorakhpur','gorakhpur'],['kanpur','kanpur'],['lucknow','lucknow'],['noida','noida'],['delhi','delhi'],['gurugram','gurugram']];
  const match = aliases.find(([prefix]) => raw === prefix || raw.startsWith(prefix + ' ') || raw.startsWith(prefix + '-') || raw.startsWith(prefix + ','));
  return (match?.[1] ?? raw).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

    const payload: Record<string, unknown> = {
      ...defaultPayload(),
      ...rowsToSettingsPayload(data),
    };

    // Public prices follow the same effective immutable version as server checkout.
    // The legacy settings payload remains the fallback until migration 021 is applied.
    const { data: activeVersion, error: versionError } = await supabase
      .from('pricing_versions')
      .select('version, effective_from, config')
      .lte('effective_from', new Date().toISOString())
      .order('effective_from', { ascending: false })
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!versionError && activeVersion?.config && typeof activeVersion.config === 'object') {
      const publishedConfig = activeVersion.config as Record<string, unknown>;
      const requestedCity = req.nextUrl.searchParams.get('city');
      const cityKey = normalizePricingCity(requestedCity);
      const cityOverrides = publishedConfig.city_overrides && typeof publishedConfig.city_overrides === 'object'
        ? publishedConfig.city_overrides as Record<string, unknown> : {};
      const cityOverride = cityKey && cityOverrides[cityKey] && typeof cityOverrides[cityKey] === 'object'
        ? cityOverrides[cityKey] as Record<string, unknown> : null;
      const config = { ...publishedConfig, ...(cityOverride ?? {}) };
      const servicePrices = config.services && typeof config.services === 'object'
        ? config.services as Record<string, number>
        : {};
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
      if (Object.keys(servicePrices).length) payload.service_base_prices = servicePrices;
    }
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
