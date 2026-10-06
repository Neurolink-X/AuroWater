import { createAnonClient } from '@/utils/supabase/server';

export type PublicService = {
  key: string;
  name: string;
  description: string;
  base_price: number;
  unit: string;
};

export type PublicPricing = {
  default_can_price: number;
  subscription_can_price: number;
  bulk_can_price: number;
  bulk_threshold: number;
  market_can_price: number;
  convenience_fee: number;
  emergency_surcharge: number;
  gst_rate: number;
};

const SERVICE_FALLBACKS: PublicService[] = [
  { key: 'water_can', name: 'Water Can (20L)', description: 'RO-purified 20L drinking-water cans.', base_price: 12, unit: 'per can' },
  { key: 'water_tanker', name: 'Water Tanker', description: 'Bulk water delivery for larger requirements.', base_price: 299, unit: 'per delivery' },
  { key: 'ro_service', name: 'RO Service & Repair', description: 'RO purifier servicing, repair and filter support.', base_price: 199, unit: 'per visit' },
  { key: 'plumbing', name: 'Plumbing', description: 'Leakage repair, fitting, drainage and installation support.', base_price: 149, unit: 'per visit' },
  { key: 'borewell', name: 'Borewell Services', description: 'Borewell drilling, repair and related water-source work.', base_price: 499, unit: 'per service' },
  { key: 'motor_pump', name: 'Motor & Pump Repair', description: 'Pump, motor and submersible service support.', base_price: 249, unit: 'per visit' },
  { key: 'tank_cleaning', name: 'Water Tank Cleaning', description: 'Overhead and underground tank cleaning.', base_price: 349, unit: 'per tank' },
];

const FALLBACK_PRICING: PublicPricing = {
  default_can_price: 12,
  subscription_can_price: 10,
  bulk_can_price: 9,
  bulk_threshold: 50,
  market_can_price: 20,
  convenience_fee: 29,
  emergency_surcharge: 199,
  gst_rate: 0.18,
};

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rate(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n > 1 ? n / 100 : n;
}

export async function getPublicCatalog(): Promise<{
  services: PublicService[];
  pricing: PublicPricing;
}> {
  try {
    const db = createAnonClient();

    const [{ data: serviceRows }, { data: settingRows }] = await Promise.all([
      db
        .from('service_types')
        .select('key, name, description, base_price, unit')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      db
        .from('settings')
        .select('key, value')
        .in('key', [
          'default_can_price',
          'subscription_can_price',
          'bulk_can_price',
          'bulk_threshold',
          'market_can_price',
          'convenience_fee',
          'emergency_surcharge',
          'gst_rate',
        ]),
    ]);

    const services =
      (serviceRows ?? []).map((row) => ({
        key: String(row.key),
        name: String(row.name),
        description: String(row.description ?? ''),
        base_price: num(row.base_price, 0),
        unit: String(row.unit ?? 'per visit'),
      })) as PublicService[];

    const map: Record<string, unknown> = {};
    for (const row of settingRows ?? []) map[String(row.key)] = row.value;

    return {
      services: services.length ? services : SERVICE_FALLBACKS,
      pricing: {
        default_can_price: num(map.default_can_price, FALLBACK_PRICING.default_can_price),
        subscription_can_price: num(map.subscription_can_price, FALLBACK_PRICING.subscription_can_price),
        bulk_can_price: num(map.bulk_can_price, FALLBACK_PRICING.bulk_can_price),
        bulk_threshold: num(map.bulk_threshold, FALLBACK_PRICING.bulk_threshold),
        market_can_price: num(map.market_can_price, FALLBACK_PRICING.market_can_price),
        convenience_fee: num(map.convenience_fee, FALLBACK_PRICING.convenience_fee),
        emergency_surcharge: num(map.emergency_surcharge, FALLBACK_PRICING.emergency_surcharge),
        gst_rate: rate(map.gst_rate, FALLBACK_PRICING.gst_rate),
      },
    };
  } catch (error) {
    console.error('[public-catalog] failed to load catalog', error);
    return { services: SERVICE_FALLBACKS, pricing: FALLBACK_PRICING };
  }
}

export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}
