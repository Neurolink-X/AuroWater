/**
 * src/lib/services/pricing.service.ts: overwrite the file where your DB-backed calculatePrice lives (same exports/signatures).
 * Fixes: see comments tagged FIX. Everything else behaves as before.
 */
import { query, queryOne } from '@/lib/db/connection';
import { PricingRule, PricingResponse, ServiceType } from '@/types';
import { calculateDistance } from '@/lib/utils/helpers';

interface PricingParams {
  service_type_id: number;
  zone_id?: number;
  quantity?: number;
  customer_lat: number;
  customer_lng: number;
  zone_base_lat?: number;
  zone_base_lng?: number;
  is_emergency?: boolean;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Optional cap on the distance surcharge, as a % of the base price. Unset = no cap (old behaviour).
const capEnv = Number(process.env.PRICING_MAX_DISTANCE_SURCHARGE_PCT);
const MAX_SURCHARGE_PCT = Number.isFinite(capEnv) && capEnv > 0 ? capEnv : Infinity;

export async function calculatePrice(params: PricingParams): Promise<PricingResponse> {
  const {
    service_type_id, zone_id, customer_lat, customer_lng,
    zone_base_lat, zone_base_lng, is_emergency = false,
  } = params;
  const quantity = Number.isFinite(params.quantity) && (params.quantity as number) > 0 ? (params.quantity as number) : 500; // FIX: reject 0/NaN/negative

  // FIX: `zone_id = NULL` never matches in SQL. Prefer the zone rule, else fall back to a global (NULL-zone) rule.
  let pricingRule = await queryOne<PricingRule>(
    `SELECT * FROM pricing_rules
     WHERE service_type_id = $1 AND is_active = true
       AND (zone_id = $2 OR zone_id IS NULL)
     ORDER BY zone_id IS NULL ASC
     LIMIT 1`,
    [service_type_id, zone_id ?? null]
  );

  if (!pricingRule) {
    const serviceType = await queryOne<Pick<ServiceType, 'base_price'>>(
      'SELECT base_price FROM service_types WHERE id = $1 AND is_active = true',
      [service_type_id]
    );
    if (!serviceType) throw new Error('Service type not found');
    pricingRule = {
      id: 0, service_type_id, zone_id, base_price: serviceType.base_price,
      distance_multiplier: 1.0, tax_percentage: 0, min_order_value: 0, emergency_charge: 0,
      is_active: true, created_at: new Date(), updated_at: new Date(),
    };
  }

  // Quantity-based base price (₹ per unit = base_price / 500)
  const base_price = round2((pricingRule.base_price / 500) * quantity);

  // FIX 1: the old code defaulted the zone base to Delhi, so a Kanpur/Lucknow/Gorakhpur customer
  //        was "~400 km away" and charged up to 40x. No zone base coords now = no distance surcharge.
  // FIX 2: surcharge is calculated on the quantity-scaled base, not the 500-unit price.
  let distance_factor = 1;
  let distanceCharge = 0;
  if (Number.isFinite(zone_base_lat) && Number.isFinite(zone_base_lng)) {
    const distance = calculateDistance(customer_lat, customer_lng, zone_base_lat as number, zone_base_lng as number);
    distance_factor = Math.max(1, 1 + distance * 0.1); // 10% per km (unchanged)
    distanceCharge = base_price * (distance_factor - 1);
    distanceCharge = Math.min(distanceCharge, base_price * (MAX_SURCHARGE_PCT / 100));
    distance_factor = base_price > 0 ? 1 + distanceCharge / base_price : 1;
  }
  distanceCharge = round2(distanceCharge);

  const subtotal = base_price;
  const tax_amount = round2((subtotal * pricingRule.tax_percentage) / 100);
  const emergency_charge = is_emergency ? round2(pricingRule.emergency_charge) : 0;
  const total_amount = round2(Math.max(subtotal + distanceCharge + tax_amount + emergency_charge, pricingRule.min_order_value));

  return {
    base_price, distance_factor, distance_charge: distanceCharge,
    tax_percentage: pricingRule.tax_percentage, subtotal, tax_amount, emergency_charge, total_amount,
  };
}

export async function setupDefaultPricing(): Promise<void> {
  try {
    const serviceTypes = [
      { name: 'WATER_SUPPLY', description: 'Water delivery service', base_price: 500 },
      { name: 'SUBMERSIBLE_INSTALLATION', description: 'Submersible pump installation', base_price: 5000 },
      { name: 'REPAIR_MAINTENANCE', description: 'Repair and maintenance', base_price: 2000 },
    ];
    for (const s of serviceTypes) {
      await query(
        `INSERT INTO service_types (name, description, base_price) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING`,
        [s.name, s.description, s.base_price]
      );
    }
    // Existing zones kept; the three live cities were missing.
    const zones = [
      { name: 'Delhi', city: 'Delhi', distance_factor: 1.0 },
      { name: 'Gurgaon', city: 'Gurgaon', distance_factor: 1.2 },
      { name: 'Noida', city: 'Noida', distance_factor: 1.1 },
      { name: 'Kanpur', city: 'Kanpur', distance_factor: 1.0 },
      { name: 'Lucknow', city: 'Lucknow', distance_factor: 1.0 },
      { name: 'Gorakhpur', city: 'Gorakhpur', distance_factor: 1.0 },
      { name: 'Agra', city: 'Agra', distance_factor: 1.0 },
    ];
    for (const z of zones) {
      await query(
        `INSERT INTO zones (name, city, distance_factor) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING`,
        [z.name, z.city, z.distance_factor]
      );
    }
  } catch (error) {
    console.error('Error setting up default pricing:', error);
  }
}
