
/**
 * src/lib/api/settings-map.ts
 *
 * Maps public.settings JSONB rows → frontend settings payload.
 *
 * Supports:
 * - Existing application settings
 * - Water pricing settings
 * - Dynamic service_base_prices
 * - JSONB values returned by Supabase
 * - JSON-string values from legacy settings storage
 * - Unknown future settings without silently discarding them
 *
 * IMPORTANT:
 * This mapper only normalizes values. Server-side pricing validation
 * and order-price calculation must also use the same authoritative settings.
 */

export type ServiceBasePrices = Record<string, number>;

export type SettingsPayload = {
  // Existing pricing settings
  platform_fee_pct?: number;
  min_order_amount?: number;
  max_order_amount?: number;
  technician_base_pay?: number;
  commission_default_pct?: number;
  delivery_radius_km?: number;

  // Water pricing
  default_can_price?: number;
  chilled_can_price?: number;
  subscription_can_price?: number;
  bulk_can_price?: number;
  bulk_threshold?: number;
  market_can_price?: number;
  convenience_fee?: number;
  emergency_surcharge?: number;
  gst_rate?: number;
  platform_fee?: number;

  // Commission settings
  bulk_commission?: number;
  technician_commission?: number;
  technician_commission_rate?: number;
  supplier_commission?: number;
  supplier_commission_rate?: number;

  // Dynamic service pricing
  service_base_prices?: ServiceBasePrices;

  // Features
  cod_enabled?: boolean;
  razorpay_enabled?: boolean;
  maintenance_mode?: boolean;
  auto_assign_orders?: boolean;
  whatsapp_enabled?: boolean;

  // App information
  app_name?: string;
  app_tagline?: string;
  brand_name?: string;
  support_email?: string;
  secondary_email?: string | null;
  support_phone?: string;
  phone_primary?: string;
  phone_secondary?: string | null;
  office_address?: string;
  working_hours?: string;

  // Geographic settings
  service_cities?: string[];
  service_radius_km?: number;

  // Other settings
  founding_member_limit?: number;
  max_cans_per_order?: number;

  // Future settings
  [key: string]: unknown;
};

/** Safely parse a JSON string when possible. */
function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

/** Safely coerce a value to a finite number. */
function toNumber(value: unknown): number | undefined {
  const parsed = parseJsonIfString(value);

  if (
    parsed === null ||
    parsed === undefined ||
    (typeof parsed === 'string' && parsed.trim() === '')
  ) {
    return undefined;
  }

  if (typeof parsed !== 'number' && typeof parsed !== 'string') {
    return undefined;
  }

  const result = Number(parsed);
  return Number.isFinite(result) ? result : undefined;
}

/** Safely coerce a value to a boolean. */
function toBoolean(value: unknown): boolean {
  const parsed = parseJsonIfString(value);

  if (typeof parsed === 'boolean') return parsed;
  if (typeof parsed === 'number') return parsed === 1;

  if (typeof parsed === 'string') {
    const normalized = parsed.trim().toLowerCase();

    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
  }

  return false;
}

/** Safely coerce a value to a string. */
function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Parse dynamic service pricing.
 *
 * Accepts either an already-parsed JSON object or a JSON string:
 * {
 *   "plumbing": 149,
 *   "ro_service": 349,
 *   "borewell": 499
 * }
 *
 * Invalid entries are ignored instead of being exposed as valid prices.
 */
function toServiceBasePrices(value: unknown): ServiceBasePrices | undefined {
  const parsed = parseJsonIfString(value);

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    return undefined;
  }

  const result: ServiceBasePrices = {};

  for (const [key, rawPrice] of Object.entries(parsed)) {
    const normalizedKey = key.trim();

    if (!normalizedKey) continue;

    const price = toNumber(rawPrice);

    // A malformed or negative price must not become a usable price.
    if (price === undefined || price < 0) continue;

    result[normalizedKey] = price;
  }

  return result;
}

const NUMBER_SETTING_KEYS = new Set<string>([
  'platform_fee_pct',
  'min_order_amount',
  'max_order_amount',
  'technician_base_pay',
  'commission_default_pct',
  'delivery_radius_km',

  'default_can_price',
  'normal_can_price',
  'chilled_can_price',
  'subscription_can_price',
  'bulk_can_price',
  'bulk_threshold',
  'market_can_price',
  'convenience_fee',
  'emergency_surcharge',
  'gst_rate',
  'platform_fee',

  'bulk_commission',
  'technician_commission',
  'technician_commission_rate',
  'supplier_commission',
  'supplier_commission_rate',

  'founding_member_limit',
  'service_radius_km',
  'max_cans_per_order',
]);

const BOOLEAN_SETTING_KEYS = new Set<string>([
  'cod_enabled',
  'razorpay_enabled',
  'maintenance_mode',
  'auto_assign_orders',
  'whatsapp_enabled',
]);

const STRING_SETTING_KEYS = new Set<string>([
  'app_name',
  'app_tagline',
  'brand_name',
  'support_email',
  'secondary_email',
  'support_phone',
  'phone_primary',
  'phone_secondary',
  'office_address',
  'working_hours',
]);

/**
 * Convert settings rows into the frontend payload.
 *
 * Supports JSONB values and legacy string values.
 * Later rows for a duplicate key take precedence, matching the previous
 * Object.fromEntries behavior.
 */
export function rowsToSettingsPayload(
  rows: { key: string; value: unknown }[] | null | undefined
): SettingsPayload {
  if (!rows?.length) return {};

  const out: SettingsPayload = {};

  for (const { key, value } of rows) {
    switch (key) {
      case 'service_base_prices': {
        const prices = toServiceBasePrices(value);

        if (prices !== undefined) {
          out.service_base_prices = prices;
        }

        break;
      }

      case 'service_cities': {
        const parsed = parseJsonIfString(value);

        if (Array.isArray(parsed)) {
          out.service_cities = parsed.filter(
            (city): city is string => typeof city === 'string'
          );
        } else {
          out.service_cities = [];
        }

        break;
      }

      default: {
        if (NUMBER_SETTING_KEYS.has(key)) {
          const number = toNumber(value);

          if (number !== undefined) {
            out[key] = number;
          }

          break;
        }

        if (BOOLEAN_SETTING_KEYS.has(key)) {
          out[key] = toBoolean(value);
          break;
        }

        if (STRING_SETTING_KEYS.has(key)) {
          if (key === 'secondary_email' || key === 'phone_secondary') {
            out[key] = value === null || value === undefined || value === ''
              ? null
              : toStr(value);
          } else {
            out[key] = toStr(value);
          }

          break;
        }

        // Preserve unknown future keys. Parse valid JSON strings when possible.
        out[key] = parseJsonIfString(value);
        break;
      }
    }
  }

  return out;
}
