import { query, queryOne } from '@/lib/db/connection';
import { PricingRule, PricingResponse } from '@/types';
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

export async function calculatePrice(params: PricingParams): Promise<PricingResponse> {
  const {
    service_type_id,
    zone_id,
    quantity = 500,
    customer_lat,
    customer_lng,
    zone_base_lat = 28.7041,
    zone_base_lng = 77.1025,
    is_emergency = false,
  } = params;

  // Get pricing rule
  let pricingRule = await queryOne<PricingRule>(
    `SELECT * FROM pricing_rules 
     WHERE service_type_id = $1 AND zone_id = $2 AND is_active = true`,
    [service_type_id, zone_id || null]
  );

  // Fallback to service base price if no rule found
  if (!pricingRule) {
    const serviceType = await queryOne<any>(
      'SELECT base_price FROM service_types WHERE id = $1 AND is_active = true',
      [service_type_id]
    );

    if (!serviceType) {
      throw new Error('Service type not found');
    }

    pricingRule = {
      id: 0,
      service_type_id,
      zone_id: zone_id,
      base_price: serviceType.base_price,
      distance_multiplier: 1.0,
      tax_percentage: 0,
      min_order_value: 0,
      emergency_charge: 0,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  // Calculate distance charge
  const distance = calculateDistance(customer_lat, customer_lng, zone_base_lat, zone_base_lng);
  const distance_factor = Math.max(1, 1 + distance * 0.1); // 10% increase per km
  const distanceCharge = pricingRule.base_price * (distance_factor - 1);

  // Calculate base price (for water, it's quantity-based)
  const base_price = (pricingRule.base_price / 500) * quantity; // ₹1 per liter

  // Subtotal before tax and charges
  const subtotal = base_price;

  // Tax calculation
  const tax_amount = (subtotal * pricingRule.tax_percentage) / 100;

  // Emergency charge
  const emergency_charge = is_emergency ? pricingRule.emergency_charge : 0;

  // Total
  const total_amount = subtotal + distanceCharge + tax_amount + emergency_charge;

  // Ensure minimum order value
  const final_total = Math.max(total_amount, pricingRule.min_order_value);

  return {
    base_price,
    distance_factor,
    distance_charge: distanceCharge,
    tax_percentage: pricingRule.tax_percentage,
    subtotal,
    tax_amount,
    emergency_charge,
    total_amount: final_total,
  };
}

export async function setupDefaultPricing(): Promise<void> {
  try {
    // Create default service types if not exist
    const serviceTypes = [
      { name: 'WATER_SUPPLY', description: 'Water delivery service', base_price: 500 },
      {
        name: 'SUBMERSIBLE_INSTALLATION',
        description: 'Submersible pump installation',
        base_price: 5000,
      },
      { name: 'REPAIR_MAINTENANCE', description: 'Repair and maintenance', base_price: 2000 },
    ];

    for (const service of serviceTypes) {
      await query(
        `INSERT INTO service_types (name, description, base_price) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO NOTHING`,
        [service.name, service.description, service.base_price]
      );
    }

    // Create default zones if not exist
    const zones = [
      { name: 'Delhi', city: 'Delhi', distance_factor: 1.0 },
      { name: 'Gurgaon', city: 'Gurgaon', distance_factor: 1.2 },
      { name: 'Noida', city: 'Noida', distance_factor: 1.1 },
    ];

    for (const zone of zones) {
      await query(
        `INSERT INTO zones (name, city, distance_factor) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO NOTHING`,
        [zone.name, zone.city, zone.distance_factor]
      );
    }

    console.log('Default pricing setup completed');
  } catch (error) {
    console.error('Error setting up default pricing:', error);
  }
}
